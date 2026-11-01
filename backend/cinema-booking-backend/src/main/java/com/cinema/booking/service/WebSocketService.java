package com.cinema.booking.service;

import com.cinema.booking.dto.message.SeatStatusUpdateMessage;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service xu ly gui message WebSocket real-time toi client.
 * Topic pattern: /topic/showtimes/{showtimeId}/seats
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    private static final String SEATS_TOPIC_PREFIX = "/topic/showtimes/";
    private static final String SEATS_TOPIC_SUFFIX = "/seats";

    /**
     * Broadcast cap nhat trang thai ghe toi tat ca client dang xem cung suat chieu.
     *
     * @param showtimeId ID suat chieu
     * @param seatIds    Danh sach ID ghe can cap nhat
     * @param status     Trang thai moi (AVAILABLE, LOCKED, BOOKED)
     * @param action     Hanh dong (HOLD, RELEASE, BOOKED)
     */
    public void broadcastSeatUpdate(Long showtimeId, List<Long> seatIds, ShowtimeSeatStatus status, String action) {
        String destination = SEATS_TOPIC_PREFIX + showtimeId + SEATS_TOPIC_SUFFIX;

        SeatStatusUpdateMessage message = SeatStatusUpdateMessage.builder()
                .showtimeId(showtimeId)
                .seatIds(seatIds)
                .status(status)
                .action(action)
                .timestamp(LocalDateTime.now())
                .build();

        try {
            messagingTemplate.convertAndSend(destination, message);
            log.info("WebSocket BROADCAST thanh cong: destination={}, action={}, seatsCount={}",
                    destination, action, seatIds.size());
        } catch (Exception e) {
            log.error("WebSocket BROADCAST that bai: destination={}, error={}", destination, e.getMessage(), e);
        }
    }

    /**
     * Broadcast su kien giu cho (HOLD) -> chuyen ghe sang LOCKED tren UI client.
     */
    public void broadcastSeatHold(Long showtimeId, List<Long> seatIds) {
        broadcastSeatUpdate(showtimeId, seatIds, ShowtimeSeatStatus.LOCKED, "HOLD");
    }

    /**
     * Broadcast su kien nha ghe (RELEASE) -> chuyen ghe ve AVAILABLE tren UI client.
     */
    public void broadcastSeatRelease(Long showtimeId, List<Long> seatIds) {
        broadcastSeatUpdate(showtimeId, seatIds, ShowtimeSeatStatus.AVAILABLE, "RELEASE");
    }

    /**
     * Broadcast su kien thanh toan thanh cong (BOOKED) -> chuyen ghe sang BOOKED tren UI client.
     */
    public void broadcastSeatBooked(Long showtimeId, List<Long> seatIds) {
        broadcastSeatUpdate(showtimeId, seatIds, ShowtimeSeatStatus.BOOKED, "BOOKED");
    }
}