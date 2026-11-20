-- PostgreSQL: chạy trong database/schema của cinema_booking.
-- Dữ liệu demo do dự án tự quản lý; giá tính bằng VND, không phải giá Galaxy.
-- Không tạo booking_products: bảng đó được ứng dụng ghi khi khách chọn sản phẩm.
-- Không gán ID cố định; chạy lại không thêm sản phẩm trùng tên và không sửa giá cũ.
-- image_url để NULL cho đến khi có ảnh sản phẩm thực tế.

BEGIN;

-- Ngăn hai lần chạy script cùng thêm một sản phẩm vì name chưa có UNIQUE.
LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO products (name, description, price, image_url, is_available)
SELECT seed.name, seed.description, seed.price, NULL, TRUE
FROM (VALUES
    ('Bắp rang bơ vừa', 'Một phần bắp rang bơ cỡ vừa.', 45000.00),
    ('Bắp rang bơ lớn', 'Một phần bắp rang bơ cỡ lớn.', 55000.00),
    ('Bắp caramel lớn', 'Một phần bắp phủ caramel cỡ lớn.', 65000.00),
    ('Nước ngọt vừa', 'Một ly nước ngọt cỡ vừa; chọn hương vị tại quầy.', 30000.00),
    ('Nước ngọt lớn', 'Một ly nước ngọt cỡ lớn; chọn hương vị tại quầy.', 35000.00),
    ('Nước suối', 'Một chai nước suối 500 ml.', 20000.00),
    ('Combo Solo', 'Một bắp rang bơ vừa và một nước ngọt vừa.', 69000.00),
    ('Combo Couple', 'Một bắp rang bơ lớn và hai nước ngọt vừa.', 109000.00),
    ('Combo Caramel', 'Một bắp caramel lớn và hai nước ngọt vừa.', 119000.00),
    ('Combo Friends', 'Hai bắp rang bơ lớn và ba nước ngọt vừa.', 179000.00)
) AS seed(name, description, price)
WHERE NOT EXISTS (
    SELECT 1 FROM products existing WHERE existing.name = seed.name
);

COMMIT;

SELECT id, name, price, is_available FROM products ORDER BY id;
