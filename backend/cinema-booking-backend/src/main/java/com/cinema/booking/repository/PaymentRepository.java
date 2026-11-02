package com.cinema.booking.repository;

import com.cinema.booking.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByBookingId(Long bookingId);

    Optional<Payment> findByBooking_BookingCode(String bookingCode);

    Optional<Payment> findByTransactionNo(String transactionNo);
}