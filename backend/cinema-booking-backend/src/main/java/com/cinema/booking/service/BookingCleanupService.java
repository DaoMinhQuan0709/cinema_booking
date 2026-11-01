package com.cinema.booking.service;

import com.cinema.booking.entity.Booking;
import com.cinema.booking.entity.ShowtimeSeat;
import com.cinema.booking.enums.BookingStatus;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.repository.BookingRepository;
import com.cinema.booking.repository.ShowtimeSeatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service xu ly don dep don hang het han va ghe mo coi (Cong viec 4.3).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BookingCleanupService {

    private final BookingRepository bookingRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final SeatLockService seatLockService;
    private final WebSocketService webSocketService;

    /**
     * Quet va xu ly tat ca don PENDING co expires_at < now.
     * Chuyen sang EXPIRED, nha ghe tren DB va Redis, broadcast WebSocket RELEASE.
     */
    @Transactional
    public int cleanupExpiredBookings() {
        LocalDateTime now = LocalDateTime.now();
        List<Booking> expiredBookings = bookingRepository.findExpiredBookings(BookingStatus.PENDING, now);

        if (expiredBookings.isEmpty()) {
            log.trace("Cronjob: Khong co don dat ve PENDING nao het han tai {}", now);
            return 0;
        }

        log.info("Cronjob: Phat hien {} don dat ve PENDING het han. Bat dau don dep...", expiredBookings.size());
        int processedCount = 0;

        for (Booking booking : expiredBookings) {
            try {
                expireBooking(booking);
                processedCount++;
            } catch (Exception e) {
                log.error("Cronjob: Loi khi xu ly don het han bookingCode={}, error={}",
                        booking.getBookingCode(), e.getMessage(), e);
            }
        }

        log.info("Cronjob: Da hoan tat don dep {}/{} don dat ve het han", processedCount, expiredBookings.size());
        return processedCount;
    }

    /**
     * Quet an toan cac ghe LOCKED co locked_until < now ma khong duoc giai phong
     * (de phong truong hop ghe mo coi do exception bat thuong).
     */
    @Transactional
    public int cleanupOrphanedLockedSeats() {
        LocalDateTime now = LocalDateTime.now();
        List<ShowtimeSeat> orphanedSeats = showtimeSeatRepository.findExpiredLockedSeats(ShowtimeSeatStatus.LOCKED, now);

        if (orphanedSeats.isEmpty()) {
            return 0;
        }

        log.warn("Cronjob: Phat hien {} ghe LOCKED mo coi qua han tai {}. Bat dau giai phong...",
                orphanedSeats.size(), now);

        // Nhom theo showtimeId de batch unlock tren Redis va broadcast WebSocket
        Map<Long, List<ShowtimeSeat>> seatsByShowtime = orphanedSeats.stream()
                .collect(Collectors.groupingBy(ss -> ss.getShowtime().getId()));

        for (Map.Entry<Long, List<ShowtimeSeat>> entry : seatsByShowtime.entrySet()) {
            Long showtimeId = entry.getKey();
            List<ShowtimeSeat> seats = entry.getValue();

            List<Long> seatIds = seats.stream()
                    .map(ShowtimeSeat::getId)
                    .collect(Collectors.toList());

            // 1. Cap nhat DB ve AVAILABLE
            for (ShowtimeSeat seat : seats) {
                seat.setStatus(ShowtimeSeatStatus.AVAILABLE);
                seat.setLockedByUser(null);
                seat.setLockedUntil(null);
            }
            showtimeSeatRepository.saveAll(seats);

            // 2. Xoa Redis keys
            seatLockService.unlockSeats(showtimeId, seatIds);

            // 3. Broadcast WebSocket RELEASE
            webSocketService.broadcastSeatRelease(showtimeId, seatIds);

            log.info("Cronjob: Da giai phong {} ghe mo coi cho showtimeId={}: seatIds={}",
                    seatIds.size(), showtimeId, seatIds);
        }

        return orphanedSeats.size();
    }

    // ========== Helper Methods ==========

    private void expireBooking(Booking booking) {
        String bookingCode = booking.getBookingCode();
        Long showtimeId = booking.getShowtime().getId();

        // 1. Cap nhat Booking sang EXPIRED
        booking.setStatus(BookingStatus.EXPIRED);
        bookingRepository.save(booking);

        // 2. Lay danh sach ID ghe
        List<Long> seatIds = booking.getBookingSeats().stream()
                .map(bs -> bs.getShowtimeSeat().getId())
                .collect(Collectors.toList());

        // 3. Cap nhat ghe ve AVAILABLE tren DB
        List<ShowtimeSeat> seats = showtimeSeatRepository.findAllByIdIn(seatIds);
        for (ShowtimeSeat seat : seats) {
            seat.setStatus(ShowtimeSeatStatus.AVAILABLE);
            seat.setLockedByUser(null);
            seat.setLockedUntil(null);
        }
        showtimeSeatRepository.saveAll(seats);

        // 4. Xoa Redis keys
        seatLockService.unlockSeats(showtimeId, seatIds);

        // 5. Broadcast WebSocket RELEASE
        webSocketService.broadcastSeatRelease(showtimeId, seatIds);

        log.info("Cronjob: EXPIRED thanh cong don bookingCode={}, showtimeId={}, releasedSeats={}",
                bookingCode, showtimeId, seatIds);
    }
}