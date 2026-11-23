package com.cinema.booking.service;

import com.cinema.booking.dto.response.DeletionPreviewResponse;
import com.cinema.booking.dto.response.DeletionPreviewResponse.Blocker;
import com.cinema.booking.dto.response.DeletionPreviewResponse.Slot;
import com.cinema.booking.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

/** Reads the deletion preview in the caller's transaction. */
@Component
@RequiredArgsConstructor
class AdminDeletionPreviewReader {
    private final EntityManager em;

    DeletionPreviewResponse read(String kind, Long id) {
        boolean movie = kind.equals("movies");
        String from = movie ? "movies m" : "showtimes s join movies m on m.id=s.movie_id";
        List<?> found = em.createNativeQuery("select m.title, " + (movie ? "m.deleted_at" : "s.deleted_at")
                + " from " + from + " where " + (movie ? "m.id" : "s.id") + "=:id").setParameter("id", id).getResultList();
        if (found.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy dữ liệu cần xóa.");
        Object[] root = (Object[]) found.getFirst();
        boolean deleted = root[1] != null;
        String scope = movie ? "s.movie_id=:id" : "s.id=:id";
        List<?> rows = em.createNativeQuery("select s.id, c.name, a.name, s.start_time, s.end_time from showtimes s "
                + "join auditoriums a on a.id=s.auditorium_id join cinemas c on c.id=a.cinema_id where "
                + scope + " and s.deleted_at is null order by s.id").setParameter("id", id).getResultList();
        List<Slot> slots = rows.stream().map(item -> {
            Object[] row = (Object[]) item;
            return new Slot(((Number) row[0]).longValue(), (String) row[1], (String) row[2],
                    row[3].toString(), row[4].toString());
        }).toList();

        String bookingScope = " from bookings b join showtimes s on s.id=b.showtime_id where " + scope;
        List<Blocker> blockers = new ArrayList<>();
        add(blockers, "CONFIRMED", count("select count(*)" + bookingScope + " and b.status='CONFIRMED'", id),
                "Có vé đã xác nhận; không được xóa theo quy tắc hiện tại.");
        add(blockers, "PENDING", count("select count(*)" + bookingScope + " and b.status='PENDING'", id),
                "Có đơn chờ thanh toán; cần xử lý trạng thái đơn trước khi xóa.");
        add(blockers, "PAYMENT",
                count("select count(*)" + bookingScope
                        + " and (exists (select 1 from payment_attempts p where p.booking_id=b.id and p.outcome in ('PENDING','SUCCESS','REFUND_REQUIRED'))"
                        + " or exists (select 1 from payments p where p.booking_id=b.id and p.status in ('PENDING','SUCCESS','REFUND_REQUIRED')))", id),
                "Có thanh toán chưa giải quyết hoặc tiền cần đối soát; không thể xóa.");

        String title = (String) root[0];
        String token = scopeToken(kind, id, title, deleted, slots);
        return new DeletionPreviewResponse(kind, id, title, deleted, slots.size(), slots, blockers,
                !deleted && blockers.isEmpty(), token);
    }

    private static String scopeToken(String kind, Long id, String title, boolean deleted, List<Slot> slots) {
        String fingerprint = kind + ":" + id + ":" + title + ":" + deleted + ":" + slots;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(fingerprint.getBytes(StandardCharsets.UTF_8));
            return "\"" + HexFormat.of().formatHex(digest) + "\"";
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private long count(String sql, Long id) {
        return ((Number) em.createNativeQuery(sql).setParameter("id", id).getSingleResult()).longValue();
    }

    private static void add(List<Blocker> target, String reason, long count, String message) {
        if (count > 0) target.add(new Blocker(reason, count, message));
    }
}
