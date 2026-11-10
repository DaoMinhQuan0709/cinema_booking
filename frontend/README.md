# PremierCinema frontend

React, Vite và Tailwind CSS. Trạng thái xác thực dùng Zustand, dữ liệu phim dùng
TanStack Query, REST dùng Axios và cập nhật ghế dùng STOMP qua WebSocket gốc.

## Chạy tại máy phát triển

Từ thư mục `frontend`, cài dependency bằng `npm ci`, sao chép `.env.example`
thành `.env` nếu cần tùy chỉnh URL, rồi chạy `npm run dev`.
Backend mặc định phục vụ REST tại `http://localhost:8080/api/v1` và STOMP tại
`ws://localhost:8080/ws`. Cấu hình `VITE_WS_BASE_URL` dạng http/https cũ vẫn
được tự chuyển sang ws/wss, nên không cần đổi file `.env` hiện có. Client dùng
endpoint WebSocket gốc đã đăng ký ở backend, giữ reconnect/subscription và
không chạy listener `unload` của SockJS. Trên PowerShell chặn `npm.ps1`, dùng
`npm.cmd`.

```powershell
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev
```

Chỉ sao chép file môi trường khi chưa có cấu hình riêng. Không đưa khóa bí mật
vào biến `VITE_*` vì các giá trị này được đưa vào mã JavaScript gửi đến trình duyệt.

API tạo đơn giữ ghế cần Redis đang chạy. Xem phần khởi động Redis trong
[hướng dẫn backend](../backend/cinema-booking-backend/GALAXY_SYNC.md#redis-cho-luồng-giữ-ghế)
nếu đọc được sơ đồ ghế nhưng không tạo được đơn.

## Kiểm tra

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

`build` xuất bản dựng vào `dist/`; `preview` xem bản dựng đó tại máy phát triển.

## Cấu trúc

- `src/features/auth`: đăng nhập, đăng ký, modal và auth store.
- `src/features/movies`: thẻ phim, danh sách, trang chi tiết, trailer, bộ chọn
  lịch chiếu theo ngày/thành phố/rạp và query hooks.
- `src/features/showtimes`: trang lịch chiếu toàn bộ phim, bộ lọc và nhóm suất
  theo phim/rạp, xử lý ngày giờ Việt Nam và query lịch theo ngày.
- `src/features/booking`: ma trận ghế, WebSocket, nút giữ chỗ, khôi phục/hủy
  đơn đang giữ và kiểm tra payload booking.
- `src/services`: các lời gọi API theo module.
- `src/config`: Axios, lưu token, cấu hình và kết nối WebSocket.
- `src/layouts`, `src/components/common`: khung trang, header và footer.

Trang chủ hiển thị tối đa 15 phim mỗi mục; nút “Xem thêm” mở `/movies` tại đúng
mục đang xem. Trang `/movies` hiển thị toàn bộ phim đang chiếu/sắp chiếu, hỗ trợ
tìm tên không dấu và sắp xếp. Trạng thái mục, tìm kiếm, sắp xếp lưu trong URL
(`status`, `q`, `sort`) để có thể chia sẻ và dùng nút quay lại của trình duyệt.

Trang chủ chỉ lấy một trang 15 phim/mục; cột gợi ý chỉ lấy 4 phim để chọn tối đa
3 phim khác. Cache preview tách khỏi danh sách đầy đủ để không làm thiếu phim ở
`/movies`. Trang danh sách và trang chi tiết được tải theo route bằng React lazy.

Trang chi tiết dùng ảnh ngang làm banner mở trailer, poster, thông tin đạo diễn/
diễn viên/quốc gia/thể loại từ backend và tối đa 3 phim đang chiếu ở cột bên phải.
Điện thoại chuyển thành một cột. Thiếu trường thì ẩn dòng tương ứng; ảnh lỗi có
fallback. Trailer YouTube chỉ nhúng khi bấm; modal hỗ trợ Escape và trả focus về
nút mở. Phần chọn suất chiếu tiếp tục dẫn đến `/booking/:showtimeId`.

Trang chủ, danh sách và trang chi tiết hiển thị dữ liệu thật từ backend, có modal xác thực
và chọn suất chiếu. Route `/booking/:showtimeId` có màn hình SVG và ma trận ghế
uốn cong, chú thích loại/trạng thái, chọn tối đa 8 ghế, bỏ chọn và tạm tính.
Màn hình/ma trận cuộn cùng nhau trên điện thoại và giữ đúng vị trí lối đi.
Ghế BOOKED/LOCKED không chọn được; ghế đổi sang không khả dụng khi tải lại sẽ
bị bỏ khỏi lựa chọn. Đổi suất cũng đặt lại lựa chọn. WebSocket subscribe topic
`/topic/showtimes/{id}/seats`, vá HOLD/RELEASE/BOOKED vào cache; mỗi lần kết nối
lại sẽ tải sơ đồ để đồng bộ các sự kiện đã bỏ lỡ.

Nút “Tiếp tục” ở sidebar gọi `POST /bookings` với `showtimeId`, các
`showtimeSeatIds` đã chọn và `products: []`. Khách chưa đăng nhập được mở
AuthModal, giữ nguyên lựa chọn; đăng nhập xong bấm tiếp để gửi yêu cầu. Nút và
sơ đồ khóa trong lúc gửi, chống bấm lặp và không tự retry POST. HTTP 409 hiện
đúng một toast “Ghế bạn chọn vừa có người giữ chỗ!”, tải lại sơ đồ và bỏ các
lựa chọn không còn khả dụng. Các lỗi khác hiển thị thông báo phù hợp.

Thành công hiển thị mã đơn, các ghế đang giữ, tổng tiền và hạn giữ từ backend
ngay tại trang chọn ghế. Ghế của mình có màu đỏ/viền sáng và nhãn “Đang giữ cho
bạn”; HOLD đến trước phản hồi POST không bị báo nhầm thành người khác chọn.
Hai ID của ghế đôi luôn được gửi cùng nhau. Giá xác nhận lấy từ BookingResponse.

Tab chỉ lưu mã giữ chỗ theo tài khoản/suất trong sessionStorage. Tải lại trang
sẽ gọi `GET /bookings/{code}` để kiểm tra quyền, trạng thái và thời hạn trước
khi khôi phục; lỗi kiểm tra có nút thử lại và tạm chặn đặt trùng. “Hủy giữ ghế
để chọn lại” gọi `DELETE /bookings/{code}/cancel`. Hết `expiresAt` hoặc nhận
RELEASE cho ghế đang giữ sẽ bỏ xác nhận và cập nhật lại giao diện. Countdown,
trang checkout, bắp nước và thanh toán thuộc bước tiếp theo.

Hai vị trí COUPLE liền kề theo cặp 1–2, 3–4... hiển thị thành một ghế đôi rộng
hai ô. Bấm chọn/bỏ chọn tác động cả hai ID, tính là 2 chỗ trong giới hạn 8 và
cộng giá của hai vị trí từ API. Một bên đã bán/đang giữ hoặc thiếu một bên sẽ
khóa cả cặp; không ghép qua lối đi. Giữ các ID hiện có để bảo toàn dữ liệu ghế.

`showtimeId` là ID số nội bộ từ `GET /api/v1/showtimes`, không phải ID Galaxy như
`1011-226432`. Vào trang chi tiết phim và bấm giờ chiếu để nhận đúng liên kết.
URL sai/thiếu ID được báo ngay, không gọi API; backend trả 400 cho tham số sai
kiểu.

Trang `/showtimes` hiển thị tất cả phim có suất mở bán trong ngày, chia thành
từng phim → rạp → giờ chiếu. Thanh ngày gồm hôm nay và 6 ngày tiếp theo, tính
theo giờ Việt Nam kể cả khi trình duyệt ở múi giờ khác. Bộ lọc thành phố/rạp/phim
lưu trong URL (`date`, `city`, `cinemaId`, `movieId`) để Back/Forward và quay lại
từ trang chọn ghế giữ được ngữ cảnh. Poster/tên phim mở chi tiết; giờ chiếu mở
`/booking/:showtimeId` với ID nội bộ.

Mỗi ngày chỉ gọi `GET /showtimes?date=YYYY-MM-DD`; không tải riêng từng phim
hoặc sơ đồ ghế. Dữ liệu được cache/làm mới mỗi phút khi trang đang hoạt động,
loại các suất đã bắt đầu; độ mới nguồn vẫn phụ thuộc chu kỳ đồng bộ backend.
Phim sắp chiếu có suất bán trước cũng xuất hiện. Bộ lọc không hợp lệ chỉ tự
reset sau phản hồi thành công; lỗi API rạp chỉ tạm vô hiệu hóa bộ lọc thành phố,
không ngăn xem lịch. Có skeleton, trạng thái không có suất, retry và giữ dữ liệu
cũ nếu làm mới thất bại. Route được lazy-load như các trang phim/chọn ghế.

Route cụm rạp và lịch sử vé vẫn là trang chờ triển khai. Mã kết nối booking,
payment, admin và chatbot được giữ để phục vụ các bước frontend tiếp theo.

Xem [hướng dẫn backend/Galaxy](../backend/cinema-booking-backend/GALAXY_SYNC.md)
để khởi động backend và hiểu ranh giới giữa catalog Galaxy và kho ghế nội bộ.
## Checkout

Đã có `/checkout/:bookingCode`. Tạo giữ ghế từ trang booking sẽ chuyển đến
Checkout; đơn đã khôi phục có nút tiếp tục. Countdown dựa trên serverTime,
combo chỉ lưu khi bấm thanh toán; backend xác nhận giá trước khi tạo URL.
Giá thay đổi cần xác nhận, 409 cần tải lại đơn, mất phản hồi không tự POST lại.

Backend cần schema mới và khởi động lại; xem
[CHECKOUT.md](../backend/cinema-booking-backend/CHECKOUT.md). Đã có trang
`/payment/vnpay-callback`: backend xác minh chữ ký/quyền xem đơn, frontend
hiển thị thông tin giao dịch và kiểm tra trạng thái chờ IPN. Chỉ xác nhận vé
khi DB có booking CONFIRMED/payment SUCCESS; không tin query parameter
`vnp_ResponseCode=00` đơn lẻ. QR và callback MoMo còn ở bước tiếp theo.

Sau `npm.cmd run build`, có thể chạy `npm.cmd run test:checkout-browser`
trên Windows với Edge. Script dùng REST/STOMP/cổng mô phỏng, kiểm tra desktop,
mobile, clock skew/timezone, giá mới, lỗi/xung đột, resume và callback VNPay, không ghi dữ liệu
thật. Có thể đặt `CHECKOUT_EDGE_PATH` nếu Edge ở đường dẫn khác.
