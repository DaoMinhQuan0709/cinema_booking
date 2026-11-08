package com.cinema.booking.service;

import com.cinema.booking.entity.*;
import com.cinema.booking.enums.SeatType;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/** Local inventory is provisioned on first seat-map access, never by catalog sync. */
@Service
@RequiredArgsConstructor
public class LocalSeatInventoryService {
    private final ShowtimeRepository showtimeRepository;
    private final AuditoriumRepository auditoriumRepository;
    private final SeatRepository seatRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;

    @Transactional
    public List<ShowtimeSeat> getOrCreateSeats(Long showtimeId) {
        List<ShowtimeSeat> existing = showtimeSeatRepository.findByShowtimeIdWithSeat(showtimeId);
        if (!existing.isEmpty()) return existing;
        // Row locks coordinate concurrent first access across all backend instances.
        Showtime showtime = showtimeRepository.findByIdForSeatInitialization(showtimeId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy suất chiếu: " + showtimeId));
        // Another request may have initialized the inventory while this one waited for the lock.
        existing = showtimeSeatRepository.findByShowtimeIdWithSeat(showtimeId);
        if (!existing.isEmpty()) return existing;
        if (!showtime.isActive() || !showtime.getStartTime().isAfter(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")))) {
            throw new BadRequestException("Không khởi tạo ghế cho suất đã bắt đầu hoặc ngừng mở bán.");
        }
        // Different showtimes can share the same room; lock it before creating physical seats.
        Auditorium room = auditoriumRepository.findByIdForSeatInitialization(showtime.getAuditorium().getId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phòng chiếu."));
        List<Seat> physical = seatRepository.findByAuditoriumIdOrderByRowCharAscSeatNumberAsc(room.getId());
        if (physical.isEmpty()) physical = seatRepository.saveAll(buildLocalLayout(room));
        List<ShowtimeSeat> inventory = new ArrayList<>(physical.size());
        for (Seat seat : physical) {
            if (!Boolean.TRUE.equals(seat.getIsActive())) continue;
            BigDecimal surcharge = BigDecimal.ZERO;
            if (seat.getType() == SeatType.VIP) {
                surcharge = BigDecimal.valueOf(20000);
            } else if (seat.getType() == SeatType.COUPLE) {
                surcharge = BigDecimal.valueOf(40000);
            }
            inventory.add(ShowtimeSeat.builder().showtime(showtime).seat(seat)
                    .price(showtime.getBasePrice().add(surcharge))
                    .status(ShowtimeSeatStatus.AVAILABLE).version(0).build());
        }
        if (inventory.isEmpty()) throw new BadRequestException("Phòng chiếu chưa có ghế đang hoạt động.");
        showtimeSeatRepository.saveAll(inventory);
        // Reload so the response contains database-generated IDs needed by POST /bookings.
        showtimeSeatRepository.flush();
        return showtimeSeatRepository.findByShowtimeIdWithSeat(showtimeId);
    }

    private List<Seat> buildLocalLayout(Auditorium room) {
        Integer rows = room.getTotalRows(), cols = room.getTotalCols();
        if (rows == null || cols == null || rows < 1 || rows > 26 || cols < 1) {
            throw new BadRequestException("Cấu hình sơ đồ ghế phòng chiếu không hợp lệ.");
        }
        List<Seat> seats = new ArrayList<>(rows * cols);
        for (int row = 0; row < rows; row++) {
            SeatType type = SeatType.STANDARD;
            if (row == rows - 1) {
                type = SeatType.COUPLE;
            } else if (row >= 4 && row <= 7) {
                type = SeatType.VIP;
            }
            for (int number = 1; number <= cols; number++) {
                seats.add(Seat.builder().auditorium(room).rowChar(String.valueOf((char) ('A' + row)))
                        .seatNumber(number).type(type).isActive(true).build());
            }
        }
        return seats;
    }
}
