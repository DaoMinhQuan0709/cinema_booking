package com.cinema.booking.dto.response;

import java.time.Instant;

public record GalaxySyncStatusResponse(boolean enabled, long intervalMs, boolean running,
                                       Instant lastAttemptAt, Instant lastSuccessAt, String lastError) {
}
