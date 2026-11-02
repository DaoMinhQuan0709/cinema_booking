package com.cinema.booking.service;

import com.cinema.booking.dto.request.MoMoIpnRequest;
import com.cinema.booking.dto.request.PaymentCreateUrlRequest;
import com.cinema.booking.dto.response.MoMoIpnResponse;
import com.cinema.booking.dto.response.PaymentUrlResponse;
import com.cinema.booking.dto.response.VNPayIpnResponse;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;

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

    /**
     * Xu ly Webhook IPN tu cong thanh toan VNPay.
     *
     * @param allParams Toan bo query parameters nhan tu VNPay
     * @return VNPayIpnResponse theo dinh dang chuan cua VNPay (RspCode, Message)
     */
    VNPayIpnResponse processVNPayIpn(Map<String, String> allParams);

    /**
     * Xu ly Webhook IPN tu cong thanh toan MoMo.
     *
     * @param request Request body nhan tu MoMo
     * @return MoMoIpnResponse theo dinh dang chuan cua MoMo (resultCode, message)
     */
    MoMoIpnResponse processMoMoIpn(MoMoIpnRequest request);
}