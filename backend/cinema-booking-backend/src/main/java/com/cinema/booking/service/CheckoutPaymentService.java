package com.cinema.booking.service;

import com.cinema.booking.config.VNPayConfig;
import com.cinema.booking.dto.request.PaymentCreateUrlRequest;
import com.cinema.booking.dto.response.PaymentUrlResponse;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.*;
import com.cinema.booking.exception.*;
import com.cinema.booking.repository.*;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;

@Service @RequiredArgsConstructor @Slf4j
public class CheckoutPaymentService {
    private final BookingRepository bookings;
    private final PaymentRepository payments;
    private final PaymentAttemptRepository attempts;
    private final CheckoutSupport checkout;
    private final PaymentGateway gateway;
    private final TransactionTemplate transactions;

    private record Reservation(Long id, PaymentGateway.Order order, PaymentUrlResponse existing) { }

    public PaymentUrlResponse create(PaymentCreateUrlRequest request, String email, HttpServletRequest http) {
        Reservation reserved = transactions.execute(status -> reserve(request, email, VNPayConfig.getIpAddress(http)));
        if (reserved.existing() != null) return reserved.existing();
        String url = null;
        try { url = gateway.create(reserved.order()); }
        catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            // Do not log a gateway exception message: it can contain a signed URL or request body.
            log.warn("Payment URL outcome unknown: attempt={}, type={}", reserved.id(), e.getClass().getSimpleName());
        }
        final String result = url;
        return transactions.execute(status -> {
            Booking b = bookings.findByCodeForUpdate(request.getBookingCode()).orElseThrow();
            PaymentAttempt a = attempts.findById(reserved.id()).orElseThrow();
            if (!checkout.live(b) || a.getOutcome() != PaymentStatus.PENDING) return reply(b, a, CheckoutState.CLOSED);
            if (a.getState() == CheckoutState.CREATING || a.getState() == CheckoutState.UNKNOWN) {
                a.setState(result == null ? CheckoutState.UNKNOWN : CheckoutState.READY);
                a.setPaymentUrl(result);
            }
            return reply(b, a, checkout.state(b, a));
        });
    }

    private Reservation reserve(PaymentCreateUrlRequest request, String email, String ip) {
        Booking b = bookings.findByCodeForUpdate(request.getBookingCode()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy đơn đặt vé."));
        checkout.authorize(b, email); checkout.requireLive(b);
        String method = request.getPaymentMethod().toUpperCase(Locale.ROOT);
        PaymentAttempt latest = attempts.findFirstByBookingIdOrderByIdDesc(b.getId()).orElse(null);
        CheckoutState state = checkout.state(b, latest);
        if (state != CheckoutState.EDITABLE) {
            if (latest == null || !latest.getMethod().equals(method) || !latest.getRevision().equals(request.getExpectedRevision()))
                throw new ConflictException("Đơn đã có phiên thanh toán. Vui lòng kiểm tra lại trạng thái.");
            return new Reservation(latest.getId(), null, reply(b, latest, state));
        }
        checkout.requireRevision(b, request.getExpectedRevision()); gateway.validate(method);
        CheckoutSupport.money(b.getTotalAmount());
        String token = UUID.randomUUID().toString().replace("-", "");
        PaymentAttempt a = attempts.saveAndFlush(PaymentAttempt.builder().booking(b).method(method).revision(request.getExpectedRevision())
                .amount(b.getTotalAmount()).providerOrderId(token).requestId(token)
                .state(CheckoutState.CREATING).outcome(PaymentStatus.PENDING).createdAt(checkout.now())
                .leaseUntil(checkout.now().plusSeconds(90)).expiresAt(b.getExpiresAt()).build());
        Payment payment = payments.findByBookingId(b.getId()).orElseGet(() -> Payment.builder().booking(b).build());
        if (payment.getStatus() == PaymentStatus.SUCCESS || payment.getStatus() == PaymentStatus.REFUND_REQUIRED || payment.getStatus() == PaymentStatus.REFUNDED)
            throw new ConflictException("Đơn đã có kết quả thanh toán. Vui lòng kiểm tra lại.");
        payment.setPaymentMethod(method); payment.setAmount(a.getAmount()); payment.setStatus(PaymentStatus.PENDING);
        payments.save(payment);
        return new Reservation(a.getId(), new PaymentGateway.Order(b.getBookingCode(), method, a.getAmount(), a.getProviderOrderId(), a.getRequestId(), a.getExpiresAt(), ip), null);
    }

    private PaymentUrlResponse reply(Booking b, PaymentAttempt a, CheckoutState state) {
        return PaymentUrlResponse.builder().bookingCode(b.getBookingCode()).paymentMethod(a.getMethod()).amount(a.getAmount())
                .expiresAt(b.getExpiresAt()).state(state).paymentUrl(state == CheckoutState.READY ? a.getPaymentUrl() : null).build();
    }
}
