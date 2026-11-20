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

- [x] **3. Cách ly dữ liệu theo phiên.** Query key bắt đầu bằng `['my-tickets', sessionId]`, phân biệt danh sách/chi tiết/QR; truyền AbortSignal, đặt `gcTime: 0`, không lưu dữ liệu vé vào localStorage. Khi đổi tài khoản/đăng xuất, hủy truy vấn và bỏ dữ liệu phiên trước; không dùng dữ liệu cũ làm placeholder cho phiên mới. → Kiểm tra đổi tài khoản khi request còn chờ, phản hồi muộn, đăng xuất và đăng nhập lại cùng tài khoản.

- [x] **4. Cập nhật trạng thái và xử lý lỗi.** Stale time 30 giây, tải lại khi focus; danh sách có đơn chờ và chi tiết đơn chờ làm mới mỗi 30 giây khi tab đang mở. Sau tạo đơn, hủy giữ chỗ hoặc xác nhận thanh toán, invalidate dữ liệu vé của phiên hiện tại. Có skeleton, danh sách rỗng với “Khám phá phim”, bộ lọc không có kết quả, lỗi/thử lại; lỗi làm mới giữ dữ liệu cũ kèm cảnh báo. Chi tiết 403/404 có lối về danh sách. Trạng thái lạ hiện “Chưa xác định”, không mở QR hoặc thao tác thanh toán. → Kiểm tra lỗi từng API, phục hồi, cập nhật sau checkout và không tự gọi API ghi từ trang vé.

- [x] **5. Bảo vệ API QR và nối giao diện.** Giữ `GET /api/v1/bookings/{bookingCode}/qr`, bỏ quyền công khai; backend kiểm tra chủ đơn hoặc ADMIN và trạng thái `CONFIRMED` trước khi sinh PNG. Trả 401 khi chưa đăng nhập, 403 khi không có quyền, 404 khi không tồn tại, 409 khi chưa xác nhận; thêm `Cache-Control: no-store`. Frontend tải bằng Axios/Bearer với `responseType: 'blob'`; điều chỉnh interceptor để giữ nguyên blob thành công nhưng vẫn bóc `ApiResponse` của JSON. Hiển thị/tải PNG qua object URL, thu hồi khi đổi đơn/phiên hoặc unmount; lỗi QR có thử lại riêng, không dùng trực tiếp `qrCodeUrl` của lịch sử. → Kiểm tra quyền, trạng thái, ảnh PNG và tải file; giữ nguyên nội dung QR và cơ chế email hiện có.

- [x] **6. Kiểm chứng và cập nhật tài liệu.** Thêm unit test lọc/đếm trạng thái, URL, ngày/tiền, điều kiện thao tác và cách ly phiên; backend test quyền/trạng thái QR, mã không tồn tại, PNG và header không cache. Thêm script Edge mô phỏng cho khách/đăng nhập, đổi phiên lúc request chờ, danh sách rỗng/lỗi, chi tiết ghế/combo, QR/tải ảnh, tiếp tục checkout, cập nhật sau thanh toán và Back/Forward/reload. Kiểm tra bàn phím/focus/nhãn trạng thái, một Header/Footer và không tràn ngang ở 390/768/1440px. Chạy lint, unit test, build, script trang vé và kiểm tra rạp/checkout bị ảnh hưởng; chạy test backend liên quan. → Ghi rõ kết quả mô phỏng, API thật và phần chưa kiểm chứng.

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

Giới hạn: tất cả kiểm tra Edge ở trên dùng REST mô phỏng; chưa xác nhận dữ liệu vé với backend/DB thật.

### Mục 3 — hoàn thành và kiểm chứng bằng API mô phỏng (18/11/2026)

Đã triển khai:

- `frontend/src/config/queryClient.js`: thêm hàm `clearTicketCache(sessionId?)` hỗ trợ hủy các query đang chạy (`cancelQueries`) và xóa sạch cache (`removeQueries`) của toàn bộ vé hoặc theo `sessionId` cụ thể.
- `frontend/src/features/auth/authStore.js`:
  - Trong `acceptSession`: gọi `clearTicketCache()` để xóa cache vé cũ trước khi phiên mới bắt đầu.
  - Trong `logout`: gọi `clearTicketCache()` để dọn sạch toàn bộ cache vé khỏi bộ nhớ, bảo đảm người dùng kế tiếp không thấy dữ liệu vé cũ.
  - Trong `syncSessionFromStorage`: gọi `clearTicketCache(previousSessionId)` khi phát hiện `sessionId` thay đổi qua storage event giữa các tab.
- `frontend/src/features/tickets/useTicketQueries.js`: ghi chú rõ ràng về kiến trúc cách ly theo phiên (`['my-tickets', sessionId, ...]`, `gcTime: 0`, `AbortSignal`, và `clearTicketCache`).
- `frontend/scripts/my-tickets-routing-check.mjs`: bổ sung kiểm thử tự động với Edge mô phỏng bao quát 3 ca cách ly dữ liệu:
  - **Ca 1:** Đổi tài khoản khi request danh sách vé đang chờ phản hồi → phản hồi của phiên cũ bị hủy, chỉ dữ liệu của phiên mới được render.
  - **Ca 2:** Phản hồi vé đến muộn sau khi đăng xuất → không hiển thị vé và không rò rỉ dữ liệu sau logout.
  - **Ca 3:** Đăng xuất rồi đăng nhập lại cùng một tài khoản → cache vé cũ bị xóa, dữ liệu mới được tải lại hoàn toàn từ API (không dùng cache cũ làm placeholder).

Kiểm tra đã chạy:

| Lệnh | Kết quả |
| --- | --- |
| `npm run lint` | Đạt (0 warnings) |
| `npm test` | 145/145 đạt |
| `npm run build` | Đạt |
| `npm run test:my-tickets-routing` | 33 nhóm đạt (bao gồm 3 ca Mục 3), 0 lỗi JavaScript |
| `npm run test:cinemas-browser` | 64 nhóm đạt, không lỗi JavaScript |
| `npm run test:checkout-browser` | 18 nhóm đạt, không lỗi JavaScript |

Báo cáo cục bộ:
- `C:/Users/LOQ/AppData/Local/Temp/cinema-tickets-routing-b7HnWr/results.json`
- `C:/Users/LOQ/AppData/Local/Temp/cinema-cinemas-mock-d0P8xb/results.json`
- `C:/Users/LOQ/AppData/Local/Temp/cinema-checkout-browser-Q0gaMN/results.json`

Giới hạn: các kiểm thử ở trên dùng REST mô phỏng, chưa gọi backend/database thật.

### Mục 4 — hoàn thành và kiểm chứng bằng API mô phỏng (18/11/2026)

Đã triển khai:

- `frontend/src/config/queryClient.js`: bổ sung `invalidateTicketCache()` để invalidate cache `['my-tickets']` tập trung sau các thao tác thay đổi trạng thái đơn hàng.
- `frontend/src/features/tickets/useTicketQueries.js`:
  - Cấu hình `staleTime: 30_000` (30 giây), `refetchOnWindowFocus: true`.
  - Cấu hình tự động làm mới (polling): danh sách có ít nhất một đơn `PENDING` hoặc trang chi tiết đơn `PENDING` tự động poll mỗi 30 giây khi tab đang mở (`refetchIntervalInBackground: false`). Khi không có đơn pending thì dừng polling.
- `frontend/src/features/tickets/TicketUI.jsx` & `TicketDetailPage.jsx`:
  - Nâng cấp `TicketLoading` thành component Skeleton card và detail skeleton hoàn chỉnh với hiệu ứng `animate-pulse`, `role="status"` và trợ năng screen reader (`sr-only`).
  - Đảm bảo hiển thị lỗi làm mới: khi background/manual refresh gặp lỗi nhưng đã có dữ liệu cũ, giao diện vẫn giữ nguyên danh sách vé cũ kèm banner cảnh báo `role="alert"` và nút "Thử lại".
- Đồng bộ cache vé (`invalidateQueries({ queryKey: ['my-tickets'] })`):
  - `useBookingHold.js`: invalidate sau khi giữ ghế (`holdSeats`) thành công và sau khi hủy giữ ghế (`cancelHold`) thành công.
  - `CheckoutPage.jsx`: invalidate sau khi hủy đơn (`cancel`) thành công.
  - `VNPayReturnPage.jsx`: invalidate khi giao dịch thanh toán được xác nhận (`confirmed === true`).
- `frontend/scripts/my-tickets-routing-check.mjs`: mở rộng kiểm tra tự động bao gồm:
  - Hiển thị Skeleton card có `animate-pulse` khi đang tải danh sách vé.
  - Lỗi làm mới giữ dữ liệu cũ kèm cảnh báo và nút "Thử lại", khi thử lại thành công thì xóa cảnh báo.
  - Chi tiết 403/404 có đường dẫn về danh sách vé.
  - Trạng thái lạ hiện "Chưa xác định", không mở QR và không có CTA thanh toán.

Kiểm tra đã chạy:

| Lệnh | Kết quả |
| --- | --- |
| `npm run lint` | Đạt (0 warnings) |
| `npm test` | 145/145 đạt |
| `npm run build` | Đạt (1.49s) |
| `npm run test:my-tickets-routing` | 34 nhóm đạt (bao gồm toàn bộ ca Mục 4), 0 lỗi JavaScript |
| `npm run test:cinemas-browser` | 64 nhóm đạt, không lỗi JavaScript |
| `npm run test:checkout-browser` | 18 nhóm đạt, không lỗi JavaScript |

Báo cáo cục bộ:
- `C:/Users/LOQ/AppData/Local/Temp/cinema-tickets-routing-lnEFJT/results.json`
- `C:/Users/LOQ/AppData/Local/Temp/cinema-cinemas-mock-teLYT6/results.json`
- `C:/Users/LOQ/AppData/Local/Temp/cinema-checkout-browser-iSREAi/results.json`

Giới hạn: các kiểm thử ở trên dùng REST mô phỏng, chưa gọi backend/database thật. Mục 5–6 tiếp tục thực hiện ở các bước sau.

### Mục 5 — hoàn thành và kiểm chứng bằng API mô phỏng (18/11/2026)

Đã triển khai:

- **Backend (Spring Boot)**:
  - `SecurityConfig.java`: Xóa `/api/v1/bookings/*/qr` khỏi danh sách `permitAll()`, yêu cầu xác thực JWT qua Spring Security.
  - `BookingService.java` & `BookingServiceImpl.java`: Thêm method `byte[] getBookingQrCode(String bookingCode, String userEmail)` kiểm tra:
    1. Đơn hàng tồn tại (404 ResourceNotFoundException).
    2. Người dùng là chủ đơn hoặc có vai trò `ADMIN` (403 ForbiddenException).
    3. Đơn hàng có trạng thái `CONFIRMED` (409 ConflictException khi đơn chưa xác nhận).
    4. Sinh dữ liệu ảnh PNG QR qua `QrCodeService` (ZXing).
  - `BookingController.java`: Cập nhật endpoint `GET /api/v1/bookings/{bookingCode}/qr`, nhận `@AuthenticationPrincipal UserDetails userDetails`, gọi service và thêm header `Cache-Control: no-store` cùng `Content-Type: image/png`.
- **Frontend (React)**:
  - `frontend/src/config/axiosInstance.js`: Thêm nhánh xử lý `response.config.responseType === 'blob'` trong response interceptor để trả về trực tiếp `response` chứa Blob thay vì cố gắng unwrap JSON `ApiResponse`.
  - `frontend/src/features/tickets/ticketService.js`: Bổ sung hàm `getQr(code, signal)` gọi endpoint `/bookings/{code}/qr` với `responseType: 'blob'` và `skipErrorToast: true`.
  - `frontend/src/features/tickets/useTicketQueries.js`: Thêm query hook `useTicketQr(code, isConfirmed)` với `queryKey: ['my-tickets', sessionId, 'qr', code]`, `gcTime: 0`, `staleTime: 0`, chỉ kích hoạt khi đơn `CONFIRMED`.
  - `frontend/src/features/tickets/TicketDetailPage.jsx`:
    - Tạo component `TicketQrSection`:
      - Khi đơn chưa xác nhận (`PENDING`, `CANCELLED`, `EXPIRED`): hiển thị văn bản hướng dẫn thích hợp.
      - Khi đơn `CONFIRMED`: hiển thị skeleton khi tải, xử lý lỗi 403 ("Bạn không có quyền xem mã QR này"), 409 ("Đơn chưa được xác nhận. Mã QR chưa khả dụng"), và lỗi mạng kèm nút "Thử lại".
      - Khi thành công: tạo Object URL an toàn từ Blob, hiển thị ảnh mã QR và nút "Tải mã QR" (`a[download]`).
      - Tự động thu hồi Object URL bằng `URL.revokeObjectURL` khi đổi mã đơn/phiên hoặc khi unmount để chống rò rỉ bộ nhớ.
- `frontend/scripts/my-tickets-routing-check.mjs`: Bổ sung bộ kiểm thử 5 ca cho mã QR:
  1. Đơn `CONFIRMED`: tải và hiển thị mã QR blob, có nút tải file PNG.
  2. Đơn `PENDING`: tuyệt đối không gọi API QR, hiển thị văn bản chờ thanh toán.
  3. Lỗi 403: hiển thị thông báo lỗi quyền và nút "Thử lại" tải lại thành công.
  4. Lỗi 409: hiển thị thông báo đơn chưa được xác nhận.
  5. Rời trang chi tiết: xác nhận `URL.revokeObjectURL` được gọi tự động.

Kiểm tra đã chạy:

| Lệnh | Kết quả |
| --- | --- |
| `npm run lint` | Đạt (0 warnings, tuân thủ react-hooks) |
| `npm test` | 145/145 đạt |
| `npm run build` | Đạt (1.34s) |
| `npm run test:my-tickets-routing` | 39 nhóm đạt (bao gồm 5 ca mã QR của Mục 5), 0 lỗi JavaScript |
| `npm run test:cinemas-browser` | 64 nhóm đạt, không lỗi JavaScript |
| `npm run test:checkout-browser` | 18 nhóm đạt, không lỗi JavaScript |

Báo cáo cục bộ:
- `C:/Users/LOQ/AppData/Local/Temp/cinema-tickets-routing-grmate/results.json`
- `C:/Users/LOQ/AppData/Local/Temp/cinema-cinemas-mock-VKCftu/results.json`
- `C:/Users/LOQ/AppData/Local/Temp/cinema-checkout-browser-xnrVtW/`

Giới hạn: các kiểm thử ở trên dùng REST mô phỏng, chưa gọi backend/database thật. Mục 6 sẽ tiến hành kiểm chứng toàn diện và hoàn tất tài liệu.

### Mục 6 — hoàn thành kiểm chứng và tài liệu (20/11/2026)

Tài liệu vận hành module: [frontend/src/features/tickets/README.md](frontend/src/features/tickets/README.md). Các kết quả dưới đây là lần kiểm tra cuối cho mục 6; phần tiến độ trước đó lưu kết quả lịch sử.

Đã bổ sung kiểm tra:

- `ticketUtils.test.js` tiếp tục bao phủ URL, lọc/đếm, ngày giờ Việt Nam, VND, nhãn ghế và điều kiện tiếp tục đơn.
- `ticketQueries.test.js`: dùng hook/service/Axios interceptor thật, chỉ thay HTTP adapter. Kiểm tra khách và phiên chưa xác minh không đọc dữ liệu; đúng endpoint/Bearer; JSON DTO và PNG Blob; đổi phiên hủy request; phản hồi cũ bị bỏ kể cả adapter trả muộn; unmount hủy QR và xóa query.
- `config/queryClient.test.js`: hủy/xóa list/detail/QR theo phiên, không khôi phục cache khi response muộn, giữ cache công khai/phiên khác; invalidation chỉ tác động phiên được chỉ định.
- `ticketQr.test.js`: giữ nguyên Blob PNG và từ chối response JSON/HTML, rỗng hoặc sai chữ ký ảnh.
- `BookingQrServiceTests`: thực thi kiểm tra quyền/trạng thái trong service thật với repository mock. Chủ đơn và ADMIN được đọc QR của đơn `CONFIRMED`; khách hàng khác bị 403 ở mọi trạng thái; chủ đơn/Admin bị 409 khi `PENDING`/`CANCELLED`/`EXPIRED`; đơn không tồn tại bị 404, không sinh QR cho chuỗi tùy ý. Sinh PNG 300×300 bằng ZXing rồi giải mã lại để xác nhận nội dung đúng mã đơn.
- `BookingControllerTests`: kiểm tra PNG thật, `Content-Type: image/png`, `Cache-Control: no-store` và ánh xạ 403/404/409. `SecurityAuthorizationTests`: filter chain thật chặn QR chưa xác thực/token sai bằng 401; USER/CUSTOMER không cần quyền ADMIN để qua bước xác thực endpoint. `PaymentReturnTests` kiểm tra hồi quy kết quả thanh toán.
- `my-tickets-routing-check.mjs`: mở rộng lên 47 nhóm. Ngoài các ca mục 1–5, kiểm tra file PNG thực sự tải xuống đúng byte và tên; ảnh được trình duyệt giải mã; tổng URL tạo/thu hồi cân bằng; đổi phiên/logout gỡ ảnh/link tải ngay; response list/detail/QR muộn không khôi phục dữ liệu; PNG sai/lỗi QR 404/503; danh sách/chi tiết poll khi có `PENDING`, tab ẩn dừng và không còn đơn chờ thì dừng; stale refetch khi focus; từ kết quả thanh toán được backend mô phỏng xác nhận trở về/reload trang vé thấy `CONFIRMED` và QR. Kiểm tra Tab/focus/Enter, `aria-pressed`, alt ảnh, nền trắng, một Header/Footer và không tràn ngang tại 390/768/1440px.

Các lỗi sửa trong quá trình nghiệm thu:

- Chuyển `URL.createObjectURL` khỏi `useMemo` trong render sang effect của component ảnh QR. Cleanup gỡ `src`/`href` và thu hồi URL khi đổi Blob/unmount; tránh tạo tài nguyên từ lần render bị bỏ.
- Thêm kiểm tra MIME/chữ ký PNG trước khi hiển thị và cung cấp nút tải, tránh tải JSON/HTML thành file `.png`.
- `invalidateTicketCache(sessionId)` và các điểm gọi sau tạo/hủy giữ chỗ, hủy checkout, xác nhận thanh toán chỉ invalidate vé của phiên liên quan. Bỏ invalidation chung `['my-tickets']` tại các điểm này; không tác động cache phiên khác.
- Kiểm tra phản hồi đến muộn thử trả dữ liệu thật từ fixture; Chromium có thể đã hủy interception nên không còn cho fulfill. Unit test bổ sung transport cố tình trả muộn để xác nhận Axios vẫn bỏ response cũ.

Kết quả cuối:

| Kiểm tra | Kết quả | Phạm vi |
| --- | --- | --- |
| `npm run lint` | Đạt, 0 cảnh báo | Cấu hình đầy đủ |
| `npm test` | 153/153 đạt | Toàn bộ unit frontend |
| `npm run build` | Đạt | Build production |
| `npm run test:my-tickets-routing` | 47 nhóm đạt, 0 lỗi JavaScript | Edge + REST mô phỏng, tải PNG xuống filesystem thật |
| `npm run test:cinemas-browser` | 64 nhóm đạt, 0 lỗi JavaScript | Hồi quy rạp/điều hướng, REST mô phỏng |
| `npm run test:checkout-browser` | 18 nhóm đạt, 0 lỗi JavaScript | Hồi quy checkout/VNPay return, REST/gateway mô phỏng |
| Maven: `BookingQrServiceTests,BookingControllerTests,SecurityAuthorizationTests,PaymentReturnTests` | 34 test đạt, không lỗi/skip | Service/controller/security/ZXing; repository và JWT lookup mock |
| `git diff --check` | Đạt | Không lỗi khoảng trắng |

Lệnh backend chạy từ `backend/cinema-booking-backend`:

```powershell
.\mvnw.cmd '-Dmaven.repo.local=C:/Users/LOQ/.m2/repository' '-Dtest=BookingQrServiceTests,BookingControllerTests,SecurityAuthorizationTests,PaymentReturnTests' test
```

Máy kiểm tra cần chỉ rõ Maven cache vì cấu hình mặc định trỏ tới `C:/.m2/repository` ngoài workspace. Báo cáo Maven tại `backend/cinema-booking-backend/target/surefire-reports/`.

Báo cáo và ảnh chụp:

- Vé: `C:/Users/LOQ/AppData/Local/Temp/cinema-tickets-routing-3sLoIp/results.json`; cùng thư mục có ảnh 390/768/1440px và file tải `ticket-BK20261109130000ABCD.png`.
- Rạp: `C:/Users/LOQ/AppData/Local/Temp/cinema-cinemas-mock-ehFZtJ/results.json`.
- Checkout: `C:/Users/LOQ/AppData/Local/Temp/cinema-checkout-browser-LYdFYm/`.

Giới hạn được xác nhận:

- **API/DB thật:** chưa chạy hành trình trình duyệt tới backend đang phục vụ dữ liệu thật, đăng nhập JWT thật, VNPay/IPN thật hoặc gửi email vé. Không suy diễn kết quả các phần này từ test mô phỏng. Các test Maven đã chạy mã backend thật ở mức service/controller/security, không kết nối PostgreSQL/Redis.
- **Polling:** trong các ca Edge chuyên biệt, timer 30 giây được rút xuống 300ms và đồng hồ ca stale/focus dịch thêm 31 giây. Cấu hình ứng dụng vẫn 30 giây. Việc ẩn/hiện tab được mô phỏng bằng sự kiện visibility.
- **QR:** fixture Edge là PNG nhỏ để kiểm tra Blob/render/download và vòng đời URL; ảnh QR thật 300×300 và nội dung giải mã được kiểm tra bằng ZXing ở backend. Chưa quét bằng thiết bị tại rạp.

Mục 1–6 đã hoàn thành trong phạm vi kiểm chứng trên. Các mục ngoài phạm vi ban đầu (hủy vé/hoàn tiền/quét tại rạp/poster/thay đổi quy trình thanh toán) vẫn chưa được triển khai.


