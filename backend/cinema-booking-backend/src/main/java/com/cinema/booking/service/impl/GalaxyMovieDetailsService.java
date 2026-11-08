package com.cinema.booking.service.impl;

import com.cinema.booking.config.GalaxySyncProperties;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.repository.MovieRepository;
import com.cinema.booking.service.GalaxyApiClient;
import com.cinema.booking.service.GalaxyMovieDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;

@Service
@RequiredArgsConstructor
@Slf4j
public class GalaxyMovieDetailsService {
    private static final List<MovieStatus> ACTIVE_STATUSES = List.of(MovieStatus.NOW_SHOWING, MovieStatus.COMING_SOON);
    private final MovieRepository movieRepository;
    private final GalaxyApiClient apiClient;
    private final GalaxyMovieDetailsWriter writer;
    private final GalaxySyncProperties properties;
    private final ReentrantLock syncLock = new ReentrantLock();

    public void syncDueMovies() {
        var settings = properties.getDetails();
        if (!properties.isEnabled() || !settings.isEnabled() || !syncLock.tryLock()) return;
        try {
            Instant now = Instant.now();
            Instant refreshBefore = now.minusMillis(Math.max(60_000, settings.getRefreshMs()));
            Instant retryBefore = now.minusMillis(Math.max(60_000, settings.getRetryMs()));
            var movies = movieRepository.findDueGalaxyDetails(ACTIVE_STATUSES, refreshBefore, retryBefore,
                    PageRequest.of(0, Math.clamp(settings.getBatchSize(), 1, 100)));
            int successful = 0;
            for (var movie : movies) {
                try {
                    // Commit the claim before HTTP. A failed request remains subject to the retry delay.
                    if (movieRepository.claimGalaxyDetails(movie.getId(), ACTIVE_STATUSES, Instant.now(),
                            refreshBefore, retryBefore) == 0) continue;
                    var json = apiClient.fetchMovieDetails(movie.getGalaxySlug(), movie.getGalaxyMovieId());
                    var details = GalaxyMovieDetails.fromJson(json);
                    writer.apply(movie.getId(), movie.getGalaxySlug(), details, Instant.now());
                    successful++;
                } catch (RuntimeException ex) {
                    log.warn("Galaxy movie details not updated for movie {}: {}", movie.getId(), ex.getMessage());
                }
            }
            if (!movies.isEmpty()) log.info("Galaxy movie details: updated={}, selected={}", successful, movies.size());
        } finally {
            syncLock.unlock();
        }
    }
}
