package com.cinema.booking.dto.response;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShowtimeSeatsMapResponse {

    private Long showtimeId;
    private Long auditoriumId;
    private String auditoriumName;
    private Integer totalRows;
    private Integer totalCols;
    private List<ShowtimeSeatResponse> seats;
}