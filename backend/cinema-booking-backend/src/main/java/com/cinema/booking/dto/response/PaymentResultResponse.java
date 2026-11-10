package com.cinema.booking.dto.response;

import com.cinema.booking.enums.PaymentStatus;

/** Verified gateway return plus the independently persisted booking/payment state. */
public record PaymentResultResponse(BookingResponse booking, PaymentStatus paymentStatus,
        PaymentStatus attemptStatus, String gatewayResponseCode, String gatewayTransactionStatus) { }
