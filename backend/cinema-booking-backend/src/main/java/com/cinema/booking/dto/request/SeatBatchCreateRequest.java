package com.cinema.booking.dto.request;

import com.cinema.booking.enums.SeatType;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeatBatchCreateRequest {

    /**
     * Danh sach cac ky tu hang ghe duoc coi la ghe VIP (Vi du: ["E", "F", "G", "H"])
     */
    private List<String> vipRows;

    /**
     * Danh sach cac ky tu hang ghe duoc coi la ghe Couple (Vi du: ["J", "K"])
     */
    private List<String> coupleRows;

    /**
     * Loai ghe mac dinh cho cac hang con lai neu khong chi dinh (Mac dinh la STANDARD)
     */
    @Builder.Default
    private SeatType defaultType = SeatType.STANDARD;
}

