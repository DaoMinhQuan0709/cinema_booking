package com.cinema.booking.service.impl;

import com.cinema.booking.dto.response.OccupancyReportResponse;
import com.cinema.booking.dto.response.RevenueReportResponse;
import com.cinema.booking.dto.response.OccupancyReportResponse.CapacitySource;
import com.cinema.booking.entity.Auditorium;
import com.cinema.booking.entity.Showtime;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.repository.BookingRepository;
import com.cinema.booking.repository.RevenueTotals;
import com.cinema.booking.repository.SeatRepository;
import com.cinema.booking.repository.ShowtimeRepository;
import com.cinema.booking.repository.ShowtimeSeatRepository;
import com.cinema.booking.service.AdminReportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.DateTimeException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminReportServiceImpl implements AdminReportService {

    private final BookingRepository bookingRepository;
    private final ShowtimeRepository showtimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final SeatRepository seatRepository;

    @Override
    @Transactional(readOnly = true)
    public RevenueReportResponse getRevenueReport(LocalDate startDate, LocalDate endDate, Long cinemaId, Long movieId, String groupBy) {
        log.info("Thong ke doanh thu: startDate={}, endDate={}, cinemaId={}, movieId={}, groupBy={}",
                startDate, endDate, cinemaId, movieId, groupBy);

        validateIds(cinemaId, movieId);
        if (startDate != null && endDate != null && startDate.isAfter(endDate)) {
            throw new BadRequestException("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
        }
        String grouping = groupBy == null ? "none" : groupBy.trim().toLowerCase(Locale.ROOT);
        if (!Set.of("none", "movie", "cinema").contains(grouping)) {
            throw new BadRequestException("groupBy chỉ nhận none, movie hoặc cinema.");
        }
        LocalDateTime start = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime end = exclusiveEnd(endDate);
        if ("none".equals(grouping)) {
            RevenueTotals totals = bookingRepository.summarizeRevenue(start, end, cinemaId, movieId);
            return RevenueReportResponse.builder().totalRevenue(totals.getRevenue())
                    .totalSuccessfulBookings(totals.getBookingCount()).totalTicketsSold(totals.getTicketCount())
                    .breakdown(List.of()).build();
        }
        var rows = "movie".equals(grouping)
                ? bookingRepository.calculateRevenueByMovie(start, end, cinemaId, movieId)
                : bookingRepository.calculateRevenueByCinema(start, end, cinemaId, movieId);
        var breakdown = rows.stream().map(row -> RevenueReportResponse.RevenueItem.builder()
                .id(row.getId()).label(row.getLabel()).revenue(row.getRevenue())
                .bookingCount(row.getBookingCount()).ticketCount(row.getTicketCount()).build()).toList();
        // KPI và các nhóm dùng chung một kết quả SQL, không lệch khi có đơn mới đồng thời.
        return RevenueReportResponse.builder()
                .totalRevenue(breakdown.stream().map(RevenueReportResponse.RevenueItem::getRevenue).reduce(BigDecimal.ZERO, BigDecimal::add))
                .totalSuccessfulBookings(breakdown.stream().mapToLong(RevenueReportResponse.RevenueItem::getBookingCount).sum())
                .totalTicketsSold(breakdown.stream().mapToLong(RevenueReportResponse.RevenueItem::getTicketCount).sum())
                .breakdown(breakdown).build();
    }

    @Override
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public OccupancyReportResponse getOccupancyReport(Long cinemaId, Long movieId, LocalDate date) {
        log.info("Thong ke ty le lap day: cinemaId={}, movieId={}, date={}", cinemaId, movieId, date);

        validateIds(cinemaId, movieId);
        LocalDateTime startOfDay = date != null ? date.atStartOfDay() : null;
        LocalDateTime endOfDay = exclusiveEnd(date);

        List<Showtime> showtimes = showtimeRepository.findForOccupancyReport(movieId, cinemaId, startOfDay, endOfDay);

        Map<Long, Object[]> seatCounts = new HashMap<>();
        if (!showtimes.isEmpty()) {
            List<Long> showtimeIds = showtimes.stream().map(Showtime::getId).toList();
            for (Object[] row : showtimeSeatRepository.countSeatsByShowtimeIds(showtimeIds, ShowtimeSeatStatus.BOOKED)) {
                seatCounts.put(((Number) row[0]).longValue(), row);
            }
        }

        // Chỉ đọc cấu hình cho các suất chưa có inventory; tuyệt đối không gọi bộ sinh ghế.
        var roomIds = showtimes.stream().filter(st -> !seatCounts.containsKey(st.getId()))
                .map(st -> st.getAuditorium().getId()).distinct().sorted().toList();
        Map<Long, Object[]> roomCounts = new HashMap<>();
        if (!roomIds.isEmpty()) {
            for (Object[] row : seatRepository.countCapacityByAuditoriumIds(roomIds)) {
                roomCounts.put(((Number) row[0]).longValue(), row);
            }
        }

        long grandTotalSeats = 0;
        long grandTotalBooked = 0;
        long missingCapacity = 0;
        List<OccupancyReportResponse.OccupancyItem> breakdown = new ArrayList<>();

        for (Showtime st : showtimes) {
            Object[] counts = seatCounts.get(st.getId());
            Capacity capacity = capacity(st.getAuditorium(), counts, roomCounts.get(st.getAuditorium().getId()));
            long totalSeats = capacity.total();
            long bookedSeats = counts == null ? 0 : ((Number) counts[2]).longValue();
            if (capacity.source() == CapacitySource.UNCONFIGURED) missingCapacity++;

            grandTotalSeats += totalSeats;
            grandTotalBooked += bookedSeats;

            String label = String.format("%s — %s / %s (%s)", st.getMovie().getTitle(),
                    st.getAuditorium().getCinema().getName(), st.getAuditorium().getName(),
                    st.getStartTime().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));

            breakdown.add(OccupancyReportResponse.OccupancyItem.builder()
                    .showtimeId(st.getId()).movieId(st.getMovie().getId())
                    .cinemaId(st.getAuditorium().getCinema().getId()).auditoriumId(st.getAuditorium().getId())
                    .startTime(st.getStartTime()).active(st.isActive()).capacitySource(capacity.source())
                    .label(label)
                    .totalSeats(totalSeats)
                    .bookedSeats(bookedSeats)
                    .occupancyRate(rate(bookedSeats, totalSeats))
                    .build());
        }

        return OccupancyReportResponse.builder()
                .totalSeatsAvailable(grandTotalSeats)
                .totalSeatsBooked(grandTotalBooked)
                .overallOccupancyRate(rate(grandTotalBooked, grandTotalSeats))
                .showtimesMissingCapacity(missingCapacity)
                .breakdown(breakdown)
                .build();
    }

    private record Capacity(long total, CapacitySource source) { }

    private Capacity capacity(Auditorium room, Object[] inventory, Object[] physical) {
        if (inventory != null) return new Capacity(((Number) inventory[1]).longValue(), CapacitySource.INVENTORY);
        if (physical != null) return new Capacity(((Number) physical[2]).longValue(), CapacitySource.ACTIVE_SEATS);
        Integer rows = room.getTotalRows(), cols = room.getTotalCols();
        // Cùng điều kiện với LocalSeatInventoryService.buildLocalLayout, đếm từng vị trí ghế.
        if (rows != null && rows >= 1 && rows <= 26 && cols != null && cols > 0) {
            return new Capacity((long) rows * cols, CapacitySource.ROOM_LAYOUT);
        }
        return new Capacity(0, CapacitySource.UNCONFIGURED);
    }

    private double rate(long booked, long total) {
        return total == 0 ? 0.0 : BigDecimal.valueOf(booked).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP).doubleValue();
    }

    private LocalDateTime exclusiveEnd(LocalDate date) {
        if (date == null) return null;
        try { return date.plusDays(1).atStartOfDay(); }
        catch (DateTimeException ex) { throw new BadRequestException("Ngày kết thúc nằm ngoài phạm vi hỗ trợ."); }
    }

    private void validateIds(Long cinemaId, Long movieId) {
        if ((cinemaId != null && cinemaId <= 0) || (movieId != null && movieId <= 0)) {
            throw new BadRequestException("ID phim và rạp phải là số nguyên dương.");
        }
    }
}

