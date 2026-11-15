package com.cinema.booking.service;

import com.cinema.booking.exception.AppException;
import com.cinema.booking.exception.ResourceNotFoundException;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

/** Khóa có hiệu lực tới cuối transaction; thứ tự phim -> suất -> đơn -> ghế. */
@Service
@RequiredArgsConstructor
public class CatalogGuard {
    private final EntityManager em;

    public void timeout() {
        em.createNativeQuery("select set_config('lock_timeout', '2000ms', true)", String.class).getSingleResult();
    }

    public void catalogWrite() {
        timeout();
        if (!Boolean.TRUE.equals(em.createNativeQuery("select pg_try_advisory_xact_lock(716305901)", Boolean.class).getSingleResult()))
            throw new AppException(409, "Danh mục đang được cập nhật hoặc đồng bộ. Vui lòng kiểm tra lại.");
    }

    public boolean movie(Long id, boolean write, boolean allowDeleted) {
        timeout();
        List<?> rows = em.createNativeQuery("select deleted_at is not null from movies where id=:id for "
                + (write ? "update" : "share"), Boolean.class).setParameter("id", id).getResultList();
        if (rows.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy phim.");
        boolean deleted = Boolean.TRUE.equals(rows.getFirst());
        if (deleted && !allowDeleted) throw new ResourceNotFoundException("Phim đã được xóa khỏi danh mục.");
        return deleted;
    }

    public boolean showtime(Long id, boolean write, boolean allowDeleted) {
        timeout();
        List<?> parents = em.createNativeQuery("select movie_id from showtimes where id=:id", Long.class)
                .setParameter("id", id).getResultList();
        if (parents.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy suất chiếu.");
        Long movieId = ((Number) parents.getFirst()).longValue();
        boolean deleted = movie(movieId, false, true);
        List<?> rows = em.createNativeQuery("select movie_id, deleted_at is not null from showtimes where id=:id for "
                + (write ? "update" : "share")).setParameter("id", id).getResultList();
        if (rows.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy suất chiếu.");
        Object[] row = (Object[]) rows.getFirst();
        if (((Number) row[0]).longValue() != movieId) throw new AppException(409, "Suất chiếu vừa đổi phim. Vui lòng kiểm tra lại.");
        deleted |= Boolean.TRUE.equals(row[1]);
        if (deleted && !allowDeleted) throw new ResourceNotFoundException("Phim hoặc suất chiếu đã được xóa.");
        return deleted;
    }

    public boolean booking(String code) {
        List<?> rows = em.createNativeQuery("select showtime_id from bookings where booking_code=:code", Long.class)
                .setParameter("code", code).getResultList();
        if (rows.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy đơn đặt vé.");
        return showtime(((Number) rows.getFirst()).longValue(), false, true);
    }

    public void syncMovies(java.util.Collection<String> ids, java.util.Collection<String> titles, boolean full) {
        timeout();
        em.createNativeQuery("select id from movies where galaxy_movie_id in (:ids) "
                + "or (galaxy_movie_id is null and title in (:titles)) or (:full and galaxy_movie_id is not null) order by id for update")
                .setParameter("ids", ids.isEmpty() ? List.of("") : ids)
                .setParameter("titles", titles.isEmpty() ? List.of("") : titles).setParameter("full", full).getResultList();
    }

    public void refresh(Object entity) { em.refresh(entity); }
}
