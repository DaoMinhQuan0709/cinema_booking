package com.cinema.booking.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

/**
 * DTO nhan request tao booking tu Client.
 * Bao gom: suatChieuId, danh sach ghe, danh sach bap nuoc (tuy chon).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingCreateRequest {

    @NotNull(message = "showtimeId khong duoc de trong")
    private Long showtimeId;

    @NotEmpty(message = "Phai chon it nhat 1 ghe")
    private List<Long> showtimeSeatIds;

    @Valid
    private List<BookingProductItem> products;
}
