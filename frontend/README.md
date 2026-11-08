# PremierCinema frontend

React, Vite và Tailwind CSS. Trạng thái xác thực dùng Zustand, dữ liệu phim dùng
TanStack Query, REST dùng Axios và cập nhật ghế dùng STOMP/SockJS.

## Chạy tại máy phát triển

Từ thư mục `frontend`, cài dependency bằng `npm ci`, sao chép `.env.example`
thành `.env` nếu cần tùy chỉnh URL, rồi chạy `npm run dev`.
Backend mặc định phục vụ REST tại `http://localhost:8080/api/v1` và WebSocket
tại `http://localhost:8080/ws`. Trên PowerShell chặn `npm.ps1`, dùng `npm.cmd`.

```powershell
npm.cmd ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd run dev
```

Chỉ sao chép file môi trường khi chưa có cấu hình riêng. Không đưa khóa bí mật
vào biến `VITE_*` vì các giá trị này được đưa vào mã JavaScript gửi đến trình duyệt.

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
- `src/services`: các lời gọi API theo module.
- `src/config`: Axios, lưu token, cấu hình và kết nối WebSocket.
- `src/layouts`, `src/components/common`: khung trang, header và footer.

Trang chủ hiển thị tối đa 15 phim mỗi mục; nút “Xem thêm” mở `/movies` tại đúng
mục đang xem. Trang `/movies` hiển thị toàn bộ phim đang chiếu/sắp chiếu, hỗ trợ
tìm tên không dấu và sắp xếp. Trạng thái mục, tìm kiếm, sắp xếp lưu trong URL
(`status`, `q`, `sort`) để có thể chia sẻ và dùng nút quay lại của trình duyệt.

Trang chủ, danh sách và trang chi tiết hiển thị dữ liệu thật từ backend, có modal xác thực
và chọn suất chiếu. Route `/booking/:showtimeId` hiện là trang chờ; kiểm tra đăng
nhập sẽ được triển khai cùng màn hình chọn ghế. Các route lịch chiếu toàn quốc,
cụm rạp và lịch sử vé vẫn là trang chờ triển khai. Mã kết nối booking,
payment, admin và chatbot được giữ để phục vụ các bước frontend tiếp theo.

Xem [hướng dẫn backend/Galaxy](../backend/cinema-booking-backend/GALAXY_SYNC.md)
để khởi động backend và hiểu ranh giới giữa catalog Galaxy và kho ghế nội bộ.
