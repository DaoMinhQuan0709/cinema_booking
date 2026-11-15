# Triển khai trang rạp chiếu phim

Thiết kế đã được người dùng xác nhận; ngày 15/11/2026 yêu cầu lưu tài liệu, lập kế hoạch và triển khai. Git ban đầu sạch tại `471be34`; bảo toàn phần đồng bộ rạp đã có.

Mục tiêu: `/cinemas` là danh bạ rạp công khai có ảnh, tìm tên, lọc tỉnh/thành và liên kết đúng rạp sang lịch chiếu. Không thêm thư viện, thay schema hoặc gọi Galaxy khi mở trang.

- [x] 1. Lưu thiết kế, giả định và quyết định vào `docs/plans/2026-11-15-cinemas-design.md` → đối chiếu phạm vi A đã xác nhận.
- [x] 2. Thêm hàm xử lý tìm/lọc, URL, ảnh và điện thoại trong `features/cinemas` → kiểm tra dữ liệu thiếu, tên tiếng Việt, thứ tự và ID nội bộ.
- [x] 3. Tạo `CinemasPage.jsx`, `CinemaCard.jsx`; dùng service/query hiện có → kiểm tra bố cục, tải/rỗng/lỗi, thử lại và ảnh dự phòng.
- [x] 4. Nối lazy route trong `App.jsx`, đổi tên menu Header → mở trực tiếp `/cinemas`, giữ MainLayout và các route hiện có.
- [x] 5. Sửa bộ lọc lịch chiếu để giữ rạp trong catalog dù chưa có suất → kiểm tra ngày khác, rạp sai tỉnh/thành và lỗi metadata.
- [x] 6. Thêm kiểm thử logic và kịch bản Edge tái chạy được → bao phủ URL/Back, bộ lọc, cache, lỗi/ảnh thiếu, bàn phím/mobile và luồng sang lịch.
- [x] 7. Kiểm chứng cuối: lint, unit test, production build, Edge với REST mô phỏng và Edge với API thật chỉ đọc → ghi riêng kết quả, ảnh chụp và giới hạn vào kế hoạch/tài liệu.

Hoàn tất khi trang dùng metadata thật, thao tác lọc không gọi API mỗi ký tự, lịch chiếu không tự đổi sang tất cả rạp khi rạp đã chọn chưa có suất, các kiểm tra liên quan đạt và không sửa DB vận hành.

Kết quả ngày 15/11/2026:

- Lint, production build (2904 module), **104/104 unit test** đạt; `git diff --check` và kiểm tra cú pháp script đạt.
- **Mô phỏng riêng:** Edge production đạt **15 nhóm**, 22 REST request, 0 lỗi runtime. Báo cáo/ảnh: `%TEMP%\cinema-cinemas-mock-GlEPzK` (`results.json`, `cinemas-mobile-mock.png`).
- **API thật chỉ đọc:** Edge production đạt **5 nhóm**, đối chiếu 33 rạp, ảnh CDN thật, tìm/lọc/làm mới, 390px/reload và rạp ID 10 chưa có suất vẫn giữ lựa chọn; 0 lỗi runtime. Báo cáo/ảnh: `%TEMP%\cinema-cinemas-live-o6Dg5A` (`results.json`, `cinemas-desktop-live.png`, `cinemas-mobile-live.png`). Không tạo ghế/booking hoặc gọi sync.
- Hướng dẫn chạy lại: [README trang rạp](frontend/src/features/cinemas/README.md). Metadata tỉnh/thành còn 7 rạp “Chưa xác định”; giao diện giữ nhóm này. Không sửa backend/schema/DB vận hành, không thêm dependency; mã giữ ở working tree, chưa commit.
