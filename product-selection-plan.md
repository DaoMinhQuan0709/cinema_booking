# Kế hoạch chức năng chọn sản phẩm

## Mục tiêu và quyết định

Luồng: **Chọn suất → Chọn ghế → Chọn sản phẩm → Thanh toán → Kết quả**.

- Toàn bộ bắp, nước và combo đang bán dùng chung cho mọi rạp; sản phẩm là tùy chọn.
- Lưu khi bấm “Tiếp tục thanh toán”; reload khôi phục lựa chọn đã lưu gần nhất.
- Dùng cùng booking, giữ nguyên thời hạn 10 phút, giá vé và khóa ghế.
- Tái sử dụng API; không thay entity/schema; không tự chạy SQL trên database ứng dụng.
- Giữ theme tối/đỏ, desktop/mobile; không mở rộng tồn kho, biến thể, khuyến mãi hay giá theo rạp.
- Thiết kế: vé điện ảnh tối/đỏ, countdown và đường phân cách vé là điểm nhấn; dùng font/token hiện có, nhịp 4/8px, chuyển động tối thiểu. DFII: 3 + 5 + 4 + 4 − 2 = 14.

## Checklist triển khai

Thực hiện theo thứ tự; kiểm tra và đánh dấu từng mục trước khi chuyển mục kế tiếp.

### 1. Tách thành phần dùng chung
- [x] Tách truy vấn đơn, countdown, tóm tắt vé và xác nhận hủy khỏi Checkout.
- [x] Giữ nguyên xử lý phiên đăng nhập, quyền sở hữu và trạng thái thanh toán.
Đạt khi: Checkout hiện tại vẫn hoạt động sau khi tách.
Kiểm tra: 153 unit test, lint/build và 18 luồng browser Checkout/VNPay qua, không có runtime exception.

### 2. Thêm bước và điều hướng chọn sản phẩm
- [x] Thêm route `/booking/:bookingCode/products` dưới MainLayout.
- [x] Giữ ghế thành công hoặc khôi phục đơn EDITABLE → chọn sản phẩm; đã bắt đầu thanh toán → Checkout.
- [x] Cập nhật tiến trình; giữ URL Checkout cũ và liên kết “Vé của tôi”.
Đạt khi: dùng đúng mã đơn, không tạo booking mới.
Kiểm tra: 6 unit test điều hướng/Checkout và build qua; kiểm thử toàn luồng ở mục 8.

### 3. Hoàn thiện ảnh sản phẩm
- [x] Đường dẫn `/images/...` dùng origin backend từ API_BASE_URL; giữ URL HTTP/HTTPS đầy đủ.
- [x] Cho phép GET công khai `/images/**`; ảnh thiếu/lỗi có fallback.
Đạt khi: ảnh tĩnh đúng chữ hoa/thường tải được khi không đăng nhập.
Kiểm tra: 2 unit test URL ảnh và 7 SecurityAuthorizationTests qua; GET đủ 10 PNG không Bearer thành công, POST ảnh vẫn yêu cầu xác thực.

### 4. Xây dựng giao diện chọn sản phẩm
- [x] Thẻ ảnh, tên, mô tả, giá, tăng/giảm từ 0; bản nháp từ đơn đã lưu.
- [x] Thông tin phim/suất/ghế, countdown, tiền vé/sản phẩm/tổng; desktop hai cột, mobile có thanh hành động cuối màn hình.
- [x] Loading, lỗi/thử lại, catalog trống, sản phẩm ngừng bán; thao tác bàn phím.
Đạt khi: tạm tính đúng; giảm hết về 0 vẫn tiếp tục chỉ với vé.
Kiểm tra: build và 8 unit test mô hình sản phẩm/checkout qua. Nút lưu sẽ được kết nối ở mục 5; kiểm tra tương tác desktop/mobile ở mục 8.

### 5. Lưu lựa chọn và xử lý lỗi
- [x] PUT `{expectedRevision, products: [{productId, quantity}]}`, bỏ quantity 0; khóa bấm lặp, cập nhật cache đơn/vé.
- [x] Giá server khác tạm tính phải được xác nhận trước khi chuyển bước.
- [x] Lỗi mạng giữ bản nháp và GET đối chiếu; 409 yêu cầu tải lại rõ ràng; không âm thầm ghi đè/xóa sản phẩm.
- [x] Chặn sửa đơn không còn EDITABLE/còn hạn; bỏ phản hồi thuộc phiên đăng nhập cũ.
Đạt khi: thay toàn bộ lựa chọn đúng, không cộng dồn hoặc gia hạn giữ ghế.
Kiểm tra: lint/build và 7 luồng browser sản phẩm qua (guest, lưu tạm, bỏ qua, giá mới mobile, catalog lỗi, 409, ngừng bán), không runtime exception. Mất phản hồi/đổi phiên kiểm tra thêm ở mục 8.

### 6. Kết nối Checkout và hủy giữ ghế
- [x] Checkout chỉ hiện sản phẩm đã lưu và liên kết chỉnh sửa.
- [x] PUT kiểm tra lại giá/revision trước tạo URL; giá đổi phải xác nhận, ngừng bán quay lại chỉnh.
- [x] Giữ READY/CREATING/UNKNOWN; không tạo thanh toán lặp.
- [x] Hủy có xác nhận; chỉ về sơ đồ khi API thành công.
Đạt khi: cả hai bước dùng cùng đơn và deadline gốc.
Kiểm tra: lint/build và 25 luồng browser sản phẩm/Checkout/VNPay qua, bao gồm kiểm tra lại giá, sửa sản phẩm ngừng bán, READY sau mất phản hồi, hủy lỗi/thành công và điều hướng từ ghế.

### 7. Cập nhật tài liệu
- [x] Hướng dẫn luồng mới, reload/bản nháp và SQL seed/ảnh hiện có.
Đạt khi: tài liệu phản ánh đúng hành vi triển khai.
Kiểm tra: liên kết trong plan/README/Checkout đã được kiểm tra tồn tại; cập nhật kế hoạch frontend và chú thích thiết kế Checkout cũ.

### 8. Kiểm chứng cuối
- [x] Unit: số lượng, payload, tổng tiền, giá thay đổi, URL ảnh.
- [x] Browser: ghế → sản phẩm → thanh toán, quay lại/reload/khôi phục; lỗi/trống/ảnh/ngừng bán/mất phản hồi/409/đổi phiên.
- [x] Browser: hết hạn/hủy/sai chủ/đang thanh toán; desktop/mobile và bàn phím.
- [x] Frontend test/lint/build và hồi quy Checkout; backend test liên quan, PostgreSQL test khi có môi trường riêng (ghi rõ skip).
Hoàn thành khi: luồng hoạt động xuyên suốt, tiền chính xác, không tạo đơn/thanh toán lặp hoặc thay đổi deadline.

## Kết quả kiểm chứng

Hoàn tất ngày 20/11/2026 (Asia/Ho_Chi_Minh).

- `npm.cmd test`: **158/158 qua**, không skip.
- `npm.cmd run lint`, `npm.cmd run build`: qua.
- `npm.cmd run test:checkout-browser`: **32 kịch bản qua**, 0 runtime exception, REST/Sandbox mô phỏng. Có kiểm tra native Enter, ảnh PNG thực từ thư mục static, layout desktop/mobile và CineBot không che nút tiếp tục.
- Backend: `SecurityAuthorizationTests,BookingControllerTests,CheckoutPostgresTests,PaymentGatewayTests,PaymentReturnTests,SeatLockServiceTests`: **36 qua, 15 skip, 0 lỗi**. 15 test PostgreSQL skip vì không có `CINEMA_TEST_DB_URL`; chưa kiểm chứng lại DB/Redis thật hoặc merchant Sandbox trong lần triển khai này.
- SecurityAuthorizationTests kiểm tra GET đủ 10 ảnh PNG công khai và POST ảnh vẫn yêu cầu xác thực.
- `git diff --check`: qua. Không thay schema, chạy SQL ứng dụng, commit hoặc push.

Các lỗi được phát hiện và sửa trong kiểm chứng: giữ sản phẩm đã lưu khi catalog lỗi; tự xác minh phiên sau đổi tài khoản từ tab khác; cho đóng dialog giá khi đơn thay đổi; nâng CineBot trên mobile tại bước sản phẩm.

Khởi động lại backend để nạp quyền GET ảnh mới. Nếu chưa có dữ liệu, dùng công cụ PostgreSQL hiện có để chạy seed-products.sql rồi update-product-images.sql trên đúng database/schema theo CHECKOUT.md.
