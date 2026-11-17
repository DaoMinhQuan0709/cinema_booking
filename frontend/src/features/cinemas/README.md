# Trang rạp chiếu phim

`/cinemas` và `/cinemas/:id` là các trang công khai dùng `MainLayout`, lazy-load từ `App.jsx`. Thiết kế danh sách được xác nhận ở [tài liệu thiết kế](../../../../docs/plans/2026-11-15-cinemas-design.md); tiến độ/kết quả ở [kế hoạch danh sách](../../../../cinemas-implementation.md) và [kế hoạch chi tiết](../../../../cinemas-detail-page-plan.md).

- `CinemasPage.jsx`: tìm tên không dấu, lọc tỉnh/thành, URL/Back, đếm kết quả và loading/rỗng/lỗi/làm mới.
- `CinemaCard.jsx`: ảnh đại diện có fallback, tên/địa chỉ/tỉnh/thành, điện thoại và liên kết chi tiết qua `getCinemaDetailHref` bằng ID nội bộ.
- `CinemaDetailPage.jsx`: hiện thông tin cơ bản theo ID trên URL, loading/lỗi/thử lại và trang không tìm thấy cho ID sai/404. Mở trực tiếp/reload không phụ thuộc danh sách; Back/Forward và liên kết về danh sách giữ bộ lọc qua router state khi đi từ thẻ rạp. Dùng Footer của `MainLayout` đúng một lần.
- `CinemaGallery.jsx`: carousel trước thông tin rạp, chỉ dùng `imageUrls` (trường `image_urls`), giữ nguyên thứ tự nguồn, lọc URL và loại trùng. Desktop hé ảnh hai bên; có nút/chấm, mũi tên/Home/End, Tab/Enter và vuốt ngang, vẫn cho cuộn dọc/zoom. Không tự chạy. Chỉ còn một ảnh thì ẩn điều hướng; ảnh lỗi được bỏ qua, thiếu ảnh hoặc tất cả ảnh lỗi có thông báo. Đổi rạp/bộ ảnh đặt lại lựa chọn và trạng thái lỗi.
- `CinemaInfoHeader.jsx`: hiện tên/địa chỉ/hotline và bộ chọn thành phố/rạp trên trang chi tiết. Đổi thành phố chỉ lọc danh sách; chọn rạp mới đổi URL, giữ `date` và router state, xóa `movieId`. Chi tiết rạp được ưu tiên khi catalog trong cache cũ hơn. Khi danh sách đang tải hoặc lỗi vẫn giữ rạp hiện tại; có nút thử lại khi lỗi. Thành phố không còn rạp sẽ hiện trạng thái rỗng và khóa ô chọn rạp.
- `useCinemaDetail` cache thông tin rạp theo ID với stale time 30 phút; `useCinemaShowtimes` chuẩn bị dữ liệu theo rạp/ngày với stale time 1 phút cho các phần tiếp theo. Cả hai truyền AbortSignal xuống Axios, không trộn snapshot khi đổi khóa và không yêu cầu `movieId`.
- `cinemaUtils.js`: xử lý Unicode, sắp `displayOrder` rồi tên, giữ nhóm “Chưa xác định”, kiểm tra URL ảnh và số điện thoại.
- Dùng `cinemaService`/`useCinemas` hiện có; cache 30 phút dùng chung. Làm mới chủ động lấy lại API; lỗi làm mới giữ snapshot cũ có cảnh báo.
- Lọc trong danh sách đã tải, không gọi API mỗi ký tự. URL dùng `q`/`city`; nhập từ khóa replace lịch sử, đổi tỉnh/thành tạo điểm Back; giữ tham số không liên quan.
- Trang không gọi Galaxy, API sơ đồ ghế hoặc API ghi. Ảnh HTTP(S) lấy trực tiếp từ CDN nguồn và giữ tỷ lệ; thẻ/ảnh bên cạnh lazy-load, ảnh chính của gallery tải ngay. Thiếu metadata có thông báo dự phòng. Bản đồ và giá vé chưa triển khai.

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

`test:cinemas-browser`: Edge headless với bản production, REST/ảnh mô phỏng; bao phủ thành công, lỗi, cache, response chậm/sai cấu trúc, ảnh lỗi, URL/Back/Forward, 390px/Tab/Enter và lịch chưa có suất. Bổ sung CTA tới chi tiết, mở trực tiếp/reload, giữ bộ lọc khi quay lại, ID sai/404/503, loading và một Footer. Gallery được kiểm tra vị trí ảnh hé hai bên, nút/chấm/bàn phím/vuốt, cuộn dọc, một/hai/nhiều ảnh, fallback và đổi route rạp. Bộ chọn rạp được kiểm tra với cache, đổi thành phố/rạp, giữ `date`/bỏ `movieId`, Back, thành phố hết rạp và lỗi/tải danh sách. Kết quả này không xác nhận backend/DB thật.

`test:cinemas-live`: Edge production với API localhost và ảnh CDN thật; chỉ cho GET/OPTIONS `/cinemas`, `/cinemas/:id` và `/showtimes`. Cần backend đang chạy và dữ liệu rạp đã có. Không khởi động lại backend, gọi sync, tạo ghế/booking hoặc sửa DB. Mặc định API `http://localhost:8080/api/v1`; có thể đặt `CINEMAS_TEST_API_BASE` sang địa chỉ loopback/cổng khác.

Hai lệnh dùng cổng preview/debug riêng (4206/9239 và 4207/9240), profile Edge tạm, tự đóng tài nguyên do script tạo và lưu `results.json`/ảnh trong đường dẫn temp được in ra. Có thể đặt `ADMIN_EDGE_PATH` nếu Edge không ở vị trí mặc định. Build lại trước khi kiểm tra thay đổi giao diện. Số rạp/ID trong kết quả live là snapshot, không hardcode lên ứng dụng.
