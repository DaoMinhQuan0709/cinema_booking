package com.cinema.booking;

import com.cinema.booking.config.GalaxySyncProperties;
import com.cinema.booking.dto.response.GalaxySyncResponse;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.service.GalaxyApiClient;
import com.cinema.booking.service.impl.GalaxyDataImporter;
import com.cinema.booking.service.impl.GalaxySyncServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GalaxySyncServiceTests {
    private final ObjectMapper mapper = new ObjectMapper();
    private GalaxyApiClient client;
    private GalaxyDataImporter importer;
    private GalaxySyncServiceImpl service;

    @BeforeEach
    void setUp() {
        client = mock(GalaxyApiClient.class);
        importer = mock(GalaxyDataImporter.class);
        service = new GalaxySyncServiceImpl(client, importer, mapper, new GalaxySyncProperties());
    }

    @Test
    void failedFetchDoesNotTouchDatabaseOrFallBackToLocalFile() {
        when(client.fetchSessions(null)).thenThrow(new AppException(502, "Galaxy HTML"));
        assertThrows(AppException.class, () -> service.syncGalaxyData(null, 0));
        verifyNoInteractions(importer);
        assertNull(service.getStatus().lastSuccessAt());
        assertEquals("Galaxy HTML", service.getStatus().lastError());
        assertFalse(service.getStatus().running());
    }

    @Test
    void failedComingSoonFetchDoesNotApplyPartialSnapshot() {
        when(client.fetchSessions(null)).thenReturn(mapper.createArrayNode());
        when(client.fetchComingSoon(null)).thenThrow(new AppException(502, "unavailable"));
        assertThrows(AppException.class, () -> service.syncGalaxyData(null, 0));
        verifyNoInteractions(importer);
    }

    @Test
    void retainsLastSuccessfulTimeWhenNextAttemptFails() {
        var empty = mapper.createArrayNode();
        when(client.fetchSessions(null)).thenReturn(empty);
        when(client.fetchComingSoon(null)).thenReturn(empty);
        when(importer.importData(empty, empty, 0, true)).thenReturn(GalaxySyncResponse.builder().build());
        service.syncGalaxyData(null, 0);
        var lastSuccess = service.getStatus().lastSuccessAt();
        assertNotNull(lastSuccess);
        when(client.fetchSessions(null)).thenThrow(new AppException(502, "offline"));
        assertThrows(AppException.class, () -> service.syncGalaxyData(null, 0));
        assertEquals(lastSuccess, service.getStatus().lastSuccessAt());
    }

    @Test
    void limitedPreviewCannotReportFullCatalogFreshness() {
        var empty = mapper.createArrayNode();
        when(client.fetchSessions(null)).thenReturn(empty);
        when(client.fetchComingSoon(null)).thenReturn(empty);
        when(importer.importData(empty, empty, 100, false)).thenReturn(GalaxySyncResponse.builder().build());
        service.syncGalaxyData(null, 100);
        assertNull(service.getStatus().lastSuccessAt());
    }

    @Test
    void manualRequestCannotOverlapScheduledFetch() throws Exception {
        CountDownLatch started = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        var empty = mapper.createArrayNode();
        when(client.fetchSessions(null)).thenAnswer(ignored -> {
            started.countDown();
            assertTrue(release.await(5, TimeUnit.SECONDS));
            return empty;
        });
        when(client.fetchComingSoon(null)).thenReturn(empty);
        when(importer.importData(empty, empty, 0, true)).thenReturn(GalaxySyncResponse.builder().build());
        try (var executor = Executors.newSingleThreadExecutor()) {
            var running = executor.submit(() -> service.syncGalaxyData(null, 0));
            try {
                assertTrue(started.await(5, TimeUnit.SECONDS));
                AppException error = assertThrows(AppException.class, () -> service.syncGalaxyData(null, 0));
                assertEquals(409, error.getCode());
            } finally {
                release.countDown();
            }
            running.get(5, TimeUnit.SECONDS);
        }
        assertFalse(service.getStatus().running());
    }
}
