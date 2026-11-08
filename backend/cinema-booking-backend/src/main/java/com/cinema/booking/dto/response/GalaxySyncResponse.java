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
    private int totalShowtimesDeactivated;
    private int totalMoviesEnded;
    private int totalShowtimesSkipped;
    private String source;
    private java.time.Instant syncedAt;
    private String message;
}

