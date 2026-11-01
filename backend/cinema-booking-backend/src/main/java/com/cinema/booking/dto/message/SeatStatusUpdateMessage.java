package com.cinema.booking.dto.message;

import com.cinema.booking.enums.ShowtimeSeatStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Message DTO gui qua WebSocket topic /topic/showtimes/{showtimeId}/seats
 * khi co su kien giu ghe (HOLD), nha ghe (RELEASE), hoac dat thanh cong (BOOKED).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatStatusUpdateMessage {

    private Long showtimeId;
    private List<Long> seatIds;
    private ShowtimeSeatStatus status;
    private String action; // "HOLD", "RELEASE", "BOOKED"
    private LocalDateTime timestamp;
}