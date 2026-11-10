package com.cinema.booking.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentCreateUrlRequest {

    @NotBlank(message = "Ma don dat ve khong duoc de trong")
    private String bookingCode;

    @NotBlank(message = "Phuong thuc thanh toan khong duoc de trong")
    @Pattern(regexp = "^(?i)(VNPAY|MOMO)$", message = "Phuong thuc thanh toan chi chap nhan VNPAY hoac MOMO")
    private String paymentMethod;

    @NotBlank(message = "Phien ban don khong duoc de trong")
    @jakarta.validation.constraints.Size(max = 64)
    private String expectedRevision;
}
