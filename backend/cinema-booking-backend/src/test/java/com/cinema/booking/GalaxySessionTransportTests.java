package com.cinema.booking;

import com.cinema.booking.config.GalaxyClientConfig;
import com.cinema.booking.config.GalaxySyncProperties;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.service.GalaxyApiClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** Uses the actual JDK HTTP transport and CookieManager against a local HTTP server. */
class GalaxySessionTransportTests {
    private static final String EMPTY = "{\"response\":{\"status\":200,\"code\":0},\"data\":{\"total\":0,\"result\":[]}}";
    private HttpServer server;
    private GalaxyApiClient client;
    private String baseUrl;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        GalaxySyncProperties properties = new GalaxySyncProperties();
        properties.setBaseUrl(baseUrl);
        properties.setClientId("configured-client");
        properties.setReadTimeoutMs(3000);
        client = new GalaxyApiClient(new GalaxyClientConfig().galaxyRestClient(properties), new ObjectMapper(), properties);
        server.start();
    }

    @AfterEach
    void tearDown() {
        if (server != null) server.stop(0);
    }

    @Test
    void storesCookieFromSelfRedirectAndReusesSessionForComingSoon() {
        AtomicInteger sessionRequests = new AtomicInteger();
        AtomicReference<String> cookieOnRetry = new AtomicReference<>();
        AtomicReference<String> cookieOnComingSoon = new AtomicReference<>();
        AtomicReference<String> clientIdOnRetry = new AtomicReference<>();
        server.createContext("/api/v2/mobile/sessions2", exchange -> {
            if (sessionRequests.incrementAndGet() == 1) {
                exchange.getResponseHeaders().add("Set-Cookie", "muid_mly=public-session; Path=/; HttpOnly");
                exchange.getResponseHeaders().add("Location", baseUrl + exchange.getRequestURI());
                respond(exchange, 302, "text/html", "<html>302 Found</html>");
            } else {
                cookieOnRetry.set(exchange.getRequestHeaders().getFirst("Cookie"));
                clientIdOnRetry.set(exchange.getRequestHeaders().getFirst("clientId"));
                respond(exchange, 200, "application/json; charset=utf-8", EMPTY);
            }
        });
        server.createContext("/api/v2/mobile/movies/comming", exchange -> {
            cookieOnComingSoon.set(exchange.getRequestHeaders().getFirst("Cookie"));
            respond(exchange, 200, "application/json; charset=utf-8", EMPTY);
        });
        assertTrue(client.fetchSessions(null).isArray());
        assertTrue(client.fetchComingSoon(null).isArray());
        assertEquals(2, sessionRequests.get());
        assertNotNull(cookieOnRetry.get());
        assertTrue(cookieOnRetry.get().contains("muid_mly=public-session"));
        assertTrue(cookieOnComingSoon.get().contains("muid_mly=public-session"));
        assertEquals("configured-client", clientIdOnRetry.get());
    }

    @Test
    void repeatedCookieRedirectsStopAfterThreeRequests() {
        AtomicInteger requests = new AtomicInteger();
        server.createContext("/", exchange -> {
            exchange.getResponseHeaders().add("Set-Cookie", "muid_mly=session-" + requests.incrementAndGet() + "; Path=/");
            exchange.getResponseHeaders().add("Location", baseUrl + exchange.getRequestURI());
            respond(exchange, 302, "text/html", "<html>302 Found</html>");
        });
        AppException error = assertThrows(AppException.class, () -> client.fetchSessions(null));
        assertEquals(502, error.getCode());
        assertEquals(3, requests.get());
    }

    @Test
    void doesNotFollowRedirectToADifferentPath() {
        AtomicInteger redirectedRequests = new AtomicInteger();
        server.createContext("/api/v2/mobile/sessions2", exchange -> {
            exchange.getResponseHeaders().add("Set-Cookie", "muid_mly=public-session; Path=/");
            exchange.getResponseHeaders().add("Location", baseUrl + "/other");
            respond(exchange, 302, "text/html", "<html>302 Found</html>");
        });
        server.createContext("/other", exchange -> {
            redirectedRequests.incrementAndGet();
            respond(exchange, 200, "application/json", EMPTY);
        });
        assertThrows(AppException.class, () -> client.fetchSessions(null));
        assertEquals(0, redirectedRequests.get());
    }

    private void respond(HttpExchange exchange, int status, String contentType, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", contentType);
        exchange.sendResponseHeaders(status, bytes.length);
        try (var stream = exchange.getResponseBody()) {
            stream.write(bytes);
        } finally {
            exchange.close();
        }
    }
}
