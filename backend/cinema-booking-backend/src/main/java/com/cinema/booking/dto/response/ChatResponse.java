package com.cinema.booking.dto.response;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatResponse {

    private String reply;

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}

