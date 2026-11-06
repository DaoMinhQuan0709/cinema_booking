package com.cinema.booking.service.impl;

import com.cinema.booking.dto.response.GalaxySyncResponse;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.enums.SeatType;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.GalaxySyncService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GalaxySyncServiceImpl implements GalaxySyncService {

    private final MovieRepository movieRepository;
    private final CinemaRepository cinemaRepository;
    private final AuditoriumRepository auditoriumRepository;
    private final SeatRepository seatRepository;
    private final ShowtimeRepository showtimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final ObjectMapper objectMapper;

    private static final String SESSIONS_URL = "https://www.galaxycine.vn/api/v2/mobile/sessions2?includeCinema=true&includeMovie=true";
    private static final String COMMING_URL = "https://www.galaxycine.vn/api/v2/mobile/movies/comming";
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

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

    @Override
    @Transactional
    public GalaxySyncResponse syncGalaxyData(String clientId, int limitShowtimes) {
        log.info("=== BẮT ĐẦU ĐỒNG BỘ ONLINE TỪ GALAXY CINEMA (limit={}) ===", limitShowtimes);

        RestClient.Builder builder = RestClient.builder()
                .defaultHeader(HttpHeaders.USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.REFERER, "https://www.galaxycine.vn/");

        if (clientId != null && !clientId.trim().isEmpty()) {
            String trimmedId = clientId.trim();
            builder.defaultHeader("clientId", trimmedId)
                   .defaultHeader("clientid", trimmedId)
                   .defaultHeader("x-client-id", trimmedId);
        }

        RestClient restClient = builder.build();

        JsonNode commingList = null;
        JsonNode sessionList;

        try {
            // 1. Tải danh sách phim sắp chiếu (nếu có thể)
            try {
                JsonNode commingJson = restClient.get()
                        .uri(COMMING_URL)
                        .retrieve()
                        .body(JsonNode.class);
                if (commingJson != null && commingJson.has("data") && commingJson.get("data").has("result")) {
                    commingList = commingJson.get("data").get("result");
                }
            } catch (Exception e) {
                log.warn("Không thể tải API phim sắp chiếu: {}", e.getMessage());
            }

            // 2. Tải danh sách suất chiếu, rạp và phim đang chiếu
            JsonNode sessionsJson = restClient.get()
                    .uri(SESSIONS_URL)
                    .retrieve()
                    .body(JsonNode.class);

            if (sessionsJson != null && sessionsJson.has("data") && sessionsJson.get("data").has("result")) {
                sessionList = sessionsJson.get("data").get("result");
            } else {
                throw new BadRequestException("Dữ liệu trả về từ Galaxy Cinema không đúng định dạng mong đợi");
            }

            return processData(sessionList, commingList, limitShowtimes);

        } catch (HttpStatusCodeException ex) {
            log.error("Galaxy API trả về mã lỗi HTTP {}: {}", ex.getStatusCode(), ex.getResponseBodyAsString());
            String errorMsg = ex.getResponseBodyAsString();
            if (ex.getStatusCode().value() == 403) {
                throw new BadRequestException("Galaxy Cinema yêu cầu Client ID xác thực (" + errorMsg +
                        "). Bạn có thể truyền tham số clientId hợp lệ hoặc dùng API đồng bộ từ file JSON: /api/v1/admin/sync/galaxy/local-file");
            }
            throw new BadRequestException("Lỗi khi kết nối tới Galaxy Cinema: " + ex.getStatusCode() + " - " + errorMsg);
        } catch (BadRequestException ex) {
            throw ex;
        } catch (Exception e) {
            log.error("Lỗi khi đồng bộ dữ liệu Galaxy: {}", e.getMessage(), e);
            throw new BadRequestException("Đồng bộ thất bại: " + e.getMessage() +
                    ". Bạn có thể dùng API đồng bộ từ file JSON offline: /api/v1/admin/sync/galaxy/local-file");
        }
    }

    @Override
    @Transactional
    public GalaxySyncResponse syncFromLocalJson(String jsonContent, int limitShowtimes) {
        log.info("=== BẮT ĐẦU ĐỒNG BỘ TỪ RAW JSON (limit={}) ===", limitShowtimes);
        try {
            JsonNode root = objectMapper.readTree(jsonContent);
            JsonNode sessionList = extractList(root);

            if (sessionList == null || sessionList.isEmpty()) {
                throw new BadRequestException("Chuỗi JSON không chứa danh sách suất chiếu (data.result)");
            }

            return processData(sessionList, null, limitShowtimes);
        } catch (BadRequestException ex) {
            throw ex;
        } catch (Exception e) {
            log.error("Lỗi khi parse JSON: {}", e.getMessage(), e);
            throw new BadRequestException("Không thể đọc chuỗi JSON: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public GalaxySyncResponse syncFromLocalFile(int limitShowtimes) {
        log.info("=== BẮT ĐẦU ĐỒNG BỘ TỪ FILE LOCAL (limit={}) ===", limitShowtimes);
        try {
            String content = null;

            // 1. Ưu tiên đọc từ ClassPath Resources (data/galaxy_sessions.json)
            try {
                ClassPathResource resource = new ClassPathResource("data/galaxy_sessions.json");
                if (resource.exists()) {
                    content = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
                    log.info("Đã tìm thấy dữ liệu trong classpath: data/galaxy_sessions.json");
                }
            } catch (Exception e) {
                log.warn("Không thể đọc từ classpath: {}", e.getMessage());
            }

            // 2. Dự phòng: tìm trên File System nếu chạy ngoài jar
            if (content == null || content.isEmpty()) {
                List<Path> candidatePaths = List.of(
                        Path.of("src/main/resources/data/galaxy_sessions.json"),
                        Path.of("backend/cinema-booking-backend/src/main/resources/data/galaxy_sessions.json"),
                        Path.of("api_galaxy.md"),
                        Path.of("../api_galaxy.md")
                );

                for (Path p : candidatePaths) {
                    if (Files.exists(p)) {
                        log.info("Đọc dữ liệu từ file system: {}", p.toAbsolutePath());
                        content = Files.readString(p);
                        if (p.toString().endsWith(".md")) {
                            int firstBrace = content.indexOf('{');
                            int commentIndex = content.indexOf("<!--");
                            if (firstBrace >= 0 && commentIndex > firstBrace) {
                                content = content.substring(firstBrace, commentIndex).trim();
                            }
                        }
                        break;
                    }
                }
            }

            if (content == null || content.isEmpty()) {
                throw new BadRequestException("Không tìm thấy file dữ liệu mẫu (galaxy_sessions.json hoặc api_galaxy.md)");
            }

            JsonNode root = objectMapper.readTree(content);
            JsonNode sessionList = extractList(root);

            if (sessionList == null || sessionList.isEmpty()) {
                throw new BadRequestException("Dữ liệu trong file không chứa danh sách suất chiếu hợp lệ");
            }

            return processData(sessionList, null, limitShowtimes);

        } catch (BadRequestException ex) {
            throw ex;
        } catch (Exception e) {
            log.error("Lỗi khi đọc file local: {}", e.getMessage(), e);
            throw new BadRequestException("Lỗi khi đọc file local: " + e.getMessage());
        }
    }

    // =========================================================================
    // CORE PROCESSING LOGIC (TỐI ƯU BATCH & CACHE)
    // =========================================================================

    private GalaxySyncResponse processData(JsonNode sessionList, JsonNode commingList, int limitShowtimes) {
        int syncedMovies = 0;
        int syncedShowtimes = 0;
        int syncedShowtimeSeats = 0;

        Map<String, Cinema> cinemaCache = new HashMap<>();
        Map<String, Auditorium> auditoriumCache = new HashMap<>();
        Map<String, Movie> movieCache = new HashMap<>();
        Map<Long, List<Seat>> auditoriumSeatsCache = new HashMap<>();

        // 1. Đồng bộ phim sắp chiếu (nếu có)
        if (commingList != null && commingList.isArray()) {
            for (JsonNode item : commingList) {
                String title = item.path("name").asText("").trim();
                if (title.isEmpty()) continue;

                Optional<Movie> existingOpt = movieRepository.findByTitle(title);
                if (existingOpt.isEmpty()) {
                    Movie movie = buildMovieFromNode(item, MovieStatus.COMING_SOON);
                    Movie saved = movieRepository.save(movie);
                    movieCache.put(title, saved);
                    syncedMovies++;
                } else {
                    movieCache.put(title, existingOpt.get());
                }
            }
        }

        // 2. Đồng bộ suất chiếu
        int count = 0;
        for (JsonNode sessionNode : sessionList) {
            if (limitShowtimes > 0 && count >= limitShowtimes) {
                log.info("Đã đạt giới hạn limitShowtimes={}", limitShowtimes);
                break;
            }

            // --- 2.1 Xử lý Movie ---
            JsonNode movieNode = sessionNode.path("movie");
            String movieTitle = movieNode.path("name").asText("").trim();
            if (movieTitle.isEmpty()) continue;

            Movie movie = movieCache.computeIfAbsent(movieTitle, t ->
                    movieRepository.findByTitle(t).orElseGet(() -> {
                        Movie m = buildMovieFromNode(movieNode, MovieStatus.NOW_SHOWING);
                        return movieRepository.save(m);
                    })
            );

            if (movie.getStatus() != MovieStatus.NOW_SHOWING) {
                movie.setStatus(MovieStatus.NOW_SHOWING);
                movieRepository.save(movie);
            }

            // --- 2.2 Xử lý Cinema ---
            JsonNode cinemaNode = sessionNode.path("cinema");
            String cinemaName = cinemaNode.path("name").asText("").trim();
            if (cinemaName.isEmpty()) continue;

            Cinema cinema = cinemaCache.computeIfAbsent(cinemaName, cName ->
                    cinemaRepository.findByName(cName).orElseGet(() -> {
                        String cityId = cinemaNode.path("cityId").asText("");
                        String address = cinemaNode.path("address").asText("");
                        String city = resolveCityName(cityId, address);

                        Cinema newCinema = Cinema.builder()
                                .name(cName)
                                .address(address)
                                .city(city)
                                .build();
                        return cinemaRepository.save(newCinema);
                    })
            );

            // --- 2.3 Xử lý Auditorium & Ghế vật lý ---
            String screenName = sessionNode.path("screenName").asText("Phòng Chiếu 1").trim();
            String auditoriumKey = cinema.getId() + "_" + screenName;

            Auditorium auditorium = auditoriumCache.computeIfAbsent(auditoriumKey, k ->
                    auditoriumRepository.findByCinemaIdAndName(cinema.getId(), screenName).orElseGet(() -> {
                        Auditorium newAuditorium = Auditorium.builder()
                                .cinema(cinema)
                                .name(screenName)
                                .totalRows(10)
                                .totalCols(12)
                                .build();
                        Auditorium savedAuditorium = auditoriumRepository.save(newAuditorium);

                        List<Seat> generatedSeats = generatePhysicalSeats(savedAuditorium);
                        List<Seat> savedSeats = seatRepository.saveAll(generatedSeats);
                        auditoriumSeatsCache.put(savedAuditorium.getId(), savedSeats);
                        return savedAuditorium;
                    })
            );

            // --- 2.4 Xử lý Showtime & ShowtimeSeats ---
            String showDate = sessionNode.path("showDate").asText("");
            String showTime = sessionNode.path("showTime").asText("");
            if (showDate.isEmpty() || showTime.isEmpty()) continue;

            LocalDateTime startTime = parseDateTime(showDate, showTime);
            if (startTime == null) continue;

            int duration = movie.getDurationMinutes() != null && movie.getDurationMinutes() > 0 ? movie.getDurationMinutes() : 120;
            LocalDateTime endTime = startTime.plusMinutes(duration + 15);

            boolean isOverlapping = showtimeRepository.existsOverlappingShowtime(
                    auditorium.getId(), startTime, endTime, null);
            if (isOverlapping) {
                continue;
            }

            String format = sessionNode.path("movieFormat").asText("");
            String version = sessionNode.path("version").asText("");
            BigDecimal basePrice = calculateBasePrice(format, version);

            Showtime showtime = Showtime.builder()
                    .movie(movie)
                    .auditorium(auditorium)
                    .startTime(startTime)
                    .endTime(endTime)
                    .basePrice(basePrice)
                    .build();
            Showtime savedShowtime = showtimeRepository.save(showtime);
            syncedShowtimes++;

            // Lấy ghế từ cache (tránh truy vấn lại DB cho mỗi suất chiếu của cùng phòng)
            List<Seat> physicalSeats = auditoriumSeatsCache.computeIfAbsent(auditorium.getId(),
                    id -> seatRepository.findByAuditoriumIdOrderByRowCharAscSeatNumberAsc(id));

            List<ShowtimeSeat> showtimeSeats = new ArrayList<>(physicalSeats.size());
            for (Seat s : physicalSeats) {
                BigDecimal seatPrice = basePrice;
                if (s.getType() == SeatType.VIP) {
                    seatPrice = seatPrice.add(BigDecimal.valueOf(20000));
                } else if (s.getType() == SeatType.COUPLE) {
                    seatPrice = seatPrice.add(BigDecimal.valueOf(40000));
                }

                showtimeSeats.add(ShowtimeSeat.builder()
                        .showtime(savedShowtime)
                        .seat(s)
                        .price(seatPrice)
                        .status(ShowtimeSeatStatus.AVAILABLE)
                        .version(0)
                        .build());
            }
            showtimeSeatRepository.saveAll(showtimeSeats);
            syncedShowtimeSeats += showtimeSeats.size();

            count++;
        }

        int syncedCinemas = cinemaCache.size();
        int syncedAuditoriums = auditoriumCache.size();
        int syncedSeats = syncedAuditoriums * 120;
        syncedMovies = movieCache.size();

        String successMsg = String.format("Đồng bộ thành công: %d phim, %d rạp, %d phòng chiếu, %d suất chiếu, %d ghế suất chiếu.",
                syncedMovies, syncedCinemas, syncedAuditoriums, syncedShowtimes, syncedShowtimeSeats);
        log.info("=== HOÀN TẤT ĐỒNG BỘ: {} ===", successMsg);

        return GalaxySyncResponse.builder()
                .totalMoviesSynced(syncedMovies)
                .totalCinemasSynced(syncedCinemas)
                .totalAuditoriumsSynced(syncedAuditoriums)
                .totalSeatsSynced(syncedSeats)
                .totalShowtimesSynced(syncedShowtimes)
                .totalShowtimeSeatsSynced(syncedShowtimeSeats)
                .message(successMsg)
                .build();
    }

    private JsonNode extractList(JsonNode root) {
        if (root.isArray()) return root;
        if (root.has("data") && root.get("data").has("result")) {
            return root.get("data").get("result");
        }
        if (root.has("result")) {
            return root.get("result");
        }
        return null;
    }

    private Movie buildMovieFromNode(JsonNode node, MovieStatus defaultStatus) {
        String title = node.path("name").asText("").trim();
        String description = node.path("slug").asText("");
        int duration = node.path("duration").asInt(120);
        if (duration <= 0) duration = 120;

        String rawStartDate = node.path("startDate").asText("");
        LocalDate releaseDate = LocalDate.now();
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
            case "18", "C18" -> "C18";
            case "16", "C16" -> "C16";
            case "13", "C13" -> "C13";
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
                .genre("Hành động / Phiêu lưu")
                .ageRating(ageRating)
                .status(defaultStatus)
                .build();
    }

    private List<Seat> generatePhysicalSeats(Auditorium auditorium) {
        List<Seat> seats = new ArrayList<>(120);
        int totalRows = auditorium.getTotalRows();
        int totalCols = auditorium.getTotalCols();

        for (int r = 0; r < totalRows; r++) {
            String rowChar = String.valueOf((char) ('A' + r));
            SeatType type = SeatType.STANDARD;

            if (rowChar.equals("E") || rowChar.equals("F") || rowChar.equals("G") || rowChar.equals("H")) {
                type = SeatType.VIP;
            } else if (rowChar.equals("J")) {
                type = SeatType.COUPLE;
            }

            for (int c = 1; c <= totalCols; c++) {
                seats.add(Seat.builder()
                        .auditorium(auditorium)
                        .rowChar(rowChar)
                        .seatNumber(c)
                        .type(type)
                        .isActive(true)
                        .build());
            }
        }
        return seats;
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
        return "TP. Hồ Chí Minh";
    }

    private LocalDateTime parseDateTime(String showDate, String showTime) {
        try {
            String combined = showDate.trim() + " " + showTime.trim();
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
