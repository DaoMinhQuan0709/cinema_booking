package com.cinema.booking;

import com.cinema.booking.config.GeminiConfig;
import com.cinema.booking.service.GeminiClientService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.FileSystemResource;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Opt-in: two real provider requests via the production backend client, using local config. No database access. */
@EnabledIfSystemProperty(named = "gemini.live", matches = "true")
class GeminiLiveApiTests {
    @Test
    void answersInVietnameseAndRemembersPreviousTurn() throws Exception {
        GeminiConfig config = loadConfiguration();
        GeminiClientService client = new GeminiClientService(config.geminiRestClient(), config, new ObjectMapper());
        String reference = "CINEBOT-" + UUID.randomUUID().toString().substring(0, 8);
        String system = "Bạn là CineBot. Trả lời bằng tiếng Việt, ngắn gọn. Đây là kiểm thử kết nối và ngữ cảnh hội thoại.";
        String question = "Hãy ghi nhớ mã phim kiểm thử của tôi: " + reference + ". Chỉ xác nhận ngắn gọn.";
        String firstReply = client.generateContent(system, question);
        assertFalse(firstReply.isBlank());
        String reply = client.generateContent(system, List.of(
                content("user", question), content("model", firstReply),
                content("user", "Mã phim kiểm thử tôi vừa đưa là gì?")));
        assertTrue(reply.contains(reference), "Expected Gemini to recall the reference from the previous turn");
        System.out.printf("Gemini live: model=%s; two real responses received; multi-turn context verified.%nReply: %s%n",
                config.getModel(), reply);
    }

    @Test
    void listsAvailableTextModels() throws Exception {
        GeminiConfig config = loadConfiguration();
        try {
            String body = config.geminiRestClient().get()
                    .uri(builder -> builder.queryParam("pageSize", 1000).build())
                    .header("x-goog-api-key", config.getApiKey()).retrieve().body(String.class);
            var response = new ObjectMapper().readTree(body);
            assertTrue(response.path("models").isArray());
            for (var model : response.path("models")) {
                if (model.path("supportedGenerationMethods").toString().contains("generateContent")) {
                    System.out.println("Available text model: " + model.path("name").asText());
                }
            }
        } catch (RestClientResponseException ex) {
            throw new AssertionError("Gemini model discovery failed: HTTP " + ex.getStatusCode().value());
        }
    }

    private GeminiConfig loadConfiguration() throws Exception {
        StandardEnvironment environment = new StandardEnvironment();
        FileSystemResource localConfig = new FileSystemResource("src/main/resources/application.yml");
        if (localConfig.exists()) {
            for (var source : new YamlPropertySourceLoader().load("local-config", localConfig)) {
                environment.getPropertySources().addLast(source);
            }
        }
        return Binder.get(environment).bind("application.gemini", GeminiConfig.class).orElseGet(GeminiConfig::new);
    }

    private Map<String, Object> content(String role, String text) {
        return Map.of("role", role, "parts", List.of(Map.of("text", text)));
    }
}
