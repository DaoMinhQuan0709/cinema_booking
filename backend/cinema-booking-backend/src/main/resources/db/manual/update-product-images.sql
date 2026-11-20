-- Chạy bằng Query Tool trong database/schema cinema_booking.
-- Ghép theo tên sản phẩm trong seed-products.sql, không phụ thuộc ID.
-- Giữ đúng chữ hoa/thường của tên file để dùng được cả trên Linux.
-- Sản phẩm "Bắp caramel lớn" hiện dùng ảnh bap_caramel_vua.png có sẵn.
-- Đường dẫn /images/... được phục vụ bởi backend Spring Boot.

BEGIN;

UPDATE products AS p
SET image_url = images.image_url
FROM (VALUES
    ('Bắp rang bơ vừa', '/images/Bap_rang_bo_vua.png'),
    ('Bắp rang bơ lớn', '/images/bap_rang_bo_lon.png'),
    ('Bắp caramel lớn', '/images/bap_caramel_vua.png'),
    ('Nước ngọt vừa', '/images/nuoc_ngot_vua.png'),
    ('Nước ngọt lớn', '/images/nuoc_ngot_lon.png'),
    ('Nước suối', '/images/nuoc_suoi.png'),
    ('Combo Solo', '/images/combo_solo.png'),
    ('Combo Couple', '/images/combo_couple.png'),
    ('Combo Caramel', '/images/combo_caramel.png'),
    ('Combo Friends', '/images/combo_friends.png')
) AS images(name, image_url)
WHERE p.name = images.name
RETURNING p.id, p.name, p.image_url;

COMMIT;
