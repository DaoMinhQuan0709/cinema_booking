package com.cinema.booking;

import com.cinema.booking.config.GeminiConfig;
import com.cinema.booking.controller.ChatController;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.exception.GlobalExceptionHandler;
import com.cinema.booking.repository.MovieRepository;
import com.cinema.booking.repository.ProductRepository;
import com.cinema.booking.repository.ShowtimeRepository;
import com.cinema.booking.service.GeminiClientService;
import com.cinema.booking.service.impl.ChatServiceImpl;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises the real HTTP transport against a local provider, without DB or Google access. */
class GeminiClientTests {
    private static final String KEY = "test-key-do-not-log";
    private static final String ANSWER = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Xin chào!\"}]},\"finishReason\":\"STOP\"}]}";
    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;
    private GeminiConfig config;
    private GeminiClientService client;

    @BeforeEach
    void setup() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        config = new GeminiConfig();
        config.setApiUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/v1beta/models");
        config.setApiKey(KEY);
        config.setModel("gemini-test");
        config.setReadTimeoutMs(3000);
        client = new GeminiClientService(config.geminiRestClient(), config, mapper);
        server.start();
    }

    @AfterEach
    void cleanup() {
        if (server != null) server.stop(0);
    }

    @Test
    void sendsKeyOnlyInHeaderAndCollectsTextPartsWithoutThoughts() throws Exception {
        AtomicReference<String> header = new AtomicReference<>();
        AtomicReference<String> path = new AtomicReference<>();
        AtomicReference<String> query = new AtomicReference<>();
        AtomicReference<JsonNode> request = new AtomicReference<>();
        server.createContext("/", exchange -> {
            header.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
            path.set(exchange.getRequestURI().getRawPath());
            query.set(exchange.getRequestURI().getRawQuery());
            request.set(mapper.readTree(exchange.getRequestBody()));
            respond(exchange, 200, """
                    {"candidates":[{"content":{"parts":[
                      {"thought":true,"text":"private reasoning"},
                      {"text":"Xin "},{"text":"chào!"},{"inlineData":{"mimeType":"image/png","data":"unused"}}
                    ]},"finishReason":"STOP"}]}
                    """);
        });
        assertEquals("Xin chào!", client.generateContent("Chỉ trả lời tiếng Việt.", "Xin chào"));
        assertEquals(KEY, header.get());
        assertEquals("/v1beta/models/gemini-test:generateContent", path.get());
        assertNull(query.get());
        assertEquals("Chỉ trả lời tiếng Việt.", request.get().path("systemInstruction").path("parts").get(0).path("text").asText());
        assertEquals("user", request.get().path("contents").get(0).path("role").asText());
        assertFalse(request.get().toString().contains(KEY));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"your-gemini-api-key-here", "${GEMINI_API_KEY}", " key ", "<api-key>", "changeme"})
    void missingOrPlaceholderKeyFailsBeforeAnyProviderRequest(String key) {
        AtomicInteger calls = new AtomicInteger();
        server.createContext("/", exchange -> { calls.incrementAndGet(); respond(exchange, 200, ANSWER); });
        config.setApiKey(key);
        assertEquals(503, assertThrows(AppException.class, () -> client.generateContent("System", "Question")).getCode());
        assertEquals(0, calls.get());
    }

    @Test
    void invalidModelIsRejectedWithoutSendingCredentials() {
        config.setModel("models/gemini-test?key=other");
        assertEquals(503, assertThrows(AppException.class, () -> client.generateContent("System", "Question")).getCode());
    }

    @ParameterizedTest
    @CsvSource({"400,503", "401,503", "403,503", "404,503", "429,429", "500,502", "503,502"})
    void providerErrorsNeverBecomeSuccessfulChatReplies(int providerStatus, int expectedStatus) {
        server.createContext("/", exchange -> respond(exchange, providerStatus, "{\"error\":{\"message\":\"" + KEY + "\"}}"));
        AppException error = assertThrows(AppException.class, () -> client.generateContent("System", "Question"));
        assertEquals(expectedStatus, error.getCode());
        assertFalse(error.getMessage().contains(KEY));
        assertNull(error.getCause(), "Raw provider exception must not escape with credentials/body");
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "not-json", "null", "{}", "{\"candidates\":[]}",
            "{\"candidates\":[{\"content\":{\"parts\":[]}}]}",
            "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"   \"}]}}]}",
            "{\"candidates\":[{\"content\":{\"parts\":[{\"thought\":true,\"text\":\"internal\"}]}}]}"})
    void missingOrMalformedAnswerReturnsBadGateway(String response) {
        server.createContext("/", exchange -> respond(exchange, 200, response));
        assertEquals(502, assertThrows(AppException.class, () -> client.generateContent("System", "Question")).getCode());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}",
            "{\"candidates\":[{\"finishReason\":\"SAFETY\",\"content\":{\"parts\":[{\"text\":\"blocked answer\"}]}}]}"})
    void blockedAnswerAsksUserToRephrase(String response) {
        server.createContext("/", exchange -> respond(exchange, 200, response));
        assertEquals(422, assertThrows(AppException.class, () -> client.generateContent("System", "Question")).getCode());
    }

    @Test
    void redirectsAreNotFollowedWithApiKey() {
        AtomicInteger redirected = new AtomicInteger();
        server.createContext("/v1beta/models", exchange -> {
            exchange.getResponseHeaders().add("Location", "/elsewhere");
            respond(exchange, 302, "");
        });
        server.createContext("/elsewhere", exchange -> { redirected.incrementAndGet(); respond(exchange, 200, ANSWER); });
        assertEquals(502, assertThrows(AppException.class, () -> client.generateContent("System", "Question")).getCode());
        assertEquals(0, redirected.get());
    }

    @Test
    void slowProviderReleasesRequestWithGatewayTimeout() {
        config.setReadTimeoutMs(75);
        client = new GeminiClientService(config.geminiRestClient(), config, mapper);
        server.createContext("/", exchange -> {
            try { Thread.sleep(500); } catch (InterruptedException ex) { Thread.currentThread().interrupt(); }
            try { respond(exchange, 200, ANSWER); } catch (IOException ex) { exchange.close(); }
        });
        assertEquals(504, assertThrows(AppException.class, () -> client.generateContent("System", "Question")).getCode());
    }

    @Test
    void chatEndpointSendsDatabaseContextAndHistoryAndReturnsReply() throws Exception {
        AtomicReference<JsonNode> request = new AtomicReference<>();
        server.createContext("/", exchange -> {
            request.set(mapper.readTree(exchange.getRequestBody()));
            respond(exchange, 200, ANSWER);
        });
        var service = new ChatServiceImpl(mock(MovieRepository.class), mock(ShowtimeRepository.class), mock(ProductRepository.class), client);
        var mvc = MockMvcBuilders.standaloneSetup(new ChatController(service)).setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(post("/api/v1/chat/ask").contentType(MediaType.APPLICATION_JSON).content("""
                {"message":"Còn suất nào không?","conversationHistory":[
                  {"role":"user","text":"Lịch chiếu hôm nay?"},
                  {"role":"model","text":"Rạp đang cập nhật lịch."}
                ]}
                """))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.reply").value("Xin chào!"));
        assertEquals(3, request.get().path("contents").size());
        assertEquals("model", request.get().path("contents").get(1).path("role").asText());
        assertEquals("Còn suất nào không?", request.get().path("contents").get(2).path("parts").get(0).path("text").asText());
        assertTrue(request.get().path("systemInstruction").toString().contains("DU LIEU THOI GIAN THUC"));
    }

    @Test
    void chatEndpointReportsProviderFailureAsHttpError() throws Exception {
        server.createContext("/", exchange -> respond(exchange, 429, "{\"error\":{\"message\":\"quota\"}}"));
        var service = new ChatServiceImpl(mock(MovieRepository.class), mock(ShowtimeRepository.class), mock(ProductRepository.class), client);
        var mvc = MockMvcBuilders.standaloneSetup(new ChatController(service)).setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(post("/api/v1/chat/ask").contentType(MediaType.APPLICATION_JSON).content("{\"message\":\"Xin chào\"}"))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value(429))
                .andExpect(jsonPath("$.data.reply").doesNotExist());
    }

    private void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (var out = exchange.getResponseBody()) { out.write(bytes); }
        finally { exchange.close(); }
    }
}
