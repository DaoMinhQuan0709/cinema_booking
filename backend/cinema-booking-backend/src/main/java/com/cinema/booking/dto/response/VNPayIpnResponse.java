package com.cinema.booking.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VNPayIpnResponse {

    @JsonProperty("RspCode")
    private String rspCode;

    @JsonProperty("Message")
    private String message;

    public static VNPayIpnResponse success() {
        return new VNPayIpnResponse("00", "Confirm Success");
    }

    public static VNPayIpnResponse orderNotFound() {
        return new VNPayIpnResponse("01", "Order not Found");
    }

    public static VNPayIpnResponse alreadyConfirmed() {
        return new VNPayIpnResponse("02", "Order already confirmed");
    }

    public static VNPayIpnResponse invalidAmount() {
        return new VNPayIpnResponse("04", "Invalid Amount");
    }

    public static VNPayIpnResponse invalidChecksum() {
        return new VNPayIpnResponse("97", "Invalid Checksum");
    }

    public static VNPayIpnResponse otherError(String message) {
        return new VNPayIpnResponse("99", message != null ? message : "Unknown Error");
    }
}