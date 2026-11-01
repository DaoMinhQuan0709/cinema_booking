package com.cinema.booking.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Cau hinh Spring WebSocket voi STOMP message broker.
 * Cho phep client subscribe topic cap nhat ghe real-time:
 * /topic/showtimes/{showtimeId}/seats
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Prefix cho message gui tu server ve client (VD: /topic/showtimes/1/seats)
        config.enableSimpleBroker("/topic");
        // Prefix cho message gui tu client len server (neu co)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint WebSocket ho tro SockJS fallback va CORS
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // Endpoint WebSocket tieu chuan khong dung SockJS
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
    }
}