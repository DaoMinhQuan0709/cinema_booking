package com.cinema.booking.service.impl;

import com.cinema.booking.config.GalaxySyncProperties;
import com.cinema.booking.dto.response.GalaxySyncResponse;
import com.cinema.booking.dto.response.GalaxySyncStatusResponse;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.service.GalaxyApiClient;
import com.cinema.booking.service.GalaxySyncService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.locks.ReentrantLock;

@Service
@RequiredArgsConstructor
public class GalaxySyncServiceImpl implements GalaxySyncService {
    private final GalaxyApiClient apiClient;
    private final GalaxyDataImporter importer;
    private final ObjectMapper objectMapper;
    private final GalaxySyncProperties properties;
    private final ReentrantLock syncLock = new ReentrantLock();
    private volatile Instant lastAttemptAt;
    private volatile Instant lastSuccessAt;
    private volatile String lastError;

    @Override
    public GalaxySyncResponse syncGalaxyData(String clientId, int limitShowtimes) {
        validateLimit(limitShowtimes);
        acquireLock();
        lastAttemptAt = Instant.now();
        try {
            // Fetch/validate all three complete responses before opening a database transaction.
            JsonNode sessions = apiClient.fetchSessions(clientId);
            JsonNode comingSoon = apiClient.fetchComingSoon(clientId);
            JsonNode nowShowing = apiClient.fetchNowShowing(clientId);
            GalaxySyncResponse result = importer.importData(sessions, comingSoon, nowShowing, limitShowtimes, limitShowtimes == 0);
            result.setSource("GALAXY_ONLINE");
            // A limited preview cannot establish freshness of the entire catalog.
            if (limitShowtimes == 0) lastSuccessAt = Instant.now();
            lastError = null;
            return result;
        } catch (RuntimeException ex) {
            lastError = ex instanceof AppException ? ex.getMessage()
                    : "Đồng bộ Galaxy thất bại khi ghi dữ liệu; transaction đã rollback. Kiểm tra log backend.";
            throw ex;
        } finally {
            syncLock.unlock();
        }
    }

    @Override
    public GalaxySyncResponse syncFromLocalJson(String jsonContent, int limitShowtimes) {
        validateLimit(limitShowtimes);
        acquireLock();
        try {
            JsonNode root = objectMapper.readTree(jsonContent);
            GalaxySyncResponse result = importer.importData(extractList(root), null, limitShowtimes, false);
            result.setSource("LOCAL_JSON");
            return result;
        } catch (JsonProcessingException ex) {
            throw new BadRequestException("Không thể đọc JSON suất chiếu.");
        } finally {
            syncLock.unlock();
        }
    }

    @Override
    public GalaxySyncResponse syncFromLocalFile(int limitShowtimes) {
        try (var stream = new ClassPathResource("data/galaxy_sessions.json").getInputStream()) {
            GalaxySyncResponse result = syncFromLocalJson(new String(stream.readAllBytes(), StandardCharsets.UTF_8), limitShowtimes);
            result.setSource("LOCAL_FILE");
            return result;
        } catch (IOException ex) {
            throw new BadRequestException("Không đọc được data/galaxy_sessions.json trong classpath.");
        }
    }

    @Override
    public GalaxySyncStatusResponse getStatus() {
        return new GalaxySyncStatusResponse(properties.isEnabled(), properties.getIntervalMs(), syncLock.isLocked(),
                lastAttemptAt, lastSuccessAt, lastError);
    }

    private void acquireLock() {
        if (!syncLock.tryLock()) throw new AppException(409, "Đang đồng bộ Galaxy. Vui lòng thử lại sau.");
    }

    private void validateLimit(int limitShowtimes) {
        if (limitShowtimes < 0) throw new BadRequestException("limitShowtimes phải >= 0 (0 = tất cả).");
    }

    private JsonNode extractList(JsonNode root) {
        if (root == null) return null;
        if (root.isArray()) return root;
        if (root.path("data").has("result")) return root.path("data").path("result");
        return root.path("result");
    }
}
