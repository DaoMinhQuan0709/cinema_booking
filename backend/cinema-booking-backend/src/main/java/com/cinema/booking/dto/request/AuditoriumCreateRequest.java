package com.cinema.booking.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditoriumCreateRequest {

    @NotBlank(message = "Ten phong chieu khong duoc de trong")
    private String name;

    @NotNull(message = "So hang ghe khong duoc de trong")
    @Min(value = 1, message = "So hang ghe toi thieu la 1")
    private Integer totalRows;

    @NotNull(message = "So cot ghe khong duoc de trong")
    @Min(value = 1, message = "So cot ghe toi thieu la 1")
    private Integer totalCols;
}

