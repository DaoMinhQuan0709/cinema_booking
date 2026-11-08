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
        if (!showtimeRepository.tryAcquireGalaxySyncLock()) {
            throw new AppException(409, "Một tiến trình khác đang đồng bộ Galaxy. Vui lòng thử lại sau.");
        }
        LocalDateTime now = LocalDateTime.now(VIETNAM);
        Map<String, Movie> movies = new HashMap<>();
        Map<String, Cinema> cinemas = new HashMap<>();
        Map<String, Auditorium> auditoriums = new HashMap<>();
        Set<String> seenSessionIds = new HashSet<>();
        for (JsonNode session : sessions) seenSessionIds.add(session.path("id").asText());
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
            if (!movies.containsKey(id)) {
                MovieStatus fallback = nowShowing == null ? MovieStatus.NOW_SHOWING : MovieStatus.ENDED;
                movies.put(id, upsertMovie(node, fallback));
            }
        }
        if (nowShowing != null) {
            for (JsonNode node : nowShowing) {
                String id = node.path("id").asText();
                movies.put(id, upsertMovie(node, MovieStatus.NOW_SHOWING));
                catalogIds.add(id);
            }
        }
        if (comingSoon != null) {
            for (JsonNode node : comingSoon) {
                String id = node.path("id").asText();
                movies.put(id, upsertMovie(node, MovieStatus.COMING_SOON));
                catalogIds.add(id);
            }
        }
        int processed = 0;
        for (JsonNode session : sessions) {
            String sessionId = session.path("id").asText();
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
                .syncedAt(Instant.now()).message(skipped == 0 ? "Đồng bộ Galaxy thành công."
                        : "Đồng bộ hoàn tất; một số suất chiếu bị đổi lịch/phòng đã ẩn để quản trị viên kiểm tra.")
                .build();
    }

    private Movie upsertMovie(JsonNode node, MovieStatus status) {
        String externalId = node.path("id").asText();
        String title = node.path("name").asText().trim();
        Movie movie = movieRepository.findByGalaxyMovieId(externalId)
                .orElseGet(() -> movieRepository.findByTitle(title)
                        .filter(old -> old.getGalaxyMovieId() == null).orElseGet(Movie::new));
        Movie values = buildMovieFromNode(node, status);
        movie.setGalaxyMovieId(externalId);
        movie.setTitle(title);
        movie.setDurationMinutes(values.getDurationMinutes());
        movie.setReleaseDate(values.getReleaseDate());
        movie.setPosterUrl(values.getPosterUrl());
        if (!values.getTrailerUrl().isBlank()) movie.setTrailerUrl(values.getTrailerUrl());
        movie.setAgeRating(values.getAgeRating());
        if (!values.getDescription().isBlank()) movie.setDescription(values.getDescription());
        if (values.getGenre() != null) movie.setGenre(values.getGenre());
        movie.setStatus(status);
        return movieRepository.save(movie);
    }

    private Cinema upsertCinema(JsonNode node) {
        String externalId = node.path("id").asText();
        String name = node.path("name").asText().trim();
        Cinema cinema = cinemaRepository.findByGalaxyCinemaId(externalId)
                .orElseGet(() -> cinemaRepository.findByName(name)
                        .filter(old -> old.getGalaxyCinemaId() == null).orElseGet(Cinema::new));
        cinema.setGalaxyCinemaId(externalId);
        cinema.setName(name);
        cinema.setAddress(node.path("address").asText(""));
        cinema.setCity(resolveCityName(node.path("cityId").asText(""), cinema.getAddress()));
        return cinemaRepository.save(cinema);
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
        if (CITY_MAP.containsKey(cityId)) {
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
