package com.cinema.booking;

import com.cinema.booking.config.GalaxySyncProperties;
import com.cinema.booking.enums.MovieStatus;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.repository.MovieRepository;
import com.cinema.booking.service.GalaxyApiClient;
import com.cinema.booking.service.impl.GalaxyMovieDetailsService;
import com.cinema.booking.service.impl.GalaxyMovieDetailsWriter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class GalaxyMovieDetailsServiceTests {
    private MovieRepository repository;
    private GalaxyApiClient client;
    private GalaxyMovieDetailsWriter writer;
    private GalaxySyncProperties properties;
    private GalaxyMovieDetailsService service;

    @BeforeEach
    void setUp() {
        repository = mock(MovieRepository.class);
        client = mock(GalaxyApiClient.class);
        writer = mock(GalaxyMovieDetailsWriter.class);
        properties = new GalaxySyncProperties();
        service = new GalaxyMovieDetailsService(repository, client, writer, properties);
        when(repository.claimGalaxyDetails(anyLong(), anyList(), any(), any(), any())).thenReturn(1);
    }

    @Test
    void honorsBothGlobalAndDetailsDisableSwitches() {
        properties.setEnabled(false);
        service.syncDueMovies();
        properties.setEnabled(true);
        properties.getDetails().setEnabled(false);
        service.syncDueMovies();
        verifyNoInteractions(repository, client, writer);
    }

    @Test
    void selectsOnlyActiveDueMoviesWithConfiguredBatchAndRetryWindow() {
        properties.getDetails().setBatchSize(7);
        service.syncDueMovies();
        var refresh = ArgumentCaptor.forClass(Instant.class);
        var retry = ArgumentCaptor.forClass(Instant.class);
        var pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findDueGalaxyDetails(eq(List.of(MovieStatus.NOW_SHOWING, MovieStatus.COMING_SOON)),
                refresh.capture(), retry.capture(), pageable.capture());
        assertEquals(7, pageable.getValue().getPageSize());
        assertEquals(21_300, retry.getValue().getEpochSecond() - refresh.getValue().getEpochSecond());
    }

    @Test
    void oneFailedMovieDoesNotStopOtherMetadataOrCallTheWriterForTheFailure() throws Exception {
        var first = movie(1L);
        var second = movie(2L);
        when(repository.findDueGalaxyDetails(anyList(), any(), any(), any())).thenReturn(List.of(first, second));
        when(client.fetchMovieDetails("slug-1", "source-1")).thenThrow(new AppException(502, "upstream unavailable"));
        when(client.fetchMovieDetails("slug-2", "source-2")).thenReturn(new ObjectMapper().readTree("{\"id\":\"source-2\"}"));
        service.syncDueMovies();
        verify(writer).apply(eq(2L), eq("slug-2"), any(), any());
        verify(writer, never()).apply(eq(1L), any(), any(), any());
        verify(repository, times(2)).claimGalaxyDetails(anyLong(), anyList(), any(), any(), any());
    }

    @Test
    void aClaimAlreadyTakenByAnotherRunSkipsTheHttpRequest() {
        when(repository.findDueGalaxyDetails(anyList(), any(), any(), any())).thenReturn(List.of(movie(1L)));
        when(repository.claimGalaxyDetails(anyLong(), anyList(), any(), any(), any())).thenReturn(0);
        service.syncDueMovies();
        verifyNoInteractions(client, writer);
    }

    @Test
    void invalidMetadataCannotReachTheDatabaseWriter() throws Exception {
        when(repository.findDueGalaxyDetails(anyList(), any(), any(), any())).thenReturn(List.of(movie(1L)));
        when(client.fetchMovieDetails("slug-1", "source-1")).thenReturn(new ObjectMapper().readTree("{\"id\":\"source-1\",\"actors\":42}"));
        service.syncDueMovies();
        verifyNoInteractions(writer);
    }

    private MovieRepository.GalaxyDetailsCandidate movie(Long id) {
        return new MovieRepository.GalaxyDetailsCandidate() {
            public Long getId() { return id; }
            public String getGalaxyMovieId() { return "source-" + id; }
            public String getGalaxySlug() { return "slug-" + id; }
        };
    }
}
