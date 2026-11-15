package com.cinema.booking.service;

import com.cinema.booking.entity.PaymentAttempt;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.Objects;

/** Giữ bằng chứng theo attempt; khóa danh tính giao dịch giữa các đơn khác nhau. */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentReceiptService {
    private final EntityManager em;
    private final CheckoutSupport checkout;

    public boolean record(PaymentAttempt attempt, String transaction) {
        if (transaction == null || transaction.isBlank() || transaction.length() > 100) return false;
        String identity = attempt.getMethod() + ":" + transaction;
        if (identity.length() > 100 || !transaction.equals(transaction.strip())) return false;
        boolean locked = Boolean.TRUE.equals(em.createNativeQuery("select pg_try_advisory_xact_lock(hashtextextended(:key, 0))", Boolean.class)
                .setParameter("key", "payment-receipt:" + identity).getSingleResult());
        if (!locked) return false;
        long others = ((Number) em.createNativeQuery("select count(*) from payment_attempts where method=:method and provider_transaction_id=:tx and id<>:id")
                .setParameter("method", attempt.getMethod()).setParameter("tx", transaction).setParameter("id", attempt.getId()).getSingleResult()).longValue();
        long legacy = ((Number) em.createNativeQuery("select count(*) from payments where transaction_no=:tx and booking_id<>:booking")
                .setParameter("tx", identity).setParameter("booking", attempt.getBooking().getId()).getSingleResult()).longValue();
        if (others > 0 || legacy > 0 || (attempt.getProviderTransactionId() != null && !Objects.equals(attempt.getProviderTransactionId(), transaction))) {
            log.warn("Giao dịch provider mâu thuẫn; giữ nguyên bằng chứng, attempt={}", attempt.getId());
            return false;
        }
        // Không đoán attempt của cùng đơn nếu một giao dịch legacy chưa có liên kết.
        if (attempt.getProviderTransactionId() == null) {
            long ownLegacy = ((Number) em.createNativeQuery("select count(*) from payments where transaction_no=:tx and booking_id=:booking")
                    .setParameter("tx", identity).setParameter("booking", attempt.getBooking().getId()).getSingleResult()).longValue();
            if (ownLegacy > 0) return false;
            attempt.setProviderTransactionId(transaction);
            attempt.setReceivedAt(checkout.now());
            em.flush();
        }
        return true;
    }
}
