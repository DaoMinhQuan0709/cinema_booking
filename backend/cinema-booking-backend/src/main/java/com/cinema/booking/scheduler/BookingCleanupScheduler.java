package com.cinema.booking.scheduler;

import com.cinema.booking.service.BookingCleanupService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Background Cleaner Scheduler (Cronjob - Cong viec 4.3).
 *
 * Chay dinh ky moi 30 giay (cau hinh qua application.booking.cleanup-cron-rate-ms):
 * 1. Quet va xu ly cac don dat ve PENDING da het han (expires_at < NOW()).
 * 2. Quet phong ve giai phong cac ghe LOCKED mo coi.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookingCleanupScheduler {

    private final BookingCleanupService bookingCleanupService;

    /**
     * Chay dinh ky moi 30s, bat dau sau 10s khi server khoi dong.
     */
    @Scheduled(fixedRateString = "${application.booking.cleanup-cron-rate-ms:30000}", initialDelay = 10000)
    public void runBookingCleanupJob() {
        log.debug("BookingCleanupScheduler: Bat dau chu ky quet don het han...");

        try {
            int expiredCount = bookingCleanupService.cleanupExpiredBookings();
            int orphanedCount = bookingCleanupService.cleanupOrphanedLockedSeats();

            if (expiredCount > 0 || orphanedCount > 0) {
                log.info("BookingCleanupScheduler: Hoan tat chu ky quet. Expired bookings: {}, Orphaned seats: {}",
                        expiredCount, orphanedCount);
            }
        } catch (Exception e) {
            log.error("BookingCleanupScheduler: Loi ngoai le trong qua trinh chay job: {}", e.getMessage(), e);
        }
    }
}