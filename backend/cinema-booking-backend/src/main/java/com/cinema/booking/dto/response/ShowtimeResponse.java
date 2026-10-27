package com.cinema.booking.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShowtimeResponse {

    private Long id;
    private Long movieId;
    private String movieTitle;
    private String posterUrl;
    private Long cinemaId;
    private String cinemaName;
    private Long auditoriumId;
    private String auditoriumName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private BigDecimal basePrice;
}