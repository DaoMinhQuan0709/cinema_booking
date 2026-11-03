package com.cinema.booking.dto.response;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OccupancyReportResponse {

    private Long totalSeatsAvailable;
    private Long totalSeatsBooked;
    private Double overallOccupancyRate; // Phan tram: 0.0 - 100.0%
    private List<OccupancyItem> breakdown;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class OccupancyItem {
        private String label; // Ten Phim, Suat chieu, hoac Ten Rap
        private Long totalSeats;
        private Long bookedSeats;
        private Double occupancyRate;
    }
}

