-- PostgreSQL: chạy trong database/schema cinema_booking dùng cho phát triển/demo.
-- Điều kiện: bảng reviews đã được tạo; movies và users đã có dữ liệu.
-- Đánh giá GIẢ LẬP để thử giao diện/AI tóm tắt, không phải ý kiến khách hàng thật.
-- Script gắn dữ liệu demo vào tối đa 3 tài khoản CUSTOMER có sẵn.
-- Không dùng trên database vận hành thật.
-- Chọn tối đa 5 phim đã phát hành, chưa xóa và không ở trạng thái COMING_SOON.
-- Tối đa 15 đánh giá; bỏ qua mọi cặp phim/người dùng đã có đánh giá.
-- Không tạo tài khoản, phim, booking hay thay đổi đánh giá hiện có.

BEGIN;

-- reviews chưa có UNIQUE(movie_id, user_id); khóa để các lần chạy script không đua nhau.
LOCK TABLE reviews IN SHARE ROW EXCLUSIVE MODE;

WITH selected_movies AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS ordinal
    FROM movies
    WHERE deleted_at IS NULL
      AND release_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      AND status <> 'COMING_SOON'
    ORDER BY id
    LIMIT 5
), selected_users AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS ordinal
    FROM users
    WHERE role = 'CUSTOMER'
    ORDER BY id
    LIMIT 3
), samples(sample_no, rating, comment) AS (
    VALUES
        (1, 5, '[DEMO] Nhìn chung rất hài lòng. Nhịp kể cuốn hút, hình ảnh và âm thanh tạo trải nghiệm xem tốt.'),
        (2, 4, '[DEMO] Trải nghiệm khá tốt. Phần trình bày hấp dẫn, nhưng một vài đoạn chuyển cảnh có thể mượt hơn.'),
        (3, 3, '[DEMO] Phim ở mức ổn. Có điểm thú vị nhưng nhịp kể chưa đều, một số đoạn còn dài.'),
        (4, 2, '[DEMO] Chưa hợp kỳ vọng của tôi. Nhịp phim chậm và cách phát triển câu chuyện chưa thuyết phục.'),
        (5, 4, '[DEMO] Tôi thích hình ảnh và không khí của phim. Nội dung dễ theo dõi, dù phần kết hơi nhanh.'),
        (6, 1, '[DEMO] Trải nghiệm chưa phù hợp với sở thích của tôi. Khó theo dõi câu chuyện và chưa có nhiều cảm xúc.')
)
INSERT INTO reviews (movie_id, user_id, rating, comment, created_at)
SELECT m.id, u.id, s.rating, s.comment,
       CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh'
FROM selected_movies m
CROSS JOIN selected_users u
JOIN samples s ON s.sample_no = 1 + MOD(m.ordinal + u.ordinal - 2, 6)
WHERE NOT EXISTS (
    SELECT 1 FROM reviews existing
    WHERE existing.movie_id = m.id AND existing.user_id = u.id
);

COMMIT;

-- Nếu không thêm dòng nào: kiểm tra phim đã phát hành, tài khoản CUSTOMER,
-- schema đang chọn, hoặc các cặp phim/người dùng đã có đánh giá.
SELECT r.id, m.title, u.full_name, r.rating, r.comment, r.created_at
FROM reviews r
JOIN movies m ON m.id = r.movie_id
JOIN users u ON u.id = r.user_id
WHERE r.comment LIKE '[DEMO]%'
ORDER BY r.movie_id, r.user_id, r.id;
