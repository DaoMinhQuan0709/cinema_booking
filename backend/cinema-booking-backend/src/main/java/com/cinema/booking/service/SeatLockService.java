package com.cinema.booking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.data.redis.core.script.DefaultRedisScript;

/**
 * Service chuyen biet xu ly lock/unlock ghe tren Redis (Tang 1 - Fast-Fail).
 *
 * Key pattern: seat_lock:{showtimeId}:{seatId}
 * Value: token rieng cua luot giu (khong tai su dung userId).
 * TTL: 600 giay (10 phut) - cau hinh qua application.yml
 *
 * Cac thao tac:
 * - lockSeats: Lock nguyen tu danh sach ghe, rollback neu co ghe bi trung
 * - unlockSeats: Nha ghe khi huy don hoac het han
 * - getLockedSeatIds: Read only the requested seats in one Redis command
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SeatLockService {

    private final StringRedisTemplate redisTemplate;

    private static final String KEY_PREFIX = "seat_lock:";

    @Value("${application.booking.hold-seat-duration-seconds:600}")
    private long holdDurationSeconds;

    /**
     * Lock nguyen tu danh sach ghe tren Redis.
     * Neu bat ky ghe nao da bi lock -> rollback tat ca key da set thanh cong -> return false.
     *
     * @param showtimeId  ID suat chieu
     * @param seatIds     Danh sach ShowtimeSeat IDs (DA DUOC SAP XEP TANG DAN)
     * @param token       Token rieng cua luot giu ghe
     * @return true neu lock thanh cong tat ca ghe, false neu co xung dot
     */
    public boolean lockSeats(Long showtimeId, List<Long> seatIds, String token) {
        if (token == null || token.isBlank()) throw new IllegalArgumentException("Hold token is required");
        List<String> lockedKeys = new ArrayList<>();
        try {
        for (Long seatId : seatIds) {
            String key = buildKey(showtimeId, seatId);

            // SET NX EX 600: Chi set neu key chua ton tai, voi TTL 600 giay
            Boolean success = redisTemplate.opsForValue()
                    .setIfAbsent(key, token, Duration.ofSeconds(holdDurationSeconds));

            if (Boolean.TRUE.equals(success)) {
                lockedKeys.add(key);
            } else {
                // Ghe da bi nguoi khac lock -> Rollback tat ca key da set
                rollbackKeys(lockedKeys, token);
                return false;
            }
        }

        return true;
        } catch (RuntimeException e) {
            try { rollbackKeys(lockedKeys, token); } catch (RuntimeException ignored) { /* Original TTL bounds a failed cleanup. */ }
            throw e;
        }
    }

    /**
     * Nha lock danh sach ghe tren Redis.
     * Dung khi huy don hoac don het han.
     *
     * @param showtimeId ID suat chieu
     * @param seatIds    Danh sach ShowtimeSeat IDs
     */
    public void unlockSeats(Long showtimeId, List<Long> seatIds, String token) {
        if (seatIds.isEmpty()) return;
        List<String> keys = seatIds.stream().map(seatId -> buildKey(showtimeId, seatId)).toList();
        rollbackKeys(keys, token);
    }

    /** Reads known seat keys with MGET instead of scanning the entire Redis keyspace. */
    public Set<Long> getLockedSeatIds(Long showtimeId, List<Long> seatIds) {
        if (seatIds.isEmpty()) return Set.of();
        List<String> keys = seatIds.stream().map(seatId -> buildKey(showtimeId, seatId)).toList();
        try {
            List<String> owners = redisTemplate.opsForValue().multiGet(keys);
            if (owners == null) return Set.of();
            Set<Long> locked = new HashSet<>();
            for (int index = 0; index < owners.size(); index++) {
                if (owners.get(index) != null) locked.add(seatIds.get(index));
            }
            return locked;
        } catch (RuntimeException ex) {
            log.warn("Cannot read Redis seat holds for showtimeId={}: {}", showtimeId, ex.getMessage());
            return Set.of();
        }
    }

    // ========== Private Methods ==========

    private String buildKey(Long showtimeId, Long seatId) {
        return KEY_PREFIX + showtimeId + ":" + seatId;
    }

    private void rollbackKeys(List<String> keys, String token) {
        if (keys.isEmpty() || token == null) return;
        var script = new DefaultRedisScript<Long>("local n=0; for _,k in ipairs(KEYS) do if redis.call('get',k)==ARGV[1] then n=n+redis.call('del',k) end end; return n", Long.class);
        redisTemplate.execute(script, keys, token);
    }
}
