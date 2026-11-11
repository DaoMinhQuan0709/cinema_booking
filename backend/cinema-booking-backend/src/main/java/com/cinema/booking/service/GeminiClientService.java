package com.cinema.booking.service;

import com.cinema.booking.config.GeminiConfig;
import com.cinema.booking.exception.AppException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.SocketTimeoutException;
import java.net.http.HttpTimeoutException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Calls generateContent from the backend; only actual model text is a successful reply. */
@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiClientService {
    private static final Set<String> BLOCKED_FINISH_REASONS = Set.of(
            "SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII",
            "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT");

    private final RestClient geminiRestClient;
    private final GeminiConfig geminiConfig;
    private final ObjectMapper objectMapper;

    public String generateContent(String systemPrompt, List<Map<String, Object>> conversationHistory) {
        validateConfiguration();
        Map<String, Object> requestBody = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
                "contents", conversationHistory,
                "generationConfig", Map.of("temperature", 0.7, "maxOutputTokens", 2048, "topP", 0.95));
        try {
            String body = geminiRestClient.post()
                    .uri("/{model}:generateContent", geminiConfig.getModel())
                    .header("x-goog-api-key", geminiConfig.getApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    // Parse explicitly with the project's Jackson mapper, independent of Spring's converter version.
                    .body(String.class);
            return extractReply(body == null || body.isBlank() ? null : objectMapper.readTree(body));
        } catch (RestClientResponseException ex) {
            int status = ex.getStatusCode().value();
            // Provider bodies/exceptions may echo credentials. Log only the numeric status.
            log.warn("Gemini rejected request: HTTP {}", status);
            if (status == 429) {
                throw new AppException(429, "CineBot đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau.");
            }
            if (status == 400 || status == 401 || status == 403 || status == 404) {
                throw new AppException(503, "Dịch vụ CineBot chưa sẵn sàng. Vui lòng thử lại sau.");
            }
            throw new AppException(502, "CineBot tạm thời không nhận được phản hồi từ dịch vụ AI.");
        } catch (ResourceAccessException ex) {
            if (isTimeout(ex)) {
                log.warn("Gemini request timed out");
                throw new AppException(504, "CineBot trả lời lâu hơn dự kiến. Vui lòng thử lại sau.");
            }
            log.warn("Gemini connection unavailable");
            throw new AppException(503, "CineBot tạm thời không kết nối được dịch vụ AI.");
        } catch (JsonProcessingException | RestClientException ex) {
            log.warn("Gemini returned an unreadable response");
            throw new AppException(502, "CineBot nhận được phản hồi không hợp lệ từ dịch vụ AI.");
        }
    }

    public String generateContent(String systemPrompt, String userMessage) {
        return generateContent(systemPrompt, List.of(Map.of(
                "role", "user", "parts", List.of(Map.of("text", userMessage)))));
    }

    private void validateConfiguration() {
        String key = geminiConfig.getApiKey();
        String lowerKey = key == null ? "" : key.toLowerCase(Locale.ROOT);
        if (key == null || key.isBlank() || key.chars().anyMatch(Character::isWhitespace)
                || lowerKey.startsWith("your") || lowerKey.startsWith("replace")
                || lowerKey.equals("changeme") || key.startsWith("${") || key.startsWith("<")) {
            log.warn("Gemini API key is missing or contains a placeholder");
            throw new AppException(503, "Dịch vụ CineBot chưa được cấu hình. Vui lòng thử lại sau.");
        }
        String model = geminiConfig.getModel();
        if (model == null || !model.matches("[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}")) {
            log.warn("Gemini model configuration is invalid");
            throw new AppException(503, "Dịch vụ CineBot chưa được cấu hình. Vui lòng thử lại sau.");
        }
    }

    private String extractReply(JsonNode response) {
        if (response == null) throw invalidResponse();
        String blockReason = response.path("promptFeedback").path("blockReason").asText("");
        if (!blockReason.isBlank() && !"BLOCK_REASON_UNSPECIFIED".equals(blockReason)) {
            throw blockedResponse();
        }
        JsonNode candidate = response.path("candidates").path(0);
        if (BLOCKED_FINISH_REASONS.contains(candidate.path("finishReason").asText(""))) {
            throw blockedResponse();
        }
        StringBuilder reply = new StringBuilder();
        for (JsonNode part : candidate.path("content").path("parts")) {
            if (!part.path("thought").asBoolean(false) && part.path("text").isTextual()) {
                reply.append(part.path("text").asText());
            }
        }
        if (reply.toString().isBlank()) throw invalidResponse();
        return reply.toString().strip();
    }

    private AppException invalidResponse() {
        log.warn("Gemini response contains no usable answer");
        return new AppException(502, "CineBot chưa nhận được câu trả lời. Vui lòng thử lại sau.");
    }

    private AppException blockedResponse() {
        log.warn("Gemini could not answer the prompt");
        return new AppException(422, "CineBot chưa thể trả lời câu hỏi này. Bạn hãy diễn đạt lại câu hỏi.");
    }

    private boolean isTimeout(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof HttpTimeoutException || cause instanceof SocketTimeoutException) return true;
        }
        return false;
    }
}

