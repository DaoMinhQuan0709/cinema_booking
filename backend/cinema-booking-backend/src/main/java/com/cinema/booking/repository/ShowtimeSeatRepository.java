package com.cinema.booking.repository;

import com.cinema.booking.entity.ShowtimeSeat;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

@Repository
public interface ShowtimeSeatRepository extends JpaRepository<ShowtimeSeat, Long> {

    @Query("SELECT ss FROM ShowtimeSeat ss " +
           "JOIN FETCH ss.seat s " +
           "WHERE ss.showtime.id = :showtimeId " +
           "ORDER BY s.rowChar ASC, s.seatNumber ASC")
    List<ShowtimeSeat> findByShowtimeIdWithSeat(@Param("showtimeId") Long showtimeId);

    /**
     * Truy van Pessimistic Lock: Lay danh sach ghe theo IDs voi trang thai AVAILABLE.
     * FOR UPDATE NOWAIT: Khong cho doi, throw exception ngay neu row dang bi lock.
     * Su dung trong Buoc 3 cua Two-Layer Locking.
     */
    @Query(value = "SELECT ss.* FROM showtime_seats ss " +
                   "WHERE ss.id IN :seatIds " +
                   "AND ss.status = 'AVAILABLE' " +
                   "ORDER BY ss.id ASC " +
                   "FOR UPDATE NOWAIT",
           nativeQuery = true)
    List<ShowtimeSeat> findAvailableSeatsForUpdateNowait(@Param("seatIds") List<Long> seatIds);

    /**
     * Tim tat ca ghe theo danh sach IDs (khong lock, dung de doc thong tin).
     */
    List<ShowtimeSeat> findAllByIdIn(List<Long> ids);

    /**
     * Tim tat ca ghe cua mot suat chieu voi trang thai cu the.
     */
    List<ShowtimeSeat> findByShowtimeIdAndStatus(Long showtimeId, ShowtimeSeatStatus status);

    /**
     * Tim tat ca ghe dang bi LOCKED ma thoi gian locked_until da qua (dung cho Cronjob 4.3 quet ghe mo coi).
     */
    @Query("SELECT ss FROM ShowtimeSeat ss " +
           "JOIN FETCH ss.showtime st " +
           "WHERE ss.status = :status " +
           "AND ss.lockedUntil < :now")
    List<ShowtimeSeat> findExpiredLockedSeats(
            @Param("status") ShowtimeSeatStatus status,
            @Param("now") LocalDateTime now);

    @Query("SELECT COUNT(ss) FROM ShowtimeSeat ss WHERE ss.showtime.id = :showtimeId")
    long countTotalSeatsByShowtimeId(@Param("showtimeId") Long showtimeId);

    @Query("SELECT COUNT(ss) FROM ShowtimeSeat ss WHERE ss.showtime.id = :showtimeId AND ss.status = :status")
    long countSeatsByShowtimeIdAndStatus(@Param("showtimeId") Long showtimeId, @Param("status") ShowtimeSeatStatus status);

    @Query("SELECT ss.showtime.id, COUNT(ss), SUM(CASE WHEN ss.status = :status THEN 1 ELSE 0 END) " +
           "FROM ShowtimeSeat ss WHERE ss.showtime.id IN :showtimeIds GROUP BY ss.showtime.id")
    List<Object[]> countSeatsByShowtimeIds(@Param("showtimeIds") Collection<Long> showtimeIds,
                                         @Param("status") ShowtimeSeatStatus status);
}
