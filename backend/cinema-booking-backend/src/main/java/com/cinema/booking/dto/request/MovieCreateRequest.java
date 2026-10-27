package com.cinema.booking.dto.request;

import com.cinema.booking.enums.MovieStatus;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MovieCreateRequest {

    @NotBlank(message = "Tên phim không được để trống")
    private String title;

    private String description;

    @NotNull(message = "Thời lượng phim không được để trống")
    @Min(value = 1, message = "Thời lượng phim phải lớn hơn 0")
    private Integer durationMinutes;

    @NotNull(message = "Ngày phát hành không được để trống")
    private LocalDate releaseDate;

    private String posterUrl;
    private String trailerUrl;
    private String genre;
    private String ageRating;

    @NotNull(message = "Trạng thái phim không được để trống")
    private MovieStatus status;
}