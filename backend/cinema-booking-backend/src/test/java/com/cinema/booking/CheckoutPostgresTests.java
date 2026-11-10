package com.cinema.booking;

import com.cinema.booking.config.BookingClockConfig;
import com.cinema.booking.dto.request.*;
import com.cinema.booking.dto.response.*;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.*;
import com.cinema.booking.exception.*;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.*;
import com.cinema.booking.service.impl.*;
import com.cinema.booking.config.*;
import jakarta.persistence.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.context.annotation.*;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.*;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.EnableTransactionManagement;
import org.springframework.transaction.support.*;
import org.springframework.mock.web.MockHttpServletRequest;
import javax.sql.DataSource;
import java.math.BigDecimal;
import java.sql.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/** Real production services/repositories, isolated schema; no application rows or gateway requests. */
@EnabledIfEnvironmentVariable(named = "CINEMA_TEST_DB_URL", matches = ".+")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class CheckoutPostgresTests {
    private static final String SCHEMA = "checkout_test_" + UUID.randomUUID().toString().replace("-", "");
    private AnnotationConfigApplicationContext context;
    private EntityManager em;
    private TransactionTemplate tx;
    private BookingService bookingService;
    private BookingProductsService products;
    private PaymentService paymentService;
    private CheckoutPaymentService checkoutPayments;
    private BookingCleanupService cleanup;
    private PaymentGateway gateway;
    private CheckoutSupport support;
    private Fixture fixture;

    static class TestClock extends Clock {
        final AtomicReference<Instant> time = new AtomicReference<>(Instant.parse("2026-11-09T06:00:00Z"));
        public ZoneId getZone() { return BookingClockConfig.ZONE; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return time.get(); }
    }

    @Configuration @EnableTransactionManagement @EnableJpaRepositories(basePackageClasses = BookingRepository.class)
    @Import({ CheckoutSupport.class, BookingProductsService.class, BookingServiceImpl.class, CheckoutPaymentService.class,
            PaymentServiceImpl.class, PaymentReturnService.class, BookingCleanupService.class, SeatChanges.class })
    static class Config {
        @Bean DataSource dataSource() throws Exception {
            var ds = new DriverManagerDataSource(System.getenv("CINEMA_TEST_DB_URL"), System.getenv("CINEMA_TEST_DB_USER"), System.getenv("CINEMA_TEST_DB_PASSWORD"));
            try (Connection c = ds.getConnection()) { c.createStatement().execute("CREATE SCHEMA " + SCHEMA); }
            ds.setSchema(SCHEMA);
            return ds;
        }
        @Bean LocalContainerEntityManagerFactoryBean entityManagerFactory(DataSource ds) {
            var factory = new LocalContainerEntityManagerFactoryBean();
            factory.setDataSource(ds); factory.setPackagesToScan("com.cinema.booking.entity");
            factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "create-drop", "hibernate.default_schema", SCHEMA,
                    "hibernate.show_sql", "false", "hibernate.jdbc.time_zone", "Asia/Ho_Chi_Minh"));
            return factory;
        }
        @Bean PlatformTransactionManager transactionManager(EntityManagerFactory factory) { return new JpaTransactionManager(factory); }
        @Bean TransactionTemplate transactionTemplate(PlatformTransactionManager manager) { return new TransactionTemplate(manager); }
        @Bean TestClock clock() { return new TestClock(); }
        @Bean SeatLockService locks() { return mock(SeatLockService.class); }
        @Bean WebSocketService websocket() { return mock(WebSocketService.class); }
        @Bean TicketFulfillmentService fulfillment() { return mock(TicketFulfillmentService.class); }
        @Bean PaymentGateway gateway() { return mock(PaymentGateway.class); }
        @Bean VNPayConfig vnpay() { var config = mock(VNPayConfig.class); when(config.getTmnCode()).thenReturn("test-merchant"); when(config.verifyIpnChecksum(anyMap())).thenReturn(true); return config; }
        @Bean MoMoConfig momo() { var config = mock(MoMoConfig.class); when(config.getPartnerCode()).thenReturn("test-merchant"); when(config.verifyIpnSignature(any())).thenReturn(true); return config; }
    }

    record Fixture(String code, Long seat, Long product, String email, LocalDateTime expires) { }

    @BeforeAll void start() {
        context = new AnnotationConfigApplicationContext(Config.class);
        em = SharedEntityManagerCreator.createSharedEntityManager(context.getBean(EntityManagerFactory.class));
        tx = context.getBean(TransactionTemplate.class); support = context.getBean(CheckoutSupport.class);
        bookingService = context.getBean(BookingService.class); products = context.getBean(BookingProductsService.class);
        paymentService = context.getBean(PaymentService.class); checkoutPayments = context.getBean(CheckoutPaymentService.class);
        cleanup = context.getBean(BookingCleanupService.class); gateway = context.getBean(PaymentGateway.class);
        try (Connection connection = context.getBean(DataSource.class).getConnection()) {
            var script = new org.springframework.core.io.ClassPathResource("db/manual/checkout.sql");
            org.springframework.jdbc.datasource.init.ScriptUtils.executeSqlScript(connection, script);
            org.springframework.jdbc.datasource.init.ScriptUtils.executeSqlScript(connection, script);
        } catch (Exception e) { throw new IllegalStateException("Checkout migration failed", e); }
    }

    @AfterAll void close() throws Exception {
        if (context != null) context.close();
        // The name is generated here, never supplied by the caller.
        if (!SCHEMA.matches("checkout_test_[a-f0-9]{32}")) throw new IllegalStateException("Unexpected schema");
        try (Connection c = DriverManager.getConnection(System.getenv("CINEMA_TEST_DB_URL"), System.getenv("CINEMA_TEST_DB_USER"), System.getenv("CINEMA_TEST_DB_PASSWORD"))) {
            c.createStatement().execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
        }
    }

    @BeforeEach void seed() throws Exception {
        context.getBean(TestClock.class).time.set(Instant.parse("2026-11-09T06:00:00Z"));
        reset(gateway, context.getBean(SeatLockService.class), context.getBean(WebSocketService.class), context.getBean(TicketFulfillmentService.class));
        when(gateway.create(any())).thenAnswer(invocation -> {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive(), "Gateway HTTP must be outside the DB transaction");
            return "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?t=test";
        });
        fixture = tx.execute(status -> {
            String suffix = UUID.randomUUID().toString().substring(0, 8);
            User user = User.builder().email(suffix + "@example.invalid").fullName("Checkout test").passwordHash("not-a-real-password").build(); em.persist(user);
            Cinema cinema = Cinema.builder().name("Test cinema").address("Isolated fixture").city("Test").build(); em.persist(cinema);
            Auditorium room = Auditorium.builder().cinema(cinema).name("Test room").totalRows(1).totalCols(1).build(); em.persist(room);
            Movie movie = Movie.builder().title("Checkout test").durationMinutes(100).releaseDate(LocalDate.of(2026, 11, 1)).build(); em.persist(movie);
            Showtime showtime = Showtime.builder().movie(movie).auditorium(room).startTime(support.now().plusDays(1)).endTime(support.now().plusDays(1).plusHours(2)).basePrice(new BigDecimal("80000")).build(); em.persist(showtime);
            Seat seat = Seat.builder().auditorium(room).rowChar("A").seatNumber(1).build(); em.persist(seat);
            LocalDateTime expiry = support.now().plusMinutes(10);
            ShowtimeSeat ss = ShowtimeSeat.builder().showtime(showtime).seat(seat).price(new BigDecimal("80000")).status(ShowtimeSeatStatus.LOCKED)
                    .lockToken(suffix).lockedByUser(user).lockedUntil(expiry).build(); em.persist(ss);
            Product product = Product.builder().name("Combo test").price(new BigDecimal("30000")).isAvailable(true).build(); em.persist(product);
            Booking b = Booking.builder().bookingCode("BK" + UUID.randomUUID().toString().replace("-", "").substring(0, 18)).user(user).showtime(showtime)
                    .status(BookingStatus.PENDING).holdToken(suffix).expiresAt(expiry).totalAmount(new BigDecimal("80000")).build();
            b.getBookingSeats().add(BookingSeat.builder().booking(b).showtimeSeat(ss).price(new BigDecimal("80000")).build()); em.persist(b); em.flush();
            return new Fixture(b.getBookingCode(), ss.getId(), product.getId(), user.getEmail(), expiry);
        });
    }

    private BookingResponse get() { return bookingService.getBookingByCode(fixture.code(), fixture.email()); }
    private BookingProductsRequest cart(String revision, int quantity) {
        var request = new BookingProductsRequest(); request.setExpectedRevision(revision);
        request.setProducts(quantity == 0 ? List.of() : List.of(BookingProductItem.builder().productId(fixture.product()).quantity(quantity).build()));
        return request;
    }
    private PaymentCreateUrlRequest payment(String revision) { return PaymentCreateUrlRequest.builder().bookingCode(fixture.code()).paymentMethod("VNPAY").expectedRevision(revision).build(); }
    private Map<String, String> ipn(String reference) { return Map.of("vnp_TxnRef", reference, "vnp_TmnCode", "test-merchant", "vnp_Amount", "8000000", "vnp_ResponseCode", "00", "vnp_TransactionStatus", "00", "vnp_TransactionNo", UUID.randomUUID().toString()); }
    private String reference() { return tx.execute(s -> context.getBean(PaymentAttemptRepository.class).findFirstByBookingIdOrderByIdDesc(context.getBean(BookingRepository.class).findByBookingCode(fixture.code()).orElseThrow().getId()).orElseThrow().getProviderOrderId()); }

    @Test void browserReturnReadsTheOrderButOnlyIpnConfirmsIt() {
        checkoutPayments.create(payment(get().getCheckoutRevision()), fixture.email(), new MockHttpServletRequest());
        var params = new HashMap<>(ipn(reference()));
        params.put("vnp_SecureHash", "a".repeat(128)); // Signature behavior has separate tests with a real key.
        var returns = context.getBean(PaymentReturnService.class);
        var waiting = returns.verifyVNPay(params, fixture.email());
        assertEquals(fixture.code(), waiting.booking().getBookingCode());
        assertEquals(BookingStatus.PENDING, waiting.booking().getStatus());
        assertEquals(PaymentStatus.PENDING, waiting.paymentStatus());
        assertEquals(BookingStatus.PENDING, get().getStatus());
        assertNull(waiting.booking().getCheckout().getPaymentUrl());
        paymentService.processVNPayIpn(params);
        var confirmed = returns.verifyVNPay(params, fixture.email());
        assertEquals(BookingStatus.CONFIRMED, confirmed.booking().getStatus());
        assertEquals(PaymentStatus.SUCCESS, confirmed.paymentStatus());
        assertEquals(PaymentStatus.SUCCESS, confirmed.attemptStatus());
    }

    @Test void replacesProductsAndKeepsTheOriginalDeadlineAndSeatQuote() {
        var first = get(); var saved = products.replace(fixture.code(), cart(first.getCheckoutRevision(), 2), fixture.email());
        assertEquals(0, new BigDecimal("140000").compareTo(saved.getTotalAmount())); assertEquals(fixture.expires(), saved.getExpiresAt());
        var replaced = products.replace(fixture.code(), cart(saved.getCheckoutRevision(), 1), fixture.email());
        assertEquals(1, replaced.getProducts().size()); assertEquals(1, replaced.getProducts().getFirst().getQuantity());
        assertEquals(0, new BigDecimal("110000").compareTo(replaced.getTotalAmount()));
        assertThrows(ConflictException.class, () -> products.replace(fixture.code(), cart(first.getCheckoutRevision(), 2), fixture.email()));
    }

    @Test void twoTabsCannotBothWriteTheSameRevision() throws Exception {
        String revision = get().getCheckoutRevision(); var barrier = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> update = () -> { barrier.await(5, TimeUnit.SECONDS); try { products.replace(fixture.code(), cart(revision, 1), fixture.email()); return true; } catch (ConflictException e) { return false; } };
            var a = pool.submit(update); var b = pool.submit(update);
            assertNotEquals(a.get(10, TimeUnit.SECONDS), b.get(10, TimeUnit.SECONDS));
        }
    }

    @Test void duplicateCreationUsesOneAttemptAndReturnsThePersistedUrl() throws Exception {
        var request = payment(get().getCheckoutRevision());
        var a = checkoutPayments.create(request, fixture.email(), new MockHttpServletRequest());
        var b = checkoutPayments.create(request, fixture.email(), new MockHttpServletRequest());
        assertEquals(CheckoutState.READY, a.getState()); assertEquals(a.getPaymentUrl(), b.getPaymentUrl()); verify(gateway, times(1)).create(any());
        assertThrows(ConflictException.class, () -> products.replace(fixture.code(), cart(get().getCheckoutRevision(), 1), fixture.email()));
    }

    @Test void timeoutDoesNotCreateANewGatewayOrderOrUnlockTheCart() throws Exception {
        when(gateway.create(any())).thenThrow(new java.net.http.HttpTimeoutException("test"));
        var request = payment(get().getCheckoutRevision());
        assertEquals(CheckoutState.UNKNOWN, checkoutPayments.create(request, fixture.email(), new MockHttpServletRequest()).getState());
        assertEquals(CheckoutState.UNKNOWN, checkoutPayments.create(request, fixture.email(), new MockHttpServletRequest()).getState());
        verify(gateway, times(1)).create(any()); assertFalse(get().getCheckout().isCanEditProducts());
    }

    @Test void cancellationCanCommitWhileGatewayWaitsAndLateUrlDoesNotReopenTheOrder() throws Exception {
        var entered = new CountDownLatch(1); var finish = new CountDownLatch(1);
        when(gateway.create(any())).thenAnswer(invocation -> { assertFalse(TransactionSynchronizationManager.isActualTransactionActive()); entered.countDown(); assertTrue(finish.await(10, TimeUnit.SECONDS)); return "https://sandbox.vnpayment.vn/pay"; });
        var request = payment(get().getCheckoutRevision());
        try (var pool = Executors.newSingleThreadExecutor()) {
            var response = pool.submit(() -> checkoutPayments.create(request, fixture.email(), new MockHttpServletRequest()));
            try {
                assertTrue(entered.await(5, TimeUnit.SECONDS));
                assertEquals(CheckoutState.CREATING, checkoutPayments.create(request, fixture.email(), new MockHttpServletRequest()).getState());
                assertEquals(BookingStatus.CANCELLED, bookingService.cancelBooking(fixture.code(), fixture.email()).getStatus());
            } finally { finish.countDown(); }
            assertEquals(CheckoutState.CLOSED, response.get(10, TimeUnit.SECONDS).getState());
            assertNull(response.get().getPaymentUrl()); assertEquals(BookingStatus.CANCELLED, get().getStatus());
        }
    }

    @Test void earlyIpnAndDuplicateIpnOnlyBookOnce() throws Exception {
        when(gateway.create(any())).thenAnswer(invocation -> { assertEquals("00", paymentService.processVNPayIpn(ipn(((PaymentGateway.Order) invocation.getArgument(0)).orderId())).getRspCode()); return "https://sandbox.vnpayment.vn/pay"; });
        assertEquals(CheckoutState.CLOSED, checkoutPayments.create(payment(get().getCheckoutRevision()), fixture.email(), new MockHttpServletRequest()).getState());
        assertEquals(BookingStatus.CONFIRMED, get().getStatus());
        assertEquals("02", paymentService.processVNPayIpn(ipn(reference())).getRspCode());
        verify(context.getBean(TicketFulfillmentService.class), times(1)).fulfillTicketAsync(anyLong());
    }

    @Test void paymentAndBothExpiryPathsCannotDowngradeBookedSeats() throws Exception {
        checkoutPayments.create(payment(get().getCheckoutRevision()), fixture.email(), new MockHttpServletRequest());
        String reference = reference(); context.getBean(TestClock.class).time.set(Instant.parse("2026-11-09T06:11:00Z"));
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(3)) {
            var a = pool.submit(() -> { start.await(); return paymentService.processVNPayIpn(ipn(reference)); });
            var b = pool.submit(() -> { start.await(); return cleanup.cleanupExpiredBookings(); });
            var c = pool.submit(() -> { start.await(); return cleanup.cleanupOrphanedLockedSeats(); });
            start.countDown(); a.get(15, TimeUnit.SECONDS); b.get(15, TimeUnit.SECONDS); c.get(15, TimeUnit.SECONDS);
        }
        assertEquals(BookingStatus.CONFIRMED, get().getStatus());
        assertEquals(ShowtimeSeatStatus.BOOKED, tx.execute(s -> em.find(ShowtimeSeat.class, fixture.seat()).getStatus()));
    }

    @Test void rollbackPublishesNothingAndPostCommitOutagesDoNotUndoCancellation() {
        var websocket = context.getBean(WebSocketService.class); var locks = context.getBean(SeatLockService.class);
        assertThrows(IllegalStateException.class, () -> tx.execute(s -> { bookingService.cancelBooking(fixture.code(), fixture.email()); throw new IllegalStateException("rollback"); }));
        verifyNoInteractions(websocket, locks); assertEquals(BookingStatus.PENDING, get().getStatus());
        doThrow(new IllegalStateException("offline")).when(websocket).broadcastSnapshots(anyLong(), anyList());
        doThrow(new IllegalStateException("offline")).when(locks).unlockSeats(anyLong(), anyList(), anyString());
        assertEquals(BookingStatus.CANCELLED, bookingService.cancelBooking(fixture.code(), fixture.email()).getStatus());
        assertEquals(ShowtimeSeatStatus.AVAILABLE, tx.execute(s -> em.find(ShowtimeSeat.class, fixture.seat()).getStatus()));
    }

    @Test void anotherUserCannotReadSignedUrlsOrChangeProducts() throws Exception {
        tx.executeWithoutResult(s -> em.persist(User.builder().email("other-" + fixture.code() + "@example.invalid").fullName("Other").passwordHash("unused").build()));
        String other = "other-" + fixture.code() + "@example.invalid";
        String revision = get().getCheckoutRevision();
        assertThrows(ForbiddenException.class, () -> bookingService.getBookingByCode(fixture.code(), other));
        assertThrows(ForbiddenException.class, () -> products.replace(fixture.code(), cart(revision, 1), other));
        assertThrows(ForbiddenException.class, () -> checkoutPayments.create(payment(revision), other, new MockHttpServletRequest()));
        verify(gateway, never()).create(any());
    }

    @Test void createsANewHoldWithServerTimeAndRollsBackRedisOnlyAfterDatabaseRollback() {
        Long showtime = get().getShowtime().getShowtimeId();
        bookingService.cancelBooking(fixture.code(), fixture.email());
        var locks = context.getBean(SeatLockService.class); var websocket = context.getBean(WebSocketService.class);
        reset(locks, websocket); when(locks.lockSeats(anyLong(), anyList(), anyString())).thenReturn(true);
        var request = BookingCreateRequest.builder().showtimeId(showtime).showtimeSeatIds(List.of(fixture.seat())).products(List.of()).build();
        assertThrows(IllegalStateException.class, () -> tx.execute(s -> { bookingService.createBooking(request, fixture.email()); throw new IllegalStateException("rollback"); }));
        verify(locks).unlockSeats(eq(showtime), eq(List.of(fixture.seat())), anyString());
        verifyNoInteractions(websocket);
        assertEquals(ShowtimeSeatStatus.AVAILABLE, tx.execute(s -> em.find(ShowtimeSeat.class, fixture.seat()).getStatus()));
        var held = bookingService.createBooking(request, fixture.email());
        assertEquals(support.instant(), held.getServerTime()); assertEquals(CheckoutState.EDITABLE, held.getCheckout().getState());
        assertEquals(Instant.parse("2026-11-09T06:10:00Z"), held.getCheckout().getExpiresAt());
    }

    @Test void serverRepricesCombosButPreservesTheReservedSeatPrice() {
        var saved = products.replace(fixture.code(), cart(get().getCheckoutRevision(), 1), fixture.email());
        tx.executeWithoutResult(s -> { em.find(Product.class, fixture.product()).setPrice(new BigDecimal("35000")); em.find(ShowtimeSeat.class, fixture.seat()).setPrice(new BigDecimal("90000")); });
        var repriced = products.replace(fixture.code(), cart(saved.getCheckoutRevision(), 1), fixture.email());
        assertEquals(0, new BigDecimal("115000").compareTo(repriced.getTotalAmount()));
        assertEquals(0, new BigDecimal("80000").compareTo(repriced.getSeats().getFirst().getPrice()));
        assertNotEquals(saved.getCheckoutRevision(), repriced.getCheckoutRevision());
    }

    @Test void invalidCartRollsBackAndTerminalRejectionAllowsEditingWithinTheSameDeadline() {
        String original = get().getCheckoutRevision();
        var invalid = cart(original, 1); invalid.setProducts(List.of(invalid.getProducts().getFirst(), invalid.getProducts().getFirst()));
        assertThrows(BadRequestException.class, () -> products.replace(fixture.code(), invalid, fixture.email()));
        assertEquals(original, get().getCheckoutRevision());
        checkoutPayments.create(payment(original), fixture.email(), new MockHttpServletRequest());
        Map<String, String> failure = new HashMap<>(ipn(reference())); failure.put("vnp_ResponseCode", "24"); failure.put("vnp_TransactionStatus", "02");
        assertEquals("00", paymentService.processVNPayIpn(failure).getRspCode());
        assertEquals(CheckoutState.EDITABLE, get().getCheckout().getState());
        assertEquals(fixture.expires(), products.replace(fixture.code(), cart(original, 1), fixture.email()).getExpiresAt());
    }

    @Test void staleCheckoutSnapshotCannotCreatePaymentAfterAnotherTabChangesTheCart() throws Exception {
        String original = get().getCheckoutRevision();
        products.replace(fixture.code(), cart(original, 1), fixture.email());
        assertThrows(ConflictException.class, () -> checkoutPayments.create(payment(original), fixture.email(), new MockHttpServletRequest()));
        verify(gateway, never()).create(any());
    }

    @Test void legacyPaymentsWithoutAttemptIdentityRemainFrozen() throws Exception {
        String revision = get().getCheckoutRevision();
        tx.executeWithoutResult(s -> {
            var b = context.getBean(BookingRepository.class).findByBookingCode(fixture.code()).orElseThrow();
            em.persist(Payment.builder().booking(b).paymentMethod("VNPAY").amount(b.getTotalAmount()).status(PaymentStatus.PENDING).build());
        });
        assertEquals(CheckoutState.UNKNOWN, get().getCheckout().getState());
        assertThrows(ConflictException.class, () -> products.replace(fixture.code(), cart(revision, 1), fixture.email()));
        assertThrows(ConflictException.class, () -> checkoutPayments.create(payment(revision), fixture.email(), new MockHttpServletRequest()));
        verify(gateway, never()).create(any());
    }
}
