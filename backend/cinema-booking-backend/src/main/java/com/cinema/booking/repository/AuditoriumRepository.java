package com.cinema.booking.repository;

import com.cinema.booking.entity.Auditorium;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditoriumRepository extends JpaRepository<Auditorium, Long> {

    java.util.Optional<Auditorium> findByCinemaIdAndName(Long cinemaId, String name);
}