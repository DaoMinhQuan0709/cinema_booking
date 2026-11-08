package com.cinema.booking.scheduler;

import com.cinema.booking.service.impl.GalaxyMovieDetailsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class GalaxyMovieDetailsScheduler {
    private final GalaxyMovieDetailsService service;

    @Scheduled(fixedDelayString = "${application.galaxy.details.interval-ms:60000}",
            initialDelayString = "${application.galaxy.details.initial-delay-ms:20000}")
    public void sync() {
        try {
            service.syncDueMovies();
        } catch (RuntimeException ex) {
            log.warn("Galaxy movie details job failed; existing metadata retained", ex);
        }
    }
}
