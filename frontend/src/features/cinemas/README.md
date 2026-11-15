# Trang rạp chiếu phim

`/cinemas` là trang công khai dùng `MainLayout`, lazy-load từ `App.jsx`. Thiết kế được xác nhận ở [tài liệu thiết kế](../../../../docs/plans/2026-11-15-cinemas-design.md); tiến độ/kết quả ở [kế hoạch triển khai](../../../../cinemas-implementation.md).

- `CinemasPage.jsx`: tìm tên không dấu, lọc tỉnh/thành, URL/Back, đếm kết quả và loading/rỗng/lỗi/làm mới.
- `CinemaCard.jsx`: ảnh đại diện có fallback, tên/địa chỉ/tỉnh/thành, điện thoại và liên kết lịch bằng ID nội bộ.
- `cinemaUtils.js`: xử lý Unicode, sắp `displayOrder` rồi tên, giữ nhóm “Chưa xác định”, kiểm tra URL ảnh và số điện thoại.
- Dùng `cinemaService`/`useCinemas` hiện có; cache 30 phút dùng chung. Làm mới chủ động lấy lại API; lỗi làm mới giữ snapshot cũ có cảnh báo.
- Lọc trong danh sách đã tải, không gọi API mỗi ký tự. URL dùng `q`/`city`; nhập từ khóa replace lịch sử, đổi tỉnh/thành tạo điểm Back; giữ tham số không liên quan.
- Trang không gọi Galaxy, API sơ đồ ghế hoặc API ghi. Ảnh HTTP(S) lấy trực tiếp từ CDN nguồn, lazy-load và giữ tỷ lệ; thiếu metadata có thông báo dự phòng. Không hiển thị gallery, bản đồ hoặc giá vé.

Trang lịch chiếu kết hợp danh sách rạp trong catalog và trong các suất: rạp hợp lệ chưa có suất trong ngày vẫn được giữ trong select/URL. Khi metadata chưa có hoặc lỗi, ID đã chọn không tự bị bỏ để hiển thị lịch rạp khác. Rạp sai tỉnh/thành hoặc không tồn tại được chuẩn hóa khi đủ dữ liệu thành công.

## Kiểm thử lặp lại

Chạy tại thư mục `frontend`:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:cinemas-browser
npm.cmd run test:cinemas-live
```

`test:cinemas-browser`: Edge headless với bản production, REST/ảnh mô phỏng; bao phủ thành công, lỗi, cache, response chậm/sai cấu trúc, ảnh lỗi, URL/Back/Forward, 390px/Tab/Enter và lịch chưa có suất. Kết quả này không xác nhận backend/DB thật.

`test:cinemas-live`: Edge production với API localhost và ảnh CDN thật; chỉ cho GET/OPTIONS `/cinemas` và `/showtimes`. Cần backend đang chạy và dữ liệu rạp đã có. Không khởi động lại backend, gọi sync, tạo ghế/booking hoặc sửa DB. Mặc định API `http://localhost:8080/api/v1`; có thể đặt `CINEMAS_TEST_API_BASE` sang địa chỉ loopback/cổng khác.

Hai lệnh dùng cổng preview/debug riêng (4206/9239 và 4207/9240), profile Edge tạm, tự đóng tài nguyên do script tạo và lưu `results.json`/ảnh trong đường dẫn temp được in ra. Có thể đặt `ADMIN_EDGE_PATH` nếu Edge không ở vị trí mặc định. Build lại trước khi kiểm tra thay đổi giao diện. Số rạp/ID trong kết quả live là snapshot, không hardcode lên ứng dụng.
