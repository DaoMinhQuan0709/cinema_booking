package com.cinema.booking.entity;

import com.cinema.booking.enums.SeatType;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "seats", uniqueConstraints = {
    @UniqueConstraint(name = "uk_seats_auditorium_row_col", columnNames = {"auditorium_id", "row_char", "seat_number"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Seat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "auditorium_id", nullable = false)
    private Auditorium auditorium;

    @Column(name = "row_char", nullable = false, length = 5)
    private String rowChar;

    @Column(name = "seat_number", nullable = false)
    private Integer seatNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private SeatType type = SeatType.STANDARD;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}