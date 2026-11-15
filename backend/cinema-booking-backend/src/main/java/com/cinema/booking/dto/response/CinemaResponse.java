package com.cinema.booking.dto.response;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CinemaResponse {

    private Long id;
    private String galaxyCinemaId;
    private String siteId;
    private String slug;
    private String name;
    private String address;
    private String city;
    private String galaxyCityId;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String phone;
    private String imageLandscape;
    private String imagePortrait;
    private List<String> imageUrls;
    private String cinemaType;
    private Integer displayOrder;
    private List<AuditoriumSummaryResponse> auditoriums;
}
