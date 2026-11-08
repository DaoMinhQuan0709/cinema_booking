package com.cinema.booking.dto.response;

import com.cinema.booking.enums.MovieStatus;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MovieResponse {

    private Long id;
    private String title;
    private String description;
    private Integer durationMinutes;
    private LocalDate releaseDate;
    private String posterUrl;
    private String landscapeUrl;
    private String trailerUrl;
    private String genre;
    private String country;
    private List<String> directors;
    private List<String> actors;
    private String ageRating;
    private MovieStatus status;
    private LocalDateTime createdAt;
}
