package com.cinema.booking.dto.response;

import lombok.*;

import java.util.List;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OccupancyReportResponse {

    private Long totalSeatsAvailable;
    private Long totalSeatsBooked;
    private Double overallOccupancyRate; // Phan tram: 0.0 - 100.0%
    private Long showtimesMissingCapacity;
    private List<OccupancyItem> breakdown;

    public enum CapacitySource { INVENTORY, ACTIVE_SEATS, ROOM_LAYOUT, UNCONFIGURED }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class OccupancyItem {
        private Long showtimeId;
        private Long movieId;
        private Long cinemaId;
        private Long auditoriumId;
        private LocalDateTime startTime;
        private Boolean active;
        private CapacitySource capacitySource;
        private String label; // Ten Phim, Suat chieu, hoac Ten Rap
        private Long totalSeats;
        private Long bookedSeats;
        private Double occupancyRate;
    }
}

