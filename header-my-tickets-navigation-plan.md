# Header: “Vé của tôi” và bỏ trang “Lịch chiếu”

Mục tiêu: thay mục “Lịch chiếu” bằng “Vé của tôi”, chuyển các lối xem lịch sang trang rạp và bỏ màn hình `/showtimes`.

**Phạm vi:** điều hướng khách hàng. Đích “Vé của tôi” là `/profile/bookings` hiện có, vẫn là placeholder; xây dựng danh sách/chi tiết vé là công việc riêng. API `/api/v1/showtimes`, lịch trong trang phim và `/admin/showtimes` vẫn phục vụ nghiệp vụ.

**Phụ thuộc:** hoàn thành [kế hoạch trang rạp](cinemas-detail-page-plan.md) trước khi gỡ màn hình lịch. Thứ tự chính: có trang chi tiết rạp → chuyển liên kết → chuyển hướng URL cũ → gỡ màn hình → kiểm chứng.

## Công việc

- [x] 1. Sửa `frontend/src/components/common/Header.jsx`: đổi mục trong `navLinks` thành “Vé của tôi” → desktop/mobile đều trỏ `/profile/bookings`, active đúng route; “Rạp chiếu phim” active cả ở trang chi tiết.
- [x] 2. Rà menu tài khoản trong `Header.jsx`: giữ lối tắt vé ở dropdown desktop, bỏ mục vé lặp trong phần tài khoản mobile → mobile chỉ có một mục “Vé của tôi”, bấm xong đóng menu.
- [x] 3. Sửa `components/common/Footer.jsx`: thay “Lịch chiếu toàn quốc” bằng “Vé của tôi”; rà `CinemaCard.jsx`/`cinemaUtils.js` theo kế hoạch trang rạp → mọi liên kết nội bộ có trang đích hợp lệ, không còn dẫn vào màn hình lịch cũ.
- [x] 4. Thêm `routes/LegacyShowtimesRedirect.jsx`, nối trong `App.jsx`: `/showtimes?cinemaId=<id>` chuyển bằng `replace` tới `/cinemas/<id>`; giữ `date`/`movieId` hợp lệ. Thiếu hoặc sai định dạng ID thì về `/cinemas`, giữ bộ lọc `city` nếu có → URL cũ không trắng trang, không lặp Back/redirect.
- [x] 5. Gỡ lazy import và `features/showtimes/ShowtimesPage.jsx`; chỉ gỡ `useDailyShowtimes.js` nếu không còn nơi dùng → giữ `scheduleUtils.js` và kiểm thử của nó vì Admin, trang rạp hoặc script còn phụ thuộc; build không có import bị gãy.
- [x] 6. Cập nhật `features/cinemas/README.md`, kiểm thử URL và `scripts/cinemas-browser-check.mjs` cho điều hướng mới → tách trường hợp URL cũ chuyển hướng với thao tác từ giao diện mới; ghi rõ trang vé còn tạm.

## Kiểm chứng cuối

- [x] 7. Tại `frontend`, chạy `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, rồi `npm.cmd run test:cinemas-browser`. Kiểm tra khách/đã đăng nhập, desktop/mobile, dropdown, `/profile/bookings`, URL lịch cũ có/không có ID, Back/Forward; mở lại chọn lịch trong trang phim và trang quản trị suất chiếu.

Hoàn tất khi header/footer điều hướng đúng, màn hình lịch chung đã được gỡ, URL cũ tới đúng trang thay thế, các kiểm tra đạt; chức năng “Vé của tôi” chỉ được đánh dấu hoàn thành phần điều hướng.

## Kết quả thực hiện — 18/11/2026

- Hoàn tất phần điều hướng “Vé của tôi” trên header/footer; dropdown desktop giữ lối tắt, mobile bỏ mục trùng và đóng sau khi chọn. Bổ sung `aria-expanded` cho menu và nhãn nút tài khoản. Trang `/profile/bookings` vẫn là placeholder, chưa triển khai danh sách/chi tiết vé.
- Thêm `LegacyShowtimesRedirect` dùng `replace` và helper URL có 4 unit test. ID rạp/phim dùng bigint dương nội bộ; ngày kiểm tra đúng lịch, trang chi tiết tiếp tục chuẩn hóa dải ngày/phim còn suất. URL cũ thiếu/sai ID về danh sách giữ `city`; ID hợp lệ nhưng không tồn tại hiện trạng thái không tìm thấy của trang rạp.
- Gỡ màn hình `ShowtimesPage`, hook `useDailyShowtimes` không còn nơi dùng và helper `getCinemaScheduleHref` không còn cần thiết. `CinemaCard` tiếp tục mở trực tiếp `/cinemas/:id`; giữ `scheduleUtils.js`, test và các API/lịch phim/Admin hiện có.
- Cập nhật README frontend/trang rạp, script kiểm tra rạp và các script quản trị có mở màn hình lịch cũ để dùng trang chi tiết rạp. Tách kiểm tra thao tác giao diện mới khỏi kiểm tra chuyển hướng URL cũ.
- Tại `frontend`: `npm.cmd run lint`, `npm.cmd test` (**136/136**), `npm.cmd run build` và `npm.cmd run test:cinemas-browser` (**64 nhóm**, không lỗi JavaScript) đều đạt. Edge kiểm tra khách/đã đăng nhập ở 390/768/1440px, active/menu/dropdown, trang vé tạm, URL cũ, Back/Forward/reload, lịch phim → chọn suất → trang ghế. Báo cáo/ảnh: `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-V5VhXV`.
- Kiểm tra bổ sung `npm.cmd run test:admin-showtimes-browser` đạt **17 nhóm** và `npm.cmd run test:admin-sync-browser` đạt **15 nhóm**, không lỗi JavaScript; bao gồm tạo suất/đồng bộ mô phỏng làm mới cache lịch tại rạp. Báo cáo lần lượt ở `C:\Users\LOQ\AppData\Local\Temp\cinema-admin-showtimes-At1xTl` và `C:\Users\LOQ\AppData\Local\Temp\cinema-admin-sync-pQBL9w`.
- Các kiểm tra trình duyệt lần này dùng Edge production với REST/ảnh/ghế và phiên đăng nhập mô phỏng; không xác nhận lại API/DB/Google Maps thật. Script HTTP quản trị đã cập nhật URL nhưng không chạy trong lần này.
