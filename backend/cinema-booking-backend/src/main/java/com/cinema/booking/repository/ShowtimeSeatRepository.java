package com.cinema.booking.repository;

import com.cinema.booking.entity.ShowtimeSeat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShowtimeSeatRepository extends JpaRepository<ShowtimeSeat, Long> {

    @Query("SELECT ss FROM ShowtimeSeat ss " +
           "JOIN FETCH ss.seat s " +
           "WHERE ss.showtime.id = :showtimeId " +
           "ORDER BY s.rowChar ASC, s.seatNumber ASC")
    List<ShowtimeSeat> findByShowtimeIdWithSeat(@Param("showtimeId") Long showtimeId);
}