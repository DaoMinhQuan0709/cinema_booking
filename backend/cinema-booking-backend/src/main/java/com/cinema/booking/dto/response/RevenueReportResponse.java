package com.cinema.booking.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RevenueReportResponse {

    private BigDecimal totalRevenue;
    private Long totalSuccessfulBookings;
    private Long totalTicketsSold;
    private List<RevenueItem> breakdown;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RevenueItem {
        private String label; // Ngay, Ten Phim, hoac Ten Rap
        private BigDecimal revenue;
        private Long bookingCount;
        private Long ticketCount;
    }
}

