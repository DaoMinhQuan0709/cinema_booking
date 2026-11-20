# Đặt vé và chọn sản phẩm

Luồng: `/booking/:showtimeId` → `/booking/:bookingCode/products` →
`/checkout/:bookingCode` → cổng thanh toán/kết quả. Chỉ trang ghế tạo booking;
các bước sau dùng mã đơn backend trả về, không đổi deadline hoặc khóa ghế.

## Chọn sản phẩm

Danh mục bắp, nước và combo dùng GET `/products`, dùng chung cho mọi rạp.
Số lượng trong trang là bản nháp; tăng/giảm không gửi request ghi. Bấm tiếp
tục PUT `/bookings/{code}/products` với `expectedRevision` và toàn bộ lựa chọn
`[{productId, quantity}]`; bỏ quantity 0, danh sách rỗng bỏ tất cả sản phẩm.
Không bắt buộc mua kèm. Reload lấy lựa chọn đã lưu gần nhất từ GET đơn,
không khôi phục bản nháp chưa lưu.

Backend quyết định giá; tổng tiền hoặc đơn giá mới phải được xác nhận trước
khi chuyển Checkout. Từ chối xác nhận trở lại chỉnh với giá vừa lưu, giữ nguyên
thời hạn. Catalog lỗi không xóa sản phẩm; sản phẩm ngừng bán vẫn hiện để bỏ.
409 giữ bản nháp và yêu cầu tải lại rõ ràng. Mất phản hồi PUT phải GET đối
chiếu, không tự retry thao tác ghi.

Checkout chỉ hiển thị sản phẩm đã lưu và liên kết chỉnh sửa. Trước tạo URL,
PUT xác minh lại giá/revision; giá thay đổi phải xác nhận, ngừng bán quay lại
chỉnh. READY tiếp tục URL cũ không PUT/POST thêm; CREATING/UNKNOWN chỉ kiểm
tra trạng thái. Route sản phẩm của đơn không EDITABLE chuyển sang Checkout.
URL Checkout cũ và liên kết “Vé của tôi” không buộc qua bước sản phẩm.

## Thành phần dùng chung

- `BookingPageAccess`: xác minh phiên, mã đơn, truy vấn và quyền truy cập.
- `hooks/useCheckoutBooking`: query theo tài khoản/phiên/mã đơn, countdown
  theo server và đồng hồ monotonic, hủy giữ ghế, bỏ phản hồi sau unmount/đổi phiên.
- `BookingUI`: tiến trình, tóm tắt vé/tiền, dialog xác nhận và thông báo.
- `ProductCard`/`ProductImage`: số lượng truy cập bằng bàn phím, ảnh lazy/fallback.

Ảnh `/images/...` dùng origin backend theo `VITE_API_BASE_URL`; URL HTTP/HTTPS
đầy đủ giữ nguyên. Backend cho GET ảnh công khai. Cách seed sản phẩm/ảnh:
[CHECKOUT.md](../../../../backend/cinema-booking-backend/CHECKOUT.md).

## Kiểm chứng

Trong `frontend`: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`,
`npm.cmd run test:checkout-browser`. Chỉ nhóm sản phẩm:
`npm.cmd run test:checkout-browser -- --products-only`.

Browser dùng Edge headless, REST và Sandbox được mô phỏng, không ghi database
ứng dụng hoặc gọi merchant thật. Báo cáo/ảnh nằm trong thư mục temp được in
ra sau chạy. Backend kiểm tra GET 10 PNG công khai bằng SecurityAuthorizationTests;
CheckoutPostgresTests dùng schema riêng và skip khi thiếu CINEMA_TEST_DB_URL.
