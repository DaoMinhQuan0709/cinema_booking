package com.cinema.booking.dto.response;

import com.cinema.booking.enums.CheckoutState;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;

@Data @Builder
public class CheckoutResponse {
    private CheckoutState state;
    private boolean canEditProducts;
    private String paymentMethod;
    private String paymentUrl;
    private Instant expiresAt;
}
