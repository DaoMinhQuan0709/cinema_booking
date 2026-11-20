# Vé của tôi

Trang danh sách `/profile/bookings` và chi tiết `/profile/bookings/:bookingCode` dùng `MainLayout` và guard xác minh `/users/me`. Kế hoạch và biên bản kiểm chứng nằm trong [my-tickets-page-plan.md](../../../../my-tickets-page-plan.md).

## Luồng dữ liệu

| Màn hình | API | Điều kiện |
| --- | --- | --- |
| Danh sách | `GET /api/v1/users/me/bookings` | Phiên đã xác minh |
| Chi tiết | `GET /api/v1/bookings/{bookingCode}` | Phiên đã xác minh, mã `BK` + 18 ký tự chữ/số |
| QR | `GET /api/v1/bookings/{bookingCode}/qr` | Đơn `CONFIRMED`; backend kiểm tra chủ đơn hoặc ADMIN |

Danh sách giữ thứ tự mới nhất từ API và lọc ngay trong bộ nhớ, không tải chi tiết hàng loạt. `status` nằm trong query string; sai/trùng được chuẩn hóa bằng replace. Liên kết chi tiết lưu query/hash danh sách trong router state để quay lại sau reload. URL chi tiết mở trực tiếp vẫn có breadcrumb về danh sách.

Chỉ `PENDING` có thao tác tiếp tục checkout. Trang vé không tự tạo giao dịch, sửa combo hoặc hủy đơn. Giá trị thiếu có nhãn “Chưa cập nhật”; tiền theo VND, giờ theo `Asia/Ho_Chi_Minh`. `LocalDateTime` backend được hiểu là giờ Việt Nam. Trạng thái lạ không cho thanh toán hay tải QR.

## Phiên và cache

- Query key: `['my-tickets', sessionId, 'list']`, `['my-tickets', sessionId, 'detail', code]`, `['my-tickets', sessionId, 'qr', code]`.
- Guard chỉ dựng trang con sau xác minh; request nhận `AbortSignal`, `gcTime: 0`, không dùng dữ liệu phiên trước làm placeholder và không lưu vé vào localStorage.
- `clearTicketCache` trong `config/queryClient.js` hủy request/xóa cache khi đăng nhập, đăng xuất hoặc đổi phiên qua storage. Axios bỏ phản hồi của phiên cũ ngay cả khi transport trả về muộn.
- Danh sách/chi tiết stale sau 30 giây, refetch khi focus. Chỉ poll 30 giây khi có đơn chờ và tab đang hiện. QR không tự refetch khi focus.
- Tạo/hủy giữ chỗ, hủy đơn ở checkout và xác nhận thanh toán invalidate vé của phiên liên quan qua `invalidateTicketCache(sessionId)`.

QR được tải bằng Bearer và `responseType: 'blob'`; chỉ chấp nhận MIME/chữ ký PNG. Không sử dụng `qrCodeUrl` từ lịch sử. Object URL được tạo sau khi giao diện mount và thu hồi khi đổi dữ liệu, rời trang, đổi phiên hoặc logout. QR đặt trong vùng trắng có khoảng trống; tải ảnh giữ nguyên byte từ backend.

Backend giữ endpoint và nội dung QR là mã đơn. Kết quả: 401 chưa xác thực, 403 không có quyền, 404 đơn không tồn tại, 409 chưa `CONFIRMED`; thành công trả `image/png` và `Cache-Control: no-store`.

## Chạy kiểm tra

Từ thư mục `frontend`, dùng Node/npm đã cài cho dự án:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:my-tickets-routing
npm.cmd run test:cinemas-browser
npm.cmd run test:checkout-browser
```

Các script Edge dùng bản build production và Edge headless trên Windows. Có thể chỉ định executable bằng `ADMIN_EDGE_PATH`. Script trang vé dùng cổng preview 4210/debug 9243; báo cáo, ảnh chụp và PNG tải xuống nằm trong thư mục temp được in ở cuối lệnh. Chạy build trước script trình duyệt. Các bộ Edge dùng REST mô phỏng và không tạo booking/thanh toán thật.

Từ thư mục `backend/cinema-booking-backend`:

```powershell
.\mvnw.cmd '-Dtest=BookingQrServiceTests,BookingControllerTests,SecurityAuthorizationTests,PaymentReturnTests' test
```

Test backend chạy service thật với repository mock, MockMvc và security filter chain thật với JWT/user lookup mock. `BookingQrServiceTests` sinh PNG thật 300×300 bằng ZXing và giải mã lại mã đơn. Không cần PostgreSQL/Redis hoặc gateway cho các test được chọn. Báo cáo ở `target/surefire-reports`.

## Phạm vi kiểm chứng

- Unit: URL, lọc/đếm, ngày/tiền, điều kiện checkout, hợp đồng JSON/Blob, khóa phiên, hủy request, bỏ phản hồi muộn và xóa/invalidate cache theo phiên.
- Edge: khách/đăng nhập, list/detail, lỗi/rỗng/thử lại, đổi phiên lúc list/detail/QR đang chờ, tải PNG thật, thu hồi URL, polling/focus, kết quả thanh toán mô phỏng, Back/Forward/reload, bàn phím và 390/768/1440px.
- Trong ca polling Edge, chỉ timer 30 giây được rút xuống 300ms; ca stale/focus dịch đồng hồ kiểm tra thêm 31 giây. Cấu hình ứng dụng vẫn 30 giây. Fixture ảnh QR của Edge là PNG nhỏ để kiểm tra Blob/render/download; việc mã hóa/giải mã QR được xác nhận riêng bằng ZXing trong test backend.
- Chưa kiểm chứng từ trình duyệt tới backend/DB thật, đăng nhập JWT thật, VNPay/IPN thật hoặc quét mã tại rạp. Kết quả từng lần chạy được ghi trong kế hoạch; không suy diễn kết quả môi trường thật từ các fixture.
