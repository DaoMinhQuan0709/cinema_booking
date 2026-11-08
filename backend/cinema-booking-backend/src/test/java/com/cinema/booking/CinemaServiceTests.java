package com.cinema.booking;

import com.cinema.booking.entity.Cinema;
import com.cinema.booking.repository.CinemaRepository;
import com.cinema.booking.service.impl.CinemaServiceImpl;
import org.junit.jupiter.api.Test;

import java.util.List;

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
}
