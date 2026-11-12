package com.cinema.booking;

import com.cinema.booking.dto.response.*;
import com.cinema.booking.dto.response.OccupancyReportResponse.CapacitySource;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.*;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.AdminReportService;
import com.cinema.booking.service.LocalSeatInventoryService;
import com.cinema.booking.service.impl.AdminReportServiceImpl;
import jakarta.persistence.*;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.context.annotation.*;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.*;
import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/** Service/repository thật trên schema thử riêng, không chạy ứng dụng/scheduler/Redis. */
@EnabledIfEnvironmentVariable(named = "CINEMA_TEST_DB_URL", matches = ".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AdminReportPostgresTests {
    private static final String SCHEMA = "report_test_" + UUID.randomUUID().toString().replace("-", "");
    private static final LocalDate DAY = LocalDate.of(2026, 11, 10);
    private AnnotationConfigApplicationContext context;
    private EntityManager em;
    private TransactionTemplate tx;
    private AdminReportService reports;
    private SessionFactory factory;
    private Cinema c1, c2;
    private Movie m1, m2;
    private Auditorium r1, r2;
    private Showtime s1, s2, s3, s4, s5, s6;
    private User user;

    @Configuration
    @EnableTransactionManagement
    @EnableJpaRepositories(basePackageClasses = BookingRepository.class)
    @Import({AdminReportServiceImpl.class, LocalSeatInventoryService.class})
    static class Config {
        @Bean DataSource dataSource() throws Exception {
            var ds = new DriverManagerDataSource(System.getenv("CINEMA_TEST_DB_URL"), System.getenv("CINEMA_TEST_DB_USER"), System.getenv("CINEMA_TEST_DB_PASSWORD"));
            try (Connection connection = ds.getConnection()) { connection.createStatement().execute("CREATE SCHEMA " + SCHEMA); }
            ds.setSchema(SCHEMA); return ds;
        }
        @Bean LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource ds) {
            var bean = new LocalContainerEntityManagerFactoryBean();
            bean.setDataSource(ds); bean.setPackagesToScan("com.cinema.booking.entity");
            bean.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            bean.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop", "hibernate.default_schema", SCHEMA,
                    "hibernate.jdbc.time_zone", "Asia/Ho_Chi_Minh", "hibernate.generate_statistics", true));
            return bean;
        }
        @Bean PlatformTransactionManager transactionManager(EntityManagerFactory factory) { return new JpaTransactionManager(factory); }
    }

    @BeforeAll void start() {
        context = new AnnotationConfigApplicationContext(Config.class);
        var emf = context.getBean(EntityManagerFactory.class);
        em = SharedEntityManagerCreator.createSharedEntityManager(emf);
        factory = emf.unwrap(SessionFactory.class);
        tx = new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
        reports = context.getBean(AdminReportService.class);
    }

    @AfterAll void close() throws Exception {
        if (context != null) context.close();
        if (!SCHEMA.matches("report_test_[a-f0-9]{32}")) throw new IllegalStateException("Schema thử không hợp lệ");
        try (Connection connection = DriverManager.getConnection(System.getenv("CINEMA_TEST_DB_URL"), System.getenv("CINEMA_TEST_DB_USER"), System.getenv("CINEMA_TEST_DB_PASSWORD"))) {
            connection.createStatement().execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }

    @BeforeEach void seed() {
        tx.executeWithoutResult(status -> {
            // Chỉ xóa fixture trong schema ngẫu nhiên vừa tạo cho lớp kiểm thử này.
            em.createNativeQuery("TRUNCATE TABLE " + SCHEMA + ".users, " + SCHEMA + ".movies, " + SCHEMA + ".cinemas, " + SCHEMA + ".products CASCADE").executeUpdate();
            user = User.builder().email("report@example.invalid").passwordHash("fixture").fullName("Báo cáo thử").build(); em.persist(user);
            c1 = cinema(); c2 = cinema(); m1 = movie(); m2 = movie();
            r1 = room(c1, 2, 3); r2 = room(c2, 1, 4);
            physical(r1, 6, 6); physical(r2, 4, 3);
            s1 = showtime(m1, r1, DAY.atTime(10, 0), true);
            s2 = showtime(m2, r1, DAY.atTime(12, 0), false);
            s3 = showtime(m1, r2, DAY.atTime(16, 0), true);
            s4 = showtime(m1, room(c1, 0, 0), DAY.atTime(18, 0), false);
            s5 = showtime(m2, r2, DAY.atTime(19, 0), true);
            Auditorium disabled = room(c2, 1, 2); physical(disabled, 2, 0);
            s6 = showtime(m2, disabled, DAY.atTime(20, 0), true);
            showtime(m1, r1, DAY.plusDays(1).atStartOfDay(), true);
            var inv1 = inventory(s1, 2); var inv2 = inventory(s2, 3); var inv3 = inventory(s3, 1);
            Booking first = booking(s1, "240000", DAY.atStartOfDay(), BookingStatus.CONFIRMED, inv1.subList(0, 2));
            // Hai dòng combo + hai ghế sẽ nhân doanh thu nếu JOIN cả collection để SUM.
            combo(first); combo(first);
            booking(s2, "300000", DAY.atTime(23, 59, 59, 999_999_000), BookingStatus.CONFIRMED, inv2.subList(0, 3));
            booking(s3, "100000", DAY.atTime(12, 0), BookingStatus.CONFIRMED, inv3.subList(0, 1));
            booking(s1, "50000", DAY.atTime(13, 0), BookingStatus.CONFIRMED, List.of(inv1.get(2))); // LOCKED không là vé bán.
            for (BookingStatus state : List.of(BookingStatus.PENDING, BookingStatus.CANCELLED, BookingStatus.EXPIRED)) {
                booking(s1, "999000", DAY.atTime(14, 0), state, List.of(inv1.getFirst()));
            }
            booking(s1, "999000", DAY.minusDays(1).atTime(23, 59, 59), BookingStatus.CONFIRMED, List.of());
            booking(s1, "888000", DAY.plusDays(1).atStartOfDay(), BookingStatus.CONFIRMED, List.of());
            em.flush(); em.clear();
        });
        factory.getStatistics().clear();
    }

    @Test void revenueGroupsApplyAllFiltersAndReconcileWithKnownKpis() {
        assertReports(null, null, "690000", 4, 6);
        assertReports(c1.getId(), null, "590000", 3, 5);
        assertReports(null, m1.getId(), "390000", 3, 3);
        assertReports(c1.getId(), m1.getId(), "290000", 2, 2);
        assertReports(c2.getId(), m1.getId(), "100000", 1, 1);
        assertReports(c2.getId(), m2.getId(), "0", 0, 0);
    }

    @Test void revenueUsesCreationDayInclusiveBoundariesAndOnlyConfirmedOrders() {
        assertMoney("690000", reports.getRevenueReport(DAY, DAY, null, null, "none").getTotalRevenue());
        assertMoney("2577000", reports.getRevenueReport(null, null, null, null, "none").getTotalRevenue());
        assertMoney("1578000", reports.getRevenueReport(DAY, null, null, null, "none").getTotalRevenue());
        assertMoney("1689000", reports.getRevenueReport(null, DAY, null, null, "none").getTotalRevenue());
    }

    @Test void equalMovieAndCinemaNamesDoNotMergeDistinctIds() {
        for (String grouping : List.of("movie", "cinema")) {
            var rows = reports.getRevenueReport(DAY, DAY, null, null, grouping).getBreakdown();
            assertEquals(2, rows.size()); assertEquals(rows.get(0).getLabel(), rows.get(1).getLabel());
            assertNotEquals(rows.get(0).getId(), rows.get(1).getId());
            assertTrue(rows.get(0).getId() < rows.get(1).getId());
        }
    }

    @Test void occupancyIncludesEndedAndInactiveSlotsAndCountsOnlyBookedPositions() {
        var report = reports.getOccupancyReport(null, null, DAY);
        assertEquals(6, report.getBreakdown().size()); assertEquals(18L, report.getTotalSeatsAvailable());
        assertEquals(6L, report.getTotalSeatsBooked()); assertEquals(33.33, report.getOverallOccupancyRate());
        assertEquals(1L, report.getShowtimesMissingCapacity());
        var withdrawn = item(report, s2); assertFalse(withdrawn.getActive()); assertEquals(3L, withdrawn.getBookedSeats());
        assertEquals(CapacitySource.INVENTORY, withdrawn.getCapacitySource());
        assertEquals(CapacitySource.UNCONFIGURED, item(report, s4).getCapacitySource());
        assertEquals(CapacitySource.ACTIVE_SEATS, item(report, s5).getCapacitySource());
        assertEquals(3L, item(report, s5).getTotalSeats());
        assertEquals(0L, item(report, s6).getTotalSeats());
        assertEquals(0.0, item(report, s6).getOccupancyRate());
    }

    @Test void occupancyFiltersAreIndependentOfOpenSaleCatalogAndUnknownFiltersAreEmpty() {
        var report = reports.getOccupancyReport(c2.getId(), m1.getId(), DAY);
        assertEquals(1, report.getBreakdown().size()); assertEquals(s3.getId(), report.getBreakdown().getFirst().getShowtimeId());
        assertEquals(3L, report.getTotalSeatsAvailable()); assertEquals(1L, report.getTotalSeatsBooked());
        assertTrue(reports.getOccupancyReport(c1.getId(), m2.getId(), DAY).getBreakdown().stream().anyMatch(row -> !row.getActive()));
        assertTrue(reports.getOccupancyReport(Long.MAX_VALUE, null, DAY).getBreakdown().isEmpty());
        assertEquals(0.0, reports.getOccupancyReport(null, null, DAY.minusDays(1)).getOverallOccupancyRate());
    }

    @Test void readingSeatMapDoesNotChangeLayoutCapacityOrOverallRate() {
        var future = tx.execute(status -> showtime(movie(), room(c1, 2, 3), LocalDateTime.of(2099, 1, 1, 10, 0), true));
        var before = reports.getOccupancyReport(null, null, null);
        assertEquals(CapacitySource.ROOM_LAYOUT, item(before, future).getCapacitySource());
        assertEquals(6L, item(before, future).getTotalSeats());
        var seats = context.getBean(LocalSeatInventoryService.class).getOrCreateSeats(future.getId());
        assertEquals(6, seats.size());
        var after = reports.getOccupancyReport(null, null, null);
        assertEquals(CapacitySource.INVENTORY, item(after, future).getCapacitySource());
        assertEquals(before.getTotalSeatsAvailable(), after.getTotalSeatsAvailable());
        assertEquals(before.getTotalSeatsBooked(), after.getTotalSeatsBooked());
        assertEquals(before.getOverallOccupancyRate(), after.getOverallOccupancyRate());
    }

    @Test void physicalInactiveSeatsStayExcludedBeforeAndAfterProvisioning() {
        var future = tx.execute(status -> showtime(m2, r2, LocalDateTime.of(2099, 1, 1, 10, 0), true));
        var before = reports.getOccupancyReport(null, null, null);
        assertEquals(CapacitySource.ACTIVE_SEATS, item(before, future).getCapacitySource());
        assertEquals(3L, item(before, future).getTotalSeats());
        assertEquals(3, context.getBean(LocalSeatInventoryService.class).getOrCreateSeats(future.getId()).size());
        var after = reports.getOccupancyReport(null, null, null);
        assertEquals(before.getTotalSeatsAvailable(), after.getTotalSeatsAvailable());
        assertEquals(before.getOverallOccupancyRate(), after.getOverallOccupancyRate());
    }

    @Test void existingInventoryIsAHistoricalSnapshotEvenWhenRoomConfigurationChanges() {
        tx.executeWithoutResult(status -> {
            em.createQuery("UPDATE Seat s SET s.isActive = false WHERE s.auditorium.id = :id").setParameter("id", r1.getId()).executeUpdate();
            em.createQuery("UPDATE Auditorium a SET a.totalRows = 0, a.totalCols = 0 WHERE a.id = :id").setParameter("id", r1.getId()).executeUpdate();
        });
        var report = reports.getOccupancyReport(null, null, DAY);
        assertEquals(6L, item(report, s1).getTotalSeats()); assertEquals(6L, item(report, s2).getTotalSeats());
        assertEquals(2L, item(report, s1).getBookedSeats());
    }

    @Test void reportsDoNotWriteAndUseBoundedQueriesRatherThanOneQueryPerShowtime() {
        var stats = factory.getStatistics(); stats.clear();
        reports.getRevenueReport(DAY, DAY, null, null, "movie");
        assertEquals(1, stats.getPrepareStatementCount());
        stats.clear(); reports.getOccupancyReport(null, null, DAY);
        assertEquals(3, stats.getPrepareStatementCount());
        assertEquals(0, stats.getEntityInsertCount()); assertEquals(0, stats.getEntityUpdateCount()); assertEquals(0, stats.getEntityDeleteCount());
        long uninitialized = tx.execute(status -> em.createQuery("SELECT COUNT(ss) FROM ShowtimeSeat ss WHERE ss.showtime.id = :id", Long.class).setParameter("id", s5.getId()).getSingleResult());
        assertEquals(0L, uninitialized);
    }

    private void assertReports(Long cinema, Long movie, String money, long orders, long tickets) {
        for (String grouping : List.of("movie", "cinema", "none")) {
            var report = reports.getRevenueReport(DAY, DAY, cinema, movie, grouping);
            assertMoney(money, report.getTotalRevenue()); assertEquals(orders, report.getTotalSuccessfulBookings()); assertEquals(tickets, report.getTotalTicketsSold());
            if (!grouping.equals("none")) {
                assertMoney(money, report.getBreakdown().stream().map(RevenueReportResponse.RevenueItem::getRevenue).reduce(BigDecimal.ZERO, BigDecimal::add));
                assertEquals(orders, report.getBreakdown().stream().mapToLong(RevenueReportResponse.RevenueItem::getBookingCount).sum());
                assertEquals(tickets, report.getBreakdown().stream().mapToLong(RevenueReportResponse.RevenueItem::getTicketCount).sum());
            }
        }
    }
    private OccupancyReportResponse.OccupancyItem item(OccupancyReportResponse report, Showtime slot) { return report.getBreakdown().stream().filter(row -> row.getShowtimeId().equals(slot.getId())).findFirst().orElseThrow(); }
    private void assertMoney(String expected, BigDecimal actual) { assertEquals(0, new BigDecimal(expected).compareTo(actual)); }
    private Cinema cinema() { var cinema = Cinema.builder().name("Rạp trùng tên").city("Thử nghiệm").address("Schema riêng").build(); em.persist(cinema); return cinema; }
    private Movie movie() { var movie = Movie.builder().title("Phim trùng tên").durationMinutes(120).releaseDate(DAY).build(); em.persist(movie); return movie; }
    private Auditorium room(Cinema cinema, int rows, int cols) { var room = Auditorium.builder().cinema(cinema).name("Phòng").totalRows(rows).totalCols(cols).build(); em.persist(room); return room; }
    private Showtime showtime(Movie movie, Auditorium room, LocalDateTime start, boolean active) {
        var slot = Showtime.builder().movie(movie).auditorium(room).startTime(start).endTime(start.plusHours(2)).basePrice(new BigDecimal("100000")).active(active).build(); em.persist(slot); return slot;
    }
    private void physical(Auditorium room, int count, int active) {
        for (int index = 0; index < count; index++) em.persist(Seat.builder().auditorium(room).rowChar("A").seatNumber(index + 1).isActive(index < active).build());
    }
    private List<ShowtimeSeat> inventory(Showtime slot, int booked) {
        List<Seat> physical = em.createQuery("SELECT s FROM Seat s WHERE s.auditorium.id = :id AND s.isActive = true ORDER BY s.id", Seat.class).setParameter("id", slot.getAuditorium().getId()).getResultList();
        var result = new ArrayList<ShowtimeSeat>();
        for (int index = 0; index < physical.size(); index++) {
            var seat = ShowtimeSeat.builder().showtime(slot).seat(physical.get(index)).price(new BigDecimal("100000"))
                    .status(index < booked ? ShowtimeSeatStatus.BOOKED : index == booked ? ShowtimeSeatStatus.LOCKED : ShowtimeSeatStatus.AVAILABLE).build();
            em.persist(seat); result.add(seat);
        }
        return result;
    }
    private Booking booking(Showtime slot, String amount, LocalDateTime created, BookingStatus status, List<ShowtimeSeat> seats) {
        var booking = Booking.builder().bookingCode(UUID.randomUUID().toString().replace("-", "").substring(0, 20)).user(user).showtime(slot)
                .totalAmount(new BigDecimal(amount)).status(status).expiresAt(created.plusMinutes(10)).build();
        seats.forEach(seat -> booking.getBookingSeats().add(BookingSeat.builder().booking(booking).showtimeSeat(seat).price(seat.getPrice()).build()));
        em.persist(booking); em.flush();
        em.createNativeQuery("UPDATE bookings SET created_at = :created WHERE id = :id").setParameter("created", created).setParameter("id", booking.getId()).executeUpdate();
        return booking;
    }
    private void combo(Booking booking) {
        var product = Product.builder().name("Combo").price(new BigDecimal("20000")).isAvailable(true).build(); em.persist(product);
        em.persist(BookingProduct.builder().booking(booking).product(product).quantity(1).unitPrice(new BigDecimal("20000")).build());
    }
}
