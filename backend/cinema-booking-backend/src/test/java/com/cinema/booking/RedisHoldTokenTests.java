package com.cinema.booking;

import com.cinema.booking.service.SeatLockService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "CINEMA_TEST_REDIS", matches = "true")
class RedisHoldTokenTests {
    @Test void aDelayedOldReleaseCannotDeleteANewerHoldAndPartialAcquisitionIsRolledBack() {
        String host = System.getenv().getOrDefault("CINEMA_TEST_REDIS_HOST", "127.0.0.1");
        int port = Integer.parseInt(System.getenv().getOrDefault("CINEMA_TEST_REDIS_PORT", "6379"));
        var connection = new LettuceConnectionFactory(host, port); connection.afterPropertiesSet(); connection.start();
        var redis = new StringRedisTemplate(connection);
        var service = new SeatLockService(redis); ReflectionTestUtils.setField(service, "holdDurationSeconds", 30L);
        long showtime = 8000000000000000000L + Math.abs(UUID.randomUUID().getLeastSignificantBits() % 1000000000L);
        String key1 = "seat_lock:" + showtime + ":1", key2 = "seat_lock:" + showtime + ":2";
        try {
            assertTrue(service.lockSeats(showtime, List.of(1L), "old-attempt"));
            redis.opsForValue().set(key1, "new-attempt", Duration.ofSeconds(30));
            service.unlockSeats(showtime, List.of(1L), "old-attempt");
            assertEquals("new-attempt", redis.opsForValue().get(key1));
            service.unlockSeats(showtime, List.of(1L), "new-attempt"); assertNull(redis.opsForValue().get(key1));
            redis.opsForValue().set(key2, "other-attempt", Duration.ofSeconds(30));
            assertFalse(service.lockSeats(showtime, List.of(1L, 2L), "partial-attempt"));
            assertNull(redis.opsForValue().get(key1)); assertEquals("other-attempt", redis.opsForValue().get(key2));
        } finally { redis.delete(List.of(key1,key2)); connection.destroy(); }
    }
}
