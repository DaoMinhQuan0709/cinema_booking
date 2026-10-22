package com.cinema.booking.entity;

import com.cinema.booking.enums.ShowtimeSeatStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "showtime_seats", uniqueConstraints = {
    @UniqueConstraint(name = "uk_showtime_seats_showtime_seat", columnNames = {"showtime_id", "seat_id"})
}, indexes = {
    @Index(name = "idx_showtime_seats_status", columnList = "showtime_id, status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShowtimeSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "showtime_id", nullable = false)
    private Showtime showtime;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seat_id", nullable = false)
    private Seat seat;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ShowtimeSeatStatus status = ShowtimeSeatStatus.AVAILABLE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "locked_by_user_id")
    private User lockedByUser;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private Integer version = 0;
}