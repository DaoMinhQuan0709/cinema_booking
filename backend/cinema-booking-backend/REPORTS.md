# Dữ liệu báo cáo Admin — phần 6

Hai API GET vẫn thuộc `/api/v1/admin/reports/**`, yêu cầu ADMIN và trả
`ApiResponse`. Không đổi schema. Khởi động lại backend để áp dụng phần sửa này;
dashboard frontend sẽ được triển khai ở phần 7.

## Doanh thu

`GET /revenue?startDate=2026-11-10&endDate=2026-11-10&cinemaId=2&movieId=3&groupBy=movie`

- Ngày lọc theo **`Booking.createdAt` đang lưu**, không theo giờ chiếu hoặc ngày
  thanh toán. Hai ngày đầu/cuối đều được tính; truy vấn dùng khoảng từ đầu ngày
  bắt đầu đến trước đầu ngày sau ngày kết thúc để không làm tròn mất mốc cuối ngày.
  Bỏ một đầu khoảng thì không giới hạn đầu đó; bỏ cả hai thì lấy mọi ngày.
- Chỉ đơn `CONFIRMED` đóng góp doanh thu và số đơn. Doanh thu là `totalAmount`
  của đơn, **gồm combo**, chưa phải báo cáo tiền nhận/hoàn theo giao dịch cổng.
- Vé là số bản ghi `BookingSeat` của đơn CONFIRMED liên kết với ghế suất có trạng
  thái `BOOKED`. `LOCKED`/`AVAILABLE` không là vé đã bán. Một cặp ghế gồm hai vị
  trí tương ứng hai bản ghi, không gộp thành một vị trí.
- `groupBy=movie|cinema|none`, mặc định `none`; chấp nhận chữ hoa/thường và trim.
  `none` trả KPI với `breakdown: []`. Giá trị khác, khoảng ngày ngược hoặc ID
  không dương trả 400; ID không tồn tại nhưng hợp lệ trả kết quả rỗng/0.
- Bộ lọc phim/rạp/ngày giống nhau ở KPI và nhóm. Nhóm theo ID và tên, không gộp
  hai phim/rạp chỉ vì trùng tên; mỗi nhóm thêm `id`, giữ `label`, `revenue`,
  `bookingCount`, `ticketCount`. Thứ tự ID tăng dần.
- Ba KPI lấy từ cùng một truy vấn tổng hợp với breakdown. Đếm ghế bằng truy vấn
  con theo đơn để không nhân tiền/số đơn khi một đơn có nhiều ghế hoặc combo.
  Kết quả rỗng trả tiền/số đếm bằng 0.

## Tỷ lệ lấp đầy

`GET /occupancy?date=2026-11-10&cinemaId=2&movieId=3`

Ngày lọc theo **ngày bắt đầu suất chiếu** ở dữ liệu LocalDateTime Việt Nam.
Bỏ ngày thì lấy mọi suất phù hợp. Truy vấn báo cáo tách khỏi catalog mở bán:
có cả suất đã kết thúc và `active=false`, giữ được lịch sử khi suất ngừng mở bán.

Mỗi suất có `capacitySource` để dashboard giải thích mẫu số:

| Nguồn | Sức chứa |
| --- | --- |
| `INVENTORY` | Số vị trí trong `showtime_seats` đã có, gồm mọi trạng thái; giữ snapshot lịch sử khi cấu hình phòng thay đổi |
| `ACTIVE_SEATS` | Khi chưa có inventory nhưng đã có ghế vật lý: chỉ đếm `Seat.isActive=true` |
| `ROOM_LAYOUT` | Chưa có cả inventory lẫn ghế vật lý: hàng × cột hợp lệ theo bộ sinh layout hiện tại (1–26 hàng, số cột dương) |
| `UNCONFIGURED` | Không có inventory/ghế vật lý và layout không hợp lệ: sức chứa 0, tăng `showtimesMissingCapacity` |

Phòng đã có ghế nhưng mọi ghế inactive có sức chứa 0 với nguồn `ACTIVE_SEATS`;
không dùng hàng × cột để hồi sinh những ghế đã bị tắt. Với cấu hình giữ nguyên,
chỉ mở sơ đồ để sinh ghế chuyển nguồn sang `INVENTORY`, không đổi mẫu số.

`bookedSeats` và `totalSeatsBooked` chỉ đếm `ShowtimeSeat.status=BOOKED`; ghế
đang giữ trong DB/Redis không được cộng. `totalSeatsAvailable` được giữ tên để
tương thích API cũ nhưng là **tổng sức chứa**, bao gồm ghế đã bán, không phải số
ghế còn trống. Tỷ lệ chung = tổng BOOKED / tổng sức chứa × 100, không phải trung
bình các tỷ lệ từng suất. Làm tròn HALF_UP hai chữ số; mẫu số 0 trả 0.0.

Khi `showtimesMissingCapacity > 0`, tỷ lệ dựa trên phần sức chứa đã xác định;
dashboard cần hiện cảnh báo thiếu cấu hình thay vì coi 0 là tỷ lệ đầy đủ.
Mỗi dòng bổ sung `showtimeId`, `movieId`, `cinemaId`, `auditoriumId`, `startTime`,
`active`, `capacitySource`; các trường `label`, `totalSeats`, `bookedSeats`,
`occupancyRate` được giữ. Label chứa cả rạp/phòng/ngày/giờ để đọc lịch sử.

Hai báo cáo chỉ đọc. Occupancy đọc cùng snapshot REPEATABLE_READ bằng tối đa
ba truy vấn: suất có sẵn chi tiết, tổng inventory theo suất, cấu hình ghế theo
phòng chưa có inventory. Không gọi bộ sinh ghế, không lock/sửa ghế hay đọc Redis;
không có truy vấn riêng cho từng suất. Ngày/ID rỗng không tạo câu `IN ()`.

## Kiểm chứng

Mockito/MockMvc không cần hạ tầng:

```powershell
.\mvnw.cmd '-Dtest=AdminReportServiceTests,AdminReportControllerTests' test
```

Repository/service thật trên PostgreSQL tạm, dùng PostgreSQL 18 cài sẵn trên
Windows, không cần credential ứng dụng:

```powershell
.\scripts\test-reports-postgres.ps1
# Nếu PostgreSQL nằm nơi khác:
.\scripts\test-reports-postgres.ps1 -PostgresBin 'D:\PostgreSQL\18\bin'
```

Helper tạo cụm mới trong temp, chọn cổng loopback tạm, chạy
`AdminReportPostgresTests`, rồi dừng server và khôi phục biến môi trường. Chỉ cụm
tạm dùng trust trên loopback; script không đọc cấu hình/kết nối DB ứng dụng.
Giữ log và dữ liệu cụm đã dừng để xem lại; không gọi `drop database`.
PowerShell script lưu UTF-8 BOM để Windows PowerShell đọc đúng tiếng Việt.

Cũng có thể chạy lớp DB trên DB dev/test chỉ định qua `CINEMA_TEST_DB_URL`,
`CINEMA_TEST_DB_USER`, `CINEMA_TEST_DB_PASSWORD`. Lớp tạo schema ngẫu nhiên
`report_test_*`, chỉ dọn fixture/schema đó, không chạy scheduler/sync hoặc gọi
cổng thanh toán. Không đặt URL thì lớp này skip; skip không phải kiểm chứng DB.

Dữ liệu thử có tổng nhóm khớp KPI dưới các bộ lọc, tên trùng, nhiều ghế/combo,
CONFIRMED/PENDING/CANCELLED/EXPIRED, BOOKED/LOCKED/AVAILABLE và các mốc biên ngày.
Occupancy kiểm tra lịch sử, thiếu cấu hình, ghế inactive, snapshot inventory,
sức chứa/tỷ lệ trước và sau mở sơ đồ; thống kê Hibernate kiểm tra số truy vấn
và không có ghi entity từ thao tác báo cáo. Đây là kiểm chứng DB thật với dữ
liệu thử độc lập, chưa phải nghiệm thu HTTP với tài khoản/dữ liệu ứng dụng thật.
