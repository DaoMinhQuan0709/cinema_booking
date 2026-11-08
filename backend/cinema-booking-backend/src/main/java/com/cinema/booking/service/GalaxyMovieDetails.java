package com.cinema.booking.service;

import com.cinema.booking.exception.AppException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.util.HtmlUtils;

import java.net.URI;
import java.util.LinkedHashSet;
import java.util.List;

/** Validated metadata. Null means absent in the response, not an instruction to erase saved data. */
public record GalaxyMovieDetails(String galaxyMovieId, String landscapeUrl, String country,
                                 List<String> directors, List<String> actors, String genre,
                                 String description, String trailerUrl) {
    public static GalaxyMovieDetails fromJson(JsonNode node) {
        if (node == null || !node.isObject()) throw invalid("data");
        String id = text(node, "id", 100);
        if (id == null) throw invalid("id");
        List<String> categories = names(node, "categories");
        String genre = categories == null ? null : String.join(", ", categories);
        if (genre != null && genre.length() > 500) throw invalid("categories");
        String description = text(node, "description", 200_000);
        return new GalaxyMovieDetails(id, webUrl(node, "imageLandscape"), text(node, "country", 255),
                names(node, "directors"), names(node, "actors"), genre,
                description == null ? null : plainText(description), webUrl(node, "trailer"));
    }

    private static String text(JsonNode node, String field, int maxLength) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) return null;
        if (!value.isTextual() || value.asText().length() > maxLength) throw invalid(field);
        String result = value.asText().trim();
        return result.isBlank() ? null : result;
    }

    private static List<String> names(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) return null;
        if (!value.isArray()) throw invalid(field);
        LinkedHashSet<String> names = new LinkedHashSet<>();
        for (JsonNode entry : value) {
            if (!entry.isObject()) throw invalid(field);
            String name = text(entry, "name", 255);
            if (name == null) throw invalid(field);
            names.add(name);
        }
        return List.copyOf(names);
    }

    private static String webUrl(JsonNode node, String field) {
        String value = text(node, field, 500);
        if (value == null) return null;
        try {
            URI uri = URI.create(value);
            if (("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null) return value;
        } catch (IllegalArgumentException ignored) { }
        throw invalid(field);
    }

    private static String plainText(String html) {
        String text = html.replaceAll("(?is)<(script|style)\\b[^>]*>.*?</\\1\\s*>", "")
                .replaceAll("(?i)<br\\s*/?>|</(?:p|div|li)\\s*>", "\n")
                .replaceAll("(?s)<[^>]*>", "");
        return HtmlUtils.htmlUnescape(text).replace('\u00a0', ' ')
                .replaceAll("\\h+", " ").replaceAll(" *\\n *", "\n").replaceAll("\\n{3,}", "\n\n").strip();
    }

    private static AppException invalid(String field) {
        return new AppException(502, "Chi tiết phim Galaxy có trường không hợp lệ: " + field + ". Giữ nguyên dữ liệu cũ.");
    }
}
