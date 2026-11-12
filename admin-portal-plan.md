# Kế hoạch xây dựng Admin Portal

Ngày lập: 11/11/2026. Nguồn yêu cầu: [mục V.7 của kế hoạch frontend](ke_hoach_frontend.md).

**Mục tiêu:** Xây dựng Admin Portal gồm phân quyền, báo cáo, quản lý phim, xếp lịch và nhập dữ liệu Galaxy mẫu.

## Phạm vi và nền tảng

- Bốn màn hình: `/admin/reports`, `/admin/movies`, `/admin/showtimes`, `/admin/sync`; `/admin` chuyển đến báo cáo.
- Dùng React 19/Router 7, Vite, Tailwind, Zustand, TanStack Query, Axios và Sonner hiện có; bổ sung `recharts` khi làm biểu đồ.
- Mã tập trung tại `src/features/admin/`, `layouts/AdminLayout.jsx`, `routes/AdminRoute.jsx`, `services/adminService.js`; nối route trong `App.jsx`.
- Bản đầu: danh sách/thêm/sửa phim, danh sách suất đang mở bán/thêm suất. Quản lý tài khoản, CRUD rạp/phòng/ghế/combo, xóa dữ liệu, sửa suất và lịch sử suất chiếu dành cho đợt mở rộng.

## Những điểm đã đối chiếu với mã hiện tại

- Ban đầu frontend chưa có màn hình Admin, `adminService.js` trống; Header đã có liên kết. Backend đã bảo vệ `/api/v1/admin/**` bằng quyền ADMIN. Các phần 1–3 đã triển khai và kiểm chứng mô phỏng; bốn màn hình nghiệp vụ vẫn là khung cho các phần 4, 5, 7, 8.
- Đọc phim: `GET /movies` trả `PageResponse.content`; thêm/sửa: `POST /admin/movies`, `PUT /admin/movies/{id}` theo `MovieCreateRequest`, ảnh/trailer dùng URL.
- `GET /cinemas` chứa phòng `auditoriums`; `GET /showtimes` chỉ trả suất mở bán. `POST /admin/showtimes` bắt buộc `endTime`, đã kiểm tra trùng phòng/giờ và trả `409`.
- Báo cáo doanh thu đang lọc theo ngày tạo đơn `CONFIRMED`, gồm tiền combo; breakdown thiếu lọc phim/rạp và số vé nhóm đang gán 0. Occupancy nhận một ngày, hiện bỏ suất inactive và chỉ đếm ghế đã sinh inventory; cần sửa ở phần 6.
- Sync local-file nhập file phía backend, mặc định 100 suất, là nguồn offline. `lastSuccessAt` từ `/admin/sync/galaxy/status` chỉ dành cho online đầy đủ; lịch sync tự động có thể cập nhật lại dữ liệu Galaxy.

## Các phần triển khai

Mỗi phần là một mốc bàn giao; khi bắt đầu, tách thành việc 2–5 phút có đầu ra kiểm tra được. Đánh dấu hoàn tất sau nghiệm thu.

| Xong | Phần | Công việc và đầu ra | Kiểm chứng |
| :---: | --- | --- | --- |
| [x] | **1. Phân quyền và phiên** | Tạo `AdminRoute`, trạng thái kiểm tra phiên trong `authStore`; xác minh `/users/me` trước khi tải Admin, dùng lại đăng nhập và giữ URL đích; xử lý 401/403, xóa cache Admin khi đổi phiên. | Đạt bằng Edge/API mô phỏng và MockMvc ngày 12/11/2026; API thật còn ở phần 9. |
| [x] | **2. Khung quản trị** | Tạo `AdminLayout`: sidebar, tài khoản/đăng xuất, menu mobile, liên kết website và `Suspense`; bốn route lazy-load, màu/font hiện có. | Đạt 5 nhóm Edge/API mô phỏng ngày 12/11/2026: URL/menu, desktop/390px, bàn phím, lazy/Suspense và tài khoản. |
| [x] | **3. Service và UI chung** | Điền `adminService.js`, tạo query hooks, bảng/modal và loading/rỗng/lỗi; dùng lại service catalog, chặn gửi lặp, làm mới cache liên quan sau khi ghi. | Đạt 11 nhóm Edge/API mô phỏng ngày 12/11/2026: DTO/Bearer, lỗi 400 theo trường, toast, cache, 409 và mất phản hồi không retry. |
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

## Tiến độ phần 2 và 3

Git trước khi bắt đầu: working tree sạch; giữ nguyên cấu trúc `AdminShell`, `AdminLayout` và các màn hình khung đã có trong repo.

- [x] Kiểm chứng phần 2: URL trực tiếp/menu active, desktop/390px, drawer và bàn phím, Suspense giữ sidebar, đăng nhập/đăng xuất.
- [x] Service đọc dùng lại catalog, ghi đúng DTO phim/suất và endpoint báo cáo/sync; truyền signal và tự xử lý lỗi ở UI.
- [x] Query keys/hooks theo phiên ADMIN; mutation chống gửi lặp, không tự retry khi mất phản hồi và làm mới cache khách/Admin.
- [x] Bảng/phân trang, modal, trường biểu mẫu và trạng thái loading/rỗng/lỗi dùng chung, có hỗ trợ bàn phím.
- [x] Kiểm chứng validation 400, toast một lần, lỗi 409/timeout, cache và hồi quy phiên; ghi riêng mô phỏng và API thật.

### Đầu ra phần 2–3

- Bảo toàn `App.jsx`, AdminShell và bốn màn hình khung đã có. `AdminLayout` chỉ sửa chỗ giữ tham chiếu trả focus để qua lint, và bổ sung vòng Tab/Shift+Tab để focus không rời drawer. Chưa thêm nghiệp vụ vào các màn hình phần 4/5/7/8.
- `adminService.js` đọc qua service catalog, ghi phim/suất theo DTO và cung cấp endpoint báo cáo/sync mẫu. Mở rộng movieService nhận Axios options để truyền signal qua mọi trang, giữ cách gọi cũ của website khách.
- Query hooks chỉ chạy sau khi xác minh ADMIN, keys bắt đầu bằng `admin`. Mutation kiểm tra phiên, dùng chung promise khi gửi lặp, không tự retry/xếp hàng ghi lúc offline, làm mới cache Admin/khách đúng nhóm. Validation 400 trả `fieldErrors`; mất phản hồi giữ bản nháp và yêu cầu kiểm tra lại dữ liệu.
- Có `AdminTable`/phân trang, `AdminModal`, `AdminField`, `AdminLoading`, `AdminEmpty`, `AdminError`. Modal/drawer có vòng focus; modal khóa cả Escape/X/backdrop trong lúc gửi và khôi phục focus/scroll khi đóng.
- API sử dụng và quy ước ghép form/bảng được ghi tại [README tính năng Admin](frontend/src/features/admin/README.md).

### Kết quả kiểm tra phần 2–3 ngày 12/11/2026

- **Kiểm tra frontend:** `npm.cmd run lint`, `npm.cmd test` (64/64), `npm.cmd run build` đều đạt. Ba unit test mới kiểm tra ánh xạ validation, phân biệt lỗi đọc/mất phản hồi ghi và chính sách retry.
- **Mô phỏng Admin:** `npm.cmd run test:admin-browser` đạt 35 nhóm: 19 hồi quy phiên, 5 khung quản trị, 11 service/UI; 113 request giả lập, 0 lỗi runtime. Kiểm tra cả Tab/Shift+Tab qua đầu/cuối dialog, sidebar giữ nguyên khi trì hoãn module, chặn tải module cho CUSTOMER; kiểm tra bảng/phân trang/loading/rỗng/lỗi, form 400, chốt gửi hai lần cùng tick, busy/Escape, DTO/Bearer, PUT phim, 409 suất chiếu, timeout không retry, cache và trạng thái sync online tách biệt nhập offline. Fixture dùng service/hook/component thật; không nằm trong entry production.
- **Mô phỏng hồi quy khách:** `npm.cmd run test:checkout-browser` đạt 18 nhóm booking/checkout/VNPay; `npm.cmd run test:chatbot-browser` đạt 6 nhóm CineBot; 0 lỗi runtime. Không có API/giao dịch thật.
- **API thật chưa chạy:** chưa gọi ghi phim/suất/sync lên backend/DB thật hoặc kiểm chứng số liệu báo cáo thật. Không sửa backend trong đợt này và không chạy lại Maven; kiểm chứng tích hợp cuối vẫn thuộc phần 9. Các phần 4–8 chưa được đánh dấu hoàn tất.
