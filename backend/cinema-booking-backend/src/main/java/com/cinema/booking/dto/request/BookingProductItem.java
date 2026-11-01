package com.cinema.booking.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

/**
 * DTO dai dien cho mot san pham bap nuoc kem theo don dat ve.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingProductItem {

    @NotNull(message = "productId khong duoc de trong")
    private Long productId;

    @NotNull(message = "quantity khong duoc de trong")
    @Min(value = 1, message = "So luong san pham phai >= 1")
    private Integer quantity;
}
