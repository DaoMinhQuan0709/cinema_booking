package com.cinema.booking.service;

import com.cinema.booking.dto.request.PaymentCreateUrlRequest;
import com.cinema.booking.dto.response.PaymentUrlResponse;
import jakarta.servlet.http.HttpServletRequest;

public interface PaymentService {

    /**
     * Sinh URL thanh toan Sandbox (VNPay / MoMo) cho don dat ve.
     *
     * @param request        Chua bookingCode va paymentMethod
     * @param userEmail      Email nguoi dung dang dang nhap
     * @param servletRequest HttpServletRequest de lay client IP
     * @return PaymentUrlResponse chua URL thanh toan va thong tin don
     */
    PaymentUrlResponse createPaymentUrl(PaymentCreateUrlRequest request, String userEmail, HttpServletRequest servletRequest);
}