package com.cinema.booking.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.util.List;

@Data
public class BookingProductsRequest {
    @NotBlank @Size(max = 64)
    private String expectedRevision;
    @NotNull @Size(max = 100)
    private List<@NotNull @Valid BookingProductItem> products;
}
