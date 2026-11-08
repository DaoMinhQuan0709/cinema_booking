package com.cinema.booking;

import com.cinema.booking.entity.*;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.impl.AdminReportServiceImpl;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminReportServiceTests {
    @Test
    void computesOccupancyWithOneGroupedQueryIncludingUninitializedShowtimes() {
        ShowtimeRepository showtimes = mock(ShowtimeRepository.class);
        ShowtimeSeatRepository seats = mock(ShowtimeSeatRepository.class);
        AdminReportServiceImpl service = new AdminReportServiceImpl(mock(BookingRepository.class), showtimes, seats);
        when(showtimes.findShowtimes(null, null, null, null)).thenReturn(List.of(showtime(1L), showtime(2L), showtime(3L)));
        when(seats.countSeatsByShowtimeIds(List.of(1L, 2L, 3L), ShowtimeSeatStatus.BOOKED))
                .thenReturn(List.of(new Object[]{1L, 120L, 60L}, new Object[]{2L, 80L, 20L}));
        var result = service.getOccupancyReport(null, null, null);
        assertEquals(200L, result.getTotalSeatsAvailable());
        assertEquals(80L, result.getTotalSeatsBooked());
        assertEquals(40.0, result.getOverallOccupancyRate());
        assertEquals(50.0, result.getBreakdown().get(0).getOccupancyRate());
        assertEquals(25.0, result.getBreakdown().get(1).getOccupancyRate());
        assertEquals(0L, result.getBreakdown().get(2).getTotalSeats());
        verify(seats, times(1)).countSeatsByShowtimeIds(anyCollection(), eq(ShowtimeSeatStatus.BOOKED));
        verify(seats, never()).countTotalSeatsByShowtimeId(anyLong());
        verify(seats, never()).countSeatsByShowtimeIdAndStatus(anyLong(), any());
    }

    @Test
    void emptyReportDoesNotExecuteAnEmptyInQuery() {
        ShowtimeRepository showtimes = mock(ShowtimeRepository.class);
        ShowtimeSeatRepository seats = mock(ShowtimeSeatRepository.class);
        when(showtimes.findShowtimes(null, null, null, null)).thenReturn(List.of());
        var result = new AdminReportServiceImpl(mock(BookingRepository.class), showtimes, seats)
                .getOccupancyReport(null, null, null);
        assertEquals(0L, result.getTotalSeatsAvailable());
        assertEquals(0.0, result.getOverallOccupancyRate());
        verifyNoInteractions(seats);
    }

    private Showtime showtime(long id) {
        return Showtime.builder().id(id).movie(Movie.builder().title("Movie " + id).build())
                .auditorium(Auditorium.builder().name("Room " + id).build())
                .startTime(LocalDateTime.of(2099, 1, 1, 10, 0)).build();
    }
}
