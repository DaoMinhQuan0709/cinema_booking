package com.cinema.booking.service;

import com.cinema.booking.entity.*;
import com.cinema.booking.enums.*;
import com.cinema.booking.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;

@Service @RequiredArgsConstructor @Slf4j
public class BookingCleanupService {
    private final BookingRepository bookings;
    private final ShowtimeSeatRepository seats;
    private final CheckoutSupport checkout;
    private final SeatChanges changes;
    private final TransactionTemplate transactions;

    public int cleanupExpiredBookings() {
        int count = 0;
        for (String code : bookings.findExpiredCodes(checkout.now())) {
            try {
                Boolean expired = transactions.execute(tx -> {
                    Booking b = bookings.findByCodeForUpdate(code).orElse(null);
                    if (b == null || b.getStatus() != BookingStatus.PENDING || b.getExpiresAt().isAfter(checkout.now())) return false;
                    b.setStatus(BookingStatus.EXPIRED);
                    changes.release(b);
                    return true;
                });
                if (Boolean.TRUE.equals(expired)) count++;
            } catch (Exception e) { log.warn("Booking expiry failed: code={}, type={}", code, e.getClass().getSimpleName()); }
        }
        return count;
    }

    public int cleanupOrphanedLockedSeats() {
        int count = 0;
        // Candidate IDs only: every condition is checked again under a seat lock.
        for (Long id : seats.findExpiredLockedIds(checkout.now())) {
            try {
                Boolean released = transactions.execute(tx -> {
                    var locked = seats.findForUpdate(List.of(id));
                    if (locked.isEmpty()) return false;
                    ShowtimeSeat s = locked.getFirst();
                    if (s.getStatus() != ShowtimeSeatStatus.LOCKED || s.getLockedUntil() == null || s.getLockedUntil().isAfter(checkout.now())
                            || bookings.hasLiveHold(id, checkout.now())) return false;
                    Map<Long, String> tokens = SeatChanges.tokens(locked);
                    SeatChanges.clear(s); seats.flush();
                    changes.afterCommit(s.getShowtime().getId(), locked, tokens, null);
                    return true;
                });
                if (Boolean.TRUE.equals(released)) count++;
            } catch (Exception e) { log.warn("Orphan seat expiry failed: seat={}, type={}", id, e.getClass().getSimpleName()); }
        }
        return count;
    }
}
