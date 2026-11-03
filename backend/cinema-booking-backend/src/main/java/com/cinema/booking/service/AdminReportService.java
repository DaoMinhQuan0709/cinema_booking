package com.cinema.booking.service;

import com.cinema.booking.dto.response.OccupancyReportResponse;
import com.cinema.booking.dto.response.RevenueReportResponse;

import java.time.LocalDate;

public interface AdminReportService {

    RevenueReportResponse getRevenueReport(LocalDate startDate, LocalDate endDate, Long cinemaId, Long movieId, String groupBy);

    OccupancyReportResponse getOccupancyReport(Long cinemaId, Long movieId, LocalDate date);
}

