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

- [x] **1. Nối hai trang vào router.** Thay placeholder trong `frontend/src/App.jsx` bằng trang danh sách và chi tiết lazy-load dưới `MainLayout`. Khách thấy “Đăng nhập để xem vé”, mở modal hiện có và giữ nguyên URL; chỉ tải dữ liệu sau khi xác minh phiên thành công. → Kiểm tra mở trực tiếp/reload cả hai URL, active header, modal đăng nhập và một Header/Footer; giai đoạn này chỉ dựng khung, chưa hiển thị dữ liệu vé/QR.

- [x] **2. Thêm truy vấn và danh sách vé.** Dùng `GET /api/v1/users/me/bookings` cho danh sách và `GET /api/v1/bookings/{bookingCode}` cho chi tiết; giữ cấu trúc response hiện có. Dựng thẻ ngang, bộ lọc/đếm trạng thái, liên kết chi tiết/checkout và bố cục chi tiết theo thiết kế trên. Lưu bộ lọc khi về danh sách; hỗ trợ Back/Forward/reload. → Kiểm tra bốn trạng thái đơn, ghế/combo chỉ ở chi tiết, đơn không có combo, trường dữ liệu thiếu và không có truy vấn chi tiết hàng loạt.

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

### Mục 1 — hoàn thành và kiểm chứng bằng API mô phỏng (18/11/2026)

Nhánh `feature/my-tickets-routing`. Đã làm:

- `frontend/src/routes/MyTicketsRoute.jsx`: guard cho `/profile/bookings/**`. Chỉ mount `<Outlet />` khi `sessionStatus === 'authenticated'` (sau `GET /users/me`); khách thấy “Đăng nhập để xem vé” và nút mở modal hiện có, URL giữ nguyên; lỗi xác minh có “Thử lại xác minh”/“Đổi tài khoản”. Trang con được remount theo `user.id:sessionId`.
- `frontend/src/features/tickets/MyTicketsPage.jsx` và `TicketDetailPage.jsx`: khung lazy-load dưới `MainLayout`, breadcrumb, `h1`, chưa có dữ liệu vé/QR và chưa gọi API. Trang chi tiết từ chối mã đơn sai định dạng bằng trạng thái “Không tìm thấy vé”.
- `frontend/src/features/tickets/ticketUtils.js` (+ test): `isBookingCode`, `getTicketDetailHref`, `MY_TICKETS_PATH`; mã đơn khớp quy tắc `BK` + 18 ký tự của Checkout.
- `frontend/src/App.jsx`: thay `PlaceholderPage` bằng route lồng `profile/bookings` (index + `:bookingCode`); bỏ component và import `Ticket` không còn dùng. Mục “Vé của tôi” trong Header dùng `NavLink` nên tự active ở cả hai trang.

Sau rà soát:

- Sửa `MyTicketsRoute`: trạng thái `forbidden` từ API Admin vẫn giữ user trong store, không đồng nghĩa người dùng mất quyền xem vé. Guard xác minh lại `/users/me` trước khi mount trang con. Nếu chính `/users/me` trả 403 thì user bị xóa và guard dừng, không lặp xác minh. Đã tái hiện ca lỗi bằng Edge trước khi sửa và kiểm tra lại thành công.
- Cập nhật `scripts/cinemas-browser-check.mjs`: kiểm tra `h1` và lời mời đăng nhập/khung danh sách mới thay vì placeholder cũ; kiểm tra reload chờ tài liệu mới thực sự tải.
- Thêm `scripts/my-tickets-routing-check.mjs`, chạy bằng `npm run test:my-tickets-routing` sau `npm run build`. Script kiểm tra bản production với API xác thực mô phỏng; API vé/QR hay API ngoài phạm vi làm kiểm tra thất bại.

Kiểm tra đã chạy:

- `npm run lint`: đạt với cấu hình đầy đủ.
- `npm test`: 139/139 đạt, gồm 3 test của `ticketUtils`.
- `npm run build`: đạt.
- `npm run test:my-tickets-routing`: 20 nhóm kiểm tra đạt, không có lỗi JavaScript. Bao gồm khách/đã xác thực, mở trực tiếp và reload hai URL tại 390/768/1440px, một Header/Footer, active header, không tràn ngang, Enter mở modal/Escape đóng modal và giữ URL; đăng nhập chờ `/users/me`, lỗi 503/thử lại/đổi tài khoản, 401/403, mã đơn sai, đổi phiên khi xác minh đang chờ, bỏ phản hồi cũ, remount khi đăng nhập lại cùng tài khoản, đăng xuất qua storage và hồi quy lỗi quyền Admin.
- `npm run test:cinemas-browser`: 64 nhóm kiểm tra đạt, không có lỗi JavaScript; gồm Header/Footer, menu tài khoản, Back/Forward/reload tới “Vé của tôi” cho khách và người đã đăng nhập.

Báo cáo cục bộ: `C:/Users/LOQ/AppData/Local/Temp/cinema-tickets-routing-xpk1JL/results.json` và `C:/Users/LOQ/AppData/Local/Temp/cinema-cinemas-mock-5d1LUM/results.json`.

Giới hạn: kiểm tra trình duyệt dùng API mô phỏng, chưa xác nhận đăng nhập với backend thật. Mục 1 chỉ xác nhận guard và khung trang; truy vấn vé, cách ly query cache, bộ lọc, chi tiết dữ liệu và QR tiếp tục ở các mục 2–6.

### Mục 2 — hoàn thành và kiểm chứng bằng API mô phỏng (18/11/2026)

Đã triển khai:

- `frontend/src/features/tickets/ticketService.js` và `useTicketQueries.js`: đọc danh sách từ `/users/me/bookings`, tái sử dụng `bookingService.getBooking` cho chi tiết. Giữ nguyên DTO backend; báo lỗi nếu response danh sách không phải mảng hoặc chi tiết không khớp mã yêu cầu. Chỉ chạy truy vấn sau xác minh phiên; không gọi chi tiết từng đơn từ danh sách.
- `MyTicketsPage.jsx`: thẻ ngang gồm phim/rạp/phòng, suất chiếu/ngày đặt, trạng thái/tổng tiền và thao tác. Giữ thứ tự API, có nút làm mới và năm bộ lọc kèm số lượng. `status` lưu trong URL; giá trị sai/trùng được chuẩn hóa bằng replace, giữ query khác và hash. Chuyển lọc không gọi thêm API.
- `TicketDetailPage.jsx`: bố cục hai cột trên desktop, một cột trên mobile; hiển thị phim/rạp/phòng, giờ chiếu, ghế/loại ghế/giá, combo/số lượng/đơn giá/thành tiền, ngày đặt, hạn giữ chỗ cho đơn chờ và tổng tiền. Phân biệt không có combo với thiếu dữ liệu combo. Breadcrumb và liên kết quay về giữ bộ lọc qua router state, kể cả khi reload trang chi tiết; mở URL chi tiết trực tiếp vẫn có lối về danh sách.
- `TicketUI.jsx` và `ticketUtils.js`: nhãn bốn trạng thái, trạng thái chưa xác định, liên kết chi tiết/checkout, định dạng VND và giờ Việt Nam. `LocalDateTime` không phụ thuộc múi giờ máy người dùng; trường thiếu hiện “Chưa cập nhật”, không biến thành 0đ. Chỉ đơn `PENDING` có mã hợp lệ được “Tiếp tục đơn”, dùng checkout hiện có.
- Giao diện giữ nền tối/đỏ, font Plus Jakarta Sans và Be Vietnam Pro; đường nét đứt chia thông tin đơn với trạng thái/tổng tiền. Đã xem ảnh chụp danh sách desktop và chi tiết mobile, đồng thời kiểm tra không tràn ngang ở 390/768/1440px.
- Mở rộng `scripts/my-tickets-routing-check.mjs` bằng fixture `scripts/fixtures/tickets.mjs` để kiểm tra dữ liệu mục 2 cùng guard mục 1. Cập nhật fixture của `scripts/cinemas-browser-check.mjs` cho request lịch sử vé mới.

Phần nền tảng cho các mục tiếp theo:

- Query key đã dùng `['my-tickets', sessionId, 'list' | 'detail', ...]`, truyền `AbortSignal`, `gcTime: 0`, không lưu dữ liệu vé vào localStorage. Mục 3 vẫn cần kiểm chứng đầy đủ hủy/xóa cache và phản hồi truy vấn vé muộn khi đổi phiên.
- Có trạng thái tải, rỗng, lỗi/thử lại cơ bản và lỗi 403/404 với lối về danh sách. Polling, refetch khi focus, invalidation sau checkout và kiểm thử làm mới thuộc mục 4.
- Vùng mã vé hiện thông báo theo trạng thái; chưa tải/sinh QR hay dùng `qrCodeUrl`. API bảo vệ QR và nút tải ảnh thuộc mục 5. Không đổi backend hoặc quy trình thanh toán.

Kiểm tra đã chạy:

| Lệnh | Kết quả |
| --- | --- |
| `npm run lint` | Đạt |
| `npm test` | 145/145, gồm 9 test utility vé |
| `npm run build` | Đạt |
| `npm run test:my-tickets-routing` | 30 nhóm đạt, không lỗi JavaScript |
| `npm run test:cinemas-browser` | 64 nhóm đạt, không lỗi JavaScript |
| `npm run test:checkout-browser` | 18 nhóm đạt, không lỗi JavaScript |

Các ca mục 2 gồm bốn trạng thái/đếm/lọc, thứ tự API, không truy vấn chi tiết hàng loạt, dữ liệu ghế/combo, đơn không combo, trường thiếu/trạng thái lạ, URL sai/trùng, Back/Forward/reload, trở về bộ lọc cũ và mở checkout. Luồng trang vé chỉ gửi GET; đăng nhập trong kiểm tra guard dùng API xác thực mô phỏng.

Báo cáo và ảnh chụp cục bộ:

- `C:/Users/LOQ/AppData/Local/Temp/cinema-tickets-routing-yKDGf6/`: `results.json`, ảnh danh sách/chi tiết tại 390/768/1440px.
- `C:/Users/LOQ/AppData/Local/Temp/cinema-cinemas-mock-5Ei7NI/results.json`.
- `C:/Users/LOQ/AppData/Local/Temp/cinema-checkout-browser-Ds1LVc/`.

Giới hạn: tất cả kiểm tra Edge ở trên dùng REST mô phỏng; chưa xác nhận dữ liệu vé với backend/DB thật. Mục 3–6 chưa được đánh dấu hoàn thành.

