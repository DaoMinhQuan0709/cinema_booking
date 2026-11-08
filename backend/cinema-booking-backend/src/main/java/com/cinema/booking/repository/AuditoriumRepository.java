package com.cinema.booking.repository;

import com.cinema.booking.entity.Auditorium;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditoriumRepository extends JpaRepository<Auditorium, Long> {

    java.util.Optional<Auditorium> findByCinemaIdAndName(Long cinemaId, String name);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Auditorium a WHERE a.id = :id")
    java.util.Optional<Auditorium> findByIdForSeatInitialization(@Param("id") Long id);
}
