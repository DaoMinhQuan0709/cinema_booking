package com.cinema.booking.controller;

import com.cinema.booking.dto.request.MoMoIpnRequest;
import com.cinema.booking.dto.request.PaymentCreateUrlRequest;
import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.MoMoIpnResponse;
import com.cinema.booking.dto.response.PaymentUrlResponse;
import com.cinema.booking.dto.response.VNPayIpnResponse;
import com.cinema.booking.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST Controller xu ly thanh toan (Cong viec 5.1 & 5.2).
 * Base path: /api/v1/payments
 */
@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;

    /**
     * POST /api/v1/payments/create-url - Sinh URL thanh toan Sandbox (VNPay / MoMo).
     */
    @PostMapping("/create-url")
    public ResponseEntity<ApiResponse<PaymentUrlResponse>> createPaymentUrl(
            @Valid @RequestBody PaymentCreateUrlRequest request,
            @AuthenticationPrincipal UserDetails userDetails,
            HttpServletRequest servletRequest) {

        log.info("POST /api/v1/payments/create-url - user={}, bookingCode={}, method={}",
                userDetails.getUsername(), request.getBookingCode(), request.getPaymentMethod());

        PaymentUrlResponse response = paymentService.createPaymentUrl(
                request, userDetails.getUsername(), servletRequest);

        return ResponseEntity.ok(ApiResponse.success(200, "Tao URL thanh toan thanh cong", response));
    }

    /**
     * GET /api/v1/payments/vnpay-ipn - Webhook IPN tu VNPay (Cong viec 5.2).
     * Endpoint public duoc VNPay goi qua phuong thuc GET de cap nhat trang thai thanh toan.
     */
    @GetMapping("/vnpay-ipn")
    public ResponseEntity<VNPayIpnResponse> vnpayIpn(@RequestParam Map<String, String> allParams) {
        log.info("GET /api/v1/payments/vnpay-ipn - params={}", allParams);
        VNPayIpnResponse response = paymentService.processVNPayIpn(allParams);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/v1/payments/momo-ipn - Webhook IPN tu MoMo (Cong viec 5.2).
     * Endpoint public duoc MoMo goi qua phuong thuc POST de cap nhat trang thai thanh toan.
     */
    @PostMapping("/momo-ipn")
    public ResponseEntity<MoMoIpnResponse> momoIpn(@RequestBody MoMoIpnRequest request) {
        log.info("POST /api/v1/payments/momo-ipn - orderId={}", request.getOrderId());
        MoMoIpnResponse response = paymentService.processMoMoIpn(request);
        return ResponseEntity.ok(response);
    }
}