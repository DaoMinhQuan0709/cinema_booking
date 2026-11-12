# Bàn giao Admin Portal

Ngày nghiệm thu: 13/11/2026. Mã và checklist chi tiết tại
[kế hoạch Admin](admin-portal-plan.md); quy ước component, hooks và DTO tại
[README Admin](frontend/src/features/admin/README.md).

## Khởi động và cấp quyền

Yêu cầu Node.js 24, Java 21, PostgreSQL và Redis. Frontend dùng React 19,
Router 7, TanStack Query 5, Vite 8, Tailwind 3 và Recharts 3. Cấu hình REST qua
`VITE_API_BASE_URL` (mặc định `http://localhost:8080/api/v1`); biến `VITE_*`
được đưa vào bundle, chỉ chứa cấu hình công khai.

1. Chuẩn bị PostgreSQL/Redis và biến môi trường backend theo
   [GALAXY_SYNC.md](backend/cinema-booking-backend/GALAXY_SYNC.md), áp dụng schema
   checkout theo [CHECKOUT.md](backend/cinema-booking-backend/CHECKOUT.md) nếu
   đang nâng cấp DB cũ. Khởi động lại backend với mã mới để có dữ liệu báo cáo
   và phân biệt đúng HTTP 401/403.
2. Từ `backend/cinema-booking-backend`, chạy `./mvnw.cmd spring-boot:run`.
3. Từ `frontend`, chạy `npm.cmd ci`, thiết lập `.env` theo `.env.example` nếu
   cần, rồi `npm.cmd run dev`. Production build: `npm.cmd run build`.
4. Đăng ký tài khoản bằng luồng hiện có. Đăng ký công khai chỉ tạo CUSTOMER.
   Người vận hành cấp ADMIN trong DB cho đúng email đã xác minh; giao diện
   không có chức năng tự nâng quyền. Ví dụ dưới đây cần thay email đích:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'email-quan-tri@example.com';
SELECT id, email, role FROM users WHERE email = 'email-quan-tri@example.com';
```

Đăng nhập lại sau khi cấp quyền, mở `/admin`. Guard xác minh `/users/me` trước
khi tải layout/module/query Admin; localStorage không quyết định quyền. Chưa
đăng nhập mở modal tại URL đang xem; CUSTOMER nhận màn hình 403. Backend bảo
vệ toàn bộ `/api/v1/admin/**`. Đổi tài khoản/đăng xuất xóa cache Admin và bỏ
qua phản hồi của phiên cũ. Sidebar có Về website và Đăng xuất; mobile có drawer
và vòng focus, Escape đóng menu.

## Bốn màn hình bàn giao

| Đường dẫn | Thao tác | API chính |
| --- | --- | --- |
| `/admin/reports` | KPI, biểu đồ theo phim/rạp, bảng nhóm, lấp đầy theo ngày riêng | `GET /admin/reports/revenue`, `/occupancy` |
| `/admin/movies` | Tìm/lọc/phân trang server, thêm/sửa chín trường DTO bằng modal | `GET /movies`, `POST /admin/movies`, `PUT /admin/movies/{id}` |
| `/admin/showtimes` | Xem suất đang mở bán, lọc ngày/rạp/phim và thêm lịch | `GET /showtimes`, `/movies`, `/cinemas`; `POST /admin/showtimes` |
| `/admin/sync` | Nhập file Galaxy mẫu, giới hạn 100/0, kết quả chín bộ đếm, trạng thái online riêng | `POST /admin/sync/galaxy/local-file?limitShowtimes=100`, `GET /admin/sync/galaxy/status` |

Các API trong bảng có tiền tố `/api/v1`. Bộ lọc được lưu trong URL để F5/Back
khôi phục ngữ cảnh. Danh mục/báo cáo liên quan được làm mới sau ghi. Form khóa
khi gửi, giữ bản nháp khi lỗi; 400 gắn lỗi vào trường, 409 lịch chiếu yêu cầu
sửa phòng/giờ. Timeout ghi không tự POST lại: đọc catalog/lịch để đối chiếu
trước khi chủ động gửi lại. Các màn hình có loading/rỗng/lỗi/thử lại, bảng
cuộn ngang và điều hướng bàn phím ở 390px.

Doanh thu tính theo **ngày tạo đơn CONFIRMED**, gồm combo; vé chỉ đếm vị trí
BOOKED liên kết đơn đó. KPI và breakdown dùng cùng bộ lọc. Occupancy dùng ngày
bắt đầu suất riêng, gồm cả lịch sử/inactive; mẫu số là tổng sức chứa, không
phải ghế còn trống. Nguồn ưu tiên inventory, ghế vật lý active, layout phòng;
thiếu cấu hình được cảnh báo. Tỷ lệ chung dùng tổng BOOKED/tổng sức chứa, không
lấy trung bình các tỷ lệ. Chi tiết: [REPORTS.md](backend/cinema-booking-backend/REPORTS.md).

Galaxy mẫu giữ nguyên ngày trong file đóng gói. Giới hạn 0 xét mọi suất tương
lai, không hạn chế số phim; file cũ có thể nhập phim nhưng không thêm lịch
tương lai. Bộ đếm là số bản ghi xử lý, có thể gồm cập nhật, không phải số bản
ghi mới. Import không tạo inventory ghế. Kết quả offline chỉ giữ trong lần mở
trang; `lastSuccessAt` thuộc đồng bộ online đầy đủ, lưu trong bộ nhớ instance.
Lịch online có thể cập nhật lại metadata phim Galaxy đã sửa. Chi tiết tại
[GALAXY_SYNC.md](backend/cinema-booking-backend/GALAXY_SYNC.md).

## Chạy nghiệm thu lại

Trên Windows cần PostgreSQL binary (mặc định
`C:/Program Files/PostgreSQL/18/bin`), Docker đang chạy, image `redis:7-alpine`,
Edge và dependency frontend/Maven đã cài. Đặt `ADMIN_EDGE_PATH` nếu Edge ở chỗ
khác. Từ `backend/cinema-booking-backend`:

```powershell
.\scripts\test-admin-acceptance.ps1
```

Helper chạy lint/unit/build, bảy bộ Edge **mô phỏng**, rồi `./mvnw.cmd test`
không lọc lớp. Helper tự tạo PostgreSQL mới trong temp, Redis container không
volume trên cổng loopback ngẫu nhiên và tắt Galaxy online/details, VNPay query
và email ra ngoài. Ứng dụng Spring Boot thử dùng Tomcat cổng ngẫu nhiên; fixture
HTTP có schema riêng để không lẫn các test catalog. DB/Redis ứng dụng đang chạy
được giữ nguyên. Kết thúc dừng cluster và dọn đúng container vừa tạo; thư mục
temp giữ dữ liệu thử/log để tra cứu. Mật khẩu/JWT fixture không ghi vào JSON
kết quả; browser profile trong temp chứa phiên thử, không phải tài khoản thật.

Các tùy chọn dùng khi phát triển:

```powershell
# Dùng build hiện có và bỏ qua các bước frontend đã đạt; vẫn có Edge HTTP thật.
.\scripts\test-admin-acceptance.ps1 -SkipFrontendChecks
# Chỉ kiểm tra hành trình HTTP/Admin, có cả Edge production.
.\scripts\test-admin-acceptance.ps1 -SkipFrontendChecks -Tests AdminPortalHttpTests
# Đổi đường dẫn binary PostgreSQL.
.\scripts\test-admin-acceptance.ps1 -PostgresBin 'D:\PostgreSQL\18\bin'
```

`-SkipBrowser` bỏ kiểm thử Edge HTTP và ghi skip tương ứng; không dùng tùy chọn
này cho nghiệm thu đầy đủ. `AdminPortalHttpTests` chỉ bật qua môi trường helper,
dùng đăng ký/đăng nhập/JWT, controller/service/repository thật, không mock bean.
Node nhận credential thử qua stdin; CDP chỉ đổi đích API sang cổng Tomcat thử,
không thay request body hoặc giả response. Kết quả UI còn được đọc lại từ DB
bằng SQL độc lập sau khi Edge kết thúc. Script này không chạy trực tiếp bằng
`npm test`; được lớp HTTP khởi chạy trong lúc backend thử còn hoạt động.

Chạy các bộ mô phỏng riêng từ `frontend` sau build:

```powershell
npm.cmd run test:admin-browser
npm.cmd run test:admin-movies-browser
npm.cmd run test:admin-showtimes-browser
npm.cmd run test:admin-reports-browser
npm.cmd run test:admin-sync-browser
npm.cmd run test:checkout-browser
npm.cmd run test:chatbot-browser
```

## Kết quả và giới hạn

Kết quả từng loại được ghi riêng ở [phần 9 của kế hoạch](admin-portal-plan.md#tiến-độ-phần-9--kiểm-chứng-và-bàn-giao).
Ngày 13/11/2026: lint/build và 89 unit test frontend đạt; toàn bộ Maven liệt kê
187 test, 184 đạt, 3 live skip, không lỗi. Bên trong có 7/7 HTTP thật và 6 nhóm
Edge với 40 response thật, 0 lỗi runtime. Bảy bộ Edge mô phỏng riêng đạt 117
nhóm, 0 lỗi runtime. Bằng chứng thật: 340.000 VND/2 đơn/3 vé, lấp đầy 3/10 = 30%,
phim/suất lưu đúng DB, trùng lịch 409 và nhập file mẫu xử lý 5 phim.

Các đơn CONFIRMED phục vụ đối chiếu báo cáo là fixture được tạo trực tiếp trong
DB thử. Kiểm tra giữ/hủy ghế và cập nhật combo dùng HTTP/Redis thật; không thực
hiện giao dịch cổng thanh toán. Các test cần Galaxy/Gemini live được tắt chủ
động, không suy diễn kết quả mô phỏng thành kết nối dịch vụ ngoài thành công.

Bản bàn giao chưa gồm xóa phim, sửa/xóa suất, danh sách lịch sử suất trong màn
hình quản lý, CRUD tài khoản/rạp/phòng/ghế/combo hoặc lịch sử job nhập offline.
Backend có một số API rộng hơn nhưng UI chỉ bàn giao phạm vi bốn màn hình trên.
Nghiệm thu dùng tài khoản/dữ liệu thử của ứng dụng thật trên hạ tầng độc lập;
không ghi hoặc kiểm toán dữ liệu vận hành hiện có ở cổng 8080/2005/6379.
