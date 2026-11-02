package com.cinema.booking.controller;

import com.cinema.booking.dto.request.PaymentCreateUrlRequest;
import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.PaymentUrlResponse;
import com.cinema.booking.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST Controller xu ly thanh toan (Cong viec 5.1).
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
     *
     * Request body:
     * {
     *   "bookingCode": "BK20261102123456ABCD",
     *   "paymentMethod": "VNPAY"
     * }
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
}