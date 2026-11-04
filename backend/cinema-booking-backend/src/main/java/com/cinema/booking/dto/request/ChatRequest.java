package com.cinema.booking.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatRequest {

    @NotBlank(message = "Noi dung tin nhan khong duoc de trong")
    private String message;

    /**
     * Lich su hoi thoai truoc do (tuy chon, phuc vu multi-turn conversation).
     * Moi phan tu gom: role ("user" hoac "model") va text.
     */
    private List<ChatMessage> conversationHistory;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ChatMessage {
        private String role; // "user" hoac "model"
        private String text;
    }
}

