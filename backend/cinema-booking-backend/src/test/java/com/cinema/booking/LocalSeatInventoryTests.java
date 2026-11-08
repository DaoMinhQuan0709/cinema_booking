package com.cinema.booking;

import com.cinema.booking.entity.*;
import com.cinema.booking.enums.SeatType;
import com.cinema.booking.enums.ShowtimeSeatStatus;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.repository.*;
import com.cinema.booking.service.LocalSeatInventoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LocalSeatInventoryTests {
    private ShowtimeRepository showtimes;
    private AuditoriumRepository rooms;
    private SeatRepository seats;
    private ShowtimeSeatRepository inventory;
    private LocalSeatInventoryService service;
    private Auditorium room;
    private Showtime showtime;
    private List<Seat> physical;
    private Map<Long, List<ShowtimeSeat>> stored;

    @BeforeEach
    void setUp() {
        showtimes = mock(ShowtimeRepository.class);
        rooms = mock(AuditoriumRepository.class);
        seats = mock(SeatRepository.class);
        inventory = mock(ShowtimeSeatRepository.class);
        service = new LocalSeatInventoryService(showtimes, rooms, seats, inventory);
        room = Auditorium.builder().id(10L).totalRows(10).totalCols(12).build();
        showtime = Showtime.builder().id(1L).auditorium(room).startTime(LocalDateTime.of(2099, 11, 8, 10, 0))
                .basePrice(BigDecimal.valueOf(80000)).build();
        physical = new ArrayList<>();
        stored = new HashMap<>();
        AtomicLong ids = new AtomicLong(100);
        when(showtimes.findByIdForSeatInitialization(1L)).thenReturn(Optional.of(showtime));
        when(rooms.findByIdForSeatInitialization(10L)).thenReturn(Optional.of(room));
        when(seats.findByAuditoriumIdOrderByRowCharAscSeatNumberAsc(10L)).thenAnswer(i -> new ArrayList<>(physical));
        when(seats.saveAll(anyList())).thenAnswer(i -> {
            List<Seat> created = i.getArgument(0);
            created.forEach(seat -> seat.setId(ids.incrementAndGet()));
            physical.addAll(created);
            return created;
        });
        when(inventory.findByShowtimeIdWithSeat(anyLong())).thenAnswer(i -> stored.getOrDefault(i.getArgument(0), List.of()));
        when(inventory.saveAll(anyList())).thenAnswer(i -> {
            List<ShowtimeSeat> created = i.getArgument(0);
            created.forEach(seat -> seat.setId(ids.incrementAndGet()));
            stored.put(created.getFirst().getShowtime().getId(), created);
            return created;
        });
    }

    @Test
    void firstAccessCreatesOnlyTheRequestedShowtimeAndReturnsGeneratedIds() {
        var result = service.getOrCreateSeats(1L);
        assertEquals(120, physical.size());
        assertEquals(120, result.size());
        assertEquals(Set.of(1L), stored.keySet());
        assertTrue(result.stream().allMatch(s -> s.getId() != null && s.getStatus() == ShowtimeSeatStatus.AVAILABLE));
        assertEquals(BigDecimal.valueOf(100000), result.get(48).getPrice());
        assertEquals(BigDecimal.valueOf(120000), result.get(108).getPrice());
        var order = inOrder(showtimes, rooms, seats, inventory);
        order.verify(inventory).findByShowtimeIdWithSeat(1L);
        order.verify(showtimes).findByIdForSeatInitialization(1L);
        order.verify(inventory).findByShowtimeIdWithSeat(1L);
        order.verify(rooms).findByIdForSeatInitialization(10L);
        order.verify(seats).findByAuditoriumIdOrderByRowCharAscSeatNumberAsc(10L);
    }

    @Test
    void repeatedAccessPreservesBookedSeatsHoldsPricesAndVersion() {
        var first = service.getOrCreateSeats(1L);
        first.get(0).setStatus(ShowtimeSeatStatus.BOOKED);
        ShowtimeSeat held = first.get(1);
        User owner = User.builder().id(5L).build();
        LocalDateTime expires = LocalDateTime.of(2099, 11, 8, 9, 55);
        held.setStatus(ShowtimeSeatStatus.LOCKED);
        held.setLockedByUser(owner);
        held.setLockedUntil(expires);
        held.setPrice(BigDecimal.valueOf(90000));
        held.setVersion(7);
        var second = service.getOrCreateSeats(1L);
        assertSame(first, second);
        assertEquals(ShowtimeSeatStatus.BOOKED, second.get(0).getStatus());
        assertEquals(ShowtimeSeatStatus.LOCKED, held.getStatus());
        assertSame(owner, held.getLockedByUser());
        assertEquals(expires, held.getLockedUntil());
        assertEquals(BigDecimal.valueOf(90000), held.getPrice());
        assertEquals(7, held.getVersion());
        verify(seats, times(1)).saveAll(anyList());
        verify(inventory, times(1)).saveAll(anyList());
        verify(showtimes, times(1)).findByIdForSeatInitialization(1L);
    }

    @Test
    void requestWaitingForInitializationLockReusesInventoryCreatedByAnotherRequest() {
        ShowtimeSeat booked = ShowtimeSeat.builder().id(40L).showtime(showtime)
                .status(ShowtimeSeatStatus.BOOKED).build();
        when(inventory.findByShowtimeIdWithSeat(1L)).thenReturn(List.of(), List.of(booked));
        var result = service.getOrCreateSeats(1L);
        assertEquals(40L, result.getFirst().getId());
        assertEquals(ShowtimeSeatStatus.BOOKED, result.getFirst().getStatus());
        verify(showtimes).findByIdForSeatInitialization(1L);
        verifyNoInteractions(rooms, seats);
        verify(inventory, never()).saveAll(anyList());
    }

    @Test
    void differentShowtimeReusesPhysicalRoomSeats() {
        service.getOrCreateSeats(1L);
        Showtime other = Showtime.builder().id(2L).auditorium(room).basePrice(BigDecimal.valueOf(80000))
                .startTime(LocalDateTime.of(2099, 11, 8, 13, 0)).build();
        when(showtimes.findByIdForSeatInitialization(2L)).thenReturn(Optional.of(other));
        assertEquals(120, service.getOrCreateSeats(2L).size());
        assertEquals(120, physical.size());
        assertEquals(2, stored.size());
        verify(seats, times(1)).saveAll(anyList());
    }

    @Test
    void existingCustomLayoutIsReusedAndInactiveSeatsAreExcluded() {
        physical.add(Seat.builder().id(20L).rowChar("B").seatNumber(3).type(SeatType.VIP).isActive(true).build());
        physical.add(Seat.builder().id(21L).rowChar("B").seatNumber(4).type(SeatType.STANDARD).isActive(false).build());
        var result = service.getOrCreateSeats(1L);
        assertEquals(1, result.size());
        assertEquals(20L, result.getFirst().getSeat().getId());
        verify(seats, never()).saveAll(anyList());
    }

    @Test
    void inactiveOrPastShowtimeCannotCreateInventory() {
        showtime.setActive(false);
        assertThrows(AppException.class, () -> service.getOrCreateSeats(1L));
        showtime.setActive(true);
        showtime.setStartTime(LocalDateTime.of(2000, 1, 1, 10, 0));
        assertThrows(AppException.class, () -> service.getOrCreateSeats(1L));
        verifyNoInteractions(rooms, seats);
        verify(inventory, never()).saveAll(anyList());
    }
}
