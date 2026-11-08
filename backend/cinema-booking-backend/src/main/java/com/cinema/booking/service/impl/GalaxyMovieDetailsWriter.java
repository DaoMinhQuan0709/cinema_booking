package com.cinema.booking.service.impl;

import com.cinema.booking.repository.MovieRepository;
import com.cinema.booking.service.GalaxyMovieDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class GalaxyMovieDetailsWriter {
    private final MovieRepository movieRepository;

    // A short transaction after HTTP and validation; never writes catalog status or inventory.
    @Transactional
    public void apply(Long movieId, String expectedSlug, GalaxyMovieDetails details, Instant syncedAt) {
        movieRepository.findById(movieId).ifPresent(movie -> {
            if (!Objects.equals(movie.getGalaxyMovieId(), details.galaxyMovieId())
                    || !Objects.equals(movie.getGalaxySlug(), expectedSlug)) return;
            if (details.landscapeUrl() != null) movie.setLandscapeUrl(details.landscapeUrl());
            if (details.country() != null) movie.setCountry(details.country());
            if (details.directors() != null) movie.setDirectors(details.directors());
            if (details.actors() != null) movie.setActors(details.actors());
            if (details.genre() != null) movie.setGenre(details.genre());
            if (details.description() != null) movie.setDescription(details.description());
            if (details.trailerUrl() != null) movie.setTrailerUrl(details.trailerUrl());
            movie.setGalaxyDetailsSyncedAt(syncedAt);
        });
    }
}
