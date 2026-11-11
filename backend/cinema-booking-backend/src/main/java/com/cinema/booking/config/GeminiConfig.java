package com.cinema.booking.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;

/**
 * Cau hinh ket noi Google Gemini API.
 * Doc tu application.yml: application.gemini.*
 */
@Configuration
@ConfigurationProperties(prefix = "application.gemini")
@Getter
@Setter
public class GeminiConfig {

    private String apiKey = "";
    private String model = "gemini-3.1-flash-lite";
    private String apiUrl = "https://generativelanguage.googleapis.com/v1beta/models";
    private int connectTimeoutMs = 5000;
    private int readTimeoutMs = 45000;

    /**
     * Tao RestClient chuyen dung cho Gemini API voi base URL da cau hinh san.
     * Bean nay duoc inject vao GeminiClientService de goi API.
     */
    @Bean("geminiRestClient")
    public RestClient geminiRestClient() {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(connectTimeoutMs))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(httpClient);
        factory.setReadTimeout(Duration.ofMillis(readTimeoutMs));
        return RestClient.builder()
                .baseUrl(apiUrl)
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}

