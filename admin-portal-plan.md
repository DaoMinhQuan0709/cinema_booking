# Kế hoạch xây dựng Admin Portal

Ngày lập: 11/11/2026. Nguồn yêu cầu: [mục V.7 của kế hoạch frontend](ke_hoach_frontend.md).

**Mục tiêu:** Xây dựng Admin Portal gồm phân quyền, báo cáo, quản lý phim, xếp lịch và nhập dữ liệu Galaxy mẫu.

## Phạm vi và nền tảng

- Bốn màn hình: `/admin/reports`, `/admin/movies`, `/admin/showtimes`, `/admin/sync`; `/admin` chuyển đến báo cáo.
- Dùng React 19/Router 7, Vite, Tailwind, Zustand, TanStack Query, Axios và Sonner hiện có; bổ sung `recharts` khi làm biểu đồ.
- Mã tập trung tại `src/features/admin/`, `layouts/AdminLayout.jsx`, `routes/AdminRoute.jsx`, `services/adminService.js`; nối route trong `App.jsx`.
- Bản đầu: danh sách/thêm/sửa phim, danh sách suất đang mở bán/thêm suất. Quản lý tài khoản, CRUD rạp/phòng/ghế/combo, xóa dữ liệu, sửa suất và lịch sử suất chiếu dành cho đợt mở rộng.

## Những điểm đã đối chiếu với mã hiện tại

- Frontend chưa có màn hình Admin, `adminService.js` trống; Header đã có liên kết. Backend đã bảo vệ `/api/v1/admin/**` bằng quyền ADMIN.
- Đọc phim: `GET /movies` trả `PageResponse.content`; thêm/sửa: `POST /admin/movies`, `PUT /admin/movies/{id}` theo `MovieCreateRequest`, ảnh/trailer dùng URL.
- `GET /cinemas` chứa phòng `auditoriums`; `GET /showtimes` chỉ trả suất mở bán. `POST /admin/showtimes` bắt buộc `endTime`, đã kiểm tra trùng phòng/giờ và trả `409`.
- Báo cáo doanh thu đang lọc theo ngày tạo đơn `CONFIRMED`, gồm tiền combo; breakdown thiếu lọc phim/rạp và số vé nhóm đang gán 0. Occupancy nhận một ngày, hiện bỏ suất inactive và chỉ đếm ghế đã sinh inventory; cần sửa ở phần 6.
- Sync local-file nhập file phía backend, mặc định 100 suất, là nguồn offline. `lastSuccessAt` từ `/admin/sync/galaxy/status` chỉ dành cho online đầy đủ; lịch sync tự động có thể cập nhật lại dữ liệu Galaxy.

## Các phần triển khai

Mỗi phần là một mốc bàn giao; khi bắt đầu, tách thành việc 2–5 phút có đầu ra kiểm tra được. Đánh dấu hoàn tất sau nghiệm thu.

| Xong | Phần | Công việc và đầu ra | Kiểm chứng |
| :---: | --- | --- | --- |
| [ ] | **1. Phân quyền và phiên** | Tạo `AdminRoute`, trạng thái kiểm tra phiên trong `authStore`; xác minh `/users/me` trước khi tải Admin, dùng lại đăng nhập và giữ URL đích; xử lý 401/403, xóa cache Admin khi đổi phiên. | CUSTOMER bị chặn; ADMIN vào được khi F5; đăng nhập trở về URL đích; hết phiên ngừng tải Admin. |
| [ ] | **2. Khung quản trị** | Tạo `AdminLayout`: sidebar, tài khoản/đăng xuất, menu mobile, liên kết website và `Suspense`; bốn route lazy-load, màu/font hiện có. | Mở trực tiếp URL, menu active đúng, dùng được ở 390px/desktop và bằng bàn phím. |
| [ ] | **3. Service và UI chung** | Điền `adminService.js`, tạo query hooks, bảng/modal và loading/rỗng/lỗi; dùng lại service catalog, chặn gửi lặp, làm mới cache liên quan sau khi ghi. | Bearer/payload đúng; validation 400 gắn vào trường; toast một lần; mutation không tự retry khi mất phản hồi. |
| [ ] | **4. Quản lý phim** | `MovieManager`: tìm tên, lọc ba trạng thái, phân trang server, thêm/sửa đúng DTO; kiểm tra tên/thời lượng/ngày/URL. | Thêm/sửa rồi F5 vẫn đúng; lỗi giữ form; catalog khách cập nhật theo trạng thái phim. |
| [ ] | **5. Quản lý suất chiếu** | `ShowtimeManager`: lọc ngày/rạp/phim, chọn phòng thuộc rạp, thêm suất; gợi ý kết thúc = thời lượng + 15 phút, gửi đủ hai mốc giờ Việt Nam; kiểm tra giá dương, giờ tương lai và thứ tự giờ. | Suất mới hiện ở lịch khách; trùng giờ trả 409 và giữ form; đổi rạp cập nhật phòng. |
| [ ] | **6. Sửa dữ liệu báo cáo** | Sửa `AdminReportServiceImpl`/repository: KPI và breakdown cùng bộ lọc, số vé nhóm đúng; occupancy gồm suất đã kết thúc và sức chứa chưa sinh inventory, thể hiện thiếu cấu hình. Chỉ BOOKED tính là đã bán. | Dữ liệu mẫu có tổng nhóm khớp KPI; tỷ lệ không đổi chỉ vì mở sơ đồ ghế; xử lý mẫu số 0, báo cáo không ghi dữ liệu. |
| [ ] | **7. Dashboard báo cáo** | `ReportDashboard` + `recharts`: KPI doanh thu/đơn/vé; doanh thu lọc khoảng ngày/phim/rạp, `groupBy=movie|cinema`; occupancy có ngày riêng. Bộ lọc lưu URL, hiển thị VND/% và cơ sở tính. | Đổi lọc cập nhật số/biểu đồ/bảng; Back/F5 giữ lọc; chặn ngày đảo ngược; có empty/error/retry. |
| [ ] | **8. Galaxy mẫu** | `DataSync`: gọi `POST /admin/sync/galaxy/local-file`, hiển thị giới hạn và số lượng xử lý; khóa khi chạy, xử lý 409/timeout, làm mới catalog/báo cáo; ghi rõ nguồn offline. | Một lần bấm/một POST; timeout không tự gửi lại; phân biệt kết quả nhập mẫu với trạng thái online. |
| [ ] | **9. Kiểm chứng và bàn giao** | Trong `frontend`: `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, thêm kiểm thử Admin bằng Edge/API giả lập; trong backend: `.\mvnw.cmd test`. Thử API thật với ADMIN/CUSTOMER trên dữ liệu thử; cập nhật README và kế hoạch frontend. | Đạt phân quyền, phim, lịch/409, báo cáo, sync trên desktop/mobile; hồi quy catalog/booking/checkout/CineBot. Ghi rõ kết quả giả lập và tích hợp thật. |

**Phụ thuộc:** `1 → 2 → 3`; tiếp theo 4, 5, 6, 8 độc lập; `6 → 7`; phần 9 luôn cuối. Đường găng: `1 → 2 → 3 → 6 → 7 → 9`.

**Hoàn tất khi:** Bốn màn hình dùng được với API thật, phân quyền frontend/backend đúng, báo cáo khớp bộ lọc và phần 9 đạt. Hiện các phần triển khai đều chưa bắt đầu.
