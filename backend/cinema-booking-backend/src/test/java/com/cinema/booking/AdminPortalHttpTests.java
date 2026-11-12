package com.cinema.booking;

import com.cinema.booking.config.BookingClockConfig;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.*;
import com.cinema.booking.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.TestConstructor;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** HTTP/Tomcat, JWT, ORM, PostgreSQL và Redis thật; chỉ chạy trong môi trường thử do helper tạo. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@EnabledIfEnvironmentVariable(named = "CINEMA_TEST_HTTP", matches = "true")
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AdminPortalHttpTests {
    private static final String SCHEMA = "admin_http_" + UUID.randomUUID().toString().replace("-", "");

    @DynamicPropertySource static void isolatedSchema(DynamicPropertyRegistry registry) throws Exception {
        String url = System.getenv("CINEMA_TEST_DB_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:\\d+/postgres")
                || !"admin_test".equals(System.getenv("CINEMA_TEST_DB_USER"))) {
            throw new IllegalStateException("HTTP nghiệm thu chỉ được chạy trên cluster thử của helper");
        }
        try (var connection = java.sql.DriverManager.getConnection(url, "admin_test", "")) {
            connection.createStatement().execute("CREATE SCHEMA " + SCHEMA);
        }
        // Tách fixture HTTP khỏi các SpringBootTest catalog/auth trong cùng lần Maven.
        registry.add("spring.datasource.url", () -> url + "?currentSchema=" + SCHEMA);
    }
    private final ObjectMapper json;
    private final UserRepository users;
    private final MovieRepository movies;
    private final CinemaRepository cinemas;
    private final AuditoriumRepository rooms;
    private final ProductRepository products;
    private final ShowtimeRepository showtimes;
    private final ShowtimeSeatRepository inventory;
    private final SeatRepository seats;
    private final BookingRepository bookings;
    private final EntityManager em;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final HttpClient client = HttpClient.newHttpClient();
    private final String suffix = UUID.randomUUID().toString().substring(0, 8);
    private final String password = "AdminTest-" + UUID.randomUUID();
    private final LocalDate tomorrow = LocalDate.now(BookingClockConfig.ZONE).plusDays(1);
    private final LocalDate reportDay = LocalDate.of(2026, 11, 10);
    private String adminToken, customerToken, customerRefresh;
    private Long customerId, cinemaId, roomId, secondRoomId, productId, movieId, showtimeId;
    private Long reportMovie1, reportMovie2, reportCinema2;
    private String browserMovieTitle;
    private int bundledMovies;

    AdminPortalHttpTests(ObjectMapper json, UserRepository users, MovieRepository movies, CinemaRepository cinemas,
            AuditoriumRepository rooms, ProductRepository products, ShowtimeRepository showtimes,
            ShowtimeSeatRepository inventory, SeatRepository seats, BookingRepository bookings,
            EntityManager em,
            JdbcTemplate jdbc, PlatformTransactionManager transactions) {
        this.json = json; this.users = users; this.movies = movies; this.cinemas = cinemas; this.rooms = rooms;
        this.products = products; this.showtimes = showtimes; this.inventory = inventory; this.seats = seats;
        this.bookings = bookings; this.em = em;
        this.jdbc = jdbc; this.tx = new TransactionTemplate(transactions);
    }

    @LocalServerPort private int port;

    private String adminEmail() { return "admin-" + suffix + "@example.invalid"; }
    private String customerEmail() { return "customer-" + suffix + "@example.invalid"; }

    private JsonNode api(String method, String path, String token, Object body, int expected) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1" + path))
                .timeout(Duration.ofSeconds(60)).header("Content-Type", "application/json");
        if (token != null) request.header("Authorization", "Bearer " + token);
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        var response = client.send(request.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        // Không in token/mật khẩu vào báo cáo khi assertion thất bại.
        assertEquals(expected, response.statusCode(), method + " " + path + ": " + response.body().replaceAll("eyJ[\\w.-]+", "[JWT]"));
        JsonNode payload = json.readTree(response.body());
        assertEquals(expected, payload.path("code").asInt());
        return payload.path("data");
    }

    @BeforeAll void prepare() throws Exception {
        // Chặn nhầm môi trường trước khi tạo tài khoản/fixture; helper dùng cluster mới và user riêng.
        assertEquals("admin_test", jdbc.queryForObject("select current_user", String.class));
        String url = System.getenv("CINEMA_TEST_DB_URL");
        assertNotNull(url);
        assertTrue(url.matches("jdbc:postgresql://127\\.0\\.0\\.1:\\d+/postgres"));
        try (var connection = Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
            assertEquals(url + "?currentSchema=" + SCHEMA, connection.getMetaData().getURL());
        }
        assertNotEquals("6379", System.getenv("CINEMA_TEST_REDIS_PORT"));
        try (var resource = getClass().getResourceAsStream("/data/galaxy_sessions.json")) {
            assertNotNull(resource);
            Set<String> ids = new HashSet<>();
            for (var session : json.readTree(resource).path("data").path("result")) ids.add(session.path("movie").path("id").asText());
            bundledMovies = ids.size(); assertTrue(bundledMovies > 0);
        }
        for (String email : List.of(adminEmail(), customerEmail())) {
            api("POST", "/auth/register", null, Map.of("email", email, "password", password, "fullName", "Nghiệm thu Admin"), 201);
        }
        tx.executeWithoutResult(status -> {
            User admin = users.findByEmail(adminEmail()).orElseThrow(); admin.setRole(UserRole.ADMIN); users.save(admin);
            customerId = users.findByEmail(customerEmail()).orElseThrow().getId();
            Cinema cinema = cinemas.save(Cinema.builder().name("Rạp nghiệm thu " + suffix).address("Dữ liệu thử độc lập").city("Hồ Chí Minh").build());
            cinemaId = cinema.getId();
            roomId = rooms.save(Auditorium.builder().cinema(cinema).name("Phòng 1").totalRows(2).totalCols(3).build()).getId();
            secondRoomId = rooms.save(Auditorium.builder().cinema(cinema).name("Phòng 2").totalRows(1).totalCols(4).build()).getId();
            productId = products.save(Product.builder().name("Combo nghiệm thu " + suffix).price(new BigDecimal("40000")).isAvailable(true).build()).getId();
        });
        adminToken = api("POST", "/auth/login", null, Map.of("email", adminEmail(), "password", password), 200).path("accessToken").asText();
        var customer = api("POST", "/auth/login", null, Map.of("email", customerEmail(), "password", password), 200);
        customerToken = customer.path("accessToken").asText(); customerRefresh = customer.path("refreshToken").asText();
    }

    @Test @Order(1) void sessionsAndBothRolesUseRealJwtAndSecurityFilters() throws Exception {
        assertEquals("ADMIN", api("GET", "/users/me", adminToken, null, 200).path("role").asText());
        assertEquals("CUSTOMER", api("GET", "/users/me", customerToken, null, 200).path("role").asText());
        assertFalse(api("POST", "/auth/refresh", null, Map.of("refreshToken", customerRefresh), 200).path("accessToken").asText().isBlank());
        api("GET", "/users/me", null, null, 401);
        api("GET", "/admin/reports/revenue", "token-sai", null, 401);
        for (String path : List.of("/admin/reports/revenue", "/admin/reports/occupancy", "/admin/sync/galaxy/status")) {
            api("GET", path, null, null, 401); api("GET", path, customerToken, null, 403);
        }
        for (String path : List.of("/admin/movies", "/admin/showtimes", "/admin/sync/galaxy/local-file")) {
            api("POST", path, customerToken, Map.of(), 403);
        }
    }

    private Map<String, Object> movie(String title, String state) {
        var body = new LinkedHashMap<String, Object>();
        body.put("title", title); body.put("durationMinutes", 100); body.put("releaseDate", tomorrow.minusDays(10).toString());
        body.put("status", state); body.put("description", null); body.put("posterUrl", null); body.put("trailerUrl", null);
        body.put("genre", "Nghiệm thu"); body.put("ageRating", "P"); return body;
    }

    @Test @Order(2) void movieWritesPersistAndPublicFiltersObserveTheEdits() throws Exception {
        long before = movies.count();
        api("POST", "/admin/movies", adminToken, Map.of("title", "", "durationMinutes", 0), 400);
        assertEquals(before, movies.count());
        movieId = api("POST", "/admin/movies", adminToken, movie("Phim HTTP " + suffix, "NOW_SHOWING"), 201).path("id").asLong();
        assertEquals("Phim HTTP " + suffix, movies.findById(movieId).orElseThrow().getTitle());
        api("PUT", "/admin/movies/" + movieId, customerToken, movie("Không được ghi", "ENDED"), 403);
        api("PUT", "/admin/movies/" + movieId, adminToken, movie("Phim HTTP đã sửa " + suffix, "COMING_SOON"), 200);
        assertEquals(MovieStatus.COMING_SOON, movies.findById(movieId).orElseThrow().getStatus());
        assertTrue(api("GET", "/movies?status=COMING_SOON&keyword=" + suffix, null, null, 200).path("content").size() >= 1);
        api("PUT", "/admin/movies/" + movieId, adminToken, movie("Phim HTTP đã sửa " + suffix, "NOW_SHOWING"), 200);
    }

    private Map<String, Object> slot(LocalDate date, String start, String end) {
        return Map.of("movieId", movieId, "auditoriumId", roomId, "startTime", date + "T" + start,
                "endTime", date + "T" + end, "basePrice", 100000);
    }

    @Test @Order(3) void showtimeWritesAppearInPublicScheduleAndOverlapReturns409WithoutAnotherRow() throws Exception {
        long before = showtimes.count();
        showtimeId = api("POST", "/admin/showtimes", adminToken, slot(tomorrow, "14:00:00", "16:00:00"), 201).path("id").asLong();
        api("POST", "/admin/showtimes", adminToken, slot(tomorrow, "15:00:00", "17:00:00"), 409);
        api("POST", "/admin/showtimes", adminToken, slot(tomorrow, "17:00:00", "17:00:00"), 400);
        assertEquals(before + 1, showtimes.count());
        assertEquals(tomorrow.atTime(14, 0), showtimes.findById(showtimeId).orElseThrow().getStartTime());
        var schedule = api("GET", "/showtimes?date=" + tomorrow + "&cinemaId=" + cinemaId + "&movieId=" + movieId, null, null, 200);
        assertTrue(schedule.findValues("id").stream().anyMatch(id -> id.asLong() == showtimeId));
    }

    @Test @Order(4) void bookingAndCheckoutUseRealRedisDatabaseHoldsAndCancellation() throws Exception {
        var map = api("GET", "/showtimes/" + showtimeId + "/seats", null, null, 200);
        assertEquals(6, map.path("seats").size());
        long seatId = map.path("seats").get(0).path("showtimeSeatId").asLong();
        assertTrue(seatId > 0);
        Map<String, Object> request = Map.of("showtimeId", showtimeId, "showtimeSeatIds", List.of(seatId), "products", List.of());
        var booking = api("POST", "/bookings", customerToken, request, 201);
        String code = booking.path("bookingCode").asText();
        api("POST", "/bookings", adminToken, request, 409);
        assertEquals(ShowtimeSeatStatus.LOCKED, inventory.findById(seatId).orElseThrow().getStatus());
        assertEquals("PENDING", api("GET", "/bookings/" + code, customerToken, null, 200).path("status").asText());
        var updated = api("PUT", "/bookings/" + code + "/products", customerToken,
                Map.of("expectedRevision", booking.path("checkoutRevision").asText(), "products", List.of(Map.of("productId", productId, "quantity", 1))), 200);
        assertEquals(0, new BigDecimal("140000").compareTo(updated.path("totalAmount").decimalValue()));
        api("DELETE", "/bookings/" + code + "/cancel", customerToken, null, 200);
        assertEquals(ShowtimeSeatStatus.AVAILABLE, inventory.findById(seatId).orElseThrow().getStatus());
        assertEquals(BookingStatus.CANCELLED, bookings.findByBookingCode(code).orElseThrow().getStatus());
    }

    private Showtime history(Movie movie, Auditorium room, int hour) {
        return showtimes.save(Showtime.builder().movie(movie).auditorium(room).startTime(reportDay.atTime(hour, 0))
                .endTime(reportDay.atTime(hour + 1, 50)).active(false).basePrice(new BigDecimal("100000")).build());
    }

    private void confirmed(Showtime showtime, int capacity, int sold, String amount, boolean combo) {
        User customer = users.findById(customerId).orElseThrow();
        var booking = bookings.saveAndFlush(Booking.builder().bookingCode("AT" + UUID.randomUUID().toString().substring(0, 16))
                .user(customer).showtime(showtime).status(BookingStatus.CONFIRMED).totalAmount(new BigDecimal(amount))
                .expiresAt(reportDay.atTime(23, 0)).build());
        // Fixture lịch sử do kiểm thử tạo trực tiếp, không giả thành giao dịch thanh toán thật.
        jdbc.update("update bookings set created_at=? where id=?", java.sql.Timestamp.valueOf(reportDay.atTime(12, 0)), booking.getId());
        for (int i = 1; i <= capacity; i++) {
            var seat = seats.save(Seat.builder().auditorium(showtime.getAuditorium()).rowChar("A").seatNumber(i).type(SeatType.STANDARD).isActive(true).build());
            var item = inventory.save(ShowtimeSeat.builder().seat(seat).showtime(showtime).price(new BigDecimal("100000"))
                    .status(i <= sold ? ShowtimeSeatStatus.BOOKED : ShowtimeSeatStatus.AVAILABLE).version(0).build());
            if (i <= sold) em.persist(BookingSeat.builder().booking(booking).showtimeSeat(item).price(item.getPrice()).build());
        }
        if (combo) em.persist(BookingProduct.builder().booking(booking).product(products.findById(productId).orElseThrow()).quantity(1).unitPrice(new BigDecimal("40000")).build());
    }

    @Test @Order(5) void reportHttpKpisGroupsAndOccupancyMatchIndependentDatabaseQueries() throws Exception {
        tx.executeWithoutResult(status -> {
            Movie m1 = movies.save(Movie.builder().title("Phim báo cáo A " + suffix).durationMinutes(100).releaseDate(reportDay).status(MovieStatus.ENDED).build());
            Movie m2 = movies.save(Movie.builder().title("Phim báo cáo B " + suffix).durationMinutes(100).releaseDate(reportDay).status(MovieStatus.ENDED).build());
            reportMovie1 = m1.getId(); reportMovie2 = m2.getId();
            Cinema c2 = cinemas.save(Cinema.builder().name("Rạp báo cáo B " + suffix).address("Độc lập").city("Hà Nội").build());
            reportCinema2 = c2.getId();
            Auditorium r1 = rooms.save(Auditorium.builder().cinema(cinemas.findById(cinemaId).orElseThrow()).name("Lịch sử A").totalRows(1).totalCols(6).build());
            Auditorium r2 = rooms.save(Auditorium.builder().cinema(c2).name("Lịch sử B").totalRows(1).totalCols(4).build());
            confirmed(history(m1, r1, 10), 6, 2, "240000", true);
            confirmed(history(m2, r2, 14), 4, 1, "100000", false);
        });
        for (String group : List.of("movie", "cinema", "none")) {
            var revenue = api("GET", "/admin/reports/revenue?startDate=" + reportDay + "&endDate=" + reportDay + "&groupBy=" + group, adminToken, null, 200);
            BigDecimal expected = jdbc.queryForObject("select sum(total_amount) from bookings where status='CONFIRMED' and created_at>=? and created_at<?", BigDecimal.class,
                    java.sql.Timestamp.valueOf(reportDay.atStartOfDay()), java.sql.Timestamp.valueOf(reportDay.plusDays(1).atStartOfDay()));
            assertEquals(0, expected.compareTo(revenue.path("totalRevenue").decimalValue()));
            assertEquals(0, new BigDecimal("340000").compareTo(expected));
            assertEquals(2, revenue.path("totalSuccessfulBookings").asInt());
            assertEquals(3, revenue.path("totalTicketsSold").asInt());
            BigDecimal sum = BigDecimal.ZERO; int tickets = 0, orders = 0;
            for (var row : revenue.path("breakdown")) { sum = sum.add(row.path("revenue").decimalValue()); tickets += row.path("ticketCount").asInt(); orders += row.path("bookingCount").asInt(); }
            if (!group.equals("none")) { assertEquals(0, expected.compareTo(sum)); assertEquals(3, tickets); assertEquals(2, orders); }
        }
        var filtered = api("GET", "/admin/reports/revenue?startDate=" + reportDay + "&endDate=" + reportDay + "&cinemaId=" + cinemaId + "&movieId=" + reportMovie1 + "&groupBy=movie", adminToken, null, 200);
        assertEquals(240000, filtered.path("totalRevenue").asInt()); assertEquals(2, filtered.path("totalTicketsSold").asInt());
        var empty = api("GET", "/admin/reports/revenue?cinemaId=" + reportCinema2 + "&movieId=" + reportMovie1, adminToken, null, 200);
        assertEquals(0, empty.path("totalRevenue").asInt());
        long rows = inventory.count();
        var occupancy = api("GET", "/admin/reports/occupancy?date=" + reportDay, adminToken, null, 200);
        assertEquals(10, occupancy.path("totalSeatsAvailable").asInt());
        assertEquals(3, occupancy.path("totalSeatsBooked").asInt());
        assertEquals(30.0, occupancy.path("overallOccupancyRate").asDouble());
        assertEquals(2, occupancy.path("breakdown").size());
        assertEquals(rows, inventory.count());
        api("GET", "/admin/reports/revenue?startDate=2026-11-11&endDate=2026-11-10", adminToken, null, 400);
    }

    @Test @Order(6) void offlineFileImportPersistsCatalogAndNeverClaimsOnlineSuccess() throws Exception {
        var before = api("GET", "/admin/sync/galaxy/status", adminToken, null, 200);
        assertFalse(before.path("enabled").asBoolean());
        var result = api("POST", "/admin/sync/galaxy/local-file?limitShowtimes=100", adminToken, null, 200);
        assertEquals("LOCAL_FILE", result.path("source").asText());
        assertFalse(result.path("syncedAt").asText().isBlank());
        assertEquals(bundledMovies, result.path("totalMoviesSynced").asInt());
        assertEquals(bundledMovies, jdbc.queryForObject("select count(*) from movies where galaxy_movie_id is not null", Long.class));
        var after = api("GET", "/admin/sync/galaxy/status", adminToken, null, 200);
        assertEquals(before.path("lastSuccessAt"), after.path("lastSuccessAt"));
        assertEquals(before.path("lastAttemptAt"), after.path("lastAttemptAt"));
        assertFalse(after.path("running").asBoolean());
        api("POST", "/admin/sync/galaxy/local-file?limitShowtimes=-1", adminToken, null, 400);
    }

    @Test @Order(7) void productionUiUsesActualHttpOnDesktopAndMobile() throws Exception {
        Assumptions.assumeTrue("true".equals(System.getenv("CINEMA_TEST_BROWSER")), "Bật CINEMA_TEST_BROWSER qua helper để chạy Edge thật");
        Path frontend = Path.of("..", "..", "frontend").toAbsolutePath().normalize();
        browserMovieTitle = "Phim Edge thật " + suffix;
        var input = new LinkedHashMap<String, Object>(Map.of("apiBase", "http://127.0.0.1:" + port + "/api/v1", "adminEmail", adminEmail(),
                "customerEmail", customerEmail(), "password", password, "movieTitle", browserMovieTitle,
                "movieId", movieId, "cinemaId", cinemaId, "roomId", secondRoomId, "day", tomorrow.plusDays(1).toString(), "reportDay", reportDay.toString()));
        input.put("expectedSyncedMovies", bundledMovies);
        Path log = Path.of(System.getenv("CINEMA_TEST_ARTIFACTS"), "edge-http.log");
        var process = new ProcessBuilder("node", "scripts/admin-http-browser-check.mjs").directory(frontend.toFile())
                .redirectErrorStream(true).redirectOutput(log.toFile()).start();
        try (var stream = process.getOutputStream()) { stream.write(json.writeValueAsBytes(input)); }
        if (!process.waitFor(180, TimeUnit.SECONDS)) { process.destroyForcibly(); fail("Edge quá hạn; xem " + log); }
        assertEquals(0, process.exitValue(), "Edge HTTP không đạt; xem " + log);
        // Đọc DB độc lập sau UI để chứng minh thao tác thật đã lưu đúng giá trị.
        assertEquals(1, jdbc.queryForObject("select count(*) from movies where title=? and status='COMING_SOON'", Long.class, browserMovieTitle + " đã sửa"));
        assertEquals(1, jdbc.queryForObject("select count(*) from showtimes where auditorium_id=? and start_time=?", Long.class,
                secondRoomId, java.sql.Timestamp.valueOf(tomorrow.plusDays(1).atTime(10, 0))));
    }
}
