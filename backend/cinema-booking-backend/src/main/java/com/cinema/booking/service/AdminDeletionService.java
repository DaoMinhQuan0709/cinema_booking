package com.cinema.booking.service;

import com.cinema.booking.dto.response.DeletionPreviewResponse;
import com.cinema.booking.dto.response.DeletionPreviewResponse.*;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.exception.ResourceNotFoundException;
import com.cinema.booking.repository.UserRepository;
import com.cinema.booking.enums.UserRole;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminDeletionService {
    private final EntityManager em;
    private final CatalogGuard guard;
    private final UserRepository users;
    private final Clock clock;

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public DeletionPreviewResponse preview(String kind, Long id, String email) {
        actor(email);
        return snapshot(kind, id);
    }

    @Transactional
    public DeletionPreviewResponse delete(String kind, Long id, String token, String email) {
        Long actor = actor(email);
        guard.catalogWrite();
        if (kind.equals("movies")) {
            guard.movie(id, true, true);
            em.createNativeQuery("select id from showtimes where movie_id=:id order by id for update")
                    .setParameter("id", id).getResultList();
        } else guard.showtime(id, true, true);
        DeletionPreviewResponse current = snapshot(kind, id);
        if (current.deleted()) return current;
        if (token == null || token.isBlank()) throw new AppException(428, "Hãy kiểm tra phạm vi trước khi xác nhận xóa.");
        if (!current.scopeToken().equals(token)) throw new AppException(412, "Phạm vi xóa đã thay đổi. Hãy kiểm tra và xác nhận lại.");
        if (!current.canDelete()) throw new com.cinema.booking.exception.DeletionBlockedException(current);
        var now = clock.instant();
        String condition = kind.equals("movies") ? "movie_id=:id" : "id=:id";
        em.createNativeQuery("update showtimes set deleted_at=:now, deleted_by_user_id=:actor, is_active=false where "
                + condition + " and deleted_at is null").setParameter("now", now).setParameter("actor", actor).setParameter("id", id).executeUpdate();
        if (kind.equals("movies")) em.createNativeQuery("update movies set deleted_at=:now, deleted_by_user_id=:actor where id=:id and deleted_at is null")
                .setParameter("now", now).setParameter("actor", actor).setParameter("id", id).executeUpdate();
        em.clear();
        return snapshot(kind, id);
    }

    private Long actor(String email) {
        var user = users.findByEmail(email).orElseThrow(() -> new AppException(401, "Phiên đăng nhập không hợp lệ."));
        if (user.getRole() != UserRole.ADMIN) throw new AppException(403, "Chỉ ADMIN được xóa dữ liệu.");
        return user.getId();
    }

    private DeletionPreviewResponse snapshot(String kind, Long id) {
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
        List<Slot> slots = rows.stream().map(item -> { Object[] r = (Object[]) item;
            return new Slot(((Number) r[0]).longValue(), (String) r[1], (String) r[2], r[3].toString(), r[4].toString()); }).toList();
        String bookingScope = " from bookings b join showtimes s on s.id=b.showtime_id where " + scope;
        List<Blocker> blockers = new ArrayList<>();
        add(blockers, "CONFIRMED", count("select count(*)" + bookingScope + " and b.status='CONFIRMED'", id), "Có vé đã xác nhận; không được xóa theo quy tắc hiện tại.");
        add(blockers, "PENDING", count("select count(*)" + bookingScope + " and b.status='PENDING'", id), "Có đơn chờ thanh toán; cần xử lý trạng thái đơn trước khi xóa.");
        add(blockers, "PAYMENT", count("select count(*)" + bookingScope + " and (exists (select 1 from payment_attempts p where p.booking_id=b.id and p.outcome in ('PENDING','SUCCESS','REFUND_REQUIRED'))"
                + " or exists (select 1 from payments p where p.booking_id=b.id and p.status in ('PENDING','SUCCESS','REFUND_REQUIRED')))" , id), "Có thanh toán chưa giải quyết hoặc tiền cần đối soát; không thể xóa.");
        String fingerprint = kind + ":" + id + ":" + root[0] + ":" + deleted + ":" + slots;
        String token;
        try { token = "\"" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(fingerprint.getBytes(StandardCharsets.UTF_8))) + "\""; }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
        return new DeletionPreviewResponse(kind, id, (String) root[0], deleted, slots.size(), slots, blockers, !deleted && blockers.isEmpty(), token);
    }

    private long count(String sql, Long id) { return ((Number) em.createNativeQuery(sql).setParameter("id", id).getSingleResult()).longValue(); }
    private void add(List<Blocker> target, String reason, long count, String message) { if (count > 0) target.add(new Blocker(reason, count, message)); }
}
