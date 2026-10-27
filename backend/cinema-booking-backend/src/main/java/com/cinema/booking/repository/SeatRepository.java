package com.cinema.booking.repository;

import com.cinema.booking.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SeatRepository extends JpaRepository<Seat, Long> {

    List<Seat> findByAuditoriumIdOrderByRowCharAscSeatNumberAsc(Long auditoriumId);
}