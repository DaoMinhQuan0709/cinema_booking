package com.cinema.booking;

import com.cinema.booking.entity.*;
import com.cinema.booking.enums.SeatType;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.LocalSeatInventoryService;
import com.cinema.booking.service.SeatLockService;
import com.cinema.booking.service.impl.ShowtimeServiceImpl;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ShowtimeServiceTests {
    @Test
    void mergesRedisHoldsOnlyIntoAvailableSeatsWithoutChangingBookedState() {
        ShowtimeRepository showtimes = mock(ShowtimeRepository.class);
        LocalSeatInventoryService inventory = mock(LocalSeatInventoryService.class);
        SeatLockService holds = mock(SeatLockService.class);
        ShowtimeServiceImpl service = new ShowtimeServiceImpl(showtimes, mock(MovieRepository.class),
                mock(AuditoriumRepository.class), holds, inventory);
        Cinema cinema = Cinema.builder().id(1L).name("Test cinema").build();
        Auditorium room = Auditorium.builder().id(2L).cinema(cinema).name("Room 1").totalRows(1).totalCols(3).build();
        Showtime showtime = Showtime.builder().id(10L).auditorium(room).movie(Movie.builder().id(3L).title("Movie").build())
                .startTime(LocalDateTime.of(2099, 1, 1, 10, 0)).basePrice(BigDecimal.valueOf(80000)).build();
        List<ShowtimeSeat> seats = List.of(seat(101L, ShowtimeSeatStatus.AVAILABLE),
                seat(102L, ShowtimeSeatStatus.BOOKED), seat(103L, ShowtimeSeatStatus.AVAILABLE));
        when(inventory.getOrCreateSeats(10L)).thenReturn(seats);
        when(showtimes.findByIdWithDetails(10L)).thenReturn(Optional.of(showtime));
        when(holds.getLockedSeatIds(10L, List.of(101L, 103L))).thenReturn(Set.of(101L));
        var result = service.getShowtimeSeats(10L);
        assertEquals(List.of(ShowtimeSeatStatus.LOCKED, ShowtimeSeatStatus.BOOKED, ShowtimeSeatStatus.AVAILABLE),
                result.getSeats().stream().map(s -> s.getStatus()).toList());
        assertEquals(ShowtimeSeatStatus.AVAILABLE, seats.getFirst().getStatus());
        verify(holds).getLockedSeatIds(10L, List.of(101L, 103L));
    }

    private ShowtimeSeat seat(long id, ShowtimeSeatStatus status) {
        return ShowtimeSeat.builder().id(id).status(status).price(BigDecimal.valueOf(80000))
                .seat(Seat.builder().id(id).rowChar("A").seatNumber((int) (id - 100)).type(SeatType.STANDARD).build()).build();
    }
}
