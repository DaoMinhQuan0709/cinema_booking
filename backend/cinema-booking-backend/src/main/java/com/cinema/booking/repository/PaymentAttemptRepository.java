package com.cinema.booking.repository;

import com.cinema.booking.entity.PaymentAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface PaymentAttemptRepository extends JpaRepository<PaymentAttempt, Long> {
    Optional<PaymentAttempt> findFirstByBookingIdOrderByIdDesc(Long bookingId);
    Optional<PaymentAttempt> findByProviderOrderId(String providerOrderId);

    // Resolve only the code before acquiring the booking lock, avoiding a stale managed attempt.
    @Query("select a.booking.bookingCode from PaymentAttempt a where a.providerOrderId = :reference and a.method = 'VNPAY'")
    Optional<String> findVNPayBookingCode(@Param("reference") String reference);
}
