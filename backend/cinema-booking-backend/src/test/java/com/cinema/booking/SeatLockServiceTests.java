package com.cinema.booking;

import com.cinema.booking.service.SeatLockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SeatLockServiceTests {
    private StringRedisTemplate redis;
    private ValueOperations<String, String> values;
    private SeatLockService service;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        service = new SeatLockService(redis);
        ReflectionTestUtils.setField(service, "holdDurationSeconds", 600L);
    }

    @Test
    void readsRequestedSeatHoldsWithOneCommandAndNoKeyspaceScan() {
        List<String> keys = List.of("seat_lock:10:101", "seat_lock:10:102", "seat_lock:10:103");
        when(values.multiGet(keys)).thenReturn(Arrays.asList("7", null, "8"));
        assertEquals(Set.of(101L, 103L), service.getLockedSeatIds(10L, List.of(101L, 102L, 103L)));
        verify(values, times(1)).multiGet(keys);
        verify(redis, never()).keys(anyString());
    }

    @Test
    void emptySeatListDoesNotCallRedis() {
        assertTrue(service.getLockedSeatIds(10L, List.of()).isEmpty());
        service.unlockSeats(10L, List.of());
        verifyNoInteractions(values);
        verify(redis, never()).delete(anyCollection());
    }

    @Test
    void redisOutageKeepsDatabaseSeatMapReadable() {
        when(values.multiGet(anyCollection())).thenThrow(new RedisConnectionFailureException("offline"));
        assertTrue(service.getLockedSeatIds(10L, List.of(101L)).isEmpty());
    }

    @Test
    void unlocksRequestedSeatsInOneDeleteCommand() {
        service.unlockSeats(10L, List.of(101L, 102L));
        verify(redis).delete(List.of("seat_lock:10:101", "seat_lock:10:102"));
        verify(redis, never()).delete(anyString());
    }

    @Test
    void failedMultiSeatHoldReleasesOnlyKeysAcquiredByThisRequest() {
        when(values.setIfAbsent(anyString(), eq("7"), eq(Duration.ofSeconds(600))))
                .thenReturn(true, false);
        assertFalse(service.lockSeats(10L, List.of(101L, 102L, 103L), 7L));
        verify(redis).delete(List.of("seat_lock:10:101"));
        verify(values, never()).setIfAbsent(eq("seat_lock:10:103"), anyString(), any(Duration.class));
    }

    @Test
    void successfulHoldPreservesTenMinuteTtl() {
        when(values.setIfAbsent(anyString(), eq("7"), eq(Duration.ofSeconds(600)))).thenReturn(true);
        assertTrue(service.lockSeats(10L, List.of(101L, 102L), 7L));
        verify(values).setIfAbsent("seat_lock:10:101", "7", Duration.ofSeconds(600));
        verify(values).setIfAbsent("seat_lock:10:102", "7", Duration.ofSeconds(600));
        verify(redis, never()).delete(anyCollection());
    }
}
