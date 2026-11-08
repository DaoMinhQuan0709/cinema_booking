package com.cinema.booking.entity;

import com.cinema.booking.enums.MovieStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "movies", indexes = {
    @Index(name = "idx_movies_status", columnList = "status"),
    @Index(name = "idx_movies_release_date", columnList = "release_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@DynamicUpdate
public class Movie {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "galaxy_movie_id", unique = true, length = 100)
    private String galaxyMovieId;

    @Column(name = "galaxy_slug", length = 255)
    private String galaxySlug;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(name = "release_date", nullable = false)
    private LocalDate releaseDate;

    @Column(name = "poster_url", length = 500)
    private String posterUrl;

    @Column(name = "landscape_url", length = 500)
    private String landscapeUrl;

    @Column(name = "trailer_url", length = 500)
    private String trailerUrl;

    @Column(length = 500)
    private String genre;

    @Column(length = 255)
    private String country;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> directors;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> actors;

    @Column(name = "galaxy_details_synced_at")
    private Instant galaxyDetailsSyncedAt;

    @Column(name = "galaxy_details_attempt_at")
    private Instant galaxyDetailsAttemptAt;

    @Column(name = "age_rating", length = 10)
    private String ageRating;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private MovieStatus status = MovieStatus.COMING_SOON;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
