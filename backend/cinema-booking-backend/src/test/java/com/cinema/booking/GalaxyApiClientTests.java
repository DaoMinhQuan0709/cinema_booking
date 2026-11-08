package com.cinema.booking;

import com.cinema.booking.config.GalaxySyncProperties;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.service.GalaxyApiClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class GalaxyApiClientTests {
    private MockRestServiceServer server;
    private GalaxyApiClient client;
    private static final String SESSIONS = "https://galaxy.test/api/v2/mobile/sessions2?includeCinema=true&includeMovie=true";
    private static final String EMPTY = "{\"response\":{\"status\":200,\"code\":0},\"data\":{\"total\":0,\"result\":[]}}";

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://galaxy.test");
        server = MockRestServiceServer.bindTo(builder).build();
        GalaxySyncProperties properties = new GalaxySyncProperties();
        properties.setClientId("configured-client");
        client = new GalaxyApiClient(builder.build(), new ObjectMapper(), properties);
    }

    @Test
    void acceptsJsonEvenWhenGalaxyLabelsItAsHtml() {
        server.expect(requestTo(SESSIONS)).andExpect(header("clientId", "configured-client"))
                .andRespond(withSuccess(EMPTY, MediaType.TEXT_HTML));
        assertTrue(client.fetchSessions(null).isArray());
        server.verify();
    }

    @Test
    void requestClientIdOverridesConfiguration() {
        server.expect(requestTo(SESSIONS)).andExpect(header("clientId", "browser-client"))
                .andRespond(withSuccess(EMPTY, MediaType.APPLICATION_JSON));
        assertTrue(client.fetchSessions(" browser-client ").isEmpty());
        server.verify();
    }

    @Test
    void rejectsActualHtmlWithAnActionableError() {
        server.expect(requestTo(SESSIONS)).andRespond(withSuccess("<!doctype html><html>blocked</html>", MediaType.TEXT_HTML));
        AppException error = assertThrows(AppException.class, () -> client.fetchSessions(null));
        assertEquals(502, error.getCode());
        assertTrue(error.getMessage().contains("HTML"));
        server.verify();
    }

    @Test
    void rejectsSelfRedirectRatherThanTryingToParseIt() {
        server.expect(requestTo(SESSIONS)).andRespond(withStatus(HttpStatus.FOUND).header(HttpHeaders.LOCATION, SESSIONS));
        AppException error = assertThrows(AppException.class, () -> client.fetchSessions(null));
        assertEquals(502, error.getCode());
        assertTrue(error.getMessage().contains("302"));
        server.verify();
    }

    @Test
    void rejectsTruncatedOrPaginatedSnapshot() {
        server.expect(requestTo(SESSIONS)).andRespond(withSuccess(
                "{\"data\":{\"total\":2985,\"result\":[{\"id\":\"one\"}]}}", MediaType.APPLICATION_JSON));
        assertThrows(AppException.class, () -> client.fetchSessions(null));
        server.verify();
    }

    @Test
    void rejectsApplicationLevelFailureEvenWithHttp200() {
        server.expect(requestTo(SESSIONS)).andRespond(withSuccess(
                "{\"response\":{\"status\":403,\"code\":1},\"data\":{\"total\":0,\"result\":[]}}", MediaType.APPLICATION_JSON));
        assertThrows(AppException.class, () -> client.fetchSessions(null));
        server.verify();
    }

    @Test
    void rejectsForbiddenResponseWithoutExposingItsBody() {
        server.expect(requestTo(SESSIONS)).andRespond(withStatus(HttpStatus.FORBIDDEN).body("private upstream details"));
        AppException error = assertThrows(AppException.class, () -> client.fetchSessions(null));
        assertTrue(error.getMessage().contains("403"));
        assertFalse(error.getMessage().contains("private upstream details"));
        server.verify();
    }
}
