package com.cinema.booking;

import com.cinema.booking.config.BookingClockConfig;
import com.cinema.booking.dto.request.BookingCreateRequest;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.*;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.*;
import com.cinema.booking.service.impl.GalaxyDataImporter;
import com.fasterxml.jackson.databind.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.*;
import org.springframework.transaction.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** HTTP/JWT, PostgreSQL và Redis thử thật; không gọi Galaxy/cổng thanh toán bên ngoài. */
@SpringBootTest(classes = CinemaBookingBackendApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "application.payment.vnpay.tmn-code=delete-test", "application.payment.vnpay.hash-secret=deletion-test-key" })
@EnabledIfEnvironmentVariable(named = "CINEMA_TEST_HTTP", matches = "true")
@TestConstructor(autowireMode = TestConstructor.AutowireMode.ALL)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class AdminDeletionHttpTests {
    private static final String SCHEMA = "deletion_http_" + UUID.randomUUID().toString().replace("-", "");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) throws Exception {
        String url = System.getenv("CINEMA_TEST_DB_URL");
        if (url == null || !url.matches("jdbc:postgresql://127\\.0\\.0\\.1:\\d+/postgres") || !"admin_test".equals(System.getenv("CINEMA_TEST_DB_USER"))) throw new IllegalStateException("Chỉ chạy trên DB thử riêng.");
        try (var c = java.sql.DriverManager.getConnection(url, "admin_test", "")) { c.createStatement().execute("create schema " + SCHEMA); }
        registry.add("spring.datasource.url", () -> url + "?currentSchema=" + SCHEMA);
    }
    @LocalServerPort int port;
    private final ObjectMapper json;
    private final EntityManager em;
    private final JdbcTemplate jdbc;
    private final UserRepository users;
    private final MovieRepository movies;
    private final AdminDeletionService deletion;
    private final CatalogGuard guard;
    private final GalaxyDataImporter importer;
    private final BookingService bookingService;
    private final ShowtimeService showtimeService;
    private final TransactionTemplate tx;
    private final PlatformTransactionManager manager;
    private final PaymentService paymentService;
    private final HttpClient http = HttpClient.newHttpClient();
    private final String suffix = UUID.randomUUID().toString().substring(0, 8);
    private final String email = "delete-admin-" + suffix + "@example.invalid";
    private final String customer = "delete-customer-" + suffix + "@example.invalid";
    private String adminToken, customerToken;
    private Long adminId, customerId;
    private String password;

    AdminDeletionHttpTests(ObjectMapper json, EntityManager em, JdbcTemplate jdbc, UserRepository users, MovieRepository movies,
            AdminDeletionService deletion, CatalogGuard guard, GalaxyDataImporter importer,
            BookingService bookingService, ShowtimeService showtimeService, PaymentService paymentService, PlatformTransactionManager manager) {
        this.json=json; this.em=em; this.jdbc=jdbc; this.users=users; this.deletion=deletion;
        this.movies=movies;
        this.guard=guard; this.importer=importer; this.bookingService=bookingService; this.showtimeService=showtimeService;
        this.tx=new TransactionTemplate(manager);
        this.manager=manager;
        this.paymentService=paymentService;
    }

    private JsonNode api(String method, String path, String token, Object body, String scope, int expected) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1" + path)).timeout(Duration.ofSeconds(15)).header("Content-Type", "application/json");
        if(token!=null)request.header("Authorization","Bearer "+token);
        if(scope!=null)request.header("If-Match",scope);
        request.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        var result=http.send(request.build(),HttpResponse.BodyHandlers.ofString());
        assertEquals(expected,result.statusCode(),method+" "+path+" "+result.body().replaceAll("eyJ[\\w.-]+","[JWT]"));
        return json.readTree(result.body()).path("data");
    }
    @BeforeAll void accounts() throws Exception {
        assertEquals("admin_test",jdbc.queryForObject("select current_user",String.class));
        password="DeleteTest-"+UUID.randomUUID();
        for(String e:List.of(email,customer)) api("POST","/auth/register",null,Map.of("email",e,"password",password,"fullName","Nghiệm thu xóa"),null,201);
        tx.executeWithoutResult(s->{var u=users.findByEmail(email).orElseThrow();u.setRole(UserRole.ADMIN);adminId=u.getId();customerId=users.findByEmail(customer).orElseThrow().getId();});
        adminToken=api("POST","/auth/login",null,Map.of("email",email,"password",password),null,200).path("accessToken").asText();
        customerToken=api("POST","/auth/login",null,Map.of("email",customer,"password",password),null,200).path("accessToken").asText();
    }
    record Fixture(Long movie,Long first,Long second,Long room,String galaxy) {}
    private Fixture fixture() {
        return tx.execute(s->{
            String id=UUID.randomUUID().toString();
            Movie m=Movie.builder().title("Xóa thử "+id).galaxyMovieId(id).releaseDate(LocalDate.now(BookingClockConfig.ZONE).minusDays(1)).durationMinutes(100).status(MovieStatus.NOW_SHOWING).build();em.persist(m);
            Cinema c=Cinema.builder().name("Rạp xóa thử").city("Hồ Chí Minh").address("Fixture").build();em.persist(c);
            Auditorium a=Auditorium.builder().cinema(c).name("Phòng A").totalRows(1).totalCols(2).build();em.persist(a);
            LocalDateTime start=LocalDate.now(BookingClockConfig.ZONE).plusDays(3).atTime(10,0);
            Showtime one=Showtime.builder().movie(m).auditorium(a).startTime(start).endTime(start.plusHours(2)).basePrice(new BigDecimal("89000")).galaxySessionId(id+"-1").build();em.persist(one);
            Showtime two=Showtime.builder().movie(m).auditorium(a).startTime(start.plusDays(1)).endTime(start.plusDays(1).plusHours(2)).basePrice(new BigDecimal("89000")).galaxySessionId(id+"-2").build();em.persist(two);
            em.flush();return new Fixture(m.getId(),one.getId(),two.getId(),a.getId(),id);
        });
    }
    private String path(Fixture f) { return "/admin/movies/"+f.movie(); }
    private String preview(Fixture f) throws Exception { return api("GET",path(f)+"/deletion-preview",adminToken,null,null,200).path("scopeToken").asText(); }
    private Long booking(Fixture f, BookingStatus status) {
        return tx.execute(s->{var b=Booking.builder().bookingCode(UUID.randomUUID().toString().replace("-","").substring(0,20)).user(em.find(User.class,customerId)).showtime(em.find(Showtime.class,f.first())).totalAmount(new BigDecimal("89000")).status(status).expiresAt(LocalDateTime.now(BookingClockConfig.ZONE).minusMinutes(1)).build();em.persist(b);em.flush();return b.getId();});
    }

    @Test void rolesAndPreconditions() throws Exception {
        var f=fixture();
        for(String method:List.of("GET","DELETE")) {
            String p=path(f)+(method.equals("GET")?"/deletion-preview":"");
            api(method,p,null,null,null,401);api(method,p,customerToken,null,null,403);
        }
        api("DELETE",path(f),adminToken,null,null,428);
        api("DELETE",path(f),adminToken,null,"\"stale\"",412);
        api("GET","/admin/movies/9223372036854775807/deletion-preview",adminToken,null,null,404);
        assertNull(jdbc.queryForObject("select deleted_at from movies where id=?",Object.class,f.movie()));
    }

    @Test void scopeTokenStaysCompatibleForMovieShowtimeAndDeletedPreviews() throws Exception {
        var f = fixture();
        String title = "Xóa thử " + f.galaxy();
        var movie = api("GET", path(f) + "/deletion-preview", adminToken, null, null, 200);
        var slots = movie.path("showtimes");
        assertEquals(2, slots.size());
        String first = legacySlot(slots.get(0), f.first());
        String second = legacySlot(slots.get(1), f.second());
        String movieToken = legacyScopeToken("movies:%s:%s:false:[%s, %s]".formatted(f.movie(), title, first, second));
        assertEquals(movieToken, movie.path("scopeToken").asText());

        var showtime = api("GET", "/admin/showtimes/" + f.first() + "/deletion-preview", adminToken, null, null, 200);
        assertEquals(1, showtime.path("showtimes").size());
        assertEquals(slots.get(0), showtime.path("showtimes").get(0));
        assertEquals(legacyScopeToken("showtimes:%s:%s:false:[%s]".formatted(f.first(), title, first)),
                showtime.path("scopeToken").asText());

        Long blocker = booking(f, BookingStatus.PENDING);
        assertEquals(movieToken, preview(f));
        api("DELETE", path(f), adminToken, null, movieToken, 409);
        jdbc.update("update bookings set status='CANCELLED' where id=?", blocker);

        var deleted = api("DELETE", path(f), adminToken, null, movieToken, 200);
        assertEquals(legacyScopeToken("movies:%s:%s:true:[]".formatted(f.movie(), title)), deleted.path("scopeToken").asText());
        assertEquals(deleted, api("GET", path(f) + "/deletion-preview", adminToken, null, null, 200));
    }

    private static String legacySlot(JsonNode slot, long id) {
        assertEquals(id, slot.path("id").asLong());
        assertEquals("Rạp xóa thử", slot.path("cinemaName").asText());
        assertEquals("Phòng A", slot.path("auditoriumName").asText());
        return "Slot[id=%s, cinemaName=Rạp xóa thử, auditoriumName=Phòng A, startTime=%s, endTime=%s]"
                .formatted(id, slot.path("startTime").asText(), slot.path("endTime").asText());
    }

    private static String legacyScopeToken(String fingerprint) throws NoSuchAlgorithmException {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(fingerprint.getBytes(StandardCharsets.UTF_8));
        return "\"" + HexFormat.of().formatHex(digest) + "\"";
    }

    @Test void deletesWholeMovieKeepsRowsHistoryAndOriginalActor() throws Exception {
        var f=fixture();Long old=booking(f,BookingStatus.CANCELLED);long inventory=jdbc.queryForObject("select count(*) from showtime_seats",Long.class);
        var p=api("GET",path(f)+"/deletion-preview",adminToken,null,null,200);assertEquals(2,p.path("showtimeCount").asInt());
        api("DELETE",path(f),adminToken,null,p.path("scopeToken").asText(),200);
        var stamp=jdbc.queryForObject("select deleted_at from movies where id=?",Object.class,f.movie());assertNotNull(stamp);
        assertEquals(adminId,jdbc.queryForObject("select deleted_by_user_id from movies where id=?",Long.class,f.movie()));
        assertEquals(2,jdbc.queryForObject("select count(*) from showtimes where movie_id=? and deleted_at is not null and not is_active",Integer.class,f.movie()));
        assertEquals(1,jdbc.queryForObject("select count(*) from bookings b join showtimes s on b.showtime_id=s.id join movies m on m.id=s.movie_id where b.id=?",Integer.class,old));
        assertEquals(inventory,jdbc.queryForObject("select count(*) from showtime_seats",Long.class));
        api("GET","/movies/"+f.movie(),null,null,null,404);api("GET","/showtimes/"+f.first(),null,null,null,404);api("GET","/showtimes/"+f.first()+"/seats",null,null,null,404);
        api("DELETE",path(f),adminToken,null,null,200);assertEquals(stamp,jdbc.queryForObject("select deleted_at from movies where id=?",Object.class,f.movie()));
        assertTrue(api("GET",path(f)+"/deletion-preview",adminToken,null,null,200).path("deleted").asBoolean());
        var history=api("GET","/users/me/bookings",customerToken,null,null,200);
        assertTrue(history.toString().contains(old.toString()));
    }

    @Test void everyProtectedBookingBlocksEntireMovieAndNoPartialMark() throws Exception {
        for(BookingStatus state:List.of(BookingStatus.PENDING,BookingStatus.CONFIRMED)) {
            var f=fixture();booking(f,state);var p=api("GET",path(f)+"/deletion-preview",adminToken,null,null,200);
            assertFalse(p.path("canDelete").asBoolean());assertTrue(p.path("blockers").toString().contains(state.name()));
            api("DELETE",path(f),adminToken,null,p.path("scopeToken").asText(),409);
            assertEquals(0,jdbc.queryForObject("select count(*) from showtimes where movie_id=? and deleted_at is not null",Integer.class,f.movie()));
            assertNull(jdbc.queryForObject("select deleted_at from movies where id=?",Object.class,f.movie()));
        }
    }

    @Test void expiredOrderWithOlderUnknownAttemptBlocksEvenWhenLatestFailed() throws Exception {
        var f=fixture();Long b=booking(f,BookingStatus.EXPIRED);
        tx.executeWithoutResult(s->{for(PaymentStatus outcome:List.of(PaymentStatus.PENDING,PaymentStatus.FAILED)) {
            var a=PaymentAttempt.builder().booking(em.find(Booking.class,b)).method("VNPAY").revision("1").amount(new BigDecimal("89000")).providerOrderId(UUID.randomUUID().toString()).requestId(UUID.randomUUID().toString()).state(outcome==PaymentStatus.PENDING?CheckoutState.UNKNOWN:CheckoutState.REJECTED).outcome(outcome).createdAt(LocalDateTime.now()).leaseUntil(LocalDateTime.now()).expiresAt(LocalDateTime.now()).build();em.persist(a);
        }});
        api("DELETE",path(f),adminToken,null,preview(f),409);
        jdbc.update("update payment_attempts set outcome='FAILED' where booking_id=?",b);
        api("DELETE",path(f),adminToken,null,preview(f),200);
    }

    @Test void changedScopeRequiresExplicitConfirmationAgain() throws Exception {
        var f=fixture();String before=preview(f);
        jdbc.update("update showtimes set start_time=start_time+interval '1 hour' where id=?",f.first());
        api("DELETE",path(f),adminToken,null,before,412);
        api("DELETE",path(f),adminToken,null,preview(f),200);
    }

    private JsonNode source(Fixture f, String sessionId) {
        return json.valueToTree(List.of(Map.of("id",sessionId,"movie",Map.of("id",f.galaxy(),"name","Phim nguồn","duration",100),
                "cinema",Map.of("id","cinema-"+f.galaxy(),"name","Rạp nguồn"),"screenName","1",
                "showDate",LocalDate.now(BookingClockConfig.ZONE).plusDays(3).toString(),"showTime","10:00","movieFormat","2D","version","2d")));
    }
    @Test void movieMarkerPreventsAllCatalogSourcesAndNewSessions() throws Exception {
        var f=fixture();api("DELETE",path(f),adminToken,null,preview(f),200);
        var result=importer.importData(source(f,"new-"+f.galaxy()),json.valueToTree(List.of(Map.of("id",f.galaxy(),"name","Phim nguồn"))),json.valueToTree(List.of(Map.of("id",f.galaxy(),"name","Phim nguồn"))),0,true);
        assertEquals(1,result.getTotalMoviesExcluded());assertEquals(1,result.getTotalShowtimesExcluded());assertEquals(0,result.getTotalMoviesSynced());assertEquals(0,result.getTotalShowtimesSynced());
        assertEquals(2,jdbc.queryForObject("select count(*) from showtimes where movie_id=?",Integer.class,f.movie()));
    }

    @Test void deletingOneSessionKeepsMovieAndOtherSessions() throws Exception {
        var f=fixture();String p="/admin/showtimes/"+f.first();String token=api("GET",p+"/deletion-preview",adminToken,null,null,200).path("scopeToken").asText();
        api("DELETE",p,adminToken,null,token,200);
        var result=importer.importData(source(f,f.galaxy()+"-1"),null,100,false);
        assertEquals(1,result.getTotalShowtimesExcluded());assertEquals(0,result.getTotalMoviesExcluded());
        assertNull(jdbc.queryForObject("select deleted_at from movies where id=?",Object.class,f.movie()));
        api("GET","/showtimes/"+f.second(),null,null,null,200);
    }

    @Test void bundledFileAndLocalJsonAlsoRespectMovieMarker() throws Exception {
        api("POST","/admin/sync/galaxy/local-file?limitShowtimes=100",adminToken,null,null,200);
        JsonNode source;
        try(var stream=getClass().getResourceAsStream("/data/galaxy_sessions.json")){assertNotNull(stream);source=json.readTree(stream).path("data").path("result");}
        String external=source.get(0).path("movie").path("id").asText();
        Long id=movies.findByGalaxyMovieId(external).orElseThrow().getId();
        String p="/admin/movies/"+id;
        String token=api("GET",p+"/deletion-preview",adminToken,null,null,200).path("scopeToken").asText();
        api("DELETE",p,adminToken,null,token,200);
        assertTrue(api("POST","/admin/sync/galaxy/local-file?limitShowtimes=100",adminToken,null,null,200).path("totalMoviesExcluded").asInt()>0);
        assertEquals(1,importer.importData(json.valueToTree(List.of(source.get(0))),null,0,false).getTotalMoviesExcluded());
        assertNotNull(jdbc.queryForObject("select deleted_at from movies where id=?",Object.class,id));
    }

    @Test void existingInventoryCannotBeReopenedAfterDelete() throws Exception {
        var f=fixture();showtimeService.getShowtimeSeats(f.first());long count=jdbc.queryForObject("select count(*) from showtime_seats where showtime_id=?",Long.class,f.first());assertEquals(2,count);
        api("DELETE",path(f),adminToken,null,preview(f),200);api("GET","/showtimes/"+f.first()+"/seats",null,null,null,404);
        assertEquals(count,jdbc.queryForObject("select count(*) from showtime_seats where showtime_id=?",Long.class,f.first()));
        Long seat=jdbc.queryForObject("select min(id) from showtime_seats where showtime_id=?",Long.class,f.first());
        api("POST","/bookings",customerToken,Map.of("showtimeId",f.first(),"showtimeSeatIds",List.of(seat)),null,404);
    }

    @Test void committedBookingWinsRaceAgainstDelete() throws Exception {
        var f=fixture();Long seat=showtimeService.getShowtimeSeats(f.first()).getSeats().getFirst().getShowtimeSeatId();
        var pool=Executors.newSingleThreadExecutor();var started=new CountDownLatch(1);
        String token=preview(f);
        try {
            var future=tx.execute(s->{
                guard.showtime(f.first(),false,false);
                Future<?> removal=pool.submit(()->{started.countDown();return deletion.delete("movies",f.movie(),token,email);});
                try {assertTrue(started.await(2,TimeUnit.SECONDS));assertThrows(TimeoutException.class,()->removal.get(150,TimeUnit.MILLISECONDS));}
                catch(InterruptedException e){throw new RuntimeException(e);}
                bookingService.createBooking(BookingCreateRequest.builder().showtimeId(f.first()).showtimeSeatIds(List.of(seat)).build(),customer);
                return removal;
            });
            ExecutionException error=assertThrows(ExecutionException.class,()->future.get(5,TimeUnit.SECONDS));
            assertInstanceOf(AppException.class,error.getCause());assertEquals(409,((AppException)error.getCause()).getCode());
            assertNull(jdbc.queryForObject("select deleted_at from movies where id=?",Object.class,f.movie()));
        } finally {pool.shutdownNow();}
    }

    private String attempt(Long booking, PaymentStatus status) {
        return tx.execute(s->{String reference=UUID.randomUUID().toString();
            em.persist(PaymentAttempt.builder().booking(em.find(Booking.class,booking)).method("VNPAY").revision("1").amount(new BigDecimal("89000"))
                    .providerOrderId(reference).requestId(reference).state(CheckoutState.REJECTED).outcome(status)
                    .createdAt(LocalDateTime.now()).leaseUntil(LocalDateTime.now()).expiresAt(LocalDateTime.now()).build());
            em.persist(Payment.builder().booking(em.find(Booking.class,booking)).paymentMethod("VNPAY").amount(new BigDecimal("89000")).status(status).build());
            return reference;
        });
    }
    private Map<String,String> ipn(String reference,String transaction) {
        var params=new TreeMap<String,String>();params.put("vnp_TxnRef",reference);params.put("vnp_TmnCode","delete-test");params.put("vnp_Amount","8900000");
        params.put("vnp_ResponseCode","00");params.put("vnp_TransactionStatus","00");params.put("vnp_TransactionNo",transaction);
        String data=params.entrySet().stream().map(e->e.getKey()+"="+java.net.URLEncoder.encode(e.getValue(),java.nio.charset.StandardCharsets.US_ASCII)).collect(java.util.stream.Collectors.joining("&"));
        params.put("vnp_SecureHash",com.cinema.booking.config.VNPayConfig.hmacSHA512("deletion-test-key",data));return params;
    }

    @Test void signedSuccessAfterFailedExpiredAndDeletedRecordsMoneyWithoutTicket() throws Exception {
        var f=fixture();showtimeService.getShowtimeSeats(f.first());Long b=booking(f,BookingStatus.EXPIRED);String ref=attempt(b,PaymentStatus.FAILED);
        api("DELETE",path(f),adminToken,null,preview(f),200);
        String transaction="tx-"+UUID.randomUUID();
        assertEquals("00",paymentService.processVNPayIpn(ipn(ref,transaction)).getRspCode());
        assertEquals("02",paymentService.processVNPayIpn(ipn(ref,transaction)).getRspCode());
        assertEquals("REFUND_REQUIRED",jdbc.queryForObject("select outcome from payment_attempts where provider_order_id=?",String.class,ref));
        assertEquals(transaction,jdbc.queryForObject("select provider_transaction_id from payment_attempts where provider_order_id=?",String.class,ref));
        assertEquals("EXPIRED",jdbc.queryForObject("select status from bookings where id=?",String.class,b));
        assertEquals(0,jdbc.queryForObject("select count(*) from showtime_seats where showtime_id=? and status='BOOKED'",Integer.class,f.first()));
        assertEquals("99",paymentService.processVNPayIpn(ipn(ref,"different-"+transaction)).getRspCode());
        assertEquals(transaction,jdbc.queryForObject("select provider_transaction_id from payment_attempts where provider_order_id=?",String.class,ref));
    }

    @Test void ipnWaitingForDeletionObservesTheCommittedDeletion() throws Exception {
        var f = fixture();
        Long bookingId = booking(f, BookingStatus.EXPIRED);
        String reference = attempt(bookingId, PaymentStatus.FAILED);
        String token = preview(f);
        var started = new CountDownLatch(1);
        try (var pool = Executors.newSingleThreadExecutor()) {
            var callback = tx.execute(status -> {
                deletion.delete("movies", f.movie(), token, email);
                var pending = pool.submit(() -> {
                    started.countDown();
                    return paymentService.processVNPayIpn(ipn(reference, "tx-" + UUID.randomUUID()));
                });
                assertTrue(assertDoesNotThrow(() -> started.await(2, TimeUnit.SECONDS)));
                assertThrows(TimeoutException.class, () -> pending.get(150, TimeUnit.MILLISECONDS));
                return pending;
            });
            assertEquals("00", callback.get(5, TimeUnit.SECONDS).getRspCode());
        }
        assertEquals("REFUND_REQUIRED", jdbc.queryForObject(
                "select outcome from payment_attempts where provider_order_id=?", String.class, reference));
        assertEquals("EXPIRED", jdbc.queryForObject("select status from bookings where id=?", String.class, bookingId));
    }

    @Test void twoOrdersCannotClaimSameProviderTransaction() throws Exception {
        var f=fixture();Long one=booking(f,BookingStatus.EXPIRED),two=booking(f,BookingStatus.EXPIRED);
        String first=attempt(one,PaymentStatus.FAILED),second=attempt(two,PaymentStatus.FAILED);
        api("DELETE",path(f),adminToken,null,preview(f),200);
        String transaction="unique-"+UUID.randomUUID();
        try(var pool=Executors.newFixedThreadPool(2)) {
            var start=new CountDownLatch(1);
            var a=pool.submit(()->{start.await();return paymentService.processVNPayIpn(ipn(first,transaction)).getRspCode();});
            var b=pool.submit(()->{start.await();return paymentService.processVNPayIpn(ipn(second,transaction)).getRspCode();});
            start.countDown();var results=List.of(a.get(5,TimeUnit.SECONDS),b.get(5,TimeUnit.SECONDS));
            assertEquals(1,results.stream().filter("00"::equals).count());assertEquals(1,results.stream().filter("99"::equals).count());
        }
        assertEquals(1,jdbc.queryForObject("select count(*) from payment_attempts where provider_transaction_id=?",Integer.class,transaction));
    }

    @org.springframework.transaction.annotation.EnableTransactionManagement
    @org.springframework.data.jpa.repository.config.EnableJpaRepositories(basePackageClasses=MovieRepository.class)
    @org.springframework.context.annotation.Import({CatalogGuard.class,GalaxyDataImporter.class})
    static class RestartConfig {
        @org.springframework.context.annotation.Bean javax.sql.DataSource dataSource() {
            return new org.springframework.jdbc.datasource.DriverManagerDataSource(System.getenv("CINEMA_TEST_DB_URL")+"?currentSchema="+SCHEMA,"admin_test","");
        }
        @org.springframework.context.annotation.Bean org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean entityManagerFactory(javax.sql.DataSource ds) {
            var factory=new org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean();factory.setDataSource(ds);factory.setPackagesToScan("com.cinema.booking.entity");
            factory.setJpaVendorAdapter(new org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter());
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto","validate","hibernate.default_schema",SCHEMA));return factory;
        }
        @org.springframework.context.annotation.Bean PlatformTransactionManager transactionManager(jakarta.persistence.EntityManagerFactory emf) {return new org.springframework.orm.jpa.JpaTransactionManager(emf);}
    }
    @Test void schemaScriptRepeatAndNewApplicationContextKeepMarkers() throws Exception {
        var f=fixture();api("DELETE",path(f),adminToken,null,preview(f),200);
        try(var connection=Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
            var script=new org.springframework.core.io.FileSystemResource("scripts/admin-deletion-schema.sql");
            org.springframework.jdbc.datasource.init.ScriptUtils.executeSqlScript(connection,script);
            org.springframework.jdbc.datasource.init.ScriptUtils.executeSqlScript(connection,script);
        }
        try(var restarted=new org.springframework.context.annotation.AnnotationConfigApplicationContext(RestartConfig.class)) {
            var imported=restarted.getBean(GalaxyDataImporter.class).importData(source(f,"restart-"+f.galaxy()),null,100,false);
            assertEquals(1,imported.getTotalMoviesExcluded());assertEquals(1,imported.getTotalShowtimesExcluded());
        }
        assertEquals(2,jdbc.queryForObject("select count(*) from showtimes where movie_id=?",Integer.class,f.movie()));
    }

    @Test void previewSnapshotAndScopeStayConsistentWhileAnotherConnectionChangesSlot() throws Exception {
        var f=fixture();var repeat=new TransactionTemplate(manager);repeat.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
        String old=repeat.execute(s->{
            var before=deletion.preview("movies",f.movie(),email);
            try(var pool=Executors.newSingleThreadExecutor()) {
                pool.submit(()->jdbc.update("update showtimes set start_time=start_time+interval '1 hour' where id=?",f.first())).get(5,TimeUnit.SECONDS);
            } catch(Exception e){throw new RuntimeException(e);}
            var after=deletion.preview("movies",f.movie(),email);
            assertEquals(before,after);return before.scopeToken();
        });
        assertNotEquals(old,preview(f));api("DELETE",path(f),adminToken,null,old,412);
    }

    @Test void lockTimeoutIsEffectiveAndSyncUsesSameDatabaseCoordination() throws Exception {
        var f=fixture();String token=preview(f);
        try(var pool=Executors.newSingleThreadExecutor()) {
            tx.executeWithoutResult(s->{
                guard.movie(f.movie(),false,false);
                var future=pool.submit(()->{try{return api("DELETE",path(f),adminToken,null,token,409);}catch(Exception e){throw new RuntimeException(e);}});
                try {future.get(5,TimeUnit.SECONDS);}catch(Exception e){throw new RuntimeException(e);}
            });
            tx.executeWithoutResult(s->{
                guard.catalogWrite();
                var future=pool.submit(()->{try{return api("DELETE",path(f),adminToken,null,token,409);}catch(Exception e){throw new RuntimeException(e);}});
                try{future.get(3,TimeUnit.SECONDS);}catch(Exception e){throw new RuntimeException(e);}
            });
        }
        api("DELETE",path(f),adminToken,null,preview(f),200);
    }

    @Test void deletedDetailsClaimAndDuplicateLocalNameNeverReviveMarkedMovie() throws Exception {
        var f=fixture();api("DELETE",path(f),adminToken,null,preview(f),200);
        // Dùng bean repository đang chạy thật; không gửi HTTP chi tiết Galaxy.
        assertEquals(0,movies.claimGalaxyDetails(f.movie(),List.of(MovieStatus.NOW_SHOWING,MovieStatus.COMING_SOON),Instant.now(),Instant.now(),Instant.now()));
        Long local=tx.execute(s->{
            Movie deleted=Movie.builder().title("Phim nguồn").releaseDate(LocalDate.now()).durationMinutes(100).deletedAt(Instant.now()).deletedByUserId(adminId).build();em.persist(deleted);
            Movie active=Movie.builder().title("Phim nguồn").releaseDate(LocalDate.now()).durationMinutes(100).build();em.persist(active);em.flush();return active.getId();
        });
        var newer=new Fixture(0L,0L,0L,0L,"new-"+UUID.randomUUID());
        importer.importData(source(newer,"local-match-"+UUID.randomUUID()),null,100,false);
        assertEquals(local,jdbc.queryForObject("select id from movies where galaxy_movie_id=?",Long.class,newer.galaxy()));
    }

    @Test void blockerLookupUsesIndexWithTwentyThousandUnrelatedOrders() throws Exception {
        var target=fixture();var other=fixture();
        Long perfUser=jdbc.queryForObject("insert into users(email,password_hash,full_name,role,created_at) select ?,password_hash,'Kiểm truy vấn','CUSTOMER',current_timestamp from users where id=? returning id",Long.class,"perf-"+UUID.randomUUID()+"@example.invalid",customerId);
        jdbc.update("insert into bookings(booking_code,user_id,showtime_id,total_amount,status,created_at,expires_at) select substr(md5(? || i::text),1,20),?,?,89000,'EXPIRED',current_timestamp,current_timestamp from generate_series(1,20000) i",UUID.randomUUID().toString(),perfUser,other.first());
        jdbc.execute("analyze bookings");
        String plan=String.join("\n",jdbc.queryForList("explain select count(*) from bookings where showtime_id=? and status in ('PENDING','CONFIRMED')",String.class,target.first()));
        assertTrue(plan.contains("idx_bookings_showtime_status"),plan);
        java.nio.file.Files.writeString(java.nio.file.Path.of(System.getenv("CINEMA_TEST_ARTIFACTS"),"deletion-query-plan.txt"),plan);
        assertTrue(deletion.preview("movies",target.movie(),email).canDelete());
    }

    @Test @EnabledIfEnvironmentVariable(named="CINEMA_TEST_BROWSER",matches="true")
    void browserDeletesMovieAndSingleSlotUsingRealApi() throws Exception {
        var movie=fixture();var slot=fixture();var blocked=fixture();booking(blocked,BookingStatus.CONFIRMED);
        String title=jdbc.queryForObject("select title from movies where id=?",String.class,movie.movie());
        String blockedTitle=jdbc.queryForObject("select title from movies where id=?",String.class,blocked.movie());
        String day=jdbc.queryForObject("select start_time::date::text from showtimes where id=?",String.class,slot.first());
        var config=new LinkedHashMap<String,Object>();
        config.put("apiBase","http://127.0.0.1:"+port+"/api/v1");config.put("adminEmail",email);config.put("customerEmail",customer);config.put("password",password);
        config.put("movieTitle",title);config.put("movieId",movie.movie());config.put("slotMovieId",slot.movie());config.put("showtimeId",slot.first());config.put("otherShowtimeId",slot.second());config.put("day",day);config.put("blockedTitle",blockedTitle);
        var frontend=java.nio.file.Path.of("..","..","frontend").toAbsolutePath().normalize();
        var output=java.nio.file.Path.of(System.getenv("CINEMA_TEST_ARTIFACTS"),"edge-deletion-http.log");
        var process=new ProcessBuilder("node",frontend.resolve("scripts/admin-deletion-http-browser-check.mjs").toString()).directory(frontend.toFile()).redirectErrorStream(true).redirectOutput(output.toFile()).start();
        try(var stdin=process.getOutputStream()){stdin.write(json.writeValueAsBytes(config));}
        boolean done=process.waitFor(120,TimeUnit.SECONDS);
        if(!done)process.destroyForcibly();
        assertTrue(done,"Edge xóa hết thời gian: "+output);assertEquals(0,process.exitValue(),"Edge xóa không đạt: "+output);
        assertNotNull(jdbc.queryForObject("select deleted_at from movies where id=?",Object.class,movie.movie()));
        assertEquals(2,jdbc.queryForObject("select count(*) from showtimes where movie_id=? and deleted_at is not null",Integer.class,movie.movie()));
        assertNotNull(jdbc.queryForObject("select deleted_at from showtimes where id=?",Object.class,slot.first()));
        assertNull(jdbc.queryForObject("select deleted_at from showtimes where id=?",Object.class,slot.second()));
        assertNull(jdbc.queryForObject("select deleted_at from movies where id=?",Object.class,blocked.movie()));
    }
}
