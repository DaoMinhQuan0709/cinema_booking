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
| [x] | **1. Phân quyền và phiên** | Tạo `AdminRoute`, trạng thái kiểm tra phiên trong `authStore`; xác minh `/users/me` trước khi tải Admin, dùng lại đăng nhập và giữ URL đích; xử lý 401/403, xóa cache Admin khi đổi phiên. | Đạt bằng Edge/API mô phỏng và MockMvc ngày 12/11/2026; API thật còn ở phần 9. |
| [ ] | **2. Khung quản trị** | Tạo `AdminLayout`: sidebar, tài khoản/đăng xuất, menu mobile, liên kết website và `Suspense`; bốn route lazy-load, màu/font hiện có. | Mở trực tiếp URL, menu active đúng, dùng được ở 390px/desktop và bằng bàn phím. |
| [ ] | **3. Service và UI chung** | Điền `adminService.js`, tạo query hooks, bảng/modal và loading/rỗng/lỗi; dùng lại service catalog, chặn gửi lặp, làm mới cache liên quan sau khi ghi. | Bearer/payload đúng; validation 400 gắn vào trường; toast một lần; mutation không tự retry khi mất phản hồi. |
| [ ] | **4. Quản lý phim** | `MovieManager`: tìm tên, lọc ba trạng thái, phân trang server, thêm/sửa đúng DTO; kiểm tra tên/thời lượng/ngày/URL. | Thêm/sửa rồi F5 vẫn đúng; lỗi giữ form; catalog khách cập nhật theo trạng thái phim. |
| [ ] | **5. Quản lý suất chiếu** | `ShowtimeManager`: lọc ngày/rạp/phim, chọn phòng thuộc rạp, thêm suất; gợi ý kết thúc = thời lượng + 15 phút, gửi đủ hai mốc giờ Việt Nam; kiểm tra giá dương, giờ tương lai và thứ tự giờ. | Suất mới hiện ở lịch khách; trùng giờ trả 409 và giữ form; đổi rạp cập nhật phòng. |
| [ ] | **6. Sửa dữ liệu báo cáo** | Sửa `AdminReportServiceImpl`/repository: KPI và breakdown cùng bộ lọc, số vé nhóm đúng; occupancy gồm suất đã kết thúc và sức chứa chưa sinh inventory, thể hiện thiếu cấu hình. Chỉ BOOKED tính là đã bán. | Dữ liệu mẫu có tổng nhóm khớp KPI; tỷ lệ không đổi chỉ vì mở sơ đồ ghế; xử lý mẫu số 0, báo cáo không ghi dữ liệu. |
| [ ] | **7. Dashboard báo cáo** | `ReportDashboard` + `recharts`: KPI doanh thu/đơn/vé; doanh thu lọc khoảng ngày/phim/rạp, `groupBy=movie|cinema`; occupancy có ngày riêng. Bộ lọc lưu URL, hiển thị VND/% và cơ sở tính. | Đổi lọc cập nhật số/biểu đồ/bảng; Back/F5 giữ lọc; chặn ngày đảo ngược; có empty/error/retry. |
| [ ] | **8. Galaxy mẫu** | `DataSync`: gọi `POST /admin/sync/galaxy/local-file`, hiển thị giới hạn và số lượng xử lý; khóa khi chạy, xử lý 409/timeout, làm mới catalog/báo cáo; ghi rõ nguồn offline. | Một lần bấm/một POST; timeout không tự gửi lại; phân biệt kết quả nhập mẫu với trạng thái online. |
| [ ] | **9. Kiểm chứng và bàn giao** | Trong `frontend`: `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, thêm kiểm thử Admin bằng Edge/API giả lập; trong backend: `.\mvnw.cmd test`. Thử API thật với ADMIN/CUSTOMER trên dữ liệu thử; cập nhật README và kế hoạch frontend. | Đạt phân quyền, phim, lịch/409, báo cáo, sync trên desktop/mobile; hồi quy catalog/booking/checkout/CineBot. Ghi rõ kết quả giả lập và tích hợp thật. |

**Phụ thuộc:** `1 → 2 → 3`; tiếp theo 4, 5, 6, 8 độc lập; `6 → 7`; phần 9 luôn cuối. Đường găng: `1 → 2 → 3 → 6 → 7 → 9`.

**Hoàn tất khi:** Bốn màn hình dùng được với API thật, phân quyền frontend/backend đúng, báo cáo khớp bộ lọc và phần 9 đạt.

## Tiến độ phần 1 — Phân quyền và phiên

Bắt đầu ngày 12/11/2026. Git trước khi sửa: chỉ có `momo-payment-integration.md` chưa được theo dõi; giữ nguyên file này. Phạm vi đợt này là phần 1; các màn hình nghiệp vụ thuộc các phần sau.

- [x] Trạng thái xác minh phiên và chống phản hồi cũ ghi đè khi đổi tài khoản.
- [x] `AdminRoute` chờ `/users/me`, kiểm tra ADMIN và dùng lại modal đăng nhập tại URL đích.
- [x] Xử lý 401/403, hủy và xóa query/mutation cache có khóa bắt đầu bằng `admin` khi phiên/quyền thay đổi.
- [x] Chạy lint, test, build và kiểm thử Edge/API mô phỏng; ghi riêng phần chưa kiểm chứng bằng API thật.

Đầu ra: `/admin` xác minh phiên rồi chuyển tới `/admin/reports`; bốn URL Admin và URL con không tồn tại đều có guard. Nội dung phía sau guard hiện là trang chờ; layout và nghiệp vụ vẫn thuộc các phần 2–8. Đăng nhập bằng modal tại chỗ nên giữ đủ pathname/query/hash. Lỗi xác minh tạm thời chặn nội dung và cho thử lại; phản hồi từ phiên cũ không thể khôi phục token, quyền hoặc cache. Đăng xuất ở tab khác được đồng bộ bằng sự kiện `storage`.

Backend đã bổ sung JSON `401` cho yêu cầu chưa xác thực/token hết hạn, giữ `403` khi tài khoản thiếu quyền. Cần khởi động lại backend để áp dụng; trước đây trường hợp chưa xác thực cũng trả `403`, không kích hoạt được refresh token ở frontend.

### Kết quả kiểm tra ngày 12/11/2026

- `frontend`: `npm.cmd run lint`, `npm.cmd test` (61/61), `npm.cmd run build` đều đạt.
- **Mô phỏng Admin:** `npm.cmd run test:admin-browser` đạt 19 nhóm kiểm tra trên Edge/Vite development, 53 request giả lập, 0 lỗi runtime. Bao gồm CUSTOMER với quyền ADMIN giả trong localStorage; chặn lazy child và query trước `/users/me`; ADMIN sau F5; form đăng nhập ở 390px giữ URL; refresh đồng thời; 401/403/500; hủy request/xóa cache; phản hồi đăng nhập/profile/refresh đến muộn; đổi tài khoản và sự kiện đăng xuất từ tab khác được giả lập.
- **Mô phỏng hồi quy:** `npm.cmd run test:checkout-browser` đạt 18 nhóm checkout/booking/VNPay; `npm.cmd run test:chatbot-browser` đạt 6 nhóm CineBot. Không có lỗi runtime; REST/STOMP/cổng thanh toán/Gemini đều dùng mô phỏng, không có giao dịch thật.
- **Backend MockMvc/Mockito:** `.\mvnw.cmd "-Dtest=SecurityAuthorizationTests,BookingControllerTests,ShowtimeControllerTests" test` đạt 15/15 (5 kiểm thử bảo mật mới, 10 hồi quy controller). Chạy chuỗi lọc bảo mật thật với JWT/user lookup giả lập, không dùng DB/Redis/API ngoài.
- **Tích hợp thật chưa chạy:** chưa đăng nhập ADMIN/CUSTOMER bằng backend/DB thật; chưa chạy toàn bộ `.\mvnw.cmd test` hoặc `AuthIntegrationTests` cần hạ tầng. Các kiểm chứng này vẫn thuộc phần 9; không coi kết quả mô phỏng là nghiệm thu tích hợp thật.
