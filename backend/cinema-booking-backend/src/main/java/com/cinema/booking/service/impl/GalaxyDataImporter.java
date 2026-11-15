package com.cinema.booking.service.impl;

import com.cinema.booking.dto.response.GalaxySyncResponse;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import java.util.*;

/**
 * Applies a validated catalog snapshot after all HTTP requests finish.
 * Galaxy IDs identify catalog records, not an integration with Galaxy's seat inventory.
 * This service never reads or writes seat inventory. Source totalSeat/bookedSeat
 * are ignored; the local inventory service initializes seats on first access.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GalaxyDataImporter {
    private final MovieRepository movieRepository;
    private final CinemaRepository cinemaRepository;
    private final AuditoriumRepository auditoriumRepository;
    private final ShowtimeRepository showtimeRepository;
    private final BookingRepository bookingRepository;
    private final com.cinema.booking.service.CatalogGuard guard;

    private static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm")
            .withResolverStyle(ResolverStyle.STRICT);

    private static final Map<String, String> CITY_MAP = Map.ofEntries(
            Map.entry("599535ea-1ea2-4393-9b5a-3ba3a807f363", "TP. Hồ Chí Minh"),
            Map.entry("f4bf5f53-4e80-40c8-b1e0-f11ffa9a636a", "Hà Nội"),
            Map.entry("48def6c3-5254-4ece-b63c-e5524fda1296", "Đà Nẵng"),
            Map.entry("3e016c97-d824-4cac-99a5-1de79b3673bc", "Cần Thơ"),
            Map.entry("c2ff3ae3-bcdc-4b53-8cb2-962e0afcca03", "Bình Dương"),
            Map.entry("c6a74ae6-4f2a-4ad7-8e9e-ba22f05c11a9", "Đồng Nai"),
            Map.entry("ae597899-e73a-42f2-b8a7-1a0ac5f29057", "Bà Rịa - Vũng Tàu"),
            Map.entry("3504c4df-cc0f-4356-a934-260cf5e9ca32", "Bến Tre"),
            Map.entry("477b975e-caac-4149-8fcc-a10fbde8df84", "Cà Mau"),
            Map.entry("356d6f3d-5cb6-4392-9abf-84aae78c6573", "An Giang"),
            Map.entry("95ea07fe-5999-4030-bb5f-abe0440d96f0", "Đắk Lắk")
    );

    @Transactional
    public GalaxySyncResponse importData(JsonNode sessions, JsonNode comingSoon, int limitShowtimes,
                                         boolean authoritative) {
        return importData(sessions, comingSoon, null, limitShowtimes, authoritative);
    }

    @Transactional
    public GalaxySyncResponse importData(JsonNode sessions, JsonNode comingSoon, JsonNode nowShowing,
                                         int limitShowtimes, boolean authoritative) {
        return importData(sessions, comingSoon, nowShowing, null, limitShowtimes, authoritative);
    }

    @Transactional
    public GalaxySyncResponse importData(JsonNode sessions, JsonNode comingSoon, JsonNode nowShowing,
                                         JsonNode cinemaCatalog, int limitShowtimes, boolean authoritative) {
        if (cinemaCatalog != null) {
            if (!cinemaCatalog.isArray()) throw new BadRequestException("Danh sách rạp Galaxy không hợp lệ.");
            Set<String> cinemaIds = new HashSet<>();
            for (JsonNode node : cinemaCatalog) {
                validateCinema(node);
                if (!cinemaIds.add(node.path("id").asText())) {
                    throw new BadRequestException("Danh sách rạp Galaxy có ID trùng lặp. Không cập nhật dữ liệu.");
                }
            }
        }
        if (nowShowing != null) {
            if (!nowShowing.isArray()) throw new BadRequestException("Invalid now-showing catalog.");
            Set<String> ids = new HashSet<>();
            for (JsonNode node : nowShowing) {
                validateMovie(node);
                if (!ids.add(node.path("id").asText())) throw new BadRequestException("Duplicate now-showing movie ID.");
            }
        }
        if (limitShowtimes < 0) throw new BadRequestException("limitShowtimes phải >= 0 (0 = tất cả).");
        validateSessions(sessions);
        if (comingSoon != null) {
            if (!comingSoon.isArray()) throw new BadRequestException("Danh sách phim sắp chiếu không hợp lệ.");
            Set<String> upcomingIds = new HashSet<>();
            for (JsonNode node : comingSoon) {
                validateMovie(node);
                if (!upcomingIds.add(node.path("id").asText())) {
                    throw new BadRequestException("Danh sách phim sắp chiếu có ID trùng lặp. Không cập nhật dữ liệu.");
                }
            }
        }
        guard.catalogWrite();
        if (!showtimeRepository.tryAcquireGalaxySyncLock()) {
            throw new AppException(409, "Một tiến trình khác đang đồng bộ Galaxy. Vui lòng thử lại sau.");
        }
        LocalDateTime now = LocalDateTime.now(VIETNAM);
        Set<String> sourceMovieIds = new HashSet<>(), sourceTitles = new HashSet<>();
        for (JsonNode s : sessions) { sourceMovieIds.add(s.path("movie").path("id").asText()); sourceTitles.add(s.path("movie").path("name").asText().trim()); }
        if (nowShowing != null) for (JsonNode m : nowShowing) { sourceMovieIds.add(m.path("id").asText()); sourceTitles.add(m.path("name").asText().trim()); }
        if (comingSoon != null) for (JsonNode m : comingSoon) { sourceMovieIds.add(m.path("id").asText()); sourceTitles.add(m.path("name").asText().trim()); }
        guard.syncMovies(sourceMovieIds, sourceTitles, authoritative && limitShowtimes == 0);
        Set<String> excludedMovies = sourceMovieIds.isEmpty() ? Set.of() : new HashSet<>(movieRepository.findDeletedGalaxyIds(sourceMovieIds));
        Set<String> excludedSessions = new HashSet<>();
        Map<String, Movie> movies = new HashMap<>();
        Map<String, Cinema> cinemas = new HashMap<>();
        // The dedicated catalog is independent of session dates/limits and takes precedence
        // over the less complete cinema object attached to a session.
        if (cinemaCatalog != null) {
            for (JsonNode node : cinemaCatalog) {
                cinemas.put(node.path("id").asText(), upsertCinema(node));
            }
        }
        Map<String, Auditorium> auditoriums = new HashMap<>();
        Set<String> seenSessionIds = new HashSet<>();
        for (JsonNode session : sessions) seenSessionIds.add(session.path("id").asText());
        Set<String> deletedSessions = seenSessionIds.isEmpty() ? Set.of() : new HashSet<>(showtimeRepository.findDeletedGalaxyIds(seenSessionIds));
        Map<String, Showtime> existingShowtimes = new HashMap<>();
        if (!seenSessionIds.isEmpty()) {
            for (Showtime showtime : showtimeRepository.findByGalaxySessionIdIn(seenSessionIds)) {
                existingShowtimes.put(showtime.getGalaxySessionId(), showtime);
            }
        }
        int syncedShowtimes = 0, skipped = 0;

        // Session availability includes advance sales and does not define catalog status.
        Set<String> catalogIds = new HashSet<>();
        for (JsonNode session : sessions) {
            JsonNode node = session.path("movie");
            String id = node.path("id").asText();
            if (excludedMovies.contains(id)) continue;
            if (!movies.containsKey(id)) {
                MovieStatus fallback = nowShowing == null ? MovieStatus.NOW_SHOWING : MovieStatus.ENDED;
                movies.put(id, upsertMovie(node, fallback, movies));
            }
        }
        if (nowShowing != null) {
            for (JsonNode node : nowShowing) {
                String id = node.path("id").asText();
                if (excludedMovies.contains(id)) continue;
                movies.put(id, upsertMovie(node, MovieStatus.NOW_SHOWING, movies));
                catalogIds.add(id);
            }
        }
        if (comingSoon != null) {
            for (JsonNode node : comingSoon) {
                String id = node.path("id").asText();
                if (excludedMovies.contains(id)) continue;
                movies.put(id, upsertMovie(node, MovieStatus.COMING_SOON, movies));
                catalogIds.add(id);
            }
        }
        int processed = 0;
        for (JsonNode session : sessions) {
            String sessionId = session.path("id").asText();
            if (deletedSessions.contains(sessionId) || excludedMovies.contains(session.path("movie").path("id").asText())) {
                excludedSessions.add(sessionId);
                continue;
            }
            LocalDateTime start = parseDateTime(session.path("showDate").asText(), session.path("showTime").asText());
            if (!start.isAfter(now)) continue;
            if (limitShowtimes > 0 && processed >= limitShowtimes) continue;
            processed++;
            Movie movie = movies.get(session.path("movie").path("id").asText());
            JsonNode cinemaNode = session.path("cinema");
            String cinemaId = cinemaNode.path("id").asText();
            Cinema cinema = cinemas.computeIfAbsent(cinemaId, ignored -> upsertCinema(cinemaNode));
            String screen = session.path("screenName").asText().trim();
            String auditoriumKey = cinemaId + ":" + screen;
            Auditorium auditorium = auditoriums.get(auditoriumKey);
            if (auditorium == null) {
                auditorium = auditoriumRepository.findByCinemaIdAndName(cinema.getId(), screen).orElse(null);
                if (auditorium == null) {
                    // Local demo layout; sessions2 does not contain Galaxy's actual seat map.
                    auditorium = auditoriumRepository.save(Auditorium.builder().cinema(cinema).name(screen)
                            .totalRows(10).totalCols(12).build());
                }
                auditoriums.put(auditoriumKey, auditorium);
            }
            Showtime showtime = existingShowtimes.get(sessionId);
            if (showtime == null) {
                // Adopt exact matches created by the old local-file importer, retaining IDs/bookings.
                showtime = showtimeRepository.findFirstByAuditoriumIdAndMovieIdAndStartTimeAndGalaxySessionIdIsNull(
                        auditorium.getId(), movie.getId(), start).orElse(null);
            }
            boolean isNew = showtime == null;
            if (isNew) showtime = new Showtime();
            showtime.setGalaxySessionId(sessionId);
            boolean relocated = !isNew && (!Objects.equals(showtime.getMovie().getId(), movie.getId())
                    || !Objects.equals(showtime.getAuditorium().getId(), auditorium.getId()));
            boolean rescheduled = !isNew && !start.equals(showtime.getStartTime());
            if (relocated || (rescheduled && bookingRepository.existsByShowtimeId(showtime.getId()))) {
                // Do not silently move a purchased ticket or replace its seat map.
                showtime.setActive(false);
                showtimeRepository.save(showtime);
                skipped++;
                log.warn("Galaxy session {} changed room/movie or a booked start time; withdrawn for admin review", sessionId);
                continue;
            }
            showtime.setMovie(movie);
            showtime.setAuditorium(auditorium);
            showtime.setStartTime(start);
            showtime.setEndTime(start.plusMinutes(movie.getDurationMinutes()));
            showtime.setActive(true);
            if (isNew) {
                showtime.setBasePrice(calculateBasePrice(session.path("movieFormat").asText(), session.path("version").asText()));
            }
            showtimeRepository.save(showtime);
            syncedShowtimes++;
        }
        int deactivated = 0, ended = 0;
        // Never reconcile missing entries from an offline file or a deliberately limited run.
        if (authoritative && limitShowtimes == 0) {
            for (Showtime showtime : showtimeRepository.findByGalaxySessionIdIsNotNullAndActiveTrue()) {
                if (!seenSessionIds.contains(showtime.getGalaxySessionId()) || !showtime.getStartTime().isAfter(now)) {
                    showtime.setActive(false);
                    deactivated++;
                }
            }
            for (Movie movie : movieRepository.findByGalaxyMovieIdIsNotNull()) {
                if (movie.getDeletedAt() != null) continue;
                if (!(nowShowing == null ? movies.keySet() : catalogIds).contains(movie.getGalaxyMovieId()) && movie.getStatus() != MovieStatus.ENDED) {
                    movie.setStatus(MovieStatus.ENDED);
                    ended++;
                }
            }
        }
        return GalaxySyncResponse.builder().totalMoviesSynced(movies.size()).totalCinemasSynced(cinemas.size())
                .totalAuditoriumsSynced(auditoriums.size()).totalSeatsSynced(0)
                .totalShowtimesSynced(syncedShowtimes).totalShowtimeSeatsSynced(0)
                .totalShowtimesDeactivated(deactivated).totalMoviesEnded(ended).totalShowtimesSkipped(skipped)
                .totalMoviesExcluded(excludedMovies.size()).totalShowtimesExcluded(excludedSessions.size())
                .syncedAt(Instant.now()).message(skipped == 0 ? "Đồng bộ Galaxy thành công."
                        : "Đồng bộ hoàn tất; một số suất chiếu bị đổi lịch/phòng đã ẩn để quản trị viên kiểm tra.")
                .build();
    }

    private Movie upsertMovie(JsonNode node, MovieStatus status, Map<String, Movie> importedMovies) {
        String externalId = node.path("id").asText();
        String title = node.path("name").asText().trim();
        Movie movie = importedMovies.get(externalId);
        boolean alreadyImported = movie != null;
        if (!alreadyImported) {
            movie = movieRepository.findByGalaxyMovieId(externalId)
                    .orElseGet(() -> movieRepository.findFirstByTitleAndGalaxyMovieIdIsNullAndDeletedAtIsNullOrderByIdAsc(title).orElseGet(Movie::new));
        }
        Movie values = buildMovieFromNode(node, status);
        movie.setGalaxyMovieId(externalId);
        if (node.path("slug").isTextual() && !node.path("slug").asText().isBlank()) {
            movie.setGalaxySlug(node.path("slug").asText().trim());
        }
        if (node.path("imageLandscape").isTextual() && !node.path("imageLandscape").asText().isBlank()) {
            movie.setLandscapeUrl(node.path("imageLandscape").asText().trim());
        }
        movie.setTitle(title);
        movie.setDurationMinutes(values.getDurationMinutes());
        movie.setReleaseDate(values.getReleaseDate());
        movie.setPosterUrl(values.getPosterUrl());
        if (!values.getTrailerUrl().isBlank()) movie.setTrailerUrl(values.getTrailerUrl());
        movie.setAgeRating(values.getAgeRating());
        if (!values.getDescription().isBlank()) movie.setDescription(values.getDescription());
        if (values.getGenre() != null) movie.setGenre(values.getGenre());
        movie.setStatus(status);
        // Reuse the managed entity when the same movie occurs in several catalog endpoints.
        return alreadyImported ? movie : movieRepository.save(movie);
    }

    private Cinema upsertCinema(JsonNode node) {
        String externalId = node.path("id").asText();
        String name = node.path("name").asText().trim();
        Cinema cinema = cinemaRepository.findByGalaxyCinemaId(externalId)
                .orElseGet(() -> cinemaRepository.findByName(name)
                        .filter(old -> old.getGalaxyCinemaId() == null).orElseGet(Cinema::new));
        cinema.setGalaxyCinemaId(externalId);
        cinema.setName(name);
        // Offline/session payloads can omit metadata; absence must not erase enrichment.
        if (hasText(node, "address")) cinema.setAddress(node.path("address").asText().trim());
        if (cinema.getAddress() == null) cinema.setAddress("");
        if (hasText(node, "siteId")) cinema.setSiteId(node.path("siteId").asText().trim());
        else if (cinema.getSiteId() == null && hasText(node, "code")) cinema.setSiteId(node.path("code").asText().trim());
        if (hasText(node, "slug")) cinema.setSlug(node.path("slug").asText().trim());
        if (hasText(node, "cityId")) cinema.setGalaxyCityId(node.path("cityId").asText().trim());
        String city = resolveCityName(cinema.getGalaxyCityId(), cinema.getAddress());
        if (!"Chưa xác định".equals(city) || cinema.getCity() == null) cinema.setCity(city);
        BigDecimal latitude = coordinate(node, "latitude", 90);
        BigDecimal longitude = coordinate(node, "longitude", 180);
        if (latitude != null) cinema.setLatitude(latitude);
        if (longitude != null) cinema.setLongitude(longitude);
        if (hasText(node, "phone")) cinema.setPhone(node.path("phone").asText().trim());
        if (hasText(node, "imageLandscape")) cinema.setImageLandscape(node.path("imageLandscape").asText().trim());
        if (hasText(node, "imagePortrait")) cinema.setImagePortrait(node.path("imagePortrait").asText().trim());
        if (node.path("imageUrls").isArray()) {
            List<String> images = new ArrayList<>();
            for (JsonNode image : node.path("imageUrls")) images.add(image.asText().trim());
            cinema.setImageUrls(images);
        }
        if (hasText(node, "cinemaType")) cinema.setCinemaType(node.path("cinemaType").asText().trim());
        if (node.path("order").isIntegralNumber()) cinema.setDisplayOrder(node.path("order").intValue());
        return cinemaRepository.save(cinema);
    }

    private boolean hasText(JsonNode node, String field) {
        return node.path(field).isTextual() && !node.path(field).asText().isBlank();
    }

    private void validateCinema(JsonNode node) {
        if (!node.isObject() || !hasText(node, "id") || !hasText(node, "name")) {
            throw new BadRequestException("Galaxy có rạp thiếu ID hoặc tên. Không cập nhật dữ liệu.");
        }
        validateCinemaText(node, "id", 100);
        validateCinemaText(node, "name", 255);
        validateCinemaText(node, "address", Integer.MAX_VALUE);
        validateCinemaText(node, "siteId", 100);
        validateCinemaText(node, "code", 100);
        validateCinemaText(node, "slug", 255);
        validateCinemaText(node, "cityId", 100);
        validateCinemaText(node, "phone", 50);
        validateCinemaText(node, "imageLandscape", 1000);
        validateCinemaText(node, "imagePortrait", 1000);
        validateCinemaText(node, "cinemaType", 50);
        coordinate(node, "latitude", 90);
        coordinate(node, "longitude", 180);
        JsonNode images = node.path("imageUrls");
        if (!images.isMissingNode() && !images.isNull()) {
            if (!images.isArray()) throw new BadRequestException("Danh sách ảnh rạp Galaxy không hợp lệ.");
            for (JsonNode image : images) {
                if (!image.isTextual() || image.asText().isBlank() || image.asText().trim().length() > 1000) {
                    throw new BadRequestException("Danh sách ảnh rạp Galaxy không hợp lệ.");
                }
            }
        }
        JsonNode order = node.path("order");
        if (!order.isMissingNode() && !order.isNull()
                && (!order.isIntegralNumber() || !order.canConvertToInt() || order.intValue() < 0)) {
            throw new BadRequestException("Thứ tự hiển thị rạp Galaxy không hợp lệ.");
        }
    }

    private void validateCinemaText(JsonNode node, String field, int maxLength) {
        JsonNode value = node.path(field);
        if (!value.isMissingNode() && !value.isNull()
                && (!value.isTextual() || value.asText().trim().length() > maxLength)) {
            throw new BadRequestException("Trường " + field + " của rạp Galaxy không hợp lệ.");
        }
    }

    private BigDecimal coordinate(JsonNode node, String field, int maxAbsoluteValue) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull() || (value.isTextual() && value.asText().isBlank())) return null;
        try {
            if (value.isNumber() || value.isTextual()) {
                BigDecimal coordinate = new BigDecimal(value.asText().trim());
                if (coordinate.abs().compareTo(BigDecimal.valueOf(maxAbsoluteValue)) <= 0) return coordinate;
            }
        } catch (NumberFormatException ignored) { }
        throw new BadRequestException("Tọa độ " + field + " của rạp Galaxy không hợp lệ.");
    }

    private void validateSessions(JsonNode sessions) {
        if (sessions == null || !sessions.isArray()) throw new BadRequestException("Danh sách suất chiếu không hợp lệ.");
        Set<String> ids = new HashSet<>();
        for (JsonNode node : sessions) {
            if (node.path("id").asText("").isBlank() || !ids.add(node.path("id").asText())
                    || node.path("cinema").path("id").asText("").isBlank()
                    || node.path("cinema").path("name").asText("").isBlank()
                    || node.path("screenName").asText("").isBlank()
                    || parseDateTime(node.path("showDate").asText(""), node.path("showTime").asText("")) == null) {
                throw new BadRequestException("Galaxy có suất chiếu thiếu dữ liệu, trùng ID hoặc sai ngày giờ. Không cập nhật dữ liệu.");
            }
            validateCinema(node.path("cinema"));
            validateMovie(node.path("movie"));
        }
    }

    private void validateMovie(JsonNode node) {
        if (node.path("id").asText("").isBlank() || node.path("name").asText("").isBlank()) {
            throw new BadRequestException("Galaxy có phim thiếu ID hoặc tên. Không cập nhật dữ liệu.");
        }
    }

    private Movie buildMovieFromNode(JsonNode node, MovieStatus defaultStatus) {
        String title = node.path("name").asText("").trim();
        String description = node.path("description").asText(node.path("content").asText(""));
        int duration = node.path("duration").asInt(120);
        if (duration <= 0) duration = 120;

        String rawStartDate = node.path("startDate").asText("");
        LocalDate releaseDate = LocalDate.now(VIETNAM);
        if (!rawStartDate.isEmpty()) {
            try {
                if (rawStartDate.length() >= 10) {
                    releaseDate = LocalDate.parse(rawStartDate.substring(0, 10));
                }
            } catch (Exception ignored) {}
        }

        String poster = node.path("imagePortrait").asText("");
        if (poster.isEmpty()) {
            poster = node.path("imageLandscape").asText("");
        }

        String trailer = node.path("trailer").asText("");
        String age = node.path("age").asText("0").trim().toUpperCase();
        String ageRating = switch (age) {
            case "18", "C18", "T18" -> "C18";
            case "16", "C16", "T16" -> "C16";
            case "13", "C13", "T13" -> "C13";
            case "K" -> "K";
            default -> "P";
        };

        return Movie.builder()
                .title(title)
                .description(description)
                .durationMinutes(duration)
                .releaseDate(releaseDate)
                .posterUrl(poster)
                .trailerUrl(trailer)
                .genre(node.path("genre").asText(null))
                .ageRating(ageRating)
                .status(defaultStatus)
                .build();
    }

    private String resolveCityName(String cityId, String address) {
        if (cityId != null && CITY_MAP.containsKey(cityId)) {
            return CITY_MAP.get(cityId);
        }
        if (address.contains("TP.HCM") || address.contains("Hồ Chí Minh") || address.contains("Sài Gòn")) {
            return "TP. Hồ Chí Minh";
        }
        if (address.contains("Hà Nội")) {
            return "Hà Nội";
        }
        if (address.contains("Đà Nẵng")) {
            return "Đà Nẵng";
        }
        if (address.contains("Hải Phòng")) {
            return "Hải Phòng";
        }
        return "Chưa xác định";
    }

    private LocalDateTime parseDateTime(String showDate, String showTime) {
        try {
            if (!showDate.matches("\\d{4}-\\d{2}-\\d{2}") || !showTime.matches("\\d{2}:\\d{2}(:\\d{2})?")) return null;
            String combined = showDate + " " + showTime.substring(0, 5);
            return LocalDateTime.parse(combined, DATE_TIME_FORMATTER);
        } catch (Exception e) {
            log.warn("Không thể parse ngày giờ suất chiếu: {} {}", showDate, showTime);
            return null;
        }
    }

    private BigDecimal calculateBasePrice(String format, String version) {
        if (format.toUpperCase().contains("IMAX")) {
            return BigDecimal.valueOf(130000);
        }
        if ("3d".equalsIgnoreCase(version) || format.toUpperCase().contains("3D")) {
            return BigDecimal.valueOf(100000);
        }
        return BigDecimal.valueOf(80000);
    }
}
