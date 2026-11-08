package com.cinema.booking;

import com.cinema.booking.entity.Movie;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.repository.MovieRepository;
import com.cinema.booking.service.GalaxyMovieDetails;
import com.cinema.booking.service.impl.GalaxyMovieDetailsWriter;
import com.cinema.booking.service.impl.MovieServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GalaxyMovieDetailsTests {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void mapsCreditsAndCategoriesAndConvertsDescriptionToPlainText() throws Exception {
        var details = GalaxyMovieDetails.fromJson(mapper.readTree("""
                {"id":"movie-1", "country":"Đức", "imageLandscape":"https://cdn.example/banner.jpg",
                 "directors":[{"name":" Simon Verhoeven "},{"name":"Simon Verhoeven"}],
                 "actors":[{"name":"Bruno Alexander"},{"name":"Senta Berger"}],
                 "categories":[{"name":"Hài"},{"name":"Tâm Lý"}],
                 "description":"<style>body{color:red}</style><p>Chào &amp; hẹn gặp.</p><script>alert(1)</script><p>Phần hai&nbsp;!</p>"}
                """));
        assertEquals(List.of("Simon Verhoeven"), details.directors());
        assertEquals(List.of("Bruno Alexander", "Senta Berger"), details.actors());
        assertEquals("Hài, Tâm Lý", details.genre());
        assertEquals("Chào & hẹn gặp.\nPhần hai !", details.description());
        assertEquals("Đức", details.country());
    }

    @Test
    void distinguishesAbsentMetadataFromExplicitEmptyLists() throws Exception {
        var absent = GalaxyMovieDetails.fromJson(mapper.readTree("{\"id\":\"movie-1\"}"));
        assertNull(absent.directors());
        var empty = GalaxyMovieDetails.fromJson(mapper.readTree("{\"id\":\"movie-1\",\"actors\":[]}"));
        assertEquals(List.of(), empty.actors());
    }

    @Test
    void rejectsMalformedCreditsAndUnsafeImageUrls() throws Exception {
        for (String json : List.of("{\"id\":\"m\",\"actors\":\"name\"}",
                "{\"id\":\"m\",\"directors\":[{}]}",
                "{\"id\":\"m\",\"imageLandscape\":\"javascript:alert(1)\"}",
                "{\"id\":\"m\",\"categories\":[7]}")) {
            var node = mapper.readTree(json);
            assertThrows(AppException.class, () -> GalaxyMovieDetails.fromJson(node));
        }
    }

    @Test
    void writesMetadataWithoutChangingCatalogOrLocalIdentity() throws Exception {
        MovieRepository repository = mock(MovieRepository.class);
        Movie movie = Movie.builder().id(16L).galaxyMovieId("movie-1").galaxySlug("test-movie")
                .status(MovieStatus.COMING_SOON).title("Saved title").build();
        when(repository.findById(16L)).thenReturn(Optional.of(movie));
        var details = GalaxyMovieDetails.fromJson(mapper.readTree("""
                {"id":"movie-1","actors":[{"name":"Actor"}],"categories":[{"name":"Hài"}]}
                """));
        new GalaxyMovieDetailsWriter(repository).apply(16L, "test-movie", details, Instant.EPOCH);
        assertEquals(List.of("Actor"), movie.getActors());
        assertEquals(Instant.EPOCH, movie.getGalaxyDetailsSyncedAt());
        assertEquals(MovieStatus.COMING_SOON, movie.getStatus());
        assertEquals("Saved title", movie.getTitle());
        assertEquals(16L, movie.getId());
    }

    @Test
    void preservesExistingValuesWhenOptionalMetadataIsAbsent() throws Exception {
        MovieRepository repository = mock(MovieRepository.class);
        Movie movie = Movie.builder().id(16L).galaxyMovieId("movie-1").galaxySlug("test-movie")
                .directors(List.of("Saved director")).description("Saved description").genre("Hài").build();
        when(repository.findById(16L)).thenReturn(Optional.of(movie));
        new GalaxyMovieDetailsWriter(repository).apply(16L, "test-movie",
                GalaxyMovieDetails.fromJson(mapper.readTree("{\"id\":\"movie-1\"}")), Instant.EPOCH);
        assertEquals(List.of("Saved director"), movie.getDirectors());
        assertEquals("Saved description", movie.getDescription());
        assertEquals("Hài", movie.getGenre());
    }

    @Test
    void ignoresStaleFetchIfTheSourceMappingChangedDuringHttp() throws Exception {
        MovieRepository repository = mock(MovieRepository.class);
        Movie movie = Movie.builder().id(16L).galaxyMovieId("new-id").galaxySlug("new-slug").build();
        when(repository.findById(16L)).thenReturn(Optional.of(movie));
        new GalaxyMovieDetailsWriter(repository).apply(16L, "old-slug",
                GalaxyMovieDetails.fromJson(mapper.readTree("{\"id\":\"old-id\",\"country\":\"Đức\"}")), Instant.EPOCH);
        assertNull(movie.getCountry());
        assertNull(movie.getGalaxyDetailsSyncedAt());
    }

    @Test
    void internalApiReturnsMetadataAndSupportsOldRowsWithNullCredits() {
        MovieRepository repository = mock(MovieRepository.class);
        Movie movie = Movie.builder().id(16L).landscapeUrl("https://cdn.example/banner.jpg")
                .country("Đức").directors(List.of("Director")).build();
        when(repository.findById(16L)).thenReturn(Optional.of(movie));
        var response = new MovieServiceImpl(repository).getMovieById(16L);
        assertEquals(movie.getLandscapeUrl(), response.getLandscapeUrl());
        assertEquals(List.of("Director"), response.getDirectors());
        assertEquals(List.of(), response.getActors());
        assertEquals("Đức", response.getCountry());
    }
}
