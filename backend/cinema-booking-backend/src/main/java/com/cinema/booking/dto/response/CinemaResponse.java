package com.cinema.booking.dto.response;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CinemaResponse {

    private Long id;
    private String name;
    private String address;
    private String city;
    private List<AuditoriumSummaryResponse> auditoriums;
}