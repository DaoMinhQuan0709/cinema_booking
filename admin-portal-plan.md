# Kế hoạch xây dựng Admin Portal

Ngày lập: 11/11/2026. Nguồn yêu cầu: [mục V.7 của kế hoạch frontend](ke_hoach_frontend.md).

**Mục tiêu:** Xây dựng Admin Portal gồm phân quyền, báo cáo, quản lý phim, xếp lịch và nhập dữ liệu Galaxy mẫu.

## Phạm vi và nền tảng

- Bốn màn hình: `/admin/reports`, `/admin/movies`, `/admin/showtimes`, `/admin/sync`; `/admin` chuyển đến báo cáo.
- Dùng React 19/Router 7, Vite, Tailwind, Zustand, TanStack Query, Axios và Sonner hiện có; bổ sung `recharts` khi làm biểu đồ.
- Mã tập trung tại `src/features/admin/`, `layouts/AdminLayout.jsx`, `routes/AdminRoute.jsx`, `services/adminService.js`; nối route trong `App.jsx`.
- Bản đầu: danh sách/thêm/sửa phim, danh sách suất đang mở bán/thêm suất. Quản lý tài khoản, CRUD rạp/phòng/ghế/combo, xóa dữ liệu, sửa suất và lịch sử suất chiếu dành cho đợt mở rộng.

## Những điểm đã đối chiếu với mã hiện tại

- Ban đầu frontend chưa có màn hình Admin, `adminService.js` trống; Header đã có liên kết. Backend đã bảo vệ `/api/v1/admin/**` bằng quyền ADMIN. Các phần 1–9 đã hoàn thành: kiểm thử trình duyệt mô phỏng, repository/service trên PostgreSQL tạm và HTTP/Edge với ứng dụng Spring Boot, tài khoản thử, PostgreSQL/Redis thật độc lập. Hướng dẫn bàn giao tại [ADMIN_PORTAL.md](ADMIN_PORTAL.md); không ghi vào DB ứng dụng đang vận hành.
- Đọc phim: `GET /movies` trả `PageResponse.content`; thêm/sửa: `POST /admin/movies`, `PUT /admin/movies/{id}` theo `MovieCreateRequest`, ảnh/trailer dùng URL.
- `GET /cinemas` chứa phòng `auditoriums`; `GET /showtimes` chỉ trả suất mở bán. `POST /admin/showtimes` bắt buộc `endTime`, đã kiểm tra trùng phòng/giờ và trả `409`.
- Báo cáo doanh thu lọc theo ngày tạo đơn `CONFIRMED`, gồm combo; KPI và breakdown đã dùng cùng bộ lọc và đếm vé BOOKED. Occupancy nhận một ngày bắt đầu suất, gồm cả lịch sử/inactive; sức chứa có nguồn inventory/ghế vật lý/layout và chỉ rõ thiếu cấu hình. Chi tiết cơ sở tính ở [REPORTS.md](backend/cinema-booking-backend/REPORTS.md).
- Sync local-file nhập file phía backend, mặc định 100 suất, là nguồn offline. `lastSuccessAt` từ `/admin/sync/galaxy/status` chỉ dành cho online đầy đủ; lịch sync tự động có thể cập nhật lại dữ liệu Galaxy.

## Các phần triển khai

Mỗi phần là một mốc bàn giao; khi bắt đầu, tách thành việc 2–5 phút có đầu ra kiểm tra được. Đánh dấu hoàn tất sau nghiệm thu.

| Xong | Phần | Công việc và đầu ra | Kiểm chứng |
| :---: | --- | --- | --- |
| [x] | **1. Phân quyền và phiên** | Tạo `AdminRoute`, trạng thái kiểm tra phiên trong `authStore`; xác minh `/users/me` trước khi tải Admin, dùng lại đăng nhập và giữ URL đích; xử lý 401/403, xóa cache Admin khi đổi phiên. | Đạt bằng Edge/API mô phỏng và MockMvc ngày 12/11/2026; API thật còn ở phần 9. |
| [x] | **2. Khung quản trị** | Tạo `AdminLayout`: sidebar, tài khoản/đăng xuất, menu mobile, liên kết website và `Suspense`; bốn route lazy-load, màu/font hiện có. | Đạt 5 nhóm Edge/API mô phỏng ngày 12/11/2026: URL/menu, desktop/390px, bàn phím, lazy/Suspense và tài khoản. |
| [x] | **3. Service và UI chung** | Điền `adminService.js`, tạo query hooks, bảng/modal và loading/rỗng/lỗi; dùng lại service catalog, chặn gửi lặp, làm mới cache liên quan sau khi ghi. | Đạt 11 nhóm Edge/API mô phỏng ngày 12/11/2026: DTO/Bearer, lỗi 400 theo trường, toast, cache, 409 và mất phản hồi không retry. |
| [x] | **4. Quản lý phim** | `MovieManager`: tìm tên, lọc ba trạng thái, phân trang server, thêm/sửa đúng DTO; kiểm tra tên/thời lượng/ngày/URL. | Đạt 13 nhóm Edge/API mô phỏng trên production build ngày 12/11/2026: F5/Back, DTO/validation, lỗi giữ form và catalog đổi theo trạng thái; API thật còn ở phần 9. |
| [x] | **5. Quản lý suất chiếu** | `ShowtimeManager`: lọc ngày/rạp/phim, chọn phòng thuộc rạp, thêm suất; gợi ý kết thúc = thời lượng + 15 phút, gửi đủ hai mốc giờ Việt Nam; kiểm tra giá dương, giờ tương lai và thứ tự giờ. | Đạt 15 nhóm Edge/API mô phỏng trên production build và 16 kiểm thử backend Mockito/MockMvc ngày 12/11/2026; có lịch khách, 409 giữ form, đổi rạp/phòng và múi giờ. API/DB thật còn ở phần 9. |
| [x] | **6. Sửa dữ liệu báo cáo** | Sửa `AdminReportServiceImpl`/repository: KPI và breakdown cùng bộ lọc, số vé nhóm đúng; occupancy gồm suất đã kết thúc và sức chứa chưa sinh inventory, thể hiện thiếu cấu hình. Chỉ BOOKED tính là đã bán. | Đạt 38/38 ngày 12/11/2026: 9 test PostgreSQL tạm thật, 13 Mockito/MockMvc báo cáo và 16 hồi quy. Tổng nhóm khớp KPI; sức chứa/tỷ lệ ổn định trước/sau mở sơ đồ, không ghi entity từ báo cáo. |
| [x] | **7. Dashboard báo cáo** | `ReportDashboard` + `recharts`: KPI doanh thu/đơn/vé; doanh thu lọc khoảng ngày/phim/rạp, `groupBy=movie|cinema`; occupancy có ngày riêng. Bộ lọc lưu URL, hiển thị VND/% và cơ sở tính. | Đạt 15 nhóm Edge/API mô phỏng trên production build ngày 12/11/2026: KPI/biểu đồ/bảng, F5/Back/hash, ngày ngược/ngày độc lập, loading/rỗng/lỗi, nguồn sức chứa, desktop/390px/bàn phím và phân quyền. |
| [x] | **8. Galaxy mẫu** | `DataSync`: gọi `POST /admin/sync/galaxy/local-file`, hiển thị giới hạn và số lượng xử lý; khóa khi chạy, xử lý 409/timeout, làm mới catalog/báo cáo; ghi rõ nguồn offline. | Đạt 15 nhóm Edge/API mô phỏng trên production build và 26 kiểm thử backend mô phỏng ngày 13/11/2026: một POST, 409/timeout, cache đang có, offline/online riêng, desktop/390px và phân quyền. |
| [x] | **9. Kiểm chứng và bàn giao** | Lint/unit/build, hồi quy Edge mô phỏng, toàn bộ Maven và HTTP/Edge thật với ADMIN/CUSTOMER trên PostgreSQL/Redis thử; helper nghiệm thu, README và kế hoạch frontend. | Đạt ngày 13/11/2026: frontend 89/89, 117 nhóm Edge mô phỏng, Maven 184 đạt/3 live skip; HTTP thật 7/7 gồm 6 nhóm Edge desktop/390px, catalog/booking/checkout/CineBot hồi quy. |

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

## Tiến độ phần 4 — Quản lý phim

Git trước khi sửa: working tree sạch. Dùng lại service, hooks và UI chung của phần 3; không triển khai nghiệp vụ phần 5–8.

- [x] Danh sách phim phân trang server; tìm theo tên, lọc ba trạng thái; URL giữ bộ lọc/trang khi F5 và Back.
- [x] Modal thêm/sửa đầy đủ `MovieCreateRequest`; chuẩn hóa dữ liệu, kiểm tra tên/thời lượng/ngày/URL và giới hạn cột dữ liệu.
- [x] Lỗi giữ bản nháp, 400 hiện theo trường, chặn gửi lặp và xử lý mất phản hồi; làm mới danh sách/catalog theo trạng thái sau lưu.
- [x] Kiểm chứng desktop/390px/bàn phím, F5, phân trang và hồi quy Admin; cập nhật tài liệu, ghi riêng mô phỏng/API thật.

### Đầu ra phần 4

- `/admin/movies` đọc một trang server, thứ tự ID mới trước, có tìm tên/lọc Đang chiếu–Sắp chiếu–Ngừng chiếu và chọn 10/20/50 phim mỗi trang. Bộ lọc/trang lưu URL; đổi lọc trở về trang đầu, đổi kích thước trang giữ tên đang nhập; trang ngoài phạm vi tự điều chỉnh sau phản hồi thành công. Có loading/rỗng/lỗi/thử lại và bảng cuộn ngang ở 390px.
- `MovieFormModal.jsx` dùng lại modal/field/mutation chung, điền sẵn đủ chín trường DTO khi sửa. `movieForm.js` tách chuẩn hóa/validation: trim chuỗi, thời lượng Integer dương, ngày lịch hợp lệ không đổi múi giờ, URL HTTP(S), giới hạn tên/URL/thể loại/độ tuổi theo entity. Trường tùy chọn trống gửi null; không gửi/ghi đè các trường metadata Galaxy ngoài DTO.
- Lỗi 400/500/mất phản hồi giữ form. Khi đang gửi, khóa form và đóng modal; không tự gửi lại. Khi mất phản hồi sau khi backend có thể đã ghi, nút Kiểm tra lại danh sách chỉ đọc lại dữ liệu để đối chiếu. Lưu thành công dùng invalidation phần 3 để đồng bộ danh sách, catalog khách và cache liên quan; sửa trạng thái làm rỗng trang cuối sẽ quay về trang hợp lệ.
- Bảo toàn App/layout và nghiệp vụ phần 5–8. Hướng dẫn sử dụng và ranh giới kiểm chứng cập nhật tại [README Admin](frontend/src/features/admin/README.md) và README frontend.

### Kết quả kiểm tra phần 4 ngày 12/11/2026

- **Kiểm tra frontend:** `npm.cmd run lint`, `npm.cmd test` (70/70), `npm.cmd run build` đều đạt. Sáu unit test mới kiểm tra DTO/null, ngày nhuận/ngày không hợp lệ, giới hạn dữ liệu, URL an toàn, bản sao form sửa và chuẩn hóa URL phân trang.
- **Mô phỏng Quản lý phim:** `npm.cmd run test:admin-movies-browser` đạt 13 nhóm trên Edge/production build, 67 request giả lập, 0 lỗi runtime. Kiểm tra màn hình thật, không dùng fixture form: tìm/lọc/phân trang/kích thước trang, F5/Back, tham số sai/trang ngoài phạm vi, loading/rỗng/lỗi, validation client/400, DTO/Bearer/POST/PUT, gửi hai lần một POST, khóa Escape, xóa trường tùy chọn, lỗi 500 giữ form, catalog khách đang có cache cập nhật khi đổi ENDED/COMING_SOON, mất phản hồi sau ghi và đối chiếu chỉ GET, desktop/390px/bàn phím và CUSTOMER bị chặn. Catalog phía API giả lập giữ trong bộ nhớ qua F5; kết quả này không chứng minh DB thật đã lưu.
- **Mô phỏng hồi quy Admin:** `npm.cmd run test:admin-browser` đạt 35 nhóm phần 1–3, 131 request giả lập, 0 lỗi runtime. Fixture nền tảng chạy ở route báo cáo để không lẫn query của MovieManager thật; sau đổi phiên, kiểm tra dữ liệu cũ đã xóa trong khi cho phép query mới của phiên ADMIN đã xác minh.
- **Mô phỏng hồi quy khách:** `npm.cmd run test:checkout-browser` đạt 18 nhóm booking/checkout/VNPay; `npm.cmd run test:chatbot-browser` đạt 6 nhóm CineBot, 0 lỗi runtime. Không gọi API thanh toán/Gemini thật.
- **Tích hợp thật chưa chạy:** chưa thêm/sửa phim hoặc thử ADMIN/CUSTOMER với backend/DB thật; chưa chạy lại Maven vì không sửa backend. Phần 9 vẫn bao gồm nghiệm thu API/DB thật; các phần 5–9 vẫn chưa hoàn tất.

## Tiến độ phần 5 — Quản lý suất chiếu

Git trước khi sửa: working tree sạch. Dùng lại service/hooks/UI chung; giữ nguyên App/layout, quản lý phim và các khung báo cáo/nhập mẫu.

- [x] Danh sách suất đang mở bán, bộ lọc ngày/rạp/phim lưu URL; F5/Back và loading/rỗng/lỗi/thử lại.
- [x] Form chọn phim/rạp/phòng, đổi rạp xóa phòng cũ; gợi ý kết thúc theo thời lượng + 15 phút và cho phép chỉnh tay.
- [x] Kiểm tra giá dương/giới hạn cột dữ liệu, giờ Việt Nam ở tương lai và kết thúc sau bắt đầu; gửi đúng năm trường DTO, giữ bản nháp khi 400/409/500/mất phản hồi.
- [x] Kiểm chứng lịch khách có cache nhận suất mới, desktop/390px/bàn phím, chống gửi lặp, múi giờ và hồi quy; cập nhật tài liệu, tách mô phỏng khỏi tích hợp thật.

### Đầu ra phần 5

- `/admin/showtimes` lọc ngay theo ngày/rạp/phim, mặc định hôm nay ở Việt Nam. URL giữ `date`, `cinemaId`, `movieId`; chuẩn hóa ngày/ID sai trước request và giữ tham số khác. Xóa lọc giữ ngày. Chỉ đọc các suất chưa bắt đầu/còn mở bán từ API, không phải lịch sử; bảng có phim, rạp/phòng, đầy đủ ngày giờ bắt đầu/kết thúc và giá VND, cuộn ngang trong vùng riêng ở mobile.
- `ShowtimeFormModal.jsx` lấy phim từ mọi trang catalog và phòng từ `cinema.auditoriums`; đổi rạp xóa phòng cũ, rạp chưa có phòng có hướng dẫn. Lỗi đọc danh mục có thử lại riêng, không chặn đọc lịch; khi thiếu danh mục thì chưa thể thêm. Form kế thừa ngữ cảnh phim/rạp/ngày và mặc định bắt đầu ở mốc hợp lệ trong tương lai.
- `showtimeForm.js` gợi ý kết thúc = bắt đầu + thời lượng + 15 phút, xử lý qua nửa đêm/tháng/năm; chỉnh tay được giữ khi đổi phim/giờ bắt đầu đến khi bấm Dùng giờ gợi ý. Validation kiểm tra phim/phòng tồn tại và phòng thuộc rạp, ngày lịch/giờ hợp lệ, bắt đầu tương lai, kết thúc sau bắt đầu, giá dương theo DECIMAL(10,2). POST chỉ có `movieId`, `auditoriumId`, `startTime`, `endTime`, `basePrice`; hai mốc là LocalDateTime Việt Nam, không chuyển sang UTC theo múi giờ trình duyệt.
- 409 giữ toàn bộ form để đổi phòng/giờ; 400 hiển thị theo trường; lỗi khác có một toast, giữ bản nháp. Đang gửi thì khóa form/đóng/Escape và chống gửi hai lần. Mất phản hồi không tự POST lại; nút Kiểm tra lại danh sách chỉ GET theo bộ lọc đang xem để đối chiếu. Lưu xong chuyển bộ lọc tới ngày/rạp/phim suất mới; invalidation có sẵn làm mới lịch khách đang có cache và dữ liệu liên quan.
- Backend `AdminCatalogServiceImpl` chuyển kiểm tra tương lai từ múi giờ máy chủ sang `Asia/Ho_Chi_Minh` qua Clock sẵn có, đồng thời chặn kết thúc bằng bắt đầu. Cần khởi động lại backend để áp dụng. Không thay đổi API hay schema, không triển khai báo cáo/sync ở phần 6–8.

### Kết quả kiểm tra phần 5 ngày 12/11/2026

- **Kiểm tra frontend:** `npm.cmd run lint`, `npm.cmd test` (78/78), `npm.cmd run build` đều đạt. Tám unit test mới kiểm tra DTO đủ hai mốc, gợi ý qua nửa đêm/ngày nhuận/năm, lịch/giờ sai, thời điểm tương lai dưới UTC/Los Angeles/Tokyo, phòng thuộc rạp, DECIMAL(10,2), URL và mặc định bản nháp.
- **Mô phỏng Quản lý suất chiếu:** `npm.cmd run test:admin-showtimes-browser` đạt 15 nhóm trên Edge/production build, 98 request giả lập, 0 lỗi runtime. Dùng màn hình thật: lọc/F5/Back, tham số sai, loading/rỗng/lỗi/thử lại, gom đủ 105 phim qua hai trang, lỗi danh mục không chặn lịch, đổi rạp/phòng và rạp rỗng, gợi ý/chỉnh tay qua nửa đêm, chặn form sai, trình duyệt Los Angeles vẫn gửi đúng hai mốc Việt Nam/DTO/Bearer, hai submit chỉ một POST, busy/Escape, F5 sau lưu, 409 giữ form và sửa phòng, 400/500, lịch khách có cache nhận link booking của suất mới, mất phản hồi sau khi phía mô phỏng đã ghi rồi GET đối chiếu, desktop/390px/bàn phím và CUSTOMER bị chặn. Dữ liệu lưu trong bộ nhớ API giả lập qua F5, không chứng minh DB thật đã lưu.
- **Backend Mockito/MockMvc:** `.\mvnw.cmd "-Dtest=AdminShowtimeServiceTests,ShowtimeServiceTests,ShowtimeControllerTests,SecurityAuthorizationTests" test` đạt 16/16. Sáu test Admin mới dùng Clock cố định ở UTC, xác nhận chặn giờ Việt Nam đã qua/bằng hiện tại, kết thúc bằng/trước bắt đầu, xung đột không ghi, suất qua nửa đêm giữ nguyên giờ/giá và sinh inventory cho ghế active với phụ thu đúng. Mười test hồi quy service/controller/bảo mật đạt; repository/JWT/user lookup giả lập, không dùng DB/Redis thật.
- **Mô phỏng hồi quy Admin:** `npm.cmd run test:admin-browser` đạt 35 nhóm, 137 request giả lập, 0 lỗi runtime; `npm.cmd run test:admin-movies-browser` đạt 13 nhóm, 67 request giả lập, 0 lỗi runtime. Bộ kiểm tra cũ được giữ nguyên.
- **Mô phỏng hồi quy khách:** `npm.cmd run test:checkout-browser` đạt 18 nhóm booking/checkout/VNPay, 82 request giả lập; `npm.cmd run test:chatbot-browser` đạt 6 nhóm CineBot. Không có lỗi runtime; REST/STOMP/cổng thanh toán/Gemini đều mô phỏng, không có giao dịch thật.
- **Tích hợp thật chưa chạy:** chưa thêm suất/kiểm tra 409 với backend/DB thật; chưa chạy toàn bộ Maven hoặc kiểm thử cần hạ tầng. Phần 9 tiếp tục bao gồm nghiệm thu API/DB thật và hồi quy toàn hệ thống; phần 6–9 chưa hoàn tất.

## Tiến độ phần 6 — Sửa dữ liệu báo cáo

Git trước khi sửa: working tree sạch. Phạm vi là dữ liệu backend; dashboard phần 7 vẫn là khung.

Kế hoạch triển khai chi tiết:

- [x] Gộp số liệu doanh thu/đơn/vé theo cùng bộ lọc ngày tạo đơn CONFIRMED, phim và rạp; tránh nhân tiền khi một đơn có nhiều ghế, nhóm theo ID để phân biệt tên trùng. KPI lấy từ cùng kết quả tổng hợp với breakdown.
- [x] Tách truy vấn occupancy khỏi lịch mở bán, gồm suất đã kết thúc/inactive. Sức chứa ưu tiên inventory đã có, rồi ghế vật lý active, cuối cùng cấu hình hàng × cột hợp lệ; báo rõ nguồn sức chứa và số suất thiếu cấu hình. Chỉ BOOKED tính là đã bán; báo cáo không sinh ghế hoặc ghi dữ liệu.
- [x] Kiểm thử bộ lọc/tổng nhóm, tiền combo, nhiều ghế/đơn, thời điểm biên, lịch sử, mẫu số 0 và sức chứa trước/sau mở sơ đồ. Thử repository/service trên PostgreSQL tạm độc lập nếu khả dụng; ghi riêng Mockito/MockMvc và kết quả DB thật, cập nhật README và tick sau kiểm chứng.

### Đầu ra phần 6

- `BookingRepository` tổng hợp ba KPI trong cùng truy vấn, bộ lọc ngày/phim/rạp dùng chung cho tổng và nhóm. Doanh thu chỉ tính `totalAmount` của đơn CONFIRMED (gồm combo), vé chỉ đếm BookingSeat liên kết ghế BOOKED của các đơn này. Không JOIN collection để SUM tiền nên đơn nhiều ghế/combo không nhân tổng; nhóm theo ID + tên, bổ sung `id` vào RevenueItem. KPI lấy từ cùng kết quả nhóm, `groupBy=none` dùng một truy vấn tổng và breakdown rỗng.
- Ngày cuối được tính bằng cận trước đầu ngày kế tiếp; ngày ngược, ID không dương và groupBy ngoài none/movie/cinema trả 400. Giữ nguồn ngày tạo đơn đang lưu, không đổi sang ngày thanh toán/giờ chiếu.
- Occupancy có truy vấn riêng, không lọc active hay loại suất đã bắt đầu. Sức chứa dùng inventory như snapshot, nếu chưa có thì đọc ghế vật lý active; chỉ khi chưa có ghế vật lý mới dùng layout hàng × cột hợp lệ theo bộ sinh ghế. Phòng đã có ghế nhưng tắt hết không bị hồi sinh sức chứa từ layout. Thiếu cấu hình trả nguồn UNCONFIGURED/sức chứa 0 và tăng `showtimesMissingCapacity`.
- Mỗi dòng occupancy thêm ID suất/phim/rạp/phòng, startTime, active, capacitySource; giữ các trường cũ. `totalSeatsAvailable` là tổng sức chứa, gồm ghế đã bán. Tỷ lệ chung tính theo tổng BOOKED/tổng sức chứa, làm tròn hai chữ số; mẫu số 0 trả 0.0, thiếu cấu hình cần cảnh báo khi làm dashboard phần 7. Transaction read-only REPEATABLE_READ, tối đa ba truy vấn đọc theo lô, không sinh/sửa ghế hoặc gọi Redis.
- Hướng dẫn API/cơ sở tính/kiểm thử tại [REPORTS.md](backend/cinema-booking-backend/REPORTS.md), README Admin và README frontend. Có helper Windows UTF-8 BOM để tạo/dừng PostgreSQL tạm trong temp, không dùng credential/schema ứng dụng. Không sửa schema, UI/dashboard phần 7 vẫn là khung; cần khởi động lại backend để áp dụng mã mới.

### Kết quả kiểm tra phần 6 ngày 12/11/2026

- **Kiểm chứng DB thật với dữ liệu thử độc lập:** `AdminReportPostgresTests` đạt 9/9, không skip, trên PostgreSQL 18.6 ở cổng loopback tạm. Chạy ORM/repository/service thật và cả bộ sinh sơ đồ thật để so sánh trước/sau. Dữ liệu có tổng 690.000 VND, 4 đơn CONFIRMED, 6 vé; lọc đồng thời phim/rạp và group movie/cinema/none khớp, nhóm tên trùng vẫn tách ID, tiền không nhân theo ghế/combo. Kiểm tra mốc đầu/cuối ngày, bỏ một/hai cận ngày, trạng thái đơn/ghế, lịch sử/inactive, phòng thiếu cấu hình/tắt ghế và snapshot inventory.
- **Chỉ đọc/số truy vấn trên DB:** một truy vấn cho doanh thu, ba truy vấn cho occupancy có fallback cấu hình; không có insert/update/delete entity từ báo cáo. Suất chưa mở sơ đồ vẫn không có inventory sau khi đọc báo cáo. Trước/sau mở sơ đồ thật, tổng sức chứa và tỷ lệ chung bằng nhau, kể cả layout tự sinh và ghế vật lý có ghế inactive.
- **Mô phỏng riêng:** `AdminReportServiceTests` đạt 9/9 Mockito; `AdminReportControllerTests` đạt 4/4 MockMvc/service giả (binding ngày/ID, JSON thêm ID/nguồn sức chứa, 400). Hồi quy `AdminShowtimeServiceTests`, `ShowtimeServiceTests`, `ShowtimeControllerTests`, `SecurityAuthorizationTests` đạt 16/16. Tổng phần mô phỏng là 29/29, không dùng JWT/user lookup/Redis/cổng thanh toán thật.
- **Lệnh nghiệm thu:** trong backend, `.\scripts\test-reports-postgres.ps1 -Tests "AdminReportPostgresTests,AdminReportServiceTests,AdminReportControllerTests,AdminShowtimeServiceTests,ShowtimeServiceTests,ShowtimeControllerTests,SecurityAuthorizationTests"` đạt **38/38**, 0 lỗi, 0 skip. Cụm tạm đã dừng và schema thử tự dọn; log còn ở thư mục temp `cinema-report-postgres-0276379faea3459b9de4a76fd585ed93`. Lỗi dựng fixture/biên dịch test và helper PowerShell ở các lượt đầu đã sửa; kết quả này là lượt chạy cuối cùng.
- **Phạm vi chưa kiểm chứng:** chưa thử HTTP bằng tài khoản ADMIN/CUSTOMER với dữ liệu ứng dụng đang chạy, chưa chạy toàn bộ Maven; không chạy lại lint/build/browser frontend vì không đổi mã frontend trong phần 6. Phần 7–9 vẫn chưa hoàn tất; PostgreSQL tạm không thay thế nghiệm thu dữ liệu ứng dụng ở phần 9.

## Tiến độ phần 7 — Dashboard báo cáo

Git trước khi sửa: working tree sạch. Triển khai frontend trên hợp đồng phần 6, giữ nguyên backend và các màn hình phim/suất chiếu.

Kế hoạch triển khai chi tiết:

- [x] Bộ lọc lưu URL: rạp/phim dùng cho cả hai báo cáo, khoảng ngày doanh thu mặc định đầu tháng–hôm nay ở Việt Nam, groupBy movie/cinema, ngày occupancy riêng mặc định hôm nay. Chặn ngày ngược trước request; F5/Back giữ ngữ cảnh.
- [x] Dashboard tối/đỏ cùng font hiện có, hướng giao diện báo cáo vận hành: KPI doanh thu/đơn/vé nổi bật, biểu đồ thanh Recharts và bảng chi tiết; occupancy có cơ sở tính, nguồn sức chứa và cảnh báo thiếu cấu hình. Số tiền/số lượng/% định dạng Việt Nam, hỗ trợ desktop/mobile/bàn phím.
- [x] Loading/rỗng/lỗi/thử lại độc lập theo báo cáo, xử lý lỗi danh mục và dữ liệu cũ; kiểm tra lint/unit/build, Edge production với API mô phỏng và hồi quy Admin/khách; cập nhật README, tách mô phỏng khỏi API/DB ứng dụng thật trước khi tick.

### Đầu ra phần 7

- `/admin/reports` có KPI doanh thu/đơn/vé, biểu đồ thanh theo phim/rạp và bảng đầy đủ theo ID nhóm; tên trùng không bị gộp. Biểu đồ tối đa 10 nhóm doanh thu cao nhất, bảng phân trang client 20 hàng độc lập, cuộn ngang trong vùng riêng ở mobile. Bổ sung Recharts 3.10.1 và lockfile, nằm trong module báo cáo lazy-load sau guard; biểu đồ có tooltip bàn phím và tắt animation.
- URL lưu `startDate`, `endDate`, `cinemaId`, `movieId`, `groupBy`, `occupancyDate`, giữ tham số khác và hash. Mặc định đầu tháng–hôm nay theo Việt Nam, group movie, ngày lấp đầy hôm nay. Rạp/phim áp dụng chung; hai bộ ngày độc lập. Ngày doanh thu là bản nháp đến khi bấm Áp dụng ngày; validation không đổi URL/kết quả khi sai, URL có khoảng ngày ngược chặn query doanh thu nhưng lấp đầy vẫn chạy. Đặt lại xóa bản nháp/lỗi và về mặc định.
- `useAdminRevenue` nhận tùy chọn enabled để chặn khoảng ngày không hợp lệ; private hook kết hợp điều kiện này với ADMIN đã xác minh, không cho tùy chọn bật query vượt qua quyền. Không dùng dữ liệu bộ lọc trước làm placeholder của bộ lọc mới. Mỗi báo cáo có loading/rỗng/lỗi/thử lại riêng; lỗi làm mới giữ dữ liệu cũ đúng bộ lọc và ghi rõ. Lỗi danh mục có thử lại riêng, không ngăn đọc báo cáo.
- Phần lấp đầy hiển thị tỷ lệ chung do backend tính, BOOKED/tổng sức chứa, nguồn sức chứa và suất đã ngừng mở bán. Mẫu số 0 hiện “—” kèm giải thích; thiếu cấu hình có cảnh báo số liệu chưa đầy đủ. Có cơ sở doanh thu theo ngày tạo đơn CONFIRMED gồm combo, vé/ghế theo từng vị trí và phần giải thích sức chứa. Dashboard chỉ GET, không mở sơ đồ hay ghi dữ liệu.
- Tách bộ lọc/biểu đồ/chuẩn hóa vào `ReportFilters.jsx`, `ReportRevenueChart.jsx`, `reportUtils.js`; thêm unit test và script Edge production riêng. Giữ App/layout, màn hình phim/suất chiếu và backend. README Admin/frontend và REPORTS.md đã cập nhật; DataSync vẫn thuộc phần 8.

### Kết quả kiểm tra phần 7 ngày 12/11/2026

- **Kiểm tra frontend:** `npm.cmd run lint`, `npm.cmd test` (84/84), `npm.cmd run build` đều đạt. Sáu unit test mới kiểm tra mặc định tháng theo Việt Nam, chuẩn hóa/giữ URL/ngày độc lập, chặn ngày ngược/thiếu, định dạng tiền/số/% không biến dữ liệu thiếu thành 0, top 10 nhóm có ID và không sửa dữ liệu cache.
- **Mô phỏng dashboard riêng:** `npm.cmd run test:admin-reports-browser` đạt 15 nhóm trên Edge/production build, 96 request giả lập, 0 lỗi runtime. Kiểm tra KPI 640.000 VND/3 đơn/6 vé và tỷ lệ chung 25%, trình duyệt Los Angeles vẫn mặc định ngày Việt Nam, biểu đồ/tooltip bàn phím/ID nhóm trùng tên, gom đủ 105 phim, lọc chung hai báo cáo, F5/Back/hash, hai bộ ngày chỉ gọi lại báo cáo tương ứng, bản nháp sai không request/không đổi dữ liệu, URL ngày ngược chặn doanh thu, tham số sai, loading/rỗng/0/mẫu số 0, 400 không retry/toast, lỗi làm mới giữ dữ liệu cũ, bốn nguồn sức chứa/cảnh báo, lỗi danh mục, phản hồi chậm không ghi đè bộ lọc mới, bảng 25 nhóm/suất phân trang, top 10, desktop/390px và CUSTOMER/403. Ảnh/JSON ở temp `cinema-admin-reports-PnX9go`.
- **Mô phỏng hồi quy Admin:** `test:admin-browser` đạt 35 nhóm/151 request; `test:admin-movies-browser` đạt 13 nhóm/67 request; `test:admin-showtimes-browser` đạt 15 nhóm/98 request, đều 0 lỗi runtime. Fixture nền tảng chuyển sang route `/admin/sync` đang là khung để không lẫn query dashboard; kiểm tra chuyển `/admin` vẫn giữ query/hash khi dashboard bổ sung ngày mặc định. Lỗi mất hash ở lượt đầu đã được sửa trong dashboard; bộ kiểm tra mới cũng đã sửa selector Recharts và điều kiện chờ KPI trong lúc tải.
- **Mô phỏng hồi quy khách:** `test:checkout-browser` đạt 18 nhóm/82 request booking/checkout/VNPay; `test:chatbot-browser` đạt 6 nhóm CineBot, 0 lỗi runtime. REST/STOMP/cổng thanh toán/Gemini đều mô phỏng, không có giao dịch thật.
- **Tích hợp ứng dụng thật chưa chạy:** chưa ghép dashboard với HTTP/backend/DB và tài khoản ứng dụng thật. Không sửa mã backend và không chạy lại Maven ở phần 7; kết quả PostgreSQL tạm 9/9 của phần 6 vẫn được ghi riêng, không coi mô phỏng dashboard là kiểm chứng DB. Cần backend phần 6 đã khởi động lại; phần 8–9 chưa hoàn tất.

## Tiến độ phần 8 — Galaxy mẫu

Git trước khi sửa: working tree sạch. Giữ nguyên backend nghiệp vụ và ba màn hình đã hoàn thành; dùng lại service/hook nhập mẫu và invalidation hiện có.

Kế hoạch triển khai chi tiết:

- [x] Màn hình `/admin/sync` nhập file Galaxy offline sẵn trong backend: giới hạn mặc định 100, 0 là mọi suất tương lai, kiểm tra số nguyên trong phạm vi Integer. Giữ theme Admin, giải thích ngày mẫu và số lượng xử lý, không yêu cầu upload/clientId.
- [x] Khóa gửi/giới hạn khi chạy, chống gửi lặp; kết quả theo nguồn/thời gian/bộ đếm, 409/400/500 giữ dữ liệu đã nhập. Timeout không tự POST lại; có thao tác chỉ đọc catalog/trạng thái để đối chiếu. Thành công làm mới catalog/rạp/lịch/báo cáo.
- [x] Trạng thái backend/online riêng với kết quả offline: running dùng chung tác vụ, lịch online, lastAttemptAt/lastSuccessAt/lastError; đọc lại và theo dõi khi đang chạy, không gán syncedAt offline vào lastSuccessAt online. Kiểm thử lint/unit/build, Edge production mô phỏng/hồi quy và hợp đồng backend offline; cập nhật README, ghi rõ API/DB ứng dụng chưa kiểm chứng trước khi tick.

### Đầu ra phần 8

- `/admin/sync` nhập file `data/galaxy_sessions.json` trong backend qua service/hook có sẵn, body null và query limitShowtimes mặc định 100; cho phép 0, chặn trống/âm/thập phân/số mũ/vượt Integer. Giới hạn áp dụng cho suất tương lai được xét, số phim xử lý không bị chặn theo giới hạn. Giữ nguyên ngày mẫu, giải thích file cũ có thể không thêm suất tương lai và lịch online có thể cập nhật lại dữ liệu Galaxy sau đó.
- Khóa form/nút khi đang gửi hoặc backend báo running; chốt ref chống hai submit cùng tick. `useIsMutating` theo mutation key giữ khóa khi chuyển trang rồi quay lại cùng tab. Thành công hiển thị source LOCAL_FILE, syncedAt theo Việt Nam, giới hạn đã gửi và 9 bộ đếm thật của DTO, gồm bản ghi thêm/cập nhật. Ghế 0 là bình thường vì nhập catalog không sinh ghế; suất bỏ qua có cảnh báo đối chiếu lịch/vé. Nguồn không khớp được cảnh báo, bộ đếm thiếu hiện “—”.
- 400 hiển thị lỗi theo trường, 409 giữ giới hạn và chỉ đọc lại trạng thái; 500 giữ giới hạn/kết quả trước, một toast từ hook. Timeout/mất phản hồi giữ thông tin lần gửi và không tự POST lại. Đọc catalog để đối chiếu chỉ GET movies/cinemas/showtimes/status và invalidation các cache liên quan; số lượng catalog không được coi là xác nhận tác vụ đã xong. Không lưu lịch sử offline giả qua F5; không tự gửi lại khi F5.
- `SyncOnlineStatus.jsx` đọc bảng trạng thái riêng, lịch enabled/chu kỳ, running dùng chung, lastAttemptAt/lastSuccessAt/lastError. Không lấy kết quả offline gán vào mốc online; lỗi online cũ vẫn hiển thị khi offline thành công. Mốc UTC được đổi sang Việt Nam; mốc trống được giải thích theo bộ nhớ instance backend. Có đọc lại, polling 2 giây khi theo dõi tác vụ, lỗi giữ trạng thái cũ/thử lại riêng. Tắt lịch online không chặn nhập offline.
- Dùng invalidation phần 3 để làm mới catalog/rạp/lịch/báo cáo. Kiểm chứng cache đã mở trước trên màn hình khách và cả ba màn hình Admin đọc dữ liệu mới sau nhập. Giữ nguyên mã backend nghiệp vụ; thêm hai test hợp đồng offline vào GalaxySyncServiceTests. Fixture nền tảng chuyển sang `/admin/foundation-check` (route không tồn tại, không có query nghiệp vụ) để độc lập với bốn màn hình đã hoàn thiện. README Admin/frontend và GALAXY_SYNC.md đã cập nhật.

### Kết quả kiểm tra phần 8 ngày 13/11/2026

- **Kiểm tra frontend:** `npm.cmd run lint`, `npm.cmd test` (**89/89**) và `npm.cmd run build` đạt. Năm unit test mới kiểm tra giới hạn/Integer/0, bộ đếm thiếu so với số 0 thực, thời gian Instant Việt Nam và điều kiện polling.
- **Mô phỏng Galaxy mẫu riêng:** `npm.cmd run test:admin-sync-browser` đạt **15 nhóm**, **88 request** giả lập, **0 lỗi runtime** trên Edge/production build. Bao gồm mặc định/nguồn file, validation, hai submit/Enter chỉ một POST null/query/Bearer, khóa form, chín bộ đếm và browser Los Angeles, mốc/lỗi online độc lập, F5 không tự nhập/lưu lịch sử giả, giới hạn 0/lịch online tắt/file cũ, running/polling, 409/400/500, mất phản hồi sau khi phía mô phỏng ghi và đối chiếu chỉ GET, pending qua chuyển trang, cache khách/Admin đang có, lỗi trạng thái, nguồn/bộ đếm bất thường, 390px/bàn phím và 403/CUSTOMER. Ảnh/JSON tại temp `cinema-admin-sync-VIIxj0` đã được xem lại.
- **Backend mô phỏng:** `.\mvnw.cmd "-Dtest=GalaxySyncServiceTests,GalaxyDataImporterTests,GalaxySyncSchedulerTests" test` đạt **26/26**, không skip: 8 service, 16 importer, 2 scheduler. Hai test mới đọc file classpath thật nhưng mock importer/HTTP, xác nhận source LOCAL_FILE, giới hạn 100/0, giữ nguyên online lastAttemptAt/lastSuccessAt/lastError và chạy được khi lịch online tắt. Không có DB/Redis/Galaxy online thật. Fixture tắt lịch online ở lượt đầu đã sửa; số liệu trên là lượt chạy cuối cùng.
- **Mô phỏng hồi quy Admin:** `test:admin-browser` đạt 35 nhóm/152 request, `test:admin-movies-browser` 13 nhóm/67 request, `test:admin-showtimes-browser` 15 nhóm/98 request, `test:admin-reports-browser` 15 nhóm/96 request; 0 lỗi runtime. Bộ kiểm tra mới đã sửa cách đọc body null của Axios và selector phân biệt bảng trạng thái với sidebar; không cần thay đổi mã nghiệp vụ để xử lý hai lỗi kiểm thử này.
- **Mô phỏng hồi quy khách:** `test:checkout-browser` đạt 18 nhóm/82 request booking/checkout/VNPay; `test:chatbot-browser` đạt 6 nhóm CineBot, 0 lỗi runtime. REST/STOMP/cổng thanh toán/Gemini đều mô phỏng, không có giao dịch thật.
- **Phạm vi chưa kiểm chứng:** chưa bấm nhập mẫu lên API/DB ứng dụng thật, chưa nghiệm thu bằng tài khoản ADMIN/CUSTOMER thật hoặc chạy toàn bộ Maven. Không gọi Galaxy online trong phần 8. Các phần 1–8 đã triển khai nhưng phần 9 còn kiểm chứng tích hợp và bàn giao; không coi số liệu mô phỏng là dữ liệu đã nhập thật.

## Tiến độ phần 9 — Kiểm chứng và bàn giao

Bắt đầu ngày 13/11/2026. Git trước khi sửa: working tree sạch trên nhánh `main`.

Kế hoạch nghiệm thu chi tiết:

- [x] Chạy lint, toàn bộ unit test và production build frontend; chạy lại các bộ Edge mô phỏng Admin/khách, ghi số nhóm và lỗi runtime riêng.
- [x] Dựng môi trường dữ liệu thử độc lập để chạy toàn bộ Maven, gồm kiểm thử PostgreSQL; tắt tác vụ gọi Galaxy/Gemini/cổng thanh toán ngoài. Giữ nguyên DB và cấu hình ứng dụng hiện có.
- [x] Kiểm chứng HTTP thật qua ứng dụng Spring Boot với tài khoản ADMIN/CUSTOMER thử: phiên/quyền, thêm/sửa phim, thêm suất và 409, báo cáo khớp DB, nhập mẫu offline và catalog. Bổ sung kịch bản có thể chạy lại, không dùng response giả để thay nghiệm thu này.
- [x] Cập nhật README bàn giao và kế hoạch frontend: cách chạy, quyền, cơ sở báo cáo, giới hạn và kết quả thực tế; chỉ tick phần 9 sau khi các tiêu chí đạt.

### Đầu ra phần 9

- [Helper nghiệm thu Windows](backend/cinema-booking-backend/scripts/test-admin-acceptance.ps1) chạy frontend và toàn bộ Maven với PostgreSQL mới trong temp, Redis container riêng/cổng loopback ngẫu nhiên; tắt Galaxy online/details, VNPay query và email ngoài. Có tùy chọn chỉ chạy backend/HTTP; kết thúc dừng đúng cluster và dọn container vừa tạo, giữ log/dữ liệu thử. `RedisHoldTokenTests` nhận host/port thử qua môi trường thay vì buộc cổng 6379.
- `AdminPortalHttpTests` gồm 7 kiểm thử theo hành trình, dùng Tomcat/JWT/security/controller/service/ORM thật, schema ngẫu nhiên riêng để không lẫn fixture với SpringBootTest catalog. Tạo tài khoản qua HTTP, cấp ADMIN chỉ trong DB thử rồi đăng nhập thật. Kiểm tra 401/403, refresh, phim/PUT/bộ lọc công khai, suất/409/giờ Việt Nam, sơ đồ/giữ ghế/cạnh tranh/cập nhật combo/hủy qua Redis/DB, báo cáo khớp SQL và nhập file offline thật.
- `admin-http-browser-check.mjs` chạy production UI trong Edge qua HTTP tới Tomcat thử. CDP chỉ đổi đích API theo cổng ngẫu nhiên, không mock response hay thay DTO. Đăng nhập bằng UI, thêm/sửa phim, F5, thêm suất và giữ form khi 409, lịch khách, dashboard, nhập mẫu, logout/CUSTOMER; desktop/390px, trình duyệt Los Angeles. Credential fixture truyền qua stdin; sau UI, Java đọc SQL độc lập để xác nhận bản ghi.
- Sửa fixture `ShowtimeIntegrationTests`: giữ entity trả về từ `save` để lấy đúng ID sau merge (`@Version` có giá trị), dùng ngày mai Việt Nam tránh qua nửa đêm. Redis key có TTL và dọn trong finally; khi bật nghiệm thu Redis, lỗi kết nối làm test thất bại. Giữ nguyên nghiệp vụ sản xuất. Script checkout bổ sung chờ nút Tiếp tục hết trạng thái refetch do STOMP trước khi bấm.
- [ADMIN_PORTAL.md](ADMIN_PORTAL.md) bàn giao cách chạy/cấp quyền, bốn route/API, cơ sở báo cáo/offline, giới hạn và lệnh nghiệm thu lặp lại. README frontend/Admin, REPORTS.md và mục V.7 của kế hoạch frontend được cập nhật. Không commit/push hoặc sửa cấu hình ứng dụng hiện có.

### Kết quả kiểm tra phần 9 ngày 13/11/2026

- **Kiểm tra frontend:** `npm.cmd run lint`, `npm.cmd test` **89/89**, `npm.cmd run build` đều đạt. Lint được chạy lại sau khi thêm script HTTP và sửa điều kiện chờ checkout.
- **Toàn bộ Maven:** `scripts/test-admin-acceptance.ps1 -SkipFrontendChecks` thực thi `.\mvnw.cmd test` không lọc lớp, kết quả **187 test được liệt kê, 184 đạt, 0 failure/error, 3 skip**. Skip chủ động: 1 GalaxyLiveApiTests và 2 GeminiLiveApiTests; không gọi các dịch vụ ngoài. Log lần cuối tại temp `cinema-admin-acceptance-caf465641ca74863a9600af08d810172/maven.log`. Không cộng XML cũ còn trong target vào số test của lượt chạy này.
- **HTTP/UI tích hợp thật:** `AdminPortalHttpTests` **7/7**, không skip; Edge bên trong đạt **6 nhóm, 40 response HTTP thật, 0 lỗi runtime**. Phim/suất được kiểm tra lại bằng SQL sau UI; lịch trùng trả 409 và DB không thêm suất trùng. Redis/DB giữ ghế thật từ chối lần giữ thứ hai, combo nâng tổng 100.000 lên 140.000, hủy trả ghế AVAILABLE/đơn CANCELLED. Nhập mẫu xử lý **5 phim** theo file classpath hiện có, source LOCAL_FILE, giữ nguyên mốc online; file cũ không được dời ngày. Kết quả/ảnh ở thư mục `edge-http` trong artifact temp trên đã được xem lại.
- **Đối chiếu báo cáo qua HTTP/SQL:** fixture lịch sử gồm 340.000 VND (có combo 40.000), 2 đơn CONFIRMED, 3 vé; nhóm movie/cinema cộng khớp KPI, group none và lọc đồng thời phim/rạp khớp. Occupancy gồm 2 suất inactive, 3/10 = 30%, không sinh inventory khi đọc báo cáo. Dashboard production hiển thị đúng các số liệu này trên desktop/390px.
- **Tích hợp DB/Redis khác trong cùng Maven:** `AdminReportPostgresTests` **9/9** trên PostgreSQL thật; `CheckoutPostgresTests` **15/15** dùng service/DB thật nhưng giả lập lock/gateway/fulfillment để không thanh toán; `RedisHoldTokenTests` **1/1** trên Redis container thử thật. Auth/Catalog/Showtime SpringBootTests và context đều đạt; không có kiểm thử hạ tầng bị bỏ qua.
- **Mô phỏng riêng — Edge Admin:** `test:admin-browser` **35 nhóm/152 request**, movies **13/67**, showtimes **15/98**, reports **15/96**, sync **15/88**. Tất cả 0 lỗi runtime; REST/catalog/báo cáo/lỗi/timeout giả lập, không dùng các kết quả này để chứng minh DB đã lưu.
- **Mô phỏng riêng — khách và backend:** checkout **18 nhóm/82 request**, CineBot **6 nhóm**, 0 lỗi runtime; tổng bảy bộ Edge là **117 nhóm**. Các lớp backend đơn vị/Mockito/MockMvc/transport cục bộ còn lại **147/147** trong lượt Maven trên; phần này không chứng minh Galaxy/Gemini/cổng thanh toán live hoạt động. Checkout artifact cuối `cinema-checkout-browser-NV5B9l`, CineBot `cinema-chatbot-browser-uMgXPg`; Admin `cinema-admin-browser-8eBiTY`, movies `cinema-admin-movies-arMPhD`, showtimes `cinema-admin-showtimes-dnV7Um`, reports `cinema-admin-reports-e9vql7`, sync `cinema-admin-sync-2PQchV`.
- **Các lỗi kiểm thử đã xử lý:** lượt HTTP đầu giả định 3 phim từ fixture mô phỏng; sửa để đọc số ID phim duy nhất trong file thật (5). Lượt Maven đầy đủ đầu phát hiện ID ghế null trong fixture cũ; sửa entity trả về từ save. Lượt checkout đầu bấm trong refetch; thêm chờ điều kiện sẵn sàng. Số liệu ở trên là lượt cuối đã đạt, không thay đổi mã nghiệp vụ để che lỗi.
- **Ranh giới nghiệm thu:** chạy ứng dụng và tài khoản thử thật trên PostgreSQL 18.6/Redis độc lập; đơn CONFIRMED lịch sử được seed trực tiếp, không phải giao dịch thanh toán thật. Không gọi Galaxy/Gemini/live payment, không ghi/đối soát dữ liệu vận hành hiện có. Cụm PostgreSQL thử đã dừng, container Redis thử đã dọn; cổng 8080/2005/6379 và PID ứng dụng ban đầu được kiểm tra giữ nguyên. Cả chín phần đã hoàn tất trong phạm vi kế hoạch; các chức năng mở rộng vẫn ngoài bản bàn giao.
