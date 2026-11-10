package com.cinema.booking.service;

import com.cinema.booking.config.VNPayConfig;
import com.cinema.booking.dto.response.PaymentResultResponse;
import com.cinema.booking.enums.PaymentStatus;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.repository.PaymentAttemptRepository;
import com.cinema.booking.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class PaymentReturnService {
    private final VNPayConfig vnpay;
    private final PaymentAttemptRepository attempts;
    private final PaymentRepository payments;
    private final BookingService bookings;

    /** Return URL is for display only. Only authenticated IPN processing settles a booking. */
    @Transactional
    public PaymentResultResponse verifyVNPay(Map<String, String> params, String email) {
        if (params == null || params.size() > 32 || params.entrySet().stream().anyMatch(e ->
                e.getKey() == null || e.getKey().length() > 64 || e.getValue() == null || e.getValue().length() > 2048)
                || !matches(params, "vnp_TxnRef", "[a-zA-Z0-9]{1,100}")
                || !matches(params, "vnp_SecureHash", "[a-fA-F0-9]{128}")
                || !matches(params, "vnp_Amount", "[0-9]{1,12}")
                || !matches(params, "vnp_ResponseCode", "[0-9]{2}")
                || !matches(params, "vnp_TransactionStatus", "[0-9]{2}"))
            throw new BadRequestException("Thông tin trả về từ VNPay không hợp lệ.");
        if (!Objects.equals(vnpay.getTmnCode(), params.get("vnp_TmnCode")) || !vnpay.verifyIpnChecksum(params))
            throw new BadRequestException("Không xác minh được chữ ký kết quả VNPay. Vui lòng kiểm tra lại đơn đặt vé.");

        String reference = params.get("vnp_TxnRef");
        String code = attempts.findVNPayBookingCode(reference)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiên thanh toán."));
        // This call authorizes owner/admin and holds the booking lock for this transaction.
        var booking = bookings.getBookingByCode(code, email);
        var attempt = attempts.findByProviderOrderId(reference)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phiên thanh toán."));
        if (new BigDecimal(params.get("vnp_Amount")).movePointLeft(2).compareTo(attempt.getAmount()) != 0)
            throw new BadRequestException("Số tiền VNPay trả về không khớp phiên thanh toán.");
        var paymentStatus = payments.findByBookingId(booking.getId()).map(p -> p.getStatus()).orElse(PaymentStatus.PENDING);
        // A result page does not need the resumable, signed payment URL.
        if (booking.getCheckout() != null) booking.getCheckout().setPaymentUrl(null);
        return new PaymentResultResponse(booking, paymentStatus, attempt.getOutcome(),
                params.get("vnp_ResponseCode"), params.get("vnp_TransactionStatus"));
    }

    private static boolean matches(Map<String, String> params, String key, String regex) {
        return params.get(key) != null && params.get(key).matches(regex);
    }
}
