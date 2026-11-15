package com.cinema.booking;

import com.cinema.booking.entity.*;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.impl.GalaxyDataImporter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GalaxyDataImporterTests {
    private final ObjectMapper mapper = new ObjectMapper();
    private MovieRepository movies;
    private CinemaRepository cinemas;
    private AuditoriumRepository auditoriums;
    private ShowtimeRepository showtimes;
    private BookingRepository bookings;
    private GalaxyDataImporter importer;
    private Map<String, Movie> movieStore;
    private Map<String, Cinema> cinemaStore;
    private Map<String, Showtime> showtimeStore;
    private Map<String, Auditorium> auditoriumStore;

    @BeforeEach
    void setUp() {
        movies = mock(MovieRepository.class);
        cinemas = mock(CinemaRepository.class);
        auditoriums = mock(AuditoriumRepository.class);
        showtimes = mock(ShowtimeRepository.class);
        bookings = mock(BookingRepository.class);
        importer = new GalaxyDataImporter(movies, cinemas, auditoriums, showtimes, bookings, mock(com.cinema.booking.service.CatalogGuard.class));
        movieStore = new HashMap<>();
        cinemaStore = new HashMap<>();
        showtimeStore = new HashMap<>();
        auditoriumStore = new HashMap<>();
        AtomicLong sequence = new AtomicLong(1);
        when(showtimes.tryAcquireGalaxySyncLock()).thenReturn(true);
        when(movies.findByGalaxyMovieId(anyString())).thenAnswer(i -> Optional.ofNullable(movieStore.get(i.getArgument(0))));
        when(movies.save(any())).thenAnswer(i -> {
            Movie movie = i.getArgument(0);
            if (movie.getId() == null) movie.setId(sequence.getAndIncrement());
            movieStore.put(movie.getGalaxyMovieId(), movie);
            return movie;
        });
        when(movies.findByGalaxyMovieIdIsNotNull()).thenAnswer(i -> new ArrayList<>(movieStore.values()));
        when(cinemas.findByGalaxyCinemaId(anyString())).thenAnswer(i -> Optional.ofNullable(cinemaStore.get(i.getArgument(0))));
        when(cinemas.save(any())).thenAnswer(i -> {
            Cinema cinema = i.getArgument(0);
            if (cinema.getId() == null) cinema.setId(sequence.getAndIncrement());
            cinemaStore.put(cinema.getGalaxyCinemaId(), cinema);
            return cinema;
        });
        when(auditoriums.findByCinemaIdAndName(anyLong(), anyString())).thenAnswer(i ->
                Optional.ofNullable(auditoriumStore.get(i.getArgument(0) + ":" + i.getArgument(1))));
        when(auditoriums.save(any())).thenAnswer(i -> {
            Auditorium auditorium = i.getArgument(0);
            if (auditorium.getId() == null) auditorium.setId(sequence.getAndIncrement());
            auditoriumStore.put(auditorium.getCinema().getId() + ":" + auditorium.getName(), auditorium);
            return auditorium;
        });
        when(showtimes.findByGalaxySessionIdIn(anyCollection())).thenAnswer(i -> {
            Collection<String> ids = i.getArgument(0);
            return ids.stream().map(showtimeStore::get).filter(Objects::nonNull).toList();
        });
        when(showtimes.save(any())).thenAnswer(i -> {
            Showtime showtime = i.getArgument(0);
            if (showtime.getId() == null) showtime.setId(sequence.getAndIncrement());
            showtimeStore.put(showtime.getGalaxySessionId(), showtime);
            return showtime;
        });
        when(showtimes.findByGalaxySessionIdIsNotNullAndActiveTrue()).thenAnswer(i ->
                showtimeStore.values().stream().filter(Showtime::isActive).toList());
    }

    @Test
    void repeatedSnapshotUpdatesMovieWithoutDuplicatingSeatsOrChangingPrice() throws Exception {
        ArrayNode snapshot = snapshot("session-1");
        importer.importData(snapshot, mapper.createArrayNode(), 0, true);
        Showtime first = showtimeStore.get("session-1");
        Long id = first.getId();
        first.setBasePrice(BigDecimal.valueOf(95000));
        ((com.fasterxml.jackson.databind.node.ObjectNode) snapshot.get(0).path("movie")).put("name", "Updated title");
        importer.importData(snapshot, mapper.createArrayNode(), 0, true);
        assertEquals(1, movieStore.size());
        assertEquals("Updated title", movieStore.get("movie-1").getTitle());
        assertEquals(id, showtimeStore.get("session-1").getId());
        assertEquals(BigDecimal.valueOf(95000), first.getBasePrice());
    }

    @Test
    void existingCatalogIsLoadedInOneQueryWithoutPerSessionFallbacks() throws Exception {
        String[] ids = java.util.stream.IntStream.range(0, 120).mapToObj(i -> "session-" + i).toArray(String[]::new);
        ArrayNode source = snapshot(ids);
        importer.importData(source, mapper.createArrayNode(), 0, true);
        clearInvocations(showtimes);
        importer.importData(source, mapper.createArrayNode(), 0, true);
        verify(showtimes, times(1)).findByGalaxySessionIdIn(anyCollection());
        verify(showtimes, never()).findFirstByAuditoriumIdAndMovieIdAndStartTimeAndGalaxySessionIdIsNull(
                anyLong(), anyLong(), any());
        assertEquals(120, showtimeStore.size());
    }

    @Test
    void importsAllSessionsByDefaultAndWithdrawsMissingOnNextFullSnapshot() throws Exception {
        ArrayNode all = snapshot("session-1", "session-2");
        importer.importData(all, mapper.createArrayNode(), 0, true);
        Long secondId = showtimeStore.get("session-2").getId();
        var result = importer.importData(snapshot("session-1"), mapper.createArrayNode(), 0, true);
        assertTrue(showtimeStore.get("session-1").isActive());
        assertFalse(showtimeStore.get("session-2").isActive());
        assertEquals(secondId, showtimeStore.get("session-2").getId());
        assertEquals(1, result.getTotalShowtimesDeactivated());
        verify(showtimes, never()).delete(any());
        verifyNoInteractions(bookings);
    }

    @Test
    void completeSyncIsNotCappedAtOneHundredShowtimes() throws Exception {
        String[] ids = java.util.stream.IntStream.range(0, 120).mapToObj(i -> "session-" + i).toArray(String[]::new);
        var result = importer.importData(snapshot(ids), mapper.createArrayNode(), 0, true);
        assertEquals(120, result.getTotalShowtimesSynced());
        assertEquals(120, showtimeStore.size());
        assertEquals(0, result.getTotalSeatsSynced());
        assertEquals(0, result.getTotalShowtimeSeatsSynced());
    }

    @Test
    void pastSessionsAreNotShiftedToTodayOrImportedAsNewShowtimes() throws Exception {
        ArrayNode past = snapshot("session-1");
        ((com.fasterxml.jackson.databind.node.ObjectNode) past.get(0)).put("showDate", "2000-01-01");
        var result = importer.importData(past, mapper.createArrayNode(), 0, true);
        assertEquals(0, result.getTotalShowtimesSynced());
        assertTrue(showtimeStore.isEmpty());
        assertEquals("2000-01-01", past.get(0).path("showDate").asText());
    }

    @Test
    void offlineAndLimitedRunsDoNotWithdrawMissingRecords() throws Exception {
        importer.importData(snapshot("session-1", "session-2"), null, 0, false);
        importer.importData(snapshot("session-1"), null, 0, false);
        assertTrue(showtimeStore.get("session-2").isActive());
        importer.importData(snapshot("session-1"), mapper.createArrayNode(), 1, true);
        assertTrue(showtimeStore.get("session-2").isActive());
    }

    @Test
    void updatesUnbookedTimeButPreservesBookedTicketTimeAndSeats() throws Exception {
        importer.importData(snapshot("session-1"), null, 0, false);
        Showtime showtime = showtimeStore.get("session-1");
        when(bookings.existsByShowtimeId(showtime.getId())).thenReturn(false);
        ArrayNode changed = snapshot("session-1");
        ((com.fasterxml.jackson.databind.node.ObjectNode) changed.get(0)).put("showTime", "14:30");
        importer.importData(changed, null, 0, false);
        assertEquals(14, showtime.getStartTime().getHour());
        LocalDateTime bookedStart = showtime.getStartTime();
        when(bookings.existsByShowtimeId(showtime.getId())).thenReturn(true);
        ((com.fasterxml.jackson.databind.node.ObjectNode) changed.get(0)).put("showTime", "16:30");
        var result = importer.importData(changed, null, 0, false);
        assertEquals(bookedStart, showtime.getStartTime());
        assertFalse(showtime.isActive());
        assertEquals(1, result.getTotalShowtimesSkipped());
    }

    @Test
    void adoptsExactLegacyShowtimeAndKeepsItsId() throws Exception {
        importer.importData(snapshot("session-1"), null, 0, false);
        Showtime legacy = showtimeStore.remove("session-1");
        legacy.setGalaxySessionId(null);
        Long originalId = legacy.getId();
        when(showtimes.findFirstByAuditoriumIdAndMovieIdAndStartTimeAndGalaxySessionIdIsNull(
                legacy.getAuditorium().getId(), legacy.getMovie().getId(), legacy.getStartTime()))
                .thenReturn(Optional.of(legacy));
        importer.importData(snapshot("session-1"), null, 0, false);
        assertEquals(originalId, showtimeStore.get("session-1").getId());
    }

    @Test
    void endsOnlySourceManagedMoviesMissingFromFullSnapshot() throws Exception {
        importer.importData(snapshot("session-1"), null, 0, false);
        var result = importer.importData(mapper.createArrayNode(), mapper.createArrayNode(), 0, true);
        assertEquals(MovieStatus.ENDED, movieStore.get("movie-1").getStatus());
        assertEquals(1, result.getTotalMoviesEnded());
        assertFalse(showtimeStore.get("session-1").isActive());
    }

    @Test
    void rejectsInvalidDateBeforeAnyWrite() throws Exception {
        ArrayNode invalid = snapshot("session-1");
        ((com.fasterxml.jackson.databind.node.ObjectNode) invalid.get(0)).put("showDate", "2099-02-30");
        assertThrows(AppException.class, () -> importer.importData(invalid, null, 0, true));
        verifyNoInteractions(movies, cinemas, auditoriums, showtimes, bookings);
    }

    @Test
    void rejectsConcurrentDatabaseImporterBeforeAnyWrite() throws Exception {
        when(showtimes.tryAcquireGalaxySyncLock()).thenReturn(false);
        AppException error = assertThrows(AppException.class, () -> importer.importData(snapshot("session-1"), null, 0, true));
        assertEquals(409, error.getCode());
        verifyNoInteractions(movies, cinemas, auditoriums, bookings);
    }

    @Test
    void springTransactionRollsBackWhenACatalogWriteFails() throws Exception {
        PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
        TransactionStatus status = mock(TransactionStatus.class);
        when(manager.getTransaction(any())).thenReturn(status);
        ProxyFactory factory = new ProxyFactory(importer);
        factory.addAdvice(new TransactionInterceptor(manager, new AnnotationTransactionAttributeSource()));
        GalaxyDataImporter transactionalImporter = (GalaxyDataImporter) factory.getProxy();
        doThrow(new IllegalStateException("showtime insert failed")).when(showtimes).save(any());
        assertThrows(IllegalStateException.class,
                () -> transactionalImporter.importData(snapshot("session-1"), null, 0, false));
        verify(manager).rollback(status);
        verify(manager, never()).commit(any());
    }

    @Test
    void advanceSalesDoNotOverrideComingSoonCatalog() throws Exception {
        ArrayNode sessions = snapshot("advance-sale");
        ArrayNode upcoming = mapper.createArrayNode().add(sessions.get(0).path("movie").deepCopy());
        importer.importData(sessions, upcoming, mapper.createArrayNode(), 0, true);
        assertEquals(MovieStatus.COMING_SOON, movieStore.get("movie-1").getStatus());
        assertTrue(showtimeStore.get("advance-sale").isActive());
    }

    @Test
    void overlappingCatalogsReuseTheMovieLookupAndKeepComingSoonPriority() throws Exception {
        ArrayNode sessions = snapshot("advance-sale");
        var movie = sessions.get(0).path("movie");
        ArrayNode showing = mapper.createArrayNode().add(movie.deepCopy());
        ArrayNode upcoming = mapper.createArrayNode().add(movie.deepCopy());
        importer.importData(sessions, upcoming, showing, 0, true);
        verify(movies, times(1)).findByGalaxyMovieId("movie-1");
        verify(movies, times(1)).save(any());
        assertEquals(MovieStatus.COMING_SOON, movieStore.get("movie-1").getStatus());
    }

    @Test
    void catalogIncludesMoviesWithoutSessionsAndWithdrawsOldListings() throws Exception {
        ArrayNode sessions = snapshot("session-1");
        var listed = sessions.get(0).path("movie").deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode) listed).put("id", "listed-without-session");
        ArrayNode showing = mapper.createArrayNode().add(listed);
        importer.importData(sessions, mapper.createArrayNode(), showing, 0, true);
        assertEquals(MovieStatus.NOW_SHOWING, movieStore.get("listed-without-session").getStatus());
        assertEquals(MovieStatus.ENDED, movieStore.get("movie-1").getStatus());
        importer.importData(sessions, mapper.createArrayNode(), mapper.createArrayNode(), 0, true);
        assertEquals(MovieStatus.ENDED, movieStore.get("listed-without-session").getStatus());
    }

    @Test
    void catalogKeepsSlugLandscapeAndPreviouslyEnrichedMetadata() throws Exception {
        ArrayNode sessions = snapshot("session-1");
        var source = (com.fasterxml.jackson.databind.node.ObjectNode) sessions.get(0).path("movie");
        source.put("slug", "test-movie");
        source.put("imageLandscape", "https://cdn.example/banner.jpg");
        importer.importData(sessions, null, 0, false);
        Movie movie = movieStore.get("movie-1");
        assertEquals("test-movie", movie.getGalaxySlug());
        assertEquals("https://cdn.example/banner.jpg", movie.getLandscapeUrl());
        movie.setDirectors(List.of("Saved director"));
        movie.setGenre("Hài, Tâm Lý");
        source.remove("slug");
        source.remove("imageLandscape");
        importer.importData(sessions, null, 0, false);
        assertEquals("test-movie", movie.getGalaxySlug());
        assertEquals("https://cdn.example/banner.jpg", movie.getLandscapeUrl());
        assertEquals(List.of("Saved director"), movie.getDirectors());
        assertEquals("Hài, Tâm Lý", movie.getGenre());
    }

    @Test
    void importsCinemaCatalogWithoutSessionsAndUpdatesTheSameLocalId() throws Exception {
        ArrayNode catalog = cinemaCatalog();
        var empty = mapper.createArrayNode();
        var result = importer.importData(empty, empty, empty, catalog, 1, false);
        assertEquals(1, result.getTotalCinemasSynced());
        assertEquals(0, result.getTotalAuditoriumsSynced());
        assertEquals(0, result.getTotalShowtimesSynced());
        Cinema cinema = cinemaStore.get("cinema-1");
        Long id = cinema.getId();
        assertEquals("0000001029", cinema.getSiteId());
        assertEquals("galaxy-test", cinema.getSlug());
        assertEquals("Hà Nội", cinema.getCity());
        assertEquals("f4bf5f53-4e80-40c8-b1e0-f11ffa9a636a", cinema.getGalaxyCityId());
        assertEquals(new BigDecimal("21.031587302213463"), cinema.getLatitude());
        assertEquals(new BigDecimal("105.8309551052807"), cinema.getLongitude());
        assertEquals("19002224", cinema.getPhone());
        assertEquals("https://cdn.example/landscape.jpg", cinema.getImageLandscape());
        assertEquals("https://cdn.example/portrait.jpg", cinema.getImagePortrait());
        assertEquals(List.of("https://cdn.example/cinema-1.jpg", "https://cdn.example/cinema-2.jpg"), cinema.getImageUrls());
        assertEquals("premium", cinema.getCinemaType());
        assertEquals(0, cinema.getDisplayOrder());
        ((com.fasterxml.jackson.databind.node.ObjectNode) catalog.get(0)).put("name", "Updated cinema");
        importer.importData(empty, empty, empty, catalog, 0, true);
        assertEquals(1, cinemaStore.size());
        assertEquals(id, cinemaStore.get("cinema-1").getId());
        assertEquals("Updated cinema", cinemaStore.get("cinema-1").getName());
        verifyNoInteractions(auditoriums, bookings);
    }

    @Test
    void dedicatedCinemaCatalogTakesPrecedenceOverSessionMetadata() throws Exception {
        ArrayNode sessions = snapshot("session-1");
        var embedded = (com.fasterxml.jackson.databind.node.ObjectNode) sessions.get(0).path("cinema");
        embedded.put("phone", "outdated");
        embedded.put("siteId", "old-code");
        var result = importer.importData(sessions, null, null, cinemaCatalog(), 0, false);
        assertEquals(1, result.getTotalCinemasSynced());
        assertEquals(1, cinemaStore.size());
        Cinema cinema = cinemaStore.get("cinema-1");
        assertEquals("Galaxy catalog cinema", cinema.getName());
        assertEquals("19002224", cinema.getPhone());
        assertEquals("0000001029", cinema.getSiteId());
        assertSame(cinema, showtimeStore.get("session-1").getAuditorium().getCinema());
        verify(cinemas, times(1)).save(any());
    }

    @Test
    void partialOfflinePayloadPreservesEnrichmentAndExistingAuditoriums() throws Exception {
        ArrayNode sessions = snapshot("session-1");
        importer.importData(sessions, null, null, cinemaCatalog(), 0, false);
        Cinema cinema = cinemaStore.get("cinema-1");
        Long id = cinema.getId();
        Auditorium auditorium = showtimeStore.get("session-1").getAuditorium();
        cinema.getAuditoriums().add(auditorium);
        var embedded = (com.fasterxml.jackson.databind.node.ObjectNode) sessions.get(0).path("cinema");
        embedded.remove("address");
        embedded.putNull("phone");
        embedded.putNull("imageUrls");
        embedded.putNull("latitude");
        importer.importData(sessions, null, 0, false);
        assertEquals(id, cinema.getId());
        assertEquals("Hà Nội", cinema.getCity());
        assertEquals("175 Nguyễn Thái Học, Hà Nội", cinema.getAddress());
        assertEquals("19002224", cinema.getPhone());
        assertEquals("0000001029", cinema.getSiteId());
        assertEquals("galaxy-test", cinema.getSlug());
        assertEquals("premium", cinema.getCinemaType());
        assertEquals(2, cinema.getImageUrls().size());
        assertEquals(new BigDecimal("21.031587302213463"), cinema.getLatitude());
        assertEquals(List.of(auditorium), cinema.getAuditoriums());
    }

    @Test
    void adoptsLegacyCinemaByNameWithoutChangingItsLocalIdOrRooms() throws Exception {
        Cinema legacy = Cinema.builder().id(42L).name("Galaxy catalog cinema")
                .city("Hà Nội").address("Legacy address").build();
        Auditorium room = Auditorium.builder().id(88L).name("Existing room").cinema(legacy).build();
        legacy.getAuditoriums().add(room);
        when(cinemas.findByName("Galaxy catalog cinema")).thenReturn(Optional.of(legacy));
        var empty = mapper.createArrayNode();
        importer.importData(empty, null, null, cinemaCatalog(), 0, false);
        Cinema saved = cinemaStore.get("cinema-1");
        assertSame(legacy, saved);
        assertEquals(42L, saved.getId());
        assertEquals(List.of(room), saved.getAuditoriums());
    }

    @Test
    void sessionsStillImportCinemasMissingFromTheSeparateCatalog() throws Exception {
        ArrayNode catalog = cinemaCatalog();
        ((com.fasterxml.jackson.databind.node.ObjectNode) catalog.get(0)).put("id", "cinema-without-session");
        ArrayNode sessions = snapshot("session-1");
        ((com.fasterxml.jackson.databind.node.ObjectNode) sessions.get(0).path("cinema")).put("code", "0000001005");
        var result = importer.importData(sessions, null, null, catalog, 0, false);
        assertEquals(2, result.getTotalCinemasSynced());
        assertEquals("0000001005", cinemaStore.get("cinema-1").getSiteId());
        assertNotNull(cinemaStore.get("cinema-without-session"));
    }

    @Test
    void invalidCinemaMetadataIsRejectedBeforeAnyDatabaseInteraction() throws Exception {
        for (String invalid : List.of(
                "{\"latitude\":\"not-a-number\"}", "{\"latitude\":91}", "{\"longitude\":-181}",
                "{\"imageUrls\":\"not-an-array\"}", "{\"imageUrls\":[123]}", "{\"phone\":123}",
                "{\"order\":1.5}", "{\"order\":2147483648}", "{\"id\":\"\"}")) {
            ArrayNode catalog = cinemaCatalog();
            ((com.fasterxml.jackson.databind.node.ObjectNode) catalog.get(0)).setAll(
                    (com.fasterxml.jackson.databind.node.ObjectNode) mapper.readTree(invalid));
            assertThrows(AppException.class,
                    () -> importer.importData(snapshot("session-1"), null, null, catalog, 0, false), invalid);
        }
        verifyNoInteractions(movies, cinemas, auditoriums, showtimes, bookings);
    }

    @Test
    void duplicateCinemaIdsAreRejectedBeforeAnyDatabaseInteraction() throws Exception {
        ArrayNode catalog = cinemaCatalog();
        catalog.add(catalog.get(0).deepCopy());
        assertThrows(AppException.class,
                () -> importer.importData(snapshot("session-1"), null, null, catalog, 0, false));
        verifyNoInteractions(movies, cinemas, auditoriums, showtimes, bookings);
    }

    @Test
    void explicitEmptyGalleryClearsImagesAndAnAbsentCinemaIsNotDeleted() throws Exception {
        var empty = mapper.createArrayNode();
        ArrayNode catalog = cinemaCatalog();
        importer.importData(empty, null, null, catalog, 0, false);
        ((com.fasterxml.jackson.databind.node.ObjectNode) catalog.get(0)).putArray("imageUrls");
        importer.importData(empty, null, null, catalog, 0, false);
        assertTrue(cinemaStore.get("cinema-1").getImageUrls().isEmpty());
        importer.importData(empty, empty, empty, empty, 0, true);
        assertEquals(1, cinemaStore.size());
        verify(cinemas, never()).delete(any());
    }

    private ArrayNode cinemaCatalog() throws Exception {
        return (ArrayNode) mapper.readTree("""
                [{"id":"cinema-1","name":"Galaxy catalog cinema","siteId":"0000001029","slug":"galaxy-test",
                  "address":"175 Nguyễn Thái Học, Hà Nội","cityId":"f4bf5f53-4e80-40c8-b1e0-f11ffa9a636a",
                  "latitude":"21.031587302213463","longitude":105.8309551052807,"phone":"19002224",
                  "imageLandscape":"https://cdn.example/landscape.jpg","imagePortrait":"https://cdn.example/portrait.jpg",
                  "imageUrls":["https://cdn.example/cinema-1.jpg","https://cdn.example/cinema-2.jpg"],
                  "cinemaType":"premium","order":0}]
                """);
    }

    private ArrayNode snapshot(String... ids) throws Exception {
        ArrayNode array = mapper.createArrayNode();
        for (int i = 0; i < ids.length; i++) {
            JsonNode node = mapper.readTree("""
                    {"id":"%s","showDate":"%s","showTime":"%02d:00","screenName":"RAP 1",
                    "movieFormat":"2D","version":"2d",
                    "movie":{"id":"movie-1","name":"Original title","duration":120,"startDate":"2099-11-01"},
                    "cinema":{"id":"cinema-1","name":"Galaxy test","address":"Test address"}}
                    """.formatted(ids[i], java.time.LocalDate.of(2099, 11, 8).plusDays(i / 4), 10 + (i % 4) * 3));
            array.add(node);
        }
        return array;
    }
}
