# Triển khai Checkout

Thiết kế: [Checkout](docs/plans/2026-11-09-checkout-design.md).
Hướng giao diện: vé điện ảnh tối/đỏ, tóm tắt vé và countdown nổi bật;
font/token hiện có, nhịp khoảng cách 4/8px, chuyển động tối thiểu.
DFII: impact 3 + fit 5 + feasibility 4 + performance 4 - consistency risk 2 = 14.

- [x] Clock, revision, DTO và PUT combo → quyền, giá, phiên bản, không gia hạn.
- [x] Lưu attempt và tạo URL an toàn → chống gửi lặp, UNKNOWN, bỏ fallback MoMo.
- [x] Đồng bộ cancel/IPN/expiry → khóa đúng thứ tự, side effect sau commit, token ghế.
- [x] Route Checkout và điều hướng giữ ghế → không tạo đơn lặp khi tiếp tục.
- [x] Combo, giá mới, countdown server, thanh toán/hủy → desktop/mobile và trạng thái lỗi.
- [x] Migration, hướng dẫn chạy và kế hoạch frontend → phân biệt việc đã làm/chưa kiểm chứng.
- [x] Kiểm chứng cuối → 33 backend (có PostgreSQL/Redis thật), 56 frontend, lint/build, 12 luồng Edge mô phỏng.

Không commit/push; không sửa file cấu hình chứa thông tin riêng.
Chưa gọi merchant Sandbox thật hoặc áp dụng migration vào schema dữ liệu ứng dụng.
Hướng dẫn: [CHECKOUT.md](backend/cinema-booking-backend/CHECKOUT.md).
