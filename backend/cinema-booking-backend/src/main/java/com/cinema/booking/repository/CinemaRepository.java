package com.cinema.booking.repository;

import com.cinema.booking.entity.Cinema;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CinemaRepository extends JpaRepository<Cinema, Long> {

    @Query("SELECT DISTINCT c FROM Cinema c LEFT JOIN FETCH c.auditoriums WHERE " +
           "(:city IS NULL OR LOWER(c.city) = LOWER(:city))")
    List<Cinema> findByCityIgnoreCaseWithAuditoriums(@Param("city") String city);
}