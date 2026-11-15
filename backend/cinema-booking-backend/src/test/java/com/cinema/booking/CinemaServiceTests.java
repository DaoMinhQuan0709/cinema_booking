package com.cinema.booking;

import com.cinema.booking.entity.Cinema;
import com.cinema.booking.repository.CinemaRepository;
import com.cinema.booking.service.impl.CinemaServiceImpl;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CinemaServiceTests {
    @Test
    void absentCityReturnsAllCinemasWithoutBindingANullSqlParameter() {
        CinemaRepository repository = mock(CinemaRepository.class);
        Cinema cinema = Cinema.builder().id(1L).name("Test cinema").city("Hà Nội").address("Test address").build();
        when(repository.findAllWithAuditoriums()).thenReturn(List.of(cinema));
        var result = new CinemaServiceImpl(repository).getCinemas(null);
        assertEquals(1, result.size());
        assertEquals("Hà Nội", result.getFirst().getCity());
        assertTrue(result.getFirst().getAuditoriums().isEmpty());
        verify(repository, never()).findByCityIgnoreCaseWithAuditoriums(any());
    }

    @Test
    void emptyOrWhitespaceCityAlsoReturnsAllCinemas() {
        CinemaRepository repository = mock(CinemaRepository.class);
        when(repository.findAllWithAuditoriums()).thenReturn(List.of());
        CinemaServiceImpl service = new CinemaServiceImpl(repository);
        assertTrue(service.getCinemas("").isEmpty());
        assertTrue(service.getCinemas("   ").isEmpty());
        verify(repository, times(2)).findAllWithAuditoriums();
        verify(repository, never()).findByCityIgnoreCaseWithAuditoriums(any());
    }

    @Test
    void suppliedCityIsTrimmedAndUsesCaseInsensitiveFilter() {
        CinemaRepository repository = mock(CinemaRepository.class);
        when(repository.findByCityIgnoreCaseWithAuditoriums("HÀ NỘI")).thenReturn(List.of());
        assertTrue(new CinemaServiceImpl(repository).getCinemas("  HÀ NỘI  ").isEmpty());
        verify(repository).findByCityIgnoreCaseWithAuditoriums("HÀ NỘI");
        verify(repository, never()).findAllWithAuditoriums();
    }

    @Test
    void cinemaDetailExposesSyncedMetadataAndStillSupportsLocalCinemas() {
        CinemaRepository repository = mock(CinemaRepository.class);
        Cinema cinema = Cinema.builder().id(1L).galaxyCinemaId("galaxy-1").siteId("000001")
                .slug("galaxy-test").name("Galaxy").address("Hà Nội").city("Hà Nội").galaxyCityId("city-1")
                .latitude(new BigDecimal("21.031587302213463")).longitude(new BigDecimal("105.8309551052807"))
                .phone("19002224").imageLandscape("landscape.jpg").imagePortrait("portrait.jpg")
                .imageUrls(List.of("one.jpg", "two.jpg")).cinemaType("premium").displayOrder(0).build();
        when(repository.findById(1L)).thenReturn(java.util.Optional.of(cinema));
        var response = new CinemaServiceImpl(repository).getCinemaById(1L);
        assertEquals("galaxy-1", response.getGalaxyCinemaId());
        assertEquals("000001", response.getSiteId());
        assertEquals("galaxy-test", response.getSlug());
        assertEquals("city-1", response.getGalaxyCityId());
        assertEquals(cinema.getLatitude(), response.getLatitude());
        assertEquals(cinema.getLongitude(), response.getLongitude());
        assertEquals("19002224", response.getPhone());
        assertEquals("landscape.jpg", response.getImageLandscape());
        assertEquals("portrait.jpg", response.getImagePortrait());
        assertEquals(List.of("one.jpg", "two.jpg"), response.getImageUrls());
        assertEquals("premium", response.getCinemaType());
        assertEquals(0, response.getDisplayOrder());
        assertTrue(response.getAuditoriums().isEmpty());
    }
}
