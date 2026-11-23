package com.cinema.booking.service;

import com.cinema.booking.dto.response.DeletionPreviewResponse;
import com.cinema.booking.exception.AppException;
import com.cinema.booking.repository.UserRepository;
import com.cinema.booking.enums.UserRole;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;

@Service
@RequiredArgsConstructor
public class AdminDeletionService {
    private final EntityManager em;
    private final CatalogGuard guard;
    private final UserRepository users;
    private final Clock clock;
    private final AdminDeletionPreviewReader previewReader;

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public DeletionPreviewResponse preview(String kind, Long id, String email) {
        actor(email);
        return previewReader.read(kind, id);
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
        DeletionPreviewResponse current = previewReader.read(kind, id);
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
        return previewReader.read(kind, id);
    }

    private Long actor(String email) {
        var user = users.findByEmail(email).orElseThrow(() -> new AppException(401, "Phiên đăng nhập không hợp lệ."));
        if (user.getRole() != UserRole.ADMIN) throw new AppException(403, "Chỉ ADMIN được xóa dữ liệu.");
        return user.getId();
    }
}
