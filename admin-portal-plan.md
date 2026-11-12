# Kế hoạch xây dựng Admin Portal

Ngày lập: 11/11/2026. Nguồn yêu cầu: [mục V.7 của kế hoạch frontend](ke_hoach_frontend.md).

**Mục tiêu:** Xây dựng Admin Portal gồm phân quyền, báo cáo, quản lý phim, xếp lịch và nhập dữ liệu Galaxy mẫu.

## Phạm vi và nền tảng

- Bốn màn hình: `/admin/reports`, `/admin/movies`, `/admin/showtimes`, `/admin/sync`; `/admin` chuyển đến báo cáo.
- Dùng React 19/Router 7, Vite, Tailwind, Zustand, TanStack Query, Axios và Sonner hiện có; bổ sung `recharts` khi làm biểu đồ.
- Mã tập trung tại `src/features/admin/`, `layouts/AdminLayout.jsx`, `routes/AdminRoute.jsx`, `services/adminService.js`; nối route trong `App.jsx`.
- Bản đầu: danh sách/thêm/sửa phim, danh sách suất đang mở bán/thêm suất. Quản lý tài khoản, CRUD rạp/phòng/ghế/combo, xóa dữ liệu, sửa suất và lịch sử suất chiếu dành cho đợt mở rộng.

## Những điểm đã đối chiếu với mã hiện tại

- Ban đầu frontend chưa có màn hình Admin, `adminService.js` trống; Header đã có liên kết. Backend đã bảo vệ `/api/v1/admin/**` bằng quyền ADMIN. Các phần 1–6 đã triển khai; phần 1–5 kiểm chứng mô phỏng, phần 6 thêm kiểm thử repository/service thật trên PostgreSQL tạm. Hai màn hình còn lại vẫn là khung cho phần 7, 8.
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
