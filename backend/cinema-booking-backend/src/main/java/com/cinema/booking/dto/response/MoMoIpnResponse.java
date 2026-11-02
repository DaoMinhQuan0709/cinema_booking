package com.cinema.booking.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MoMoIpnResponse {

    private int resultCode;
    private String message;

    public static MoMoIpnResponse success() {
        return new MoMoIpnResponse(0, "Confirm Success");
    }

    public static MoMoIpnResponse alreadyConfirmed() {
        return new MoMoIpnResponse(0, "Order already confirmed");
    }

    public static MoMoIpnResponse invalidSignature() {
        return new MoMoIpnResponse(97, "Invalid signature");
    }

    public static MoMoIpnResponse error(int code, String message) {
        return new MoMoIpnResponse(code, message);
    }
}