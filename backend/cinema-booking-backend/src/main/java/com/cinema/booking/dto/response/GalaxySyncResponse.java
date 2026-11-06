package com.cinema.booking.dto.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GalaxySyncResponse {

    private int totalCinemasSynced;
    private int totalAuditoriumsSynced;
    private int totalSeatsSynced;
    private int totalMoviesSynced;
    private int totalShowtimesSynced;
    private int totalShowtimeSeatsSynced;
    private String message;
}

