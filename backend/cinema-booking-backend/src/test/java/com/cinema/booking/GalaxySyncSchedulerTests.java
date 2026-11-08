package com.cinema.booking;

import com.cinema.booking.config.GalaxySyncProperties;
import com.cinema.booking.dto.response.GalaxySyncResponse;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.scheduler.GalaxySyncScheduler;
import com.cinema.booking.service.GalaxySyncService;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GalaxySyncSchedulerTests {
    @Test
    void configuredIntervalDefaultsToFiveMinutesAndCanBeDisabled() {
        GalaxySyncProperties properties = new GalaxySyncProperties();
        assertEquals(300_000, properties.getIntervalMs());
        properties.setEnabled(false);
        GalaxySyncService service = mock(GalaxySyncService.class);
        new GalaxySyncScheduler(service, properties).sync();
        verifyNoInteractions(service);
    }

    @Test
    void upstreamFailureDoesNotStopNextScheduledAttempt() {
        GalaxySyncService service = mock(GalaxySyncService.class);
        when(service.syncGalaxyData(null, 0)).thenThrow(new AppException(502, "upstream unavailable"))
                .thenReturn(GalaxySyncResponse.builder().build());
        GalaxySyncScheduler scheduler = new GalaxySyncScheduler(service, new GalaxySyncProperties());
        assertDoesNotThrow(scheduler::sync);
        assertDoesNotThrow(scheduler::sync);
        verify(service, times(2)).syncGalaxyData(null, 0);
    }
}
