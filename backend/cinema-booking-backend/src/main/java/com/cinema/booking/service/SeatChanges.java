package com.cinema.booking.service;

import com.cinema.booking.entity.*;
import com.cinema.booking.enums.*;
import com.cinema.booking.repository.ShowtimeSeatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.*;
import java.util.*;

/** Callers lock the booking before changing its seats. Side effects are best effort after commit. */
@Component @RequiredArgsConstructor @Slf4j
public class SeatChanges {
    private final ShowtimeSeatRepository seats;
    private final SeatLockService locks;
    private final WebSocketService websocket;

    public static boolean owns(Booking b, ShowtimeSeat s) {
        if (s.getStatus() != ShowtimeSeatStatus.LOCKED) return false;
        if (b.getHoldToken() != null) return b.getHoldToken().equals(s.getLockToken());
        return s.getLockToken() == null && s.getLockedByUser() != null && s.getLockedByUser().getId().equals(b.getUser().getId())
                && Objects.equals(s.getLockedUntil(), b.getExpiresAt());
    }

    public void release(Booking b) {
        List<ShowtimeSeat> owned = lockedSeats(b).stream().filter(s -> owns(b, s)).toList();
        Map<Long, String> tokens = tokens(owned);
        owned.forEach(SeatChanges::clear);
        seats.flush();
        afterCommit(b.getShowtime().getId(), owned, tokens, null);
    }

    public List<ShowtimeSeat> lockedSeats(Booking b) {
        List<Long> ids = b.getBookingSeats().stream().map(s -> s.getShowtimeSeat().getId()).sorted().toList();
        return ids.isEmpty() ? List.of() : seats.findForUpdate(ids);
    }

    public static Map<Long, String> tokens(List<ShowtimeSeat> seats) {
        Map<Long, String> tokens = new HashMap<>();
        seats.forEach(s -> { if (s.getLockToken() != null) tokens.put(s.getId(), s.getLockToken()); });
        return tokens;
    }

    public static void clear(ShowtimeSeat s) {
        s.setStatus(ShowtimeSeatStatus.AVAILABLE); s.setLockedByUser(null); s.setLockedUntil(null); s.setLockToken(null);
    }

    public void releaseOnRollback(Long showtime, List<Long> ids, String token) {
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) safe(() -> locks.unlockSeats(showtime, ids, token));
            }
        });
    }

    public void afterCommit(Long showtime, List<ShowtimeSeat> changed, Map<Long, String> unlockTokens, Runnable extra) {
        Runnable effect = () -> {
            unlockTokens.forEach((id, token) -> safe(() -> locks.unlockSeats(showtime, List.of(id), token)));
            if (!changed.isEmpty()) safe(() -> websocket.broadcastSnapshots(showtime, changed));
            if (extra != null) safe(extra);
        };
        if (!TransactionSynchronizationManager.isSynchronizationActive()) throw new IllegalStateException("Seat changes require a transaction");
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { effect.run(); }
        });
    }

    private void safe(Runnable action) {
        try { action.run(); } catch (Exception e) { log.warn("Post-commit seat synchronization failed: {}", e.getClass().getSimpleName()); }
    }
}
