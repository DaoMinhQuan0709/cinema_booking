package com.cinema.booking.repository;

import com.cinema.booking.entity.Showtime;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShowtimeRepository extends JpaRepository<Showtime, Long> {

    @Query("SELECT s FROM Showtime s " +
           "JOIN FETCH s.movie m " +
           "JOIN FETCH s.auditorium a " +
           "JOIN FETCH a.cinema c " +
           "WHERE s.active = true AND (:movieId IS NULL OR s.movie.id = :movieId) " +
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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Showtime s WHERE s.galaxySessionId IN :sessionIds ORDER BY s.id")
    List<Showtime> findByGalaxySessionIdIn(@Param("sessionIds") Collection<String> sessionIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Showtime> findFirstByAuditoriumIdAndMovieIdAndStartTimeAndGalaxySessionIdIsNull(
            Long auditoriumId, Long movieId, LocalDateTime startTime);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<Showtime> findByGalaxySessionIdIsNotNullAndActiveTrue();

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("SELECT s FROM Showtime s WHERE s.id = :id")
    Optional<Showtime> findByIdForBooking(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Showtime s WHERE s.id = :id")
    Optional<Showtime> findByIdForSeatInitialization(@Param("id") Long id);

    // Held until transaction commit/rollback, across all backend instances.
    @Query(value = "SELECT pg_try_advisory_xact_lock(716305901)", nativeQuery = true)
    boolean tryAcquireGalaxySyncLock();

    @Query("SELECT COUNT(s) > 0 FROM Showtime s " +
           "WHERE s.active = true AND s.auditorium.id = :auditoriumId " +
           "AND (:excludeId IS NULL OR s.id <> :excludeId) " +
           "AND (s.startTime < :endTime AND s.endTime > :startTime)")
    boolean existsOverlappingShowtime(
            @Param("auditoriumId") Long auditoriumId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("excludeId") Long excludeId
    );
}
