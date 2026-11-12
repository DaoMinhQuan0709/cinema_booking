package com.cinema.booking;

import com.cinema.booking.dto.request.ShowtimeCreateRequest;
import com.cinema.booking.entity.*;
import com.cinema.booking.enums.SeatType;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.exception.ConflictException;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.impl.AdminCatalogServiceImpl;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminShowtimeServiceTests {
    private final MovieRepository movies = mock(MovieRepository.class);
    private final AuditoriumRepository rooms = mock(AuditoriumRepository.class);
    private final ShowtimeRepository showtimes = mock(ShowtimeRepository.class);
    private final SeatRepository seats = mock(SeatRepository.class);
    private final ShowtimeSeatRepository inventory = mock(ShowtimeSeatRepository.class);
    // Deliberately UTC: Vietnam now is 10:00, regardless of the JVM/Clock zone.
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-12T03:00:00Z"), ZoneOffset.UTC);
    private final AdminCatalogServiceImpl service = new AdminCatalogServiceImpl(movies, mock(CinemaRepository.class),
            rooms, seats, showtimes, inventory, mock(ProductRepository.class), clock);

    private ShowtimeCreateRequest request(String start, String end) {
        Cinema cinema = Cinema.builder().id(2L).name("Cinema").build();
        Auditorium room = Auditorium.builder().id(3L).cinema(cinema).name("Room").build();
        when(movies.findById(1L)).thenReturn(Optional.of(Movie.builder().id(1L).title("Movie").durationMinutes(120).build()));
        when(rooms.findById(3L)).thenReturn(Optional.of(room));
        return ShowtimeCreateRequest.builder().movieId(1L).auditoriumId(3L)
                .startTime(LocalDateTime.parse(start)).endTime(LocalDateTime.parse(end))
                .basePrice(new BigDecimal("90000.50")).build();
    }

    @Test
    void rejectsVietnamPastEvenWhenItLooksFutureInUtc() {
        var request = request("2026-11-12T09:59:59", "2026-11-12T12:00:00");
        assertThrows(BadRequestException.class, () -> service.createShowtime(request));
        verifyNoInteractions(showtimes, seats, inventory);
    }

    @Test
    void rejectsExactlyNowRatherThanCreatingAnAlreadyStartedSession() {
        var request = request("2026-11-12T10:00:00", "2026-11-12T12:00:00");
        assertThrows(BadRequestException.class, () -> service.createShowtime(request));
        verifyNoInteractions(showtimes, seats, inventory);
    }

    @Test
    void endMustBeStrictlyAfterStart() {
        for (String end : List.of("2026-11-12T11:59:59", "2026-11-12T12:00:00")) {
            var request = request("2026-11-12T12:00:00", end);
            assertThrows(BadRequestException.class, () -> service.createShowtime(request));
        }
        verifyNoInteractions(showtimes, seats, inventory);
    }

    @Test
    void conflictingRoomIntervalRejectsWithoutWritingOrGeneratingInventory() {
        var request = request("2026-11-12T12:00:00", "2026-11-12T14:15:00");
        when(showtimes.existsOverlappingShowtime(3L, request.getStartTime(), request.getEndTime(), null)).thenReturn(true);
        assertThrows(ConflictException.class, () -> service.createShowtime(request));
        verify(showtimes, never()).save(any());
        verifyNoInteractions(seats, inventory);
    }

    @Test
    void createsCrossMidnightSessionWithExactLocalTimesAndSeatPrices() {
        var request = request("2026-11-12T23:30:00", "2026-11-13T01:45:00");
        when(showtimes.save(any())).thenAnswer(call -> { Showtime slot = call.getArgument(0); slot.setId(9L); return slot; });
        when(seats.findByAuditoriumIdOrderByRowCharAscSeatNumberAsc(3L)).thenReturn(List.of(
                Seat.builder().id(10L).type(SeatType.STANDARD).isActive(true).build(),
                Seat.builder().id(11L).type(SeatType.VIP).isActive(true).build(),
                Seat.builder().id(12L).type(SeatType.COUPLE).isActive(true).build(),
                Seat.builder().id(13L).type(SeatType.STANDARD).isActive(false).build()));
        var result = service.createShowtime(request);
        assertEquals(request.getStartTime(), result.getStartTime());
        assertEquals(request.getEndTime(), result.getEndTime());
        assertEquals(2L, result.getCinemaId());
        assertEquals(request.getBasePrice(), result.getBasePrice());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ShowtimeSeat>> captured = ArgumentCaptor.forClass(List.class);
        verify(inventory).saveAll(captured.capture());
        assertEquals(List.of(new BigDecimal("90000.50"), new BigDecimal("110000.50"), new BigDecimal("130000.50")),
                captured.getValue().stream().map(ShowtimeSeat::getPrice).toList());
        assertTrue(captured.getValue().stream().allMatch(seat -> seat.getStatus() == ShowtimeSeatStatus.AVAILABLE));
    }

    @Test
    void acceptsFutureVietnamTimeWithAClockInUtc() {
        var request = request("2026-11-12T10:00:01", "2026-11-12T12:15:00");
        when(showtimes.save(any())).thenAnswer(call -> call.getArgument(0));
        when(seats.findByAuditoriumIdOrderByRowCharAscSeatNumberAsc(3L)).thenReturn(List.of());
        assertEquals(request.getStartTime(), service.createShowtime(request).getStartTime());
    }
}
