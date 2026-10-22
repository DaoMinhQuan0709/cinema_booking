package com.cinema.booking.dto.response;

import com.cinema.booking.enums.BookingStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingHistoryResponse {

    private Long id;
    private String bookingCode;
    private String movieTitle;
    private String cinemaName;
    private String auditoriumName;
    private LocalDateTime showStartTime;
    private BigDecimal totalAmount;
    private BookingStatus status;
    private String qrCodeUrl;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}