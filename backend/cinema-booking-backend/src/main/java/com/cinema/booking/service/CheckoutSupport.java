package com.cinema.booking.service;

import com.cinema.booking.config.BookingClockConfig;
import com.cinema.booking.dto.response.CheckoutResponse;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.*;
import com.cinema.booking.exception.*;
import com.cinema.booking.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;

@Component @RequiredArgsConstructor
public class CheckoutSupport {
    private static final ObjectMapper CANONICAL_JSON = new ObjectMapper();
    private final Clock clock;
    private final UserRepository users;
    private final PaymentAttemptRepository attempts;
    private final PaymentRepository payments;

    public LocalDateTime now() { return LocalDateTime.now(clock); }
    public Instant instant() { return clock.instant(); }
    public Instant deadline(Booking b) { return b.getExpiresAt().atZone(BookingClockConfig.ZONE).toInstant(); }

    public void authorize(Booking b, String email) {
        User user = users.findByEmail(email).orElseThrow(() -> new ForbiddenException("Vui lòng đăng nhập lại."));
        if (!b.getUser().getId().equals(user.getId()) && user.getRole() != UserRole.ADMIN)
            throw new ForbiddenException("Bạn không có quyền truy cập đơn này.");
    }

    public boolean live(Booking b) {
        return b.getStatus() == BookingStatus.PENDING && b.getExpiresAt().isAfter(now());
    }

    public CheckoutState state(Booking b, PaymentAttempt attempt) {
        if (!live(b)) return CheckoutState.CLOSED;
        if (attempt == null) {
            // Old payments have no durable gateway identity. Never guess that they were not sent.
            return payments.findByBookingId(b.getId()).isPresent() ? CheckoutState.UNKNOWN : CheckoutState.EDITABLE;
        }
        if (attempt.getState() == CheckoutState.REJECTED) return CheckoutState.EDITABLE;
        if (attempt.getState() == CheckoutState.CREATING && !attempt.getLeaseUntil().isAfter(now()))
            return CheckoutState.UNKNOWN;
        return attempt.getState();
    }

    public CheckoutResponse view(Booking b) {
        PaymentAttempt attempt = attempts.findFirstByBookingIdOrderByIdDesc(b.getId()).orElse(null);
        CheckoutState state = state(b, attempt);
        return CheckoutResponse.builder().state(state).canEditProducts(state == CheckoutState.EDITABLE)
                .expiresAt(deadline(b)).paymentMethod(attempt == null ? null : attempt.getMethod())
                .paymentUrl(state == CheckoutState.READY ? attempt.getPaymentUrl() : null).build();
    }

    public void requireLive(Booking b) {
        if (!live(b)) throw new ConflictException("Đơn đã thanh toán, bị hủy hoặc hết thời gian giữ ghế. Vui lòng kiểm tra lại.");
    }

    public void requireRevision(Booking b, String expected) {
        if (expected == null || !MessageDigest.isEqual(revision(b).getBytes(StandardCharsets.UTF_8), expected.getBytes(StandardCharsets.UTF_8)))
            throw new ConflictException("Đơn đã thay đổi. Vui lòng tải lại và xác nhận thông tin trước khi thanh toán.");
    }

    public static BigDecimal money(BigDecimal value) {
        try {
            if (value == null || value.signum() < 0 || value.compareTo(new BigDecimal("9999999999")) > 0)
                throw new ArithmeticException();
            value.longValueExact(); // VND has no fractional payment amount in this integration.
            return value.setScale(2, RoundingMode.UNNECESSARY);
        } catch (ArithmeticException e) {
            throw new BadRequestException("Giá tiền không hợp lệ hoặc vượt giới hạn thanh toán.");
        }
    }

    public String revision(Booking b) {
        try {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("format", "checkout-v1"); data.put("code", b.getBookingCode());
            data.put("status", b.getStatus().name()); data.put("deadline", Long.toString(deadline(b).toEpochMilli()));
            data.put("seats", b.getBookingSeats().stream().sorted(Comparator.comparing(s -> s.getShowtimeSeat().getId()))
                    .map(s -> List.of(s.getShowtimeSeat().getId().toString(), money(s.getPrice()).toPlainString())).toList());
            data.put("products", b.getBookingProducts().stream().sorted(Comparator.comparing(p -> p.getProduct().getId()))
                    .map(p -> List.of(p.getProduct().getId().toString(), p.getQuantity(), money(p.getUnitPrice()).toPlainString())).toList());
            data.put("total", money(b.getTotalAmount()).toPlainString());
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(CANONICAL_JSON.writeValueAsBytes(data)));
        } catch (AppException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("Cannot construct checkout revision", e); }
    }
}
