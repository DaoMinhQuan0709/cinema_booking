package com.cinema.booking.service.impl;

import com.cinema.booking.dto.response.OccupancyReportResponse;
import com.cinema.booking.dto.response.RevenueReportResponse;
import com.cinema.booking.entity.Showtime;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.repository.BookingRepository;
import com.cinema.booking.repository.ShowtimeRepository;
import com.cinema.booking.repository.ShowtimeSeatRepository;
import com.cinema.booking.service.AdminReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminReportServiceImpl implements AdminReportService {

    private final BookingRepository bookingRepository;
    private final ShowtimeRepository showtimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;

    @Override
    @Transactional(readOnly = true)
    public RevenueReportResponse getRevenueReport(LocalDate startDate, LocalDate endDate, Long cinemaId, Long movieId, String groupBy) {
        log.info("Thong ke doanh thu: startDate={}, endDate={}, cinemaId={}, movieId={}, groupBy={}",
                startDate, endDate, cinemaId, movieId, groupBy);

        LocalDateTime start = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime end = endDate != null ? endDate.atTime(LocalTime.MAX) : null;

        BigDecimal totalRevenue = bookingRepository.calculateTotalRevenue(start, end, cinemaId, movieId);
        long totalSuccessfulBookings = bookingRepository.countSuccessfulBookings(start, end, cinemaId, movieId);
        long totalTicketsSold = bookingRepository.countTotalTicketsSold(start, end, cinemaId, movieId);

        List<RevenueReportResponse.RevenueItem> breakdown = new ArrayList<>();

        if ("movie".equalsIgnoreCase(groupBy)) {
            List<Object[]> rows = bookingRepository.calculateRevenueByMovie(start, end);
            for (Object[] row : rows) {
                breakdown.add(RevenueReportResponse.RevenueItem.builder()
                        .label((String) row[0])
                        .revenue((BigDecimal) row[1])
                        .bookingCount((Long) row[2])
                        .ticketCount(0L)
                        .build());
            }
        } else if ("cinema".equalsIgnoreCase(groupBy)) {
            List<Object[]> rows = bookingRepository.calculateRevenueByCinema(start, end);
            for (Object[] row : rows) {
                breakdown.add(RevenueReportResponse.RevenueItem.builder()
                        .label((String) row[0])
                        .revenue((BigDecimal) row[1])
                        .bookingCount((Long) row[2])
                        .ticketCount(0L)
                        .build());
            }
        }

        return RevenueReportResponse.builder()
                .totalRevenue(totalRevenue)
                .totalSuccessfulBookings(totalSuccessfulBookings)
                .totalTicketsSold(totalTicketsSold)
                .breakdown(breakdown)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public OccupancyReportResponse getOccupancyReport(Long cinemaId, Long movieId, LocalDate date) {
        log.info("Thong ke ty le lap day: cinemaId={}, movieId={}, date={}", cinemaId, movieId, date);

        LocalDateTime startOfDay = date != null ? date.atStartOfDay() : null;
        LocalDateTime endOfDay = date != null ? date.atTime(LocalTime.MAX) : null;

        List<Showtime> showtimes = showtimeRepository.findShowtimes(movieId, cinemaId, startOfDay, endOfDay);

        Map<Long, Object[]> seatCounts = new HashMap<>();
        if (!showtimes.isEmpty()) {
            List<Long> showtimeIds = showtimes.stream().map(Showtime::getId).toList();
            for (Object[] row : showtimeSeatRepository.countSeatsByShowtimeIds(showtimeIds, ShowtimeSeatStatus.BOOKED)) {
                seatCounts.put(((Number) row[0]).longValue(), row);
            }
        }

        long grandTotalSeats = 0;
        long grandTotalBooked = 0;
        List<OccupancyReportResponse.OccupancyItem> breakdown = new ArrayList<>();

        for (Showtime st : showtimes) {
            Object[] counts = seatCounts.get(st.getId());
            long totalSeats = counts == null ? 0 : ((Number) counts[1]).longValue();
            long bookedSeats = counts == null ? 0 : ((Number) counts[2]).longValue();

            grandTotalSeats += totalSeats;
            grandTotalBooked += bookedSeats;

            double rate = totalSeats > 0 ? ((double) bookedSeats / totalSeats) * 100.0 : 0.0;
            // Lam tron 2 chu so thap phan
            rate = BigDecimal.valueOf(rate).setScale(2, RoundingMode.HALF_UP).doubleValue();

            String label = String.format("%s - %s (%s)",
                    st.getMovie().getTitle(),
                    st.getAuditorium().getName(),
                    st.getStartTime().toLocalTime().toString());

            breakdown.add(OccupancyReportResponse.OccupancyItem.builder()
                    .label(label)
                    .totalSeats(totalSeats)
                    .bookedSeats(bookedSeats)
                    .occupancyRate(rate)
                    .build());
        }

        double overallRate = grandTotalSeats > 0 ? ((double) grandTotalBooked / grandTotalSeats) * 100.0 : 0.0;
        overallRate = BigDecimal.valueOf(overallRate).setScale(2, RoundingMode.HALF_UP).doubleValue();

        return OccupancyReportResponse.builder()
                .totalSeatsAvailable(grandTotalSeats)
                .totalSeatsBooked(grandTotalBooked)
                .overallOccupancyRate(overallRate)
                .breakdown(breakdown)
                .build();
    }
}

