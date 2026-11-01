package com.cinema.booking.repository;

import com.cinema.booking.entity.Booking;
import com.cinema.booking.enums.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByBookingCode(String bookingCode);

    List<Booking> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Tim tat ca don PENDING da het han (dung cho Cronjob - Cong viec 4.3).
     */
    @Query("SELECT b FROM Booking b " +
           "WHERE b.status = :status " +
           "AND b.expiresAt < :now")
    List<Booking> findExpiredBookings(
            @Param("status") BookingStatus status,
            @Param("now") LocalDateTime now);

    /**
     * Kiem tra nguoi dung co don PENDING cho cung suat chieu khong
     * (tranh dat nhieu don cung luc cho 1 suat chieu).
     */
    @Query("SELECT COUNT(b) > 0 FROM Booking b " +
           "WHERE b.user.id = :userId " +
           "AND b.showtime.id = :showtimeId " +
           "AND b.status = 'PENDING'")
    boolean existsPendingBookingByUserAndShowtime(
            @Param("userId") Long userId,
            @Param("showtimeId") Long showtimeId);
}
