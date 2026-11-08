package com.cinema.booking;

import com.cinema.booking.config.GalaxyClientConfig;
import com.cinema.booking.config.GalaxySyncProperties;
import com.cinema.booking.service.GalaxyApiClient;
import com.cinema.booking.service.GalaxyMovieDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import static org.junit.jupiter.api.Assertions.*;

/** Opt-in read-only smoke test. Does not start Spring, connect to DB, or import data. */
@EnabledIfSystemProperty(named = "galaxy.live", matches = "true")
class GalaxyLiveApiTests {
    @Test
    void fetchesCompleteSessionsAndComingSoonUsingProductionHttpClient() {
        GalaxySyncProperties properties = new GalaxySyncProperties();
        properties.setClientId(System.getProperty("galaxy.client-id", System.getenv("GALAXY_CLIENT_ID")));
        GalaxyApiClient client = new GalaxyApiClient(new GalaxyClientConfig().galaxyRestClient(properties),
                new ObjectMapper(), properties);
        var sessions = client.fetchSessions(null);
        var comingSoon = client.fetchComingSoon(null);
        var nowShowing = client.fetchNowShowing(null);
        assertTrue(sessions.isArray());
        assertFalse(sessions.isEmpty(), "Expected current Galaxy sessions");
        assertTrue(comingSoon.isArray());
        assertTrue(nowShowing.isArray());
        for (var session : sessions) {
            assertFalse(session.path("id").asText().isBlank());
            assertFalse(session.path("movie").path("id").asText().isBlank());
            assertFalse(session.path("cinema").path("id").asText().isBlank());
        }
        var sample = !comingSoon.isEmpty() ? comingSoon.get(0) : nowShowing.get(0);
        var details = GalaxyMovieDetails.fromJson(client.fetchMovieDetails(sample.path("slug").asText(), sample.path("id").asText()));
        assertEquals(sample.path("id").asText(), details.galaxyMovieId());
        System.out.printf("Galaxy live: %d sessions, %d coming-soon movies, %d now-showing movies; detail object validated%n",
                sessions.size(), comingSoon.size(), nowShowing.size());
    }
}
