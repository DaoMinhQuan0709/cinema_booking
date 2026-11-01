package com.cinema.booking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
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
 * - unlockSeat: Nha 1 ghe cu the
 * - isLocked: Kiem tra ghe co dang bi lock
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
        for (Long seatId : seatIds) {
            String key = buildKey(showtimeId, seatId);
            Boolean deleted = redisTemplate.delete(key);
            if (Boolean.TRUE.equals(deleted)) {
                log.debug("Redis UNLOCK: key={}", key);
            }
        }
        log.info("Redis UNLOCK {} ghe cho showtimeId={}", seatIds.size(), showtimeId);
    }

    /**
     * Nha lock 1 ghe cu the.
     */
    public void unlockSeat(Long showtimeId, Long seatId) {
        String key = buildKey(showtimeId, seatId);
        redisTemplate.delete(key);
        log.debug("Redis UNLOCK single: key={}", key);
    }

    /**
     * Kiem tra ghe co dang bi lock tren Redis.
     */
    public boolean isLocked(Long showtimeId, Long seatId) {
        String key = buildKey(showtimeId, seatId);
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    /**
     * Lay userId dang giu ghe (null neu chua bi lock).
     */
    public String getLockedByUserId(Long showtimeId, Long seatId) {
        String key = buildKey(showtimeId, seatId);
        return redisTemplate.opsForValue().get(key);
    }

    /**
     * Xoa tat ca key lock cua mot suat chieu (dung khi cleanup).
     */
    public void unlockAllForShowtime(Long showtimeId) {
        String pattern = KEY_PREFIX + showtimeId + ":*";
        Set<String> keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
            log.info("Redis UNLOCK ALL {} keys for showtimeId={}", keys.size(), showtimeId);
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
