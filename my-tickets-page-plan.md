# Trang “Vé của tôi” — `/profile/bookings`

Mục tiêu: thay trang tạm bằng danh sách đơn đặt vé của tài khoản đang đăng nhập và thêm trang chi tiết `/profile/bookings/:bookingCode` có thông tin vé/QR.

**Cách thực hiện:** triển khai từng mục một theo thứ tự 1–6; kiểm tra và ghi kết quả sau mỗi mục trước khi chuyển sang mục tiếp theo. Chưa đánh dấu hoàn thành khi mới dựng khung giao diện.

**Phụ thuộc:** [kế hoạch điều hướng header](header-my-tickets-navigation-plan.md) và [trang chi tiết rạp](cinemas-detail-page-plan.md) đã hoàn tất. Tái sử dụng đăng nhập, checkout và API hiện có.

## Thiết kế đã thống nhất

- Giữ `MainLayout`, Header/Footer, nền tối, màu đỏ và bộ font hiện có. “Vé của tôi” active ở cả danh sách và chi tiết.
- Danh sách gồm tiêu đề, mô tả ngắn, nút “Làm mới”, bộ lọc trạng thái và các thẻ vé ngang. Desktop: phim/rạp bên trái, suất chiếu ở giữa, trạng thái/tổng tiền/thao tác bên phải; mobile xếp dọc.
- Thẻ hiển thị phim, rạp/phòng, suất chiếu, mã đơn, ngày đặt, tổng tiền và trạng thái. Không thêm poster hoặc ghế trên thẻ vì API lịch sử chưa trả các trường này; không tải chi tiết từng đơn khi mở danh sách.
- Bộ lọc: “Tất cả”, “Đã xác nhận”, “Chờ thanh toán”, “Đã hủy”, “Hết hạn”, kèm số lượng từ danh sách đã tải. Lưu trong query `status`; mặc định “Tất cả”, giá trị sai được chuẩn hóa bằng replace. Giữ thứ tự mới nhất trước từ API; chưa thêm tìm kiếm hoặc phân trang.
- Mỗi thẻ có “Xem chi tiết”; đơn `PENDING` có “Tiếp tục đơn” tới checkout hiện có. Trang vé không tự tạo giao dịch, sửa combo hoặc hủy đơn.
- Chi tiết là trang riêng, có breadcrumb về danh sách. Desktop hai cột thông tin đơn và QR; mobile một cột. Hiển thị mã/trạng thái đơn, phim, rạp/phòng, thời gian, ghế và giá, combo, tổng tiền, ngày đặt và hạn giữ chỗ nếu đang chờ. QR đặt trên nền trắng, có khoảng trống quanh mã và nút tải PNG.
- Chỉ đơn `CONFIRMED` được hiển thị/tải QR. Không suy diễn tình trạng hoàn tiền từ trạng thái đơn; không tự đổi trạng thái theo đồng hồ trình duyệt. Giờ hiển thị theo Việt Nam, tiền theo VND.

## Công việc

- [ ] **1. Nối hai trang vào router.** Thay placeholder trong `frontend/src/App.jsx` bằng trang danh sách và chi tiết lazy-load dưới `MainLayout`. Khách thấy “Đăng nhập để xem vé”, mở modal hiện có và giữ nguyên URL; chỉ tải dữ liệu sau khi xác minh phiên thành công. → Kiểm tra mở trực tiếp/reload cả hai URL, active header, modal đăng nhập và một Header/Footer; giai đoạn này chỉ dựng khung, chưa hiển thị dữ liệu vé/QR.

- [ ] **2. Thêm truy vấn và danh sách vé.** Dùng `GET /api/v1/users/me/bookings` cho danh sách và `GET /api/v1/bookings/{bookingCode}` cho chi tiết; giữ cấu trúc response hiện có. Dựng thẻ ngang, bộ lọc/đếm trạng thái, liên kết chi tiết/checkout và bố cục chi tiết theo thiết kế trên. Lưu bộ lọc khi về danh sách; hỗ trợ Back/Forward/reload. → Kiểm tra bốn trạng thái đơn, ghế/combo chỉ ở chi tiết, đơn không có combo, trường dữ liệu thiếu và không có truy vấn chi tiết hàng loạt.

- [ ] **3. Cách ly dữ liệu theo phiên.** Query key bắt đầu bằng `['my-tickets', sessionId]`, phân biệt danh sách/chi tiết/QR; truyền AbortSignal, đặt `gcTime: 0`, không lưu dữ liệu vé vào localStorage. Khi đổi tài khoản/đăng xuất, hủy truy vấn và bỏ dữ liệu phiên trước; không dùng dữ liệu cũ làm placeholder cho phiên mới. → Kiểm tra đổi tài khoản khi request còn chờ, phản hồi muộn, đăng xuất và đăng nhập lại cùng tài khoản.

- [ ] **4. Cập nhật trạng thái và xử lý lỗi.** Stale time 30 giây, tải lại khi focus; danh sách có đơn chờ và chi tiết đơn chờ làm mới mỗi 30 giây khi tab đang mở. Sau tạo đơn, hủy giữ chỗ hoặc xác nhận thanh toán, invalidate dữ liệu vé của phiên hiện tại. Có skeleton, danh sách rỗng với “Khám phá phim”, bộ lọc không có kết quả, lỗi/thử lại; lỗi làm mới giữ dữ liệu cũ kèm cảnh báo. Chi tiết 403/404 có lối về danh sách. Trạng thái lạ hiện “Chưa xác định”, không mở QR hoặc thao tác thanh toán. → Kiểm tra lỗi từng API, phục hồi, cập nhật sau checkout và không tự gọi API ghi từ trang vé.

- [ ] **5. Bảo vệ API QR và nối giao diện.** Giữ `GET /api/v1/bookings/{bookingCode}/qr`, bỏ quyền công khai; backend kiểm tra chủ đơn hoặc ADMIN và trạng thái `CONFIRMED` trước khi sinh PNG. Trả 401 khi chưa đăng nhập, 403 khi không có quyền, 404 khi không tồn tại, 409 khi chưa xác nhận; thêm `Cache-Control: no-store`. Frontend tải bằng Axios/Bearer với `responseType: 'blob'`; điều chỉnh interceptor để giữ nguyên blob thành công nhưng vẫn bóc `ApiResponse` của JSON. Hiển thị/tải PNG qua object URL, thu hồi khi đổi đơn/phiên hoặc unmount; lỗi QR có thử lại riêng, không dùng trực tiếp `qrCodeUrl` của lịch sử. → Kiểm tra quyền, trạng thái, ảnh PNG và tải file; giữ nguyên nội dung QR và cơ chế email hiện có.

- [ ] **6. Kiểm chứng và cập nhật tài liệu.** Thêm unit test lọc/đếm trạng thái, URL, ngày/tiền, điều kiện thao tác và cách ly phiên; backend test quyền/trạng thái QR, mã không tồn tại, PNG và header không cache. Thêm script Edge mô phỏng cho khách/đăng nhập, đổi phiên lúc request chờ, danh sách rỗng/lỗi, chi tiết ghế/combo, QR/tải ảnh, tiếp tục checkout, cập nhật sau thanh toán và Back/Forward/reload. Kiểm tra bàn phím/focus/nhãn trạng thái, một Header/Footer và không tràn ngang ở 390/768/1440px. Chạy lint, unit test, build, script trang vé và kiểm tra rạp/checkout bị ảnh hưởng; chạy test backend liên quan. → Ghi rõ kết quả mô phỏng, API thật và phần chưa kiểm chứng.

## Hoàn tất khi

- Người dùng xem được danh sách và chi tiết đơn của mình; mở lại URL và điều hướng không mất ngữ cảnh.
- Dữ liệu không lẫn giữa các phiên; QR được backend kiểm tra quyền và chỉ cấp cho đơn đã xác nhận.
- Luồng “Tiếp tục đơn” dùng checkout hiện có; các kiểm tra liên quan đạt.
- Ngoài phạm vi phiên bản này: hủy vé, hoàn tiền, quét QR tại rạp, poster trong danh sách và thay đổi quy trình thanh toán.

## Tiến độ

File này ghi kế hoạch thiết kế và các tiêu chí kiểm chứng; cập nhật kết quả thực tế sau từng mục.

### Mục 1 — đã dựng khung, chưa nghiệm thu (18/11/2026)

Nhánh `feature/my-tickets-routing`. Đã làm:

- `frontend/src/routes/MyTicketsRoute.jsx`: guard cho `/profile/bookings/**`. Chỉ mount `<Outlet />` khi `sessionStatus === 'authenticated'` (sau `GET /users/me`); khách thấy “Đăng nhập để xem vé” và nút mở modal hiện có, URL giữ nguyên; lỗi xác minh có “Thử lại xác minh”/“Đổi tài khoản”. Trang con được remount theo `user.id:sessionId`.
- `frontend/src/features/tickets/MyTicketsPage.jsx` và `TicketDetailPage.jsx`: khung lazy-load dưới `MainLayout`, breadcrumb, `h1`, chưa có dữ liệu vé/QR và chưa gọi API. Trang chi tiết từ chối mã đơn sai định dạng bằng trạng thái “Không tìm thấy vé”.
- `frontend/src/features/tickets/ticketUtils.js` (+ test): `isBookingCode`, `getTicketDetailHref`, `MY_TICKETS_PATH`; mã đơn khớp quy tắc `BK` + 18 ký tự của Checkout.
- `frontend/src/App.jsx`: thay `PlaceholderPage` bằng route lồng `profile/bookings` (index + `:bookingCode`); bỏ component và import `Ticket` không còn dùng. Mục “Vé của tôi” trong Header dùng `NavLink` nên tự active ở cả hai trang.

Kiểm tra đã chạy: `node --test src/features/tickets/ticketUtils.test.js` (3/3 đạt) và ESLint lõi (cú pháp JSX, biến chưa khai báo, import thừa) trên các file đổi — sạch.

Chưa kiểm chứng (cần `npm ci` và Edge): `npm run lint` đầy đủ, `npm test`, `npm run build`, và kiểm tra trình duyệt mở trực tiếp/reload hai URL, active header, modal đăng nhập, một Header/Footer. Vì vậy mục 1 ở trên chưa được đánh dấu `[x]`.

