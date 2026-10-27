package com.cinema.booking.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CinemaCreateRequest {

    @NotBlank(message = "Tên rạp không được để trống")
    private String name;

    @NotBlank(message = "Địa chỉ rạp không được để trống")
    private String address;

    @NotBlank(message = "Thành phố không được để trống")
    private String city;
}