package com.cinema.booking.controller;

import com.cinema.booking.dto.request.ChatRequest;
import com.cinema.booking.dto.response.ApiResponse;
import com.cinema.booking.dto.response.ChatResponse;
import com.cinema.booking.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping("/ask")
    public ResponseEntity<ApiResponse<ChatResponse>> ask(@Valid @RequestBody ChatRequest request) {
        ChatResponse response = chatService.askChatbot(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}

