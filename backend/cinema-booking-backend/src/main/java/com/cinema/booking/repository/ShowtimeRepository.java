package com.cinema.booking.repository;

import com.cinema.booking.entity.Showtime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShowtimeRepository extends JpaRepository<Showtime, Long> {

    @Query("SELECT s FROM Showtime s " +
           "JOIN FETCH s.movie m " +
           "JOIN FETCH s.auditorium a " +
           "JOIN FETCH a.cinema c " +
           "WHERE (:movieId IS NULL OR s.movie.id = :movieId) " +
           "AND (:cinemaId IS NULL OR a.cinema.id = :cinemaId) " +
           "AND (cast(:startOfDay as timestamp) IS NULL OR s.startTime >= :startOfDay) " +
           "AND (cast(:endOfDay as timestamp) IS NULL OR s.startTime <= :endOfDay) " +
           "ORDER BY s.startTime ASC")
    List<Showtime> findShowtimes(
            @Param("movieId") Long movieId,
            @Param("cinemaId") Long cinemaId,
            @Param("startOfDay") LocalDateTime startOfDay,
            @Param("endOfDay") LocalDateTime endOfDay
    );

    @Query("SELECT s FROM Showtime s " +
           "JOIN FETCH s.movie m " +
           "JOIN FETCH s.auditorium a " +
           "JOIN FETCH a.cinema c " +
           "WHERE s.id = :id")
    Optional<Showtime> findByIdWithDetails(@Param("id") Long id);
}