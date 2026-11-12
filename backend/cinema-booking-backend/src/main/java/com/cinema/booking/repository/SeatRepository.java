package com.cinema.booking.repository;

import com.cinema.booking.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Collection;

@Repository
public interface SeatRepository extends JpaRepository<Seat, Long> {

    List<Seat> findByAuditoriumIdOrderByRowCharAscSeatNumberAsc(Long auditoriumId);

    void deleteByAuditoriumId(Long auditoriumId);

    // COUNT phân biệt chưa có layout với layout đã có nhưng mọi ghế đều inactive.
    @Query("""
            SELECT s.auditorium.id, COUNT(s), SUM(CASE WHEN s.isActive = true THEN 1 ELSE 0 END)
            FROM Seat s WHERE s.auditorium.id IN :auditoriumIds GROUP BY s.auditorium.id
            """)
    List<Object[]> countCapacityByAuditoriumIds(@Param("auditoriumIds") Collection<Long> auditoriumIds);
}
