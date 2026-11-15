package com.cinema.booking.dto.response;

import java.util.List;

public record DeletionPreviewResponse(String kind, Long id, String title, boolean deleted,
        int showtimeCount, List<Slot> showtimes, List<Blocker> blockers, boolean canDelete, String scopeToken) {
    public record Slot(Long id, String cinemaName, String auditoriumName, String startTime, String endTime) {}
    public record Blocker(String reason, long count, String message) {}
}
