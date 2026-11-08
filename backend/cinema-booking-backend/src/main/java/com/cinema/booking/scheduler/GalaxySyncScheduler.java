package com.cinema.booking.scheduler;

import com.cinema.booking.config.GalaxySyncProperties;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.service.GalaxySyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class GalaxySyncScheduler {
    private final GalaxySyncService syncService;
    private final GalaxySyncProperties properties;

    @Scheduled(fixedDelayString = "${application.galaxy.interval-ms:300000}",
            initialDelayString = "${application.galaxy.initial-delay-ms:10000}")
    public void sync() {
        if (!properties.isEnabled()) return;
        try {
            var result = syncService.syncGalaxyData(null, 0);
            log.info("Galaxy sync completed: movies={}, showtimes={}, withdrawn={}, skipped={}",
                    result.getTotalMoviesSynced(), result.getTotalShowtimesSynced(),
                    result.getTotalShowtimesDeactivated(), result.getTotalShowtimesSkipped());
        } catch (AppException ex) {
            log.warn("Galaxy sync not completed: {}", ex.getMessage());
        } catch (RuntimeException ex) {
            log.error("Galaxy sync failed; previous snapshot retained", ex);
        }
    }
}
