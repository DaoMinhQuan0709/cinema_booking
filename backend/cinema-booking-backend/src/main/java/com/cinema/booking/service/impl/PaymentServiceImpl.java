package com.cinema.booking.service.impl;

import com.cinema.booking.config.*;
import com.cinema.booking.dto.request.*;
import com.cinema.booking.dto.response.*;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.*;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.*;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.*;

@Service @RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {
    private final CheckoutPaymentService checkoutPayments;
    private final CheckoutSupport checkout;
    private final BookingRepository bookings;
    private final PaymentRepository payments;
    private final PaymentAttemptRepository attempts;
    private final ShowtimeSeatRepository seats;
    private final SeatChanges seatChanges;
    private final TicketFulfillmentService fulfillment;
    private final VNPayConfig vnpay;
    private final MoMoConfig momo;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @Override
    public PaymentUrlResponse createPaymentUrl(PaymentCreateUrlRequest request, String email, HttpServletRequest http) {
        return checkoutPayments.create(request, email, http);
    }

    @Override @Transactional
    public VNPayIpnResponse processVNPayIpn(Map<String, String> params) {
        if (!vnpay.verifyIpnChecksum(params) || !Objects.equals(vnpay.getTmnCode(), params.get("vnp_TmnCode")))
            return VNPayIpnResponse.invalidChecksum();
        PaymentAttempt a = context(params.get("vnp_TxnRef"), "VNPAY");
        if (a == null) return VNPayIpnResponse.orderNotFound();
        BigDecimal amount;
        try { amount = new BigDecimal(params.get("vnp_Amount")).movePointLeft(2); }
        catch (Exception e) { return VNPayIpnResponse.invalidAmount(); }
        if (amount.compareTo(a.getAmount()) != 0) return VNPayIpnResponse.invalidAmount();
        if (a.getOutcome() != PaymentStatus.PENDING) return VNPayIpnResponse.alreadyConfirmed();
        boolean success = "00".equals(params.get("vnp_ResponseCode")) && "00".equals(params.get("vnp_TransactionStatus"));
        if (success && (params.get("vnp_TransactionNo") == null || params.get("vnp_TransactionNo").isBlank() || "0".equals(params.get("vnp_TransactionNo"))))
            return VNPayIpnResponse.otherError("Invalid transaction identity");
        settle(a, success, "02".equals(params.get("vnp_TransactionStatus")), params.get("vnp_TransactionNo"));
        return VNPayIpnResponse.success();
    }

    @Override @Transactional
    public MoMoIpnResponse processMoMoIpn(MoMoIpnRequest request) {
        if (!momo.verifyIpnSignature(request) || !Objects.equals(momo.getPartnerCode(), request.getPartnerCode()))
            return MoMoIpnResponse.invalidSignature();
        PaymentAttempt a = context(request.getOrderId(), "MOMO");
        if (a == null || !Objects.equals(a.getRequestId(), request.getRequestId())) return MoMoIpnResponse.error(1, "Order not found");
        if (request.getAmount() == null || a.getAmount().compareTo(BigDecimal.valueOf(request.getAmount())) != 0)
            return MoMoIpnResponse.error(4, "Invalid amount");
        if (a.getOutcome() != PaymentStatus.PENDING) return MoMoIpnResponse.alreadyConfirmed();
        int code = request.getResultCode() == null ? -1 : request.getResultCode();
        if (code == 0 && (request.getTransId() == null || request.getTransId() <= 0)) return MoMoIpnResponse.error(4, "Invalid transaction identity");
        boolean finalFailure = Set.of(1001, 1002, 1003, 1004, 1005, 1006, 1007, 1017, 1026).contains(code);
        settle(a, code == 0, finalFailure, request.getTransId() == null ? null : request.getTransId().toString());
        return MoMoIpnResponse.success();
    }

    private PaymentAttempt context(String reference, String method) {
        if (reference == null) return null;
        var found = attempts.findByProviderOrderId(reference);
        if (found.isEmpty() || !method.equals(found.get().getMethod())) return null;
        var candidate = found.get();
        var booking = bookings.findByCodeForUpdate(candidate.getBooking().getBookingCode()).orElse(null);
        if (booking == null) return null;
        // The candidate/proxy may have been read before waiting for the booking lock.
        entityManager.refresh(booking);
        entityManager.refresh(candidate);
        return candidate;
    }

    private void settle(PaymentAttempt a, boolean success, boolean finalFailure, String transaction) {
        Booking b = a.getBooking();
        Payment payment = payments.findByBookingId(b.getId()).orElse(null);
        if (payment == null || a.getOutcome() != PaymentStatus.PENDING) return;
        if (!success) {
            if (!finalFailure) { a.setState(CheckoutState.UNKNOWN); return; }
            a.setOutcome(PaymentStatus.FAILED); a.setState(CheckoutState.REJECTED);
            if (attempts.findFirstByBookingIdOrderByIdDesc(b.getId()).map(latest -> latest.getId().equals(a.getId())).orElse(false)
                    && payment.getStatus() == PaymentStatus.PENDING) payment.setStatus(PaymentStatus.FAILED);
            return;
        }
        a.setState(CheckoutState.CLOSED);
        if (payment.getStatus() == PaymentStatus.SUCCESS || payment.getStatus() == PaymentStatus.REFUND_REQUIRED || payment.getStatus() == PaymentStatus.REFUNDED) {
            a.setOutcome(PaymentStatus.REFUND_REQUIRED); return;
        }
        List<ShowtimeSeat> locked = seatChanges.lockedSeats(b);
        boolean canBook = locked.size() == b.getBookingSeats().size() && !locked.isEmpty()
                && (b.getStatus() == BookingStatus.PENDING || b.getStatus() == BookingStatus.EXPIRED)
                && locked.stream().allMatch(s -> SeatChanges.owns(b, s) || s.getStatus() == ShowtimeSeatStatus.AVAILABLE);
        payment.setTransactionNo(a.getMethod() + ":" + transaction); payment.setPaidAt(checkout.now());
        if (!canBook) {
            payment.setStatus(PaymentStatus.REFUND_REQUIRED); a.setOutcome(PaymentStatus.REFUND_REQUIRED); return;
        }
        Map<Long, String> tokens = SeatChanges.tokens(locked);
        locked.forEach(s -> { s.setStatus(ShowtimeSeatStatus.BOOKED); s.setLockedByUser(null); s.setLockedUntil(null); s.setLockToken(null); });
        b.setStatus(BookingStatus.CONFIRMED); payment.setStatus(PaymentStatus.SUCCESS); a.setOutcome(PaymentStatus.SUCCESS);
        seats.flush();
        seatChanges.afterCommit(b.getShowtime().getId(), locked, tokens, () -> fulfillment.fulfillTicketAsync(b.getId()));
    }
}
