package com.cinema.booking.dto.response;

import com.cinema.booking.enums.BookingStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO response chi tiet don dat ve sau khi tao thanh cong.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingResponse {

    private Long id;
    private String bookingCode;
    private BookingStatus status;
    private BigDecimal totalAmount;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;

    // Thong tin suat chieu
    private ShowtimeInfo showtime;

    // Danh sach ghe da giu
    private List<SeatInfo> seats;

    // Danh sach bap nuoc
    private List<ProductInfo> products;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ShowtimeInfo {
        private Long showtimeId;
        private String movieTitle;
        private String cinemaName;
        private String auditoriumName;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SeatInfo {
        private Long showtimeSeatId;
        private String rowChar;
        private Integer seatNumber;
        private String seatType;
        private BigDecimal price;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ProductInfo {
        private Long productId;
        private String productName;
        private Integer quantity;
        private BigDecimal unitPrice;
        private BigDecimal subtotal;
    }
}
