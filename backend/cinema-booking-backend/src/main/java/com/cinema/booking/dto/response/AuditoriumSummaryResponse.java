package com.cinema.booking.dto.response;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditoriumSummaryResponse {

    private Long id;
    private String name;
    private Integer totalRows;
    private Integer totalCols;
}