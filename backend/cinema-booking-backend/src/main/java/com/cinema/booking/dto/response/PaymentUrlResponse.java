package com.cinema.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentUrlResponse {

    private String paymentUrl;
    private String bookingCode;
    private String paymentMethod;
    private BigDecimal amount;
    private LocalDateTime expiresAt;
}