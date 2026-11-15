package com.cinema.booking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "cinemas")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Cinema {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "galaxy_cinema_id", unique = true, length = 100)
    private String galaxyCinemaId;

    @Column(name = "site_id", length = 100)
    private String siteId;

    @Column(length = 255)
    private String slug;

    @Column(name = "galaxy_city_id", length = 100)
    private String galaxyCityId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String address;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(precision = 20, scale = 17)
    private BigDecimal latitude;

    @Column(precision = 20, scale = 17)
    private BigDecimal longitude;

    @Column(length = 50)
    private String phone;

    @Column(name = "image_landscape", length = 1000)
    private String imageLandscape;

    @Column(name = "image_portrait", length = 1000)
    private String imagePortrait;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "image_urls", columnDefinition = "jsonb")
    private List<String> imageUrls;

    @Column(name = "cinema_type", length = 50)
    private String cinemaType;

    @Column(name = "display_order")
    private Integer displayOrder;

    @OneToMany(mappedBy = "cinema", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Auditorium> auditoriums = new ArrayList<>();
}
