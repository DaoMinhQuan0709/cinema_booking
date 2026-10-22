package com.cinema.booking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "auditoriums")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Auditorium {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cinema_id", nullable = false)
    private Cinema cinema;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "total_rows", nullable = false)
    private Integer totalRows;

    @Column(name = "total_cols", nullable = false)
    private Integer totalCols;

    @OneToMany(mappedBy = "auditorium", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Seat> seats = new ArrayList<>();
}