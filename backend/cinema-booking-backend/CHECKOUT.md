# Chạy và kiểm tra Checkout

Checkout dùng dữ liệu đơn và ghế nội bộ. Từ trang chọn ghế, “Tiếp tục” tạo
đơn giữ chỗ rồi mở `/checkout/:bookingCode`; mã đơn phải do backend trả về.
Countdown và sửa combo không gia hạn thời gian giữ ghế.

## Cập nhật database và chạy

1. Chạy [checkout.sql](src/main/resources/db/manual/checkout.sql) trên đúng
   database/schema ứng dụng, bằng công cụ PostgreSQL đang dùng. Script thêm
   cột token giữ ghế, bảng attempt và index; chạy lặp được, giữ dữ liệu cũ.
   Với `ddl-auto=update`, Hibernate có thể tạo bảng/cột, nhưng vẫn cần SQL
   để có unique index giới hạn một attempt đang hoạt động trên mỗi đơn.
2. Bật PostgreSQL và Redis, khởi động lại backend bằng cấu hình F5 hiện có.
3. Trong `frontend`, chạy `npm.cmd run dev`. Đăng nhập, chọn phim/suất/ghế,
   bấm “Tiếp tục”, chọn combo và phương thức rồi thanh toán.

Migration này đã được kiểm tra trong schema riêng khi chạy test; công việc
triển khai mã nguồn không tự áp dụng migration lên schema dữ liệu thật.

## Cấu hình VNPay Sandbox và lỗi “Sai chữ ký”

Phải dùng cặp `vnp_TmnCode` / `vnp_HashSecret` VNPay cấp cho **cùng một
website Sandbox**. Tài khoản đăng nhập merchant và mật khẩu đăng nhập không
thay thế được cặp thông tin tích hợp này. Xem [hướng dẫn chính thức của VNPay](https://sandbox.vnpayment.vn/apis/docs/gioi-thieu/);
nếu chưa có, [đăng ký merchant Sandbox](https://sandbox.vnpayment.vn/devreg).

Để chạy bằng **F5 / Run Java Program** mà không nhập biến môi trường mỗi lần:

1. Mở `src/main/resources/application.yml`, tìm `application` → `payment` →
   `vnpay` đã có sẵn. **Thay hai giá trị** `tmn-code` và `hash-secret` bằng
   thông tin VNPay cấp; không thêm một block `application` thứ hai:

   ```yaml
   application:
     payment:
       vnpay:
         tmn-code: '<vnp_TmnCode do VNPay cấp>'
         hash-secret: '<vnp_HashSecret do VNPay cấp>'
   ```

   Đây chỉ là phần minh họa vị trí hai khóa, không thay toàn bộ file bằng đoạn
   này. Giữ cấu hình URL Sandbox và return URL đang có. File `application.yml`
   đã được Git bỏ qua; chỉ lưu khóa tại máy, không gửi khóa hoặc mật khẩu vào chat.
2. Dừng backend rồi chạy lại để nạp cấu hình mới.
3. Đơn đang ở `READY` giữ nguyên URL đã ký bằng khóa cũ. Sau lỗi “Sai chữ ký”
   và chưa thanh toán, quay lại Checkout, chọn “Hủy giữ ghế để chọn lại”, rồi
   tạo đơn mới để nhận URL ký bằng cấu hình mới. Không dùng lại URL lỗi cũ.

Nếu dùng biến môi trường, giữ hai giá trị tương ứng là `${VNPAY_TMN_CODE:}` và
`${VNPAY_HASH_SECRET:}`, rồi cấu hình các biến đó cho tiến trình chạy backend.
Ứng dụng không còn mặc định dùng merchant/khóa mẫu. Thiếu một trong hai giá
trị, để nguyên placeholder hoặc có khoảng trắng thừa sẽ bị từ chối trước khi
tạo phiên thanh toán, và giao diện hiển thị thông báo cấu hình.

Chữ ký hiện dùng HMAC-SHA512 trên các tham số sắp xếp theo tên và URL-encode
theo [mẫu Java VNPay 2.1.0](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).
Nếu vẫn lỗi sau khi cấu hình đúng cặp thông tin và tạo đơn mới, kiểm tra cặp
khóa có thuộc cùng website/môi trường và có bị đổi trên VNPay không. Cần đối
chiếu URL của lần thử mới; không suy ra lỗi thuật toán chỉ từ trang báo lỗi.

### VNPay báo “Website này chưa được phê duyệt” (`Error.html?code=71`)

Đây là thông báo từ trang VNPay về website/merchant của yêu cầu đang gửi.
`TmnCode` định danh website/dịch vụ đã khai báo với VNPay; sao chép cặp khóa
từ dự án cũ vẫn dùng định danh đó, không tạo website mới trên VNPay. Chỉ từ
thông báo này chưa thể kết luận do đổi domain/return URL, hoặc chữ ký đã
được xác minh thành công.

1. Đối chiếu `tmn-code` đang cấu hình với email thông tin tích hợp **Sandbox**
   VNPay cấp, không lấy nhầm mã hoặc cặp thông tin môi trường thanh toán thật.
2. Thử tạo URL mới từ dự án cũ với cùng cặp thông tin, chỉ cần đến màn hình
   chọn phương thức/ngân hàng. Nếu cả hai cùng báo chưa phê duyệt, ưu tiên
   kiểm tra trạng thái merchant với VNPay. Nếu dự án cũ vẫn mở được, so sánh
   mã website, endpoint, return URL và cấu hình thực tế của hai tiến trình;
   không gửi khóa bí mật khi đối chiếu.
3. Kiểm tra trạng thái website/terminal trong tài khoản merchant hoặc nhờ
   [hỗ trợ kỹ thuật VNPay](https://sandbox.vnpayment.vn/apis/contact/) xác nhận
   trạng thái và việc sử dụng mã đó cho dự án cinema_booking. Cung cấp mã
   website, môi trường Sandbox, mã tra cứu và thời điểm trên trang lỗi;
   không gửi HashSecret/mật khẩu.
4. Sau khi VNPay xác nhận mã đã được phép sử dụng (hoặc cấp mã Sandbox mới),
   cập nhật cấu hình nếu cần, khởi động lại backend và thử bằng đơn mới.

Backend không có quyền phê duyệt website trên VNPay. Không thay thuật toán
ký hoặc tự đổi trạng thái đơn sang thành công để xử lý thông báo này.

## Hợp đồng API bổ sung

GET `/api/v1/bookings/{code}` trả thêm:

- `serverTime`: thời gian server dạng Instant/ISO có timezone.
- `checkoutRevision`: SHA-256 của nội dung đơn đã lưu, dùng nguyên giá trị
  này trong request; không tự tính tại frontend.
- `checkout`: `state`, `canEditProducts`, `expiresAt` có timezone,
  `paymentMethod`, `paymentUrl` khi phiên READY còn hợp lệ.

PUT `/api/v1/bookings/{code}/products`:

```json
{
  "expectedRevision": "<checkoutRevision từ GET>",
  "products": [{ "productId": 1, "quantity": 2 }]
}
```

Danh sách rỗng bỏ toàn bộ combo. Không gửi quantity 0 hoặc ID trùng. Backend
tính lại giá combo, giữ giá vé đã đặt và expiresAt. Phiên bản cũ trả 409;
khách phải tải lại/xác nhận đơn, không âm thầm ghi đè từ tab khác.

POST `/api/v1/payments/create-url`:

```json
{
  "bookingCode": "<mã đơn>",
  "paymentMethod": "VNPAY",
  "expectedRevision": "<revision sau PUT và xác nhận giá>"
}
```

Client/Postman cũ cần bổ sung expectedRevision. Phản hồi 200 có state READY
và paymentUrl; 202 nghĩa là chưa có URL được xác nhận, cần GET lại đơn.
Không redirect nếu thiếu URL hoặc host/scheme không đúng Sandbox.

## Phiên thanh toán và lỗi mạng

- EDITABLE: có thể chọn combo/phương thức, lưu khi bấm thanh toán.
- CREATING: intent đã lưu và đang gọi cổng ngoài transaction DB.
- READY: có URL đã lưu; tiếp tục trực tiếp URL, không PUT hoặc tạo giao dịch mới.
- UNKNOWN: chưa đủ bằng chứng về kết quả gửi yêu cầu. Giỏ/phương thức được
  giữ nguyên, kiểm tra trạng thái bằng GET; không tự tạo order/request ID mới.
- REJECTED: kết quả từ chối cuối cùng đã được xác nhận cho attempt; đơn còn
  hạn trở lại EDITABLE để chỉnh/thử lại. Không coi mọi HTTP error là REJECTED.
- CLOSED: đơn kết thúc hoặc thời hạn đã qua, không bắt đầu thanh toán mới.

Payment cũ thiếu attempt/reference được giữ nguyên và xem là UNKNOWN. Không
tự chuyển các giao dịch lịch sử thành chưa gửi. Phục hồi UNKNOWN hiện dựa
vào URL đã lưu hoặc IPN hợp lệ; chưa có job tự đối soát mọi giao dịch với
cổng. Khi mất phản hồi create mà cổng chưa gửi IPN, có thể phải chờ hoặc hủy
giữ chỗ. Hủy giữ chỗ không có nghĩa giao dịch tại cổng cũng đã được hủy.

Một Payment giữ các attempt riêng để đối chiếu. Request lặp dùng đúng
attempt đã lưu; IPN kiểm tra chữ ký, merchant, reference/request ID và số tiền
đã chốt. Không tạo Payment từ một IPN không nhận diện được. Kết quả SUCCESS
không bị callback lỗi đến trễ ghi đè.

MoMo không còn fallback URL giả `resultCode=0`. Nếu gọi cổng lỗi hoặc thiếu
payUrl hợp lệ, hệ thống giữ UNKNOWN và ghi mã lỗi đã lọc, không báo thành công.
Lưu URL nhạy cảm chỉ để owner/admin tiếp tục phiên; không log URL/chữ ký/token
hoặc toàn bộ IPN. Quy tắc kết quả tham khảo [MoMo result codes](https://developers.momo.vn/v3/docs/payment/api/result-handling/resultcode/)
và [VNPAY payment](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html).

## Ghế và thời gian

Clock backend thống nhất giờ Việt Nam. Countdown dùng serverTime/deadline và
đồng hồ monotonic, đồng bộ khi quay lại tab. Giao diện xác minh server khi về 0.

Cancel/IPN/expiry khóa booking trước, ghế theo ID tăng dần. Cron ghế mồ côi
kiểm tra lại sau khóa ghế. Redis dùng token riêng từng lượt giữ, nhả bằng
compare-and-delete. WebSocket gửi version ghế sau commit; client bỏ message
cũ và làm mới sơ đồ khoảng 30 giây khi trang đang mở.

Side effect sau commit là best-effort. Lỗi Redis/WebSocket không hoàn tác
một thay đổi DB đã commit. Key cũ không xóa được có thể chặn chọn lại đến TTL
gốc (mặc định tối đa 600 giây); không gia hạn key hoặc hứa phục hồi ngay.

## Trang kết quả VNPay

Đã có route `/payment/vnpay-callback`. Sau khi cập nhật mã nguồn, khởi động
lại backend và tải lại trang callback đang mở; không phải thanh toán lại để
xem kết quả của giao dịch vừa thực hiện. Đăng nhập đúng tài khoản đã đặt vé.

Frontend gửi các tham số trả về bằng JSON tới endpoint yêu cầu đăng nhập
`POST /api/v1/payments/vnpay-return`. Backend kiểm tra chữ ký, merchant,
reference và số tiền đã chốt, tra mã đơn từ payment attempt rồi kiểm tra
quyền owner/admin. Endpoint chỉ đọc kết quả và trả `Cache-Control: no-store`;
không ghi nhận thanh toán chỉ vì trình duyệt quay lại.

- Khi chữ ký hợp lệ và VNPay báo `00/00` nhưng đơn chưa xác nhận: hiển thị
  “VNPay đã ghi nhận thanh toán”, kèm trạng thái chờ xác nhận vé.
- Chỉ hiển thị “Đặt vé thành công” khi DB có booking `CONFIRMED` và payment
  `SUCCESS`. Hiển thị riêng trường hợp hủy tại VNPay, thất bại, cần xử lý
  hoàn tiền, URL không hợp lệ hoặc người dùng không có quyền.
- Khi chưa có kết quả cuối, tự kiểm tra khoảng 3 giây/lần trong khoảng một
  phút khi tab mở, rồi cho phép bấm “Kiểm tra trạng thái”. Tải lại trang
  vẫn tra được đơn bằng reference; không lấy mã đơn bằng cách cắt OrderInfo.

Nếu trang chờ xác nhận liên tục, kiểm tra cấu hình **IPN** của merchant:
VNPay phải truy cập được địa chỉ HTTPS public chuyển tiếp tới
`GET /api/v1/payments/vnpay-ipn` của backend (cổng 8080). Không cấu hình IPN
thành route frontend ở cổng 5173. `localhost` trên máy bạn không phải địa chỉ
VNPay có thể gọi từ ngoài Internet. Return URL hiện là
`http://localhost:5173/payment/vnpay-callback` và dùng cho trình duyệt quay về.
Có thể dùng domain triển khai hoặc tunnel HTTPS cho backend, rồi khai báo
IPN đó với VNPay; tunnel cần còn hoạt động trong lúc thử giao dịch.

Theo [phân biệt Return URL và IPN của VNPay](https://sandbox.vnpayment.vn/apis/docs/faqs/),
IPN dùng để cập nhật thanh toán; Return URL dùng để hiển thị kết quả.
Trang này không tự gọi lại endpoint IPN để ép xác nhận đơn. Với giao dịch
đã trả tiền nhưng chưa có IPN, cần kiểm tra/đối soát giao dịch; không yêu cầu
khách thanh toán lại. QR và trang callback MoMo vẫn là phần tiếp theo.

### Thẻ test thành công nhưng trang vẫn chờ xác nhận

**IPN (Instant Payment Notification)** là thông báo máy chủ VNPay gửi trực
tiếp tới backend để xác nhận giao dịch. Có hai luồng riêng sau khi nhập OTP:

```text
VNPay → trình duyệt → localhost:5173/payment/vnpay-callback
                     Hiển thị kết quả

Máy chủ VNPay → HTTPS public → localhost:8080/api/v1/payments/vnpay-ipn
                              Xác minh, cập nhật thanh toán và chốt ghế
```

Thẻ test “Thành công” xác định kết quả phía Sandbox; nó không tự thiết lập
địa chỉ IPN của merchant. Khi chưa nhận/xử lý được IPN hợp lệ, database vẫn
có payment `PENDING` dù trang nhận được kết quả có chữ ký `00/00`.

Để nhận IPN khi phát triển trên Windows:

1. Giữ backend chạy ở cổng 8080. Cài ngrok và kết nối tài khoản theo
   [hướng dẫn chính thức](https://ngrok.com/docs/gateway/endpoints/agent-cli-quickstart).
   Sau khi cài, mở PowerShell và chạy một lần với authtoken của **ngrok**:

   ```powershell
   ngrok config add-authtoken '<authtoken từ tài khoản ngrok>'
   ```

2. Chạy tunnel và giữ Terminal này mở trong suốt buổi kiểm thử:

   ```powershell
   ngrok http 8080
   ```

   Lấy địa chỉ **HTTPS** ở dòng `Forwarding`, ví dụ
   `https://ten-cua-ban.ngrok-free.app`. Dùng đúng domain ngrok thực tế cấp.
3. Ghép địa chỉ đó với endpoint backend để có **IPN URL**:

   ```text
   https://ten-cua-ban.ngrok-free.app/api/v1/payments/vnpay-ipn
   ```

   Khai báo URL này cho **merchant Sandbox mới** ở phía VNPay. Nếu tài khoản
   không có mục chỉnh IPN, liên hệ [hỗ trợ kỹ thuật VNPay](https://sandbox.vnpayment.vn/apis/contact/)
   với TmnCode, môi trường Sandbox và IPN URL; không gửi HashSecret.
   Địa chỉ này cần được VNPay lưu vào cấu hình merchant. Thêm một dòng
   `ipn-url` vào `application.yml` không đăng ký nó với VNPay; code VNPay
   hiện tại cũng không đọc thuộc tính đó. Giữ `return-url` hiện tại để
   trình duyệt quay lại frontend trên máy.
4. Kiểm tra kết nối qua domain public, **không kèm tham số thanh toán**:

   ```powershell
   Invoke-RestMethod 'https://ten-cua-ban.ngrok-free.app/api/v1/payments/vnpay-ipn'
   ```

   Kết quả mong đợi là HTTP 200 với `RspCode: 97`, `Message: Invalid Checksum`.
   Đây là phản hồi đúng cho lần thử không có chữ ký: chứng minh request đã
   tới backend và không cần đăng nhập, nhưng chưa chứng minh VNPay đã lưu
   IPN URL. HTML, trang yêu cầu đăng nhập, 404 hoặc 502 nghĩa là chưa tới
   đúng endpoint. Không thêm lớp đăng nhập tương tác trước đường dẫn IPN.
5. Sau khi VNPay xác nhận cấu hình, kiểm thử bằng **một đơn Sandbox riêng**.
   Kiểm tra request IPN trong trình kiểm tra request của ngrok và Terminal
   backend (`GET /api/v1/payments/vnpay-ipn`). Request thật phải có chữ ký
   hợp lệ; `RspCode: 00` là đã xử lý, `02` là đã xử lý trước đó. Đối chiếu
   payment `SUCCESS`, booking `CONFIRMED` và ghế `BOOKED`; khi không còn giữ
   được ghế, có thể cần xử lý hoàn tiền thay vì cấp vé.

Với **đơn đã thanh toán trước khi cấu hình IPN**, không trả tiền lần nữa cho
đơn đó. Cập nhật IPN URL không bảo đảm VNPay tự gửi lại thông báo cũ; cần
kiểm tra lịch sử/gửi lại IPN qua công cụ chính thức nếu được hỗ trợ, hoặc
nhờ VNPay hỗ trợ đối soát. Không sửa SQL thành `SUCCESS` và không sao chép
tham số Return URL sang endpoint IPN để giả lập thông báo máy chủ.

Mỗi buổi thử cần backend và tunnel cùng chạy. Nếu domain tunnel thay đổi,
cập nhật IPN URL ở VNPay trước khi thử tiếp. Nút “Kiểm tra trạng thái” chỉ
đọc kết quả hiện có; nó không yêu cầu VNPay gửi IPN.

## Kiểm thử

Các test PostgreSQL dùng service/repository thật với schema `checkout_test_*`
riêng và tự xóa khi xong. Không chạy scheduler/sync hoặc gửi request sang cổng.
Chỉ định DB dev/test có quyền tạo schema:

```powershell
$env:CINEMA_TEST_DB_URL = 'jdbc:postgresql://localhost:<port>/<database>'
$env:CINEMA_TEST_DB_USER = '<user>'
$env:CINEMA_TEST_DB_PASSWORD = '<password>'
$env:CINEMA_TEST_REDIS = 'true'
.\mvnw.cmd '-Dtest=CheckoutPostgresTests,PaymentGatewayTests,RedisHoldTokenTests,BookingControllerTests,SeatLockServiceTests,ShowtimeControllerTests' test
```

RedisHoldTokenTests dùng key ngẫu nhiên riêng trên Redis 127.0.0.1:6379 và
dọn sau khi chạy. Hai lớp cần hạ tầng sẽ skip nếu không đặt biến môi trường;
không coi skip là đã kiểm chứng PostgreSQL/Redis.

Frontend: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`, rồi
`npm.cmd run test:checkout-browser`. Kiểm tra trình duyệt dùng Edge headless
ẩn trên Windows (có thể đặt CHECKOUT_EDGE_PATH), chặn REST/Sandbox bằng phản
hồi mô phỏng, không tạo đơn thật. Ảnh và báo cáo lỗi lưu trong thư mục temp
được in ra khi chạy.

Kiểm thử cổng thật cần merchant Sandbox hợp lệ và IPN URL mà cổng truy cập
được; localhost không đủ để nhận IPN từ ngoài máy. Trang kết quả VNPay đã
được kiểm tra bằng 8 test chữ ký/quyền truy cập/controller, 1 test PostgreSQL
về Return → chờ IPN → xác nhận và các luồng trình duyệt mô phỏng.
