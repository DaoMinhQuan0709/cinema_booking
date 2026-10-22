package com.cinema.booking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "booking_seats", uniqueConstraints = {
    @UniqueConstraint(name = "uk_booking_seats_booking_showtime_seat", columnNames = {"booking_id", "showtime_seat_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "showtime_seat_id", nullable = false)
    private ShowtimeSeat showtimeSeat;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;
}