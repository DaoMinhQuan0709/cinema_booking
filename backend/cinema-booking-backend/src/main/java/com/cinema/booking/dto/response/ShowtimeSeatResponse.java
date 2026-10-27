package com.cinema.booking.dto.response;

import com.cinema.booking.enums.SeatType;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShowtimeSeatResponse {

    private Long showtimeSeatId;
    private Long seatId;
    private String rowChar;
    private Integer seatNumber;
    private SeatType seatType;
    private BigDecimal price;
    private ShowtimeSeatStatus status;
}