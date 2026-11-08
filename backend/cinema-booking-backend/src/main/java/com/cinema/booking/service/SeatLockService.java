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

/**
 * Service chuyen biet xu ly lock/unlock ghe tren Redis (Tang 1 - Fast-Fail).
 *
 * Key pattern: seat_lock:{showtimeId}:{seatId}
 * Value: userId (de biet ai dang giu ghe)
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
     * @param userId      ID nguoi dung dang giu ghe
     * @return true neu lock thanh cong tat ca ghe, false neu co xung dot
     */
    public boolean lockSeats(Long showtimeId, List<Long> seatIds, Long userId) {
        List<String> lockedKeys = new ArrayList<>();
        String userIdStr = userId.toString();

        for (Long seatId : seatIds) {
            String key = buildKey(showtimeId, seatId);

            // SET NX EX 600: Chi set neu key chua ton tai, voi TTL 600 giay
            Boolean success = redisTemplate.opsForValue()
                    .setIfAbsent(key, userIdStr, Duration.ofSeconds(holdDurationSeconds));

            if (Boolean.TRUE.equals(success)) {
                lockedKeys.add(key);
                log.debug("Redis LOCK thanh cong: key={}, userId={}", key, userId);
            } else {
                // Ghe da bi nguoi khac lock -> Rollback tat ca key da set
                log.warn("Redis LOCK that bai (ghe da bi giu): key={}, userId={}", key, userId);
                rollbackKeys(lockedKeys);
                return false;
            }
        }

        log.info("Redis LOCK thanh cong tat ca {} ghe cho showtimeId={}, userId={}",
                seatIds.size(), showtimeId, userId);
        return true;
    }

    /**
     * Nha lock danh sach ghe tren Redis.
     * Dung khi huy don hoac don het han.
     *
     * @param showtimeId ID suat chieu
     * @param seatIds    Danh sach ShowtimeSeat IDs
     */
    public void unlockSeats(Long showtimeId, List<Long> seatIds) {
        if (seatIds.isEmpty()) return;
        List<String> keys = seatIds.stream().map(seatId -> buildKey(showtimeId, seatId)).toList();
        redisTemplate.delete(keys);
        log.info("Redis UNLOCK {} ghe cho showtimeId={}", seatIds.size(), showtimeId);
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

    private void rollbackKeys(List<String> keys) {
        if (!keys.isEmpty()) {
            redisTemplate.delete(keys);
            log.info("Redis ROLLBACK {} keys da lock truoc do", keys.size());
        }
    }
}
