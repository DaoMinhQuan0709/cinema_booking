package com.cinema.booking.repository;

import com.cinema.booking.entity.Movie;
import com.cinema.booking.enums.MovieStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.time.Instant;

@Repository
public interface MovieRepository extends JpaRepository<Movie, Long>, JpaSpecificationExecutor<Movie> {

    List<Movie> findByStatus(MovieStatus status);

    java.util.Optional<Movie> findByTitle(String title);

    java.util.Optional<Movie> findByGalaxyMovieId(String galaxyMovieId);

    List<Movie> findByGalaxyMovieIdIsNotNull();

    @Query("""
            SELECT m.id AS id, m.galaxyMovieId AS galaxyMovieId, m.galaxySlug AS galaxySlug FROM Movie m
            WHERE m.galaxyMovieId IS NOT NULL AND m.galaxySlug IS NOT NULL AND m.galaxySlug <> ''
              AND m.status IN :statuses
              AND (m.galaxyDetailsSyncedAt IS NULL OR m.galaxyDetailsSyncedAt <= :refreshBefore)
              AND (m.galaxyDetailsAttemptAt IS NULL OR m.galaxyDetailsAttemptAt <= :retryBefore)
            ORDER BY CASE WHEN m.galaxyDetailsAttemptAt IS NULL THEN 0 ELSE 1 END,
                     m.galaxyDetailsAttemptAt, m.id
            """)
    List<GalaxyDetailsCandidate> findDueGalaxyDetails(@Param("statuses") List<MovieStatus> statuses,
                                                     @Param("refreshBefore") Instant refreshBefore,
                                                     @Param("retryBefore") Instant retryBefore, Pageable pageable);

    interface GalaxyDetailsCandidate {
        Long getId();
        String getGalaxyMovieId();
        String getGalaxySlug();
    }

    @Modifying
    @Transactional
    @Query("""
            UPDATE Movie m SET m.galaxyDetailsAttemptAt = :now
            WHERE m.id = :id AND m.status IN :statuses
              AND (m.galaxyDetailsSyncedAt IS NULL OR m.galaxyDetailsSyncedAt <= :refreshBefore)
              AND (m.galaxyDetailsAttemptAt IS NULL OR m.galaxyDetailsAttemptAt <= :retryBefore)
            """)
    int claimGalaxyDetails(@Param("id") Long id, @Param("statuses") List<MovieStatus> statuses,
                           @Param("now") Instant now, @Param("refreshBefore") Instant refreshBefore,
                           @Param("retryBefore") Instant retryBefore);
}
