package com.cinema.booking.service;

import com.cinema.booking.config.GalaxySyncProperties;
import com.cinema.booking.exception.AppException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.net.URI;

@Component
public class GalaxyApiClient {
    private static final int MAX_SESSION_ATTEMPTS = 3;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final GalaxySyncProperties properties;

    public GalaxyApiClient(@Qualifier("galaxyRestClient") RestClient restClient,
                           ObjectMapper objectMapper, GalaxySyncProperties properties) {
        this.restClient = restClient;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    public JsonNode fetchSessions(String clientId) {
        return fetchList("/api/v2/mobile/sessions2?includeCinema=true&includeMovie=true", clientId);
    }

    public JsonNode fetchNowShowing(String clientId) {
        return fetchList("/api/v2/mobile/movies/showing", clientId);
    }

    public JsonNode fetchComingSoon(String clientId) {
        // "comming" is the spelling used by Galaxy's API.
        return fetchList("/api/v2/mobile/movies/comming", clientId);
    }

    private JsonNode fetchList(String path, String overrideClientId) {
        JsonNode data = fetchData(path, overrideClientId);
        JsonNode result = data.path("result");
        // A partial/paginated response must never withdraw records absent from that page.
        if (!result.isArray() || !data.path("total").isIntegralNumber() || !data.path("total").canConvertToInt()
                || data.path("total").asInt(-1) != result.size()) {
            throw failure("Galaxy chưa trả danh sách đầy đủ (data.total khác số phần tử data.result hoặc sai định dạng). "
                    + "Không cập nhật dữ liệu; cần kiểm tra tham số phân trang của API.");
        }
        return result;
    }

    public JsonNode fetchMovieDetails(String slug, String galaxyMovieId) {
        if (slug == null || !slug.matches("[A-Za-z0-9][A-Za-z0-9_-]{0,254}")) {
            throw failure("Slug phim Galaxy không hợp lệ.");
        }
        JsonNode data = fetchData("/api/v2/mobile/movies/" + slug, null);
        if (!data.isObject() || galaxyMovieId == null || !data.path("id").isTextual()
                || !galaxyMovieId.equals(data.path("id").asText())) {
            throw failure("Chi tiết phim Galaxy sai định dạng hoặc không khớp ID nguồn. Giữ nguyên dữ liệu cũ.");
        }
        return data;
    }

    private JsonNode fetchData(String path, String overrideClientId) {
        String clientId = StringUtils.hasText(overrideClientId) ? overrideClientId.trim() : properties.getClientId();
        try {
            for (int attempt = 0; attempt < MAX_SESSION_ATTEMPTS; attempt++) {
                boolean canRetry = attempt + 1 < MAX_SESSION_ATTEMPTS;
                JsonNode result = restClient.get().uri(path)
                    .headers(headers -> {
                        if (StringUtils.hasText(clientId)) {
                            headers.set("clientId", clientId.trim());
                        }
                    })
                    .exchange((request, response) -> {
                        HttpStatusCode status = response.getStatusCode();
                        if (status.is3xxRedirection()) {
                            // Galaxy's public edge issues a session cookie, then redirects to the
                            // same URL. The JDK CookieManager stores it before this callback runs.
                            // Never forward clientId/cookies to a redirected host or another path.
                            if (canRetry && isCookieSessionRedirect(request.getURI(), response.getHeaders())) {
                                return null;
                            }
                            throw failure("Galaxy trả HTTP " + status.value()
                                    + " (chuyển hướng), chưa nhận được JSON sau khi kiểm tra phiên truy cập. "
                                    + "Kiểm tra URL API và clientId từ request trình duyệt.");
                        }
                        if (!status.is2xxSuccessful()) {
                            throw failure("Galaxy trả HTTP " + status.value()
                                    + ". Kiểm tra quyền truy cập API và cấu hình GALAXY_CLIENT_ID.");
                        }
                        // Read raw UTF-8: do not depend on HTTP Content-Type or Jackson 2/3 converters.
                        String body = new String(response.getBody().readAllBytes(), StandardCharsets.UTF_8).strip();
                        if (body.startsWith("\uFEFF")) body = body.substring(1).strip();
                        if (body.startsWith("<")) {
                            throw failure("Galaxy trả trang HTML thay vì JSON (Content-Type: "
                                    + response.getHeaders().getContentType()
                                    + "). Kiểm tra URL API và clientId; không thể đồng bộ từ trang chuyển hướng hoặc trang chặn truy cập.");
                        }
                        return parseData(body);
                    });
                if (result != null) return result;
            }
            throw failure("Không thiết lập được phiên truy cập Galaxy sau 3 yêu cầu.");
        } catch (RestClientException ex) {
            throw new AppException(502, "Không kết nối được API Galaxy. Dữ liệu lần đồng bộ trước được giữ nguyên.", ex);
        }
    }

    private boolean isCookieSessionRedirect(URI requestUri, HttpHeaders headers) {
        if (!headers.containsHeader(HttpHeaders.SET_COOKIE)) return false;
        try {
            URI location = headers.getLocation();
            return location != null && requestUri.equals(requestUri.resolve(location));
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private JsonNode parseData(String body) {
        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (JsonProcessingException ex) {
            throw failure("Phản hồi Galaxy không phải JSON hợp lệ. Dữ liệu cũ được giữ nguyên.");
        }
        if (root == null || (root.has("response") &&
                (root.path("response").path("code").asInt(-1) != 0
                        || root.path("response").path("status").asInt(200) != 200))) {
            throw failure("Galaxy báo lỗi trong nội dung phản hồi. Kiểm tra clientId và quyền truy cập API.");
        }
        return root.path("data");
    }

    private AppException failure(String message) {
        return new AppException(502, message);
    }
}
