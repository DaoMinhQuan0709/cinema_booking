package com.cinema.booking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

/**
 * Cau hinh ket noi Google Gemini API.
 * Doc tu application.yml: application.gemini.*
 */
@Configuration
@ConfigurationProperties(prefix = "application.gemini")
@Getter
@Setter
public class GeminiConfig {

    private String apiKey;
    private String model;
    private String apiUrl;

    /**
     * Tao RestClient chuyen dung cho Gemini API voi base URL da cau hinh san.
     * Bean nay duoc inject vao GeminiClientService de goi API.
     */
    @Bean("geminiRestClient")
    public RestClient geminiRestClient() {
        return RestClient.builder()
                .baseUrl(apiUrl)
                .build();
    }
}

