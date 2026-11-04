package com.cinema.booking.service;

import com.cinema.booking.config.GeminiConfig;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Service goi Google Gemini REST API (generateContent) bang RestClient.
 *
 * Cong viec 7.1: Xay dung lop ket noi co ban toi Gemini API.
 * - Nhan System Prompt (ngu canh phim, lich chieu) va User Message (cau hoi cua nguoi dung).
 * - Gui request POST toi endpoint generateContent.
 * - Parse va tra ve text response tu Gemini.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiClientService {

    private final RestClient geminiRestClient;
    private final GeminiConfig geminiConfig;

    /**
     * Goi Gemini API voi System Prompt va danh sach lich su hoi thoai.
     *
     * @param systemPrompt Noi dung system instruction (ngu canh du lieu phim/lich chieu)
     * @param conversationHistory Lich su hoi thoai (danh sach cac cap role + text)
     * @return Cau tra loi text tu Gemini
     */
    public String generateContent(String systemPrompt, List<Map<String, Object>> conversationHistory) {
        try {
            // 1. Xay dung request body theo format cua Gemini REST API
            Map<String, Object> requestBody = buildRequestBody(systemPrompt, conversationHistory);

            // 2. Goi API: POST /models/{model}:generateContent?key={apiKey}
            String uri = "/" + geminiConfig.getModel() + ":generateContent?key=" + geminiConfig.getApiKey();

            JsonNode response = geminiRestClient.post()
                    .uri(uri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(JsonNode.class);

            // 3. Parse response lay text tu candidates[0].content.parts[0].text
            return extractTextFromResponse(response);

        } catch (Exception e) {
            log.error("GeminiClientService: Loi khi goi Gemini API: {}", e.getMessage(), e);
            return "Xin loi, toi dang gap su co ket noi. Vui long thu lai sau it phut.";
        }
    }

    /**
     * Overload don gian: Goi Gemini voi 1 System Prompt va 1 cau hoi duy nhat.
     */
    public String generateContent(String systemPrompt, String userMessage) {
        Map<String, Object> userContent = new HashMap<>();
        userContent.put("role", "user");
        userContent.put("parts", List.of(Map.of("text", userMessage)));

        List<Map<String, Object>> history = new ArrayList<>();
        history.add(userContent);

        return generateContent(systemPrompt, history);
    }

    /**
     * Xay dung request body theo dinh dang Gemini REST API.
     *
     * Format:
     * {
     *   "system_instruction": { "parts": [{"text": "..."}] },
     *   "contents": [
     *     {"role": "user", "parts": [{"text": "..."}]},
     *     {"role": "model", "parts": [{"text": "..."}]}
     *   ],
     *   "generationConfig": { "temperature": 0.7, "maxOutputTokens": 2048 }
     * }
     */
    private Map<String, Object> buildRequestBody(String systemPrompt, List<Map<String, Object>> conversationHistory) {
        Map<String, Object> body = new HashMap<>();

        // System Instruction
        Map<String, Object> systemInstruction = new HashMap<>();
        systemInstruction.put("parts", List.of(Map.of("text", systemPrompt)));
        body.put("system_instruction", systemInstruction);

        // Contents (lich su hoi thoai)
        body.put("contents", conversationHistory);

        // Generation Config
        Map<String, Object> generationConfig = new HashMap<>();
        generationConfig.put("temperature", 0.7);
        generationConfig.put("maxOutputTokens", 2048);
        generationConfig.put("topP", 0.95);
        body.put("generationConfig", generationConfig);

        return body;
    }

    /**
     * Parse phan hoi tu Gemini API, lay text tu candidates[0].content.parts[0].text
     */
    private String extractTextFromResponse(JsonNode response) {
        if (response == null) {
            log.warn("GeminiClientService: Response tu Gemini la null");
            return "Xin loi, toi khong nhan duoc phan hoi tu he thong AI. Vui long thu lai.";
        }

        JsonNode candidates = response.path("candidates");
        if (candidates.isMissingNode() || candidates.isEmpty()) {
            log.warn("GeminiClientService: Khong co candidates trong response: {}", response);
            return "Xin loi, he thong AI khong tra ve ket qua. Vui long thu lai voi cau hoi khac.";
        }

        JsonNode textNode = candidates.get(0)
                .path("content")
                .path("parts")
                .get(0)
                .path("text");

        if (textNode.isMissingNode()) {
            log.warn("GeminiClientService: Khong tim thay text trong response: {}", response);
            return "Xin loi, toi khong the xu ly phan hoi tu AI. Vui long thu lai.";
        }

        return textNode.asText();
    }
}

