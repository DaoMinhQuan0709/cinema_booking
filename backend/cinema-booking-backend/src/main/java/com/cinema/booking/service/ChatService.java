package com.cinema.booking.service;

import com.cinema.booking.dto.request.ChatRequest;
import com.cinema.booking.dto.response.ChatResponse;

public interface ChatService {

    ChatResponse askChatbot(ChatRequest request);
}

