package com.cinema.booking;

import com.cinema.booking.entity.*;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.dto.response.OccupancyReportResponse.CapacitySource;
import com.cinema.booking.exception.BadRequestException;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.impl.AdminReportServiceImpl;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminReportServiceTests {
    private final BookingRepository bookings = mock(BookingRepository.class);
    private final ShowtimeRepository showtimes = mock(ShowtimeRepository.class);
    private final ShowtimeSeatRepository seats = mock(ShowtimeSeatRepository.class);
    private final SeatRepository physical = mock(SeatRepository.class);
    private final AdminReportServiceImpl service = new AdminReportServiceImpl(bookings, showtimes, seats, physical);

    @Test
    void computesWeightedOccupancyIncludingUninitializedShowtimes() {
        when(showtimes.findForOccupancyReport(null, null, null, null)).thenReturn(List.of(showtime(1L), showtime(2L), showtime(3L)));
        when(seats.countSeatsByShowtimeIds(List.of(1L, 2L, 3L), ShowtimeSeatStatus.BOOKED))
                .thenReturn(List.of(new Object[]{1L, 120L, 60L}, new Object[]{2L, 80L, 20L}));
        var result = service.getOccupancyReport(null, null, null);
        assertEquals(320L, result.getTotalSeatsAvailable());
        assertEquals(80L, result.getTotalSeatsBooked());
        assertEquals(25.0, result.getOverallOccupancyRate());
        assertEquals(50.0, result.getBreakdown().get(0).getOccupancyRate());
        assertEquals(25.0, result.getBreakdown().get(1).getOccupancyRate());
        assertEquals(120L, result.getBreakdown().get(2).getTotalSeats());
        assertEquals(CapacitySource.ROOM_LAYOUT, result.getBreakdown().get(2).getCapacitySource());
        assertEquals(0L, result.getShowtimesMissingCapacity());
        verify(seats, times(1)).countSeatsByShowtimeIds(anyCollection(), eq(ShowtimeSeatStatus.BOOKED));
    }

    @Test
    void emptyReportDoesNotExecuteAnEmptyInQuery() {
        when(showtimes.findForOccupancyReport(null, null, null, null)).thenReturn(List.of());
        var result = service.getOccupancyReport(null, null, null);
        assertEquals(0L, result.getTotalSeatsAvailable());
        assertEquals(0.0, result.getOverallOccupancyRate());
        assertEquals(0L, result.getShowtimesMissingCapacity());
        verifyNoInteractions(seats, physical);
    }

    @Test
    void usesActivePhysicalSeatsBeforeLayoutAndDoesNotReviveDisabledSeats() {
        when(showtimes.findForOccupancyReport(null, null, null, null)).thenReturn(List.of(showtime(1L), showtime(2L)));
        when(physical.countCapacityByAuditoriumIds(List.of(1L, 2L))).thenReturn(List.of(new Object[]{1L, 100L, 75L}, new Object[]{2L, 100L, 0L}));
        var result = service.getOccupancyReport(null, null, null);
        assertEquals(75L, result.getTotalSeatsAvailable());
        assertEquals(0.0, result.getBreakdown().get(1).getOccupancyRate());
        assertEquals(CapacitySource.ACTIVE_SEATS, result.getBreakdown().get(1).getCapacitySource());
        assertEquals(0L, result.getShowtimesMissingCapacity());
    }

    @Test
    void reportsMissingLayoutWithoutFabricatingCapacityOrWritingSeats() {
        Showtime slot = showtime(1L); slot.setActive(false); slot.getAuditorium().setTotalRows(0);
        when(showtimes.findForOccupancyReport(null, null, null, null)).thenReturn(List.of(slot));
        var result = service.getOccupancyReport(null, null, null);
        assertEquals(0L, result.getTotalSeatsAvailable());
        assertEquals(0.0, result.getOverallOccupancyRate());
        assertEquals(1L, result.getShowtimesMissingCapacity());
        assertEquals(CapacitySource.UNCONFIGURED, result.getBreakdown().getFirst().getCapacitySource());
        assertFalse(result.getBreakdown().getFirst().getActive());
        verify(seats, never()).saveAll(any()); verify(physical, never()).saveAll(any());
    }

    @Test
    void occupancyPassesHistoricalDateAndBothIdsWithAnExclusiveEnd() {
        LocalDate date = LocalDate.of(2020, 1, 1);
        when(showtimes.findForOccupancyReport(4L, 5L, date.atStartOfDay(), date.plusDays(1).atStartOfDay())).thenReturn(List.of());
        service.getOccupancyReport(5L, 4L, date);
        verify(showtimes).findForOccupancyReport(4L, 5L, date.atStartOfDay(), date.plusDays(1).atStartOfDay());
        verifyNoMoreInteractions(showtimes);
    }

    @Test
    void revenueMovieGroupsAndKpiUseTheSameFilteredResultIncludingTicketCounts() {
        LocalDate date = LocalDate.of(2026, 11, 10);
        var rows = List.of(group(3L, "Phim", "240000", 1, 2), group(4L, "Phim", "300000", 2, 3));
        when(bookings.calculateRevenueByMovie(date.atStartOfDay(), date.plusDays(1).atStartOfDay(), 2L, null))
                .thenReturn(rows);
        var result = service.getRevenueReport(date, date, 2L, null, " MOVIE ");
        assertEquals(new BigDecimal("540000"), result.getTotalRevenue());
        assertEquals(3L, result.getTotalSuccessfulBookings()); assertEquals(5L, result.getTotalTicketsSold());
        assertNotEquals(result.getBreakdown().get(0).getId(), result.getBreakdown().get(1).getId());
        assertEquals(2L, result.getBreakdown().get(0).getTicketCount());
        verify(bookings).calculateRevenueByMovie(date.atStartOfDay(), date.plusDays(1).atStartOfDay(), 2L, null);
        verifyNoMoreInteractions(bookings);
    }

    @Test
    void cinemaGroupsApplyBothFiltersAndEmptyGroupTotalsAreZero() {
        when(bookings.calculateRevenueByCinema(null, null, 2L, 3L)).thenReturn(List.of());
        var result = service.getRevenueReport(null, null, 2L, 3L, "cinema");
        assertEquals(BigDecimal.ZERO, result.getTotalRevenue());
        assertEquals(0L, result.getTotalTicketsSold()); assertEquals(0L, result.getTotalSuccessfulBookings());
        verify(bookings).calculateRevenueByCinema(null, null, 2L, 3L); verifyNoMoreInteractions(bookings);
    }

    @Test
    void noGroupingReturnsTheSummaryWithoutLoadingEveryBookingOrBuildingGroups() {
        RevenueTotals totals = mock(RevenueTotals.class);
        when(totals.getRevenue()).thenReturn(BigDecimal.TEN); when(totals.getBookingCount()).thenReturn(1L); when(totals.getTicketCount()).thenReturn(2L);
        when(bookings.summarizeRevenue(null, null, null, null)).thenReturn(totals);
        var result = service.getRevenueReport(null, null, null, null, null);
        assertEquals(BigDecimal.TEN, result.getTotalRevenue()); assertEquals(2L, result.getTotalTicketsSold());
        assertTrue(result.getBreakdown().isEmpty());
        verify(bookings).summarizeRevenue(null, null, null, null); verifyNoMoreInteractions(bookings);
    }

    @Test
    void rejectsReversedDatesUnknownGroupsAndInvalidIdsBeforeReadingRepositories() {
        assertThrows(BadRequestException.class, () -> service.getRevenueReport(LocalDate.of(2026, 11, 11), LocalDate.of(2026, 11, 10), null, null, "movie"));
        assertThrows(BadRequestException.class, () -> service.getRevenueReport(null, null, null, null, "day"));
        assertThrows(BadRequestException.class, () -> service.getRevenueReport(null, null, -1L, null, "none"));
        assertThrows(BadRequestException.class, () -> service.getOccupancyReport(null, 0L, null));
        verifyNoInteractions(bookings, showtimes, seats, physical);
    }

    private RevenueGroup group(long id, String label, String revenue, long orders, long tickets) {
        var row = mock(RevenueGroup.class);
        when(row.getId()).thenReturn(id); when(row.getLabel()).thenReturn(label); when(row.getRevenue()).thenReturn(new BigDecimal(revenue));
        when(row.getBookingCount()).thenReturn(orders); when(row.getTicketCount()).thenReturn(tickets); return row;
    }

    private Showtime showtime(long id) {
        return Showtime.builder().id(id).movie(Movie.builder().id(id).title("Phim " + id).build())
                .auditorium(Auditorium.builder().id(id).name("Phòng " + id).totalRows(10).totalCols(12)
                        .cinema(Cinema.builder().id(1L).name("Rạp").build()).build())
                .startTime(LocalDateTime.of(2099, 1, 1, 10, 0)).build();
    }
}
