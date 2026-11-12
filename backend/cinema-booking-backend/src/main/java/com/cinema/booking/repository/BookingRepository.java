package com.cinema.booking.repository;

import com.cinema.booking.entity.Booking;
import com.cinema.booking.enums.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByBookingCode(String bookingCode);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Booking b WHERE b.bookingCode = :code")
    Optional<Booking> findByCodeForUpdate(@Param("code") String code);

    @Query("SELECT b.bookingCode FROM Booking b WHERE b.status = 'PENDING' AND b.expiresAt <= :now ORDER BY b.id")
    List<String> findExpiredCodes(@Param("now") LocalDateTime now);

    @Query("SELECT COUNT(bs) > 0 FROM BookingSeat bs WHERE bs.showtimeSeat.id = :seatId AND bs.booking.status = 'PENDING' AND bs.booking.expiresAt > :now")
    boolean hasLiveHold(@Param("seatId") Long seatId, @Param("now") LocalDateTime now);

    boolean existsByShowtimeId(Long showtimeId);

    @EntityGraph(attributePaths = {"showtime.movie", "showtime.auditorium.cinema"})
    List<Booking> findByUserIdOrderByCreatedAtDesc(Long userId);

    /**
     * Tim tat ca don PENDING da het han (dung cho Cronjob - Cong viec 4.3).
     * Su dung JOIN FETCH de load san showtime va bookingSeats tranh N+1 query.
     */
    @Query("SELECT DISTINCT b FROM Booking b " +
           "LEFT JOIN FETCH b.showtime s " +
           "LEFT JOIN FETCH b.bookingSeats bs " +
           "LEFT JOIN FETCH bs.showtimeSeat ss " +
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

    // Đếm ghế bằng truy vấn con theo đơn, không JOIN collection làm nhân totalAmount.
    String REPORT_METRICS = """
            COALESCE(SUM(b.totalAmount), 0) AS revenue, COUNT(b) AS bookingCount,
            COALESCE(SUM((SELECT COUNT(bs) FROM BookingSeat bs
                WHERE bs.booking = b AND bs.showtimeSeat.status = 'BOOKED')), 0) AS ticketCount
            """;
    String REPORT_FILTER = """
            FROM Booking b WHERE b.status = 'CONFIRMED'
            AND (cast(:start as timestamp) IS NULL OR b.createdAt >= :start)
            AND (cast(:end as timestamp) IS NULL OR b.createdAt < :end)
            AND (:cinemaId IS NULL OR b.showtime.auditorium.cinema.id = :cinemaId)
            AND (:movieId IS NULL OR b.showtime.movie.id = :movieId)
            """;

    @Query("SELECT " + REPORT_METRICS + REPORT_FILTER)
    RevenueTotals summarizeRevenue(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end,
                                   @Param("cinemaId") Long cinemaId, @Param("movieId") Long movieId);

    @Query("SELECT b.showtime.movie.id AS id, b.showtime.movie.title AS label, " + REPORT_METRICS + REPORT_FILTER +
            "GROUP BY b.showtime.movie.id, b.showtime.movie.title ORDER BY b.showtime.movie.id")
    List<RevenueGroup> calculateRevenueByMovie(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end,
                                             @Param("cinemaId") Long cinemaId, @Param("movieId") Long movieId);

    @Query("SELECT b.showtime.auditorium.cinema.id AS id, b.showtime.auditorium.cinema.name AS label, " + REPORT_METRICS + REPORT_FILTER +
            "GROUP BY b.showtime.auditorium.cinema.id, b.showtime.auditorium.cinema.name ORDER BY b.showtime.auditorium.cinema.id")
    List<RevenueGroup> calculateRevenueByCinema(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end,
                                              @Param("cinemaId") Long cinemaId, @Param("movieId") Long movieId);
}
