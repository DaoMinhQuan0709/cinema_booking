# Header: “Vé của tôi” và bỏ trang “Lịch chiếu”

Mục tiêu: thay mục “Lịch chiếu” bằng “Vé của tôi”, chuyển các lối xem lịch sang trang rạp và bỏ màn hình `/showtimes`.

**Phạm vi:** điều hướng khách hàng. Đích “Vé của tôi” là `/profile/bookings` hiện có, vẫn là placeholder; xây dựng danh sách/chi tiết vé là công việc riêng. API `/api/v1/showtimes`, lịch trong trang phim và `/admin/showtimes` vẫn phục vụ nghiệp vụ.

**Phụ thuộc:** hoàn thành [kế hoạch trang rạp](cinemas-detail-page-plan.md) trước khi gỡ màn hình lịch. Thứ tự chính: có trang chi tiết rạp → chuyển liên kết → chuyển hướng URL cũ → gỡ màn hình → kiểm chứng.

## Công việc

- [ ] 1. Sửa `frontend/src/components/common/Header.jsx`: đổi mục trong `navLinks` thành “Vé của tôi” → desktop/mobile đều trỏ `/profile/bookings`, active đúng route; “Rạp chiếu phim” active cả ở trang chi tiết.
- [ ] 2. Rà menu tài khoản trong `Header.jsx`: giữ lối tắt vé ở dropdown desktop, bỏ mục vé lặp trong phần tài khoản mobile → mobile chỉ có một mục “Vé của tôi”, bấm xong đóng menu.
- [ ] 3. Sửa `components/common/Footer.jsx`: thay “Lịch chiếu toàn quốc” bằng “Vé của tôi”; rà `CinemaCard.jsx`/`cinemaUtils.js` theo kế hoạch trang rạp → mọi liên kết nội bộ có trang đích hợp lệ, không còn dẫn vào màn hình lịch cũ.
- [ ] 4. Thêm `routes/LegacyShowtimesRedirect.jsx`, nối trong `App.jsx`: `/showtimes?cinemaId=<id>` chuyển bằng `replace` tới `/cinemas/<id>`; giữ `date`/`movieId` hợp lệ. Thiếu hoặc sai định dạng ID thì về `/cinemas`, giữ bộ lọc `city` nếu có → URL cũ không trắng trang, không lặp Back/redirect.
- [ ] 5. Gỡ lazy import và `features/showtimes/ShowtimesPage.jsx`; chỉ gỡ `useDailyShowtimes.js` nếu không còn nơi dùng → giữ `scheduleUtils.js` và kiểm thử của nó vì Admin, trang rạp hoặc script còn phụ thuộc; build không có import bị gãy.
- [ ] 6. Cập nhật `features/cinemas/README.md`, kiểm thử URL và `scripts/cinemas-browser-check.mjs` cho điều hướng mới → tách trường hợp URL cũ chuyển hướng với thao tác từ giao diện mới; ghi rõ trang vé còn tạm.

## Kiểm chứng cuối

- [ ] 7. Tại `frontend`, chạy `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, rồi `npm.cmd run test:cinemas-browser`. Kiểm tra khách/đã đăng nhập, desktop/mobile, dropdown, `/profile/bookings`, URL lịch cũ có/không có ID, Back/Forward; mở lại chọn lịch trong trang phim và trang quản trị suất chiếu.

Hoàn tất khi header/footer điều hướng đúng, màn hình lịch chung đã được gỡ, URL cũ tới đúng trang thay thế, các kiểm tra đạt; chức năng “Vé của tôi” chỉ được đánh dấu hoàn thành phần điều hướng.
