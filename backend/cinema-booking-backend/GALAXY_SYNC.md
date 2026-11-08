# Đồng bộ catalog Galaxy và quản lý đặt vé độc lập

## Ranh giới hệ thống và quyền sở hữu dữ liệu

Hệ thống dùng Galaxy làm nguồn tham chiếu cho phim, thông tin rạp xuất hiện
trong lịch chiếu và suất chiếu. Đây là đồng bộ định kỳ (periodic sync / near
real-time), không phải bản sao đồng nhất tức thì của toàn bộ hệ thống Galaxy.
Các endpoint website đang truy cập được không đồng nghĩa với một Partner API
có cam kết hỗ trợ, độ đầy đủ dữ liệu hoặc SLA cho hệ thống bên ngoài.

| Nhóm dữ liệu | Nguồn và cơ chế cập nhật | Phạm vi thực tế |
| --- | --- | --- |
| Phim, poster, trailer, thời lượng | Galaxy → backend qua HTTP định kỳ | Cập nhật các trường API cung cấp; không cam kết đồng nhất 100% mọi trường trên website |
| Rạp và tên phòng chiếu | Thông tin đính kèm suất chiếu Galaxy | Hiện chỉ nhập rạp/phòng có trong các suất tương lai được xử lý; chưa lấy toàn bộ danh mục rạp bằng API riêng |
| Ngày giờ và liên kết phim/rạp/phòng của suất chiếu | Galaxy → snapshot → DB nội bộ | Đồng bộ gần thời gian thực; suất đã có đơn bị đổi giờ cần xử lý riêng |
| `seats`: sơ đồ và loại ghế | Template nội bộ, mặc định 10×12 | Sơ đồ mô phỏng phục vụ đồ án, không khẳng định đúng sơ đồ phòng Galaxy |
| `showtime_seats`: trạng thái, người giữ, hạn giữ, giá | Booking/payment/cleanup nội bộ cập nhật PostgreSQL và Redis | Không nhập hoặc gửi trạng thái ghế sang Galaxy; không dùng `totalSeat`/`bookedSeat` để suy ra ghế nào trống |
| Đơn hàng, thanh toán, mã QR | Hệ thống nội bộ và cổng thanh toán sandbox | Vé thử nghiệm của đồ án; không phải vé được Galaxy xác nhận hoặc dùng để vào rạp |

PostgreSQL là nguồn dữ liệu bền vững cho trạng thái ghế theo suất. Redis hỗ trợ
từ chối tranh chấp sớm và giữ chỗ với TTL mặc định 600 giây. Luồng tạo booking
hiện dùng `SELECT ... FOR UPDATE NOWAIT` sau khi sắp xếp ID ghế; entity còn có
`@Version`. Thao tác Redis là nguyên tử trên từng key, không biến toàn bộ nhóm
ghế hoặc Redis và PostgreSQL thành một transaction chung.

STOMP WebSocket đẩy thay đổi ghế giữa các client của chính đồ án. “Real-time”
ở đây mô tả cập nhật giao diện theo sự kiện, không phải bảo đảm không có độ trễ
mạng hoặc đồng bộ giao dịch với Galaxy. Khi mất kết nối hoặc cần đối soát,
client lấy lại sơ đồ qua API nội bộ; quyết định giữ/mua ghế nằm ở backend.

Chỉ đọc được sơ đồ/trạng thái ghế từ một website, nếu được phép, cũng chưa đủ
để bán cùng kho ghế đó: hệ thống cần tích hợp được ủy quyền để gửi lệnh giữ,
xác nhận, hủy và nhận kết quả từ hệ thống quản lý kho ghế có thẩm quyền. Dự án
hiện không có tích hợp giao dịch này với Galaxy, nên không thể bảo đảm chống
bán trùng giữa hai hệ thống. Không suy diễn rằng mọi API ghế đều bất khả truy
cập, có chữ ký bí mật hay dùng Cloudflare khi chưa có bằng chứng cụ thể.

Sơ đồ ranh giới và các ID nguồn được mô tả trong [ARCHITECTURE.md](../../ARCHITECTURE.md).

## Chu kỳ đồng bộ catalog

**Đồng bộ Galaxy không tạo bản ghi `seats` hoặc `showtime_seats`.** Mỗi lần
khởi động hoặc đồng bộ chỉ thêm/cập nhật phim, rạp, thông tin phòng gắn với
lịch chiếu và suất chiếu. Suất đã có được nhận diện bằng ID Galaxy.

Kho ghế được tạo theo nhu cầu bởi `LocalSeatInventoryService`, khi gọi
`GET /api/v1/showtimes/{id}/seats` lần đầu:

- Nếu suất đã có ghế: dùng lại trạng thái, giá, người giữ và hạn giữ đã lưu.
- Nếu chưa có: dùng sơ đồ phòng nội bộ; phòng chưa có ghế dùng template 10×12.
  Chỉ tạo `showtime_seats` cho suất đang được mở, mặc định 120 bản ghi.
- Các suất cùng phòng dùng chung ghế vật lý. Khóa bản ghi suất và phòng trong
  transaction ngăn các yêu cầu mở sơ đồ đồng thời tạo dữ liệu trùng.
- Suất chưa ai mở sơ đồ chưa cần tạo kho ghế. Dữ liệu ghế đã tạo từ phiên bản
  trước được giữ lại để bảo toàn booking; bản cập nhật này không tự xóa chúng.

Ví dụ: đồng bộ 2.000 suất mới tạo khoảng 2.000 bản ghi `showtimes`, không kèm
240.000 bản ghi ghế suất chiếu. Mở 3 sơ đồ suất khác nhau mới cần khoảng 360
bản ghi `showtime_seats`. Các bộ đếm ghế trong response đồng bộ giữ giá trị 0
để tương thích API cũ.

Backend lấy trực tiếp ba API `sessions2?includeCinema=true&includeMovie=true`,
`movies/showing` và `movies/comming`. Hai danh sách phim quyết định phân loại
đang chiếu/sắp chiếu; phim có suất bán trước vẫn có thể là sắp chiếu.
Lần chạy tự động đầu tiên bắt đầu sau 10 giây; mỗi lần hoàn tất,
backend đợi 5 phút trước lần tiếp theo. Độ trễ cập nhật còn phụ thuộc thời gian
Galaxy phản hồi và thời gian nhập dữ liệu. Bộ đồng bộ không tự dùng file JSON
thay thế khi kết nối online thất bại.

Giữ chu kỳ 5 phút đã thống nhất. Với `fixedDelay`, khoảng cách giữa hai lần
bắt đầu bằng thời gian thực hiện lần trước cộng 5 phút; lỗi mạng hoặc lỗi DB
có thể khiến dữ liệu cũ lâu hơn. Đây là mục tiêu vận hành, không phải cam kết
độ trễ tối đa 5 phút. Kiểm tra `lastSuccessAt` và `lastError` qua API trạng thái.

Ví dụ cron `0 0 6,12,18 * * ?` chỉ phù hợp nếu chấp nhận cập nhật ba lần/ngày;
khoảng chờ dài nhất là 12 giờ từ 18h đến 6h hôm sau. Nếu áp dụng lịch theo giờ
cố định, cần đặt timezone `Asia/Ho_Chi_Minh`. Lịch hiện tại vẫn dùng `fixedDelay`.

## Cấu hình và chạy

### Dữ liệu chi tiết phim

`GalaxyMovieDetailsScheduler` chạy riêng với luồng catalog. API chi tiết
`GET /api/v2/mobile/movies/{slug}` bổ sung ảnh ngang, quốc gia, tên đạo diễn,
diễn viên, thể loại từ `categories`, mô tả và trailer. Slug và ảnh ngang cũng
được lưu từ danh sách phim. Dữ liệu nghệ sĩ lưu thành mảng tên JSONB trên phim.

Mặc định, tác vụ bắt đầu sau 20 giây rồi đợi 1 phút sau mỗi lượt; tối đa 20 phim
mỗi lượt, gọi tuần tự. Phim chưa có chi tiết được đưa vào hàng đợi, làm mới sau
6 giờ. Lần thử được ghi trước HTTP để lỗi không bị gọi lại liên tục; chờ tối thiểu
5 phút trước khi thử lại và ưu tiên phim có lần thử cũ hơn để tránh tắc hàng đợi.
Response cần đúng ID Galaxy, object/mảng đúng kiểu. Lỗi ở một phim giữ dữ liệu
cũ và không rollback catalog. HTTP và việc ghi metadata nằm ngoài transaction
catalog; `@DynamicUpdate` trên `Movie` tránh ghi đè các cột không thay đổi khi
catalog và metadata cùng cập nhật.

Truy vấn tìm phim đến hạn chỉ lấy ID nội bộ, ID Galaxy và slug, tránh tải lại
JSON nghệ sĩ/mô tả vào bộ nhớ cho công việc chưa cần những trường đó. Khi cùng
một phim xuất hiện ở sessions, đang chiếu và sắp chiếu trong một lượt catalog,
importer dùng lại entity đã đọc; không tìm và merge lặp cho mỗi nguồn.

Các biến tùy chọn trong `application.yml`:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `GALAXY_DETAILS_SYNC_ENABLED` | `true` | Bật tác vụ bổ sung; vẫn tuân theo `GALAXY_SYNC_ENABLED` |
| `GALAXY_DETAILS_INTERVAL_MS` | `60000` | Khoảng đợi sau mỗi lượt |
| `GALAXY_DETAILS_INITIAL_DELAY_MS` | `20000` | Khoảng đợi sau khởi động |
| `GALAXY_DETAILS_BATCH_SIZE` | `20` | Phim mỗi lượt, giới hạn 1–100 |
| `GALAXY_DETAILS_REFRESH_MS` | `21600000` | Thời hạn làm mới, tối thiểu 1 phút |
| `GALAXY_DETAILS_RETRY_MS` | `300000` | Khoảng chờ thử lại, tối thiểu 1 phút |

`GET /api/v1/movies/{id}` trả thêm `landscapeUrl`, `country`, `directors`, `actors`;
không gọi Galaxy khi khách mở trang. Lần đồng bộ đầu cần vài lượt để bổ sung hết
catalog; dữ liệu mới hiển thị dần. Trang chi tiết đọc lại API nội bộ mỗi phút khi
đang mở. Mô tả nguồn chuyển thành văn bản; trailer chỉ nhúng sau khi bấm và chỉ
chấp nhận URL YouTube hợp lệ.

Dev dùng `ddl-auto=update` khi khởi động lại. Production cần chạy bản mới của
`src/main/resources/db/manual/galaxy-sync.sql` trước deploy; script có thể chạy lại.
Tác vụ không đọc/ghi `seats`, `showtime_seats` hoặc booking. Trạng thái freshness
catalog không đại diện cho thời điểm cập nhật metadata của từng phim.

### Chạy bằng VS Code

Mở thư mục gốc `E:\JAVA\cinema_booking` trong VS Code. Cấu hình
[.vscode/launch.json](../../.vscode/launch.json) đã khai báo main class, thư mục
backend và các biến `GALAXY_*` cho tiến trình Java.

1. Dừng phiên backend cũ nếu còn chạy.
2. Mở **Run and Debug** (`Ctrl+Shift+D`).
3. Chọn **Cinema Backend (Galaxy Sync)** rồi nhấn **F5**.
4. Chờ log `Started CinemaBookingBackendApplication` và Tomcat mở cổng 8080.
   Có thể kiểm tra JSON tại `http://localhost:8080/api/v1/movies`.

PostgreSQL và Redis cần chạy theo cấu hình của profile `dev`. Không cần nhập
`$env:` mỗi lần nếu dùng cấu hình F5 này. Nếu Galaxy thay clientId, cập nhật
`env.GALAXY_CLIENT_ID` trong `launch.json` rồi khởi động lại backend.

Log `Galaxy sync not completed` là lỗi của tác vụ đồng bộ, không tự dừng
web server. HTTP 403 cần kiểm tra clientId của tiến trình đang chạy; việc đặt
`$env:` ở một terminal khác không cập nhật môi trường của tiến trình IDE.

### Chạy từ PowerShell hoặc cấu hình môi trường riêng

Đặt biến môi trường trong cấu hình chạy IDE hoặc trước khi khởi động backend:

```powershell
$env:GALAXY_SYNC_ENABLED = 'true'
$env:GALAXY_SYNC_INTERVAL_MS = '300000'
$env:GALAXY_CLIENT_ID = '<clientId của request Galaxy chạy thành công>'
```

`GALAXY_API_BASE_URL` mặc định là `https://www.galaxycine.vn`. Chỉ thay đổi nếu
đã xác nhận Galaxy đổi host API. `clientId` lấy từ request `sessions2` trong
DevTools → Network trên website Galaxy. Không đưa Cookie/Authorization của
tài khoản vào mã nguồn. Nếu Galaxy đổi clientId, cập nhật biến môi trường và
khởi động lại backend. Biến `GALAXY_SYNC_INITIAL_DELAY_MS` điều chỉnh lần chạy đầu.

Với profile `dev`, Hibernate `ddl-auto=update` tạo các cột mới khi khởi động.
Với profile `prod` (`ddl-auto=validate`), áp dụng
`src/main/resources/db/manual/galaxy-sync.sql` trước khi chạy bản backend mới.
Đây là script migration thủ công; ứng dụng không tự thực thi script này.

## API quản trị

Các endpoint sau yêu cầu JWT của tài khoản `ADMIN`:

- `POST /api/v1/admin/sync/galaxy`: lấy toàn bộ snapshot online ngay lập tức.
  Mặc định `limitShowtimes=0` nghĩa là tất cả, thay cho giới hạn 100 cũ.
- `POST /api/v1/admin/sync/galaxy?clientId=...`: ghi đè clientId cho lần chạy đó.
  Lịch tự động vẫn dùng biến môi trường; tham số này không được lưu lại.
- `GET /api/v1/admin/sync/galaxy/status`: xem trạng thái lịch, lần thử gần nhất,
  lần đồng bộ toàn bộ thành công gần nhất và lỗi gần nhất.
  Mốc thời gian là ISO-8601 UTC; trạng thái này nằm trong bộ nhớ của instance
  đang phục vụ request và được đặt lại khi backend khởi động lại.
- `/galaxy/local-file` và `/galaxy/raw-json` vẫn dùng được để nhập thử thủ công.
  Đây là dữ liệu offline, không chứng minh catalog đang cập nhật.

Chỉ lần online đầy đủ mới đối chiếu các bản ghi bị gỡ khỏi nguồn. Lần chạy có
`limitShowtimes > 0` và lần offline không ẩn các bản ghi vắng mặt, không cập nhật
mốc thành công của đồng bộ online đầy đủ.

## Cách cập nhật dữ liệu

- Phim, rạp và suất chiếu được nhận diện bằng ID Galaxy. Thông tin phim/rạp
  được cập nhật, không chỉ thêm mới. Khi chuyển từ bộ nhập cũ, phim trùng tên,
  rạp trùng tên và suất chiếu trùng phim/phòng/thời gian được nhận diện lại để
  giữ nguyên ID nội bộ và lịch sử vé.
- Dữ liệu cũ không khớp với nguồn và chưa có ID Galaxy không thể phân biệt
  chắc chắn với dữ liệu do quản trị viên tạo. Bộ đồng bộ giữ lại các bản ghi đó;
  cần kiểm tra riêng dữ liệu thử nghiệm cũ nếu muốn catalog chỉ chứa Galaxy.
- Suất chiếu Galaxy đã gỡ hoặc đã bắt đầu được đánh dấu `is_active=false`.
  Danh sách tra cứu chỉ trả suất còn mở và chưa bắt đầu. API đặt vé từ chối
  suất đã ẩn, kể cả khi người dùng giữ đường dẫn cũ.
- Không xóa booking, không reset trạng thái/giá ghế đã tồn tại. Thời gian bắt đầu
  thay đổi sẽ cập nhật khi chưa có đơn. Suất đổi phòng/phim hoặc đổi giờ khi đã
  có đơn được ẩn và báo trong `totalShowtimesSkipped` để quản trị viên kiểm tra;
  backend không tự chuyển vé sang suất khác hoặc tự hoàn tiền.
- Cập nhật được áp dụng trong một transaction. HTTP chạy bên ngoài transaction.
  Khóa trong process ngăn lịch tự động trùng thao tác thủ công; advisory lock
  PostgreSQL ngăn các instance ghi dữ liệu đồng thời. Khóa bản ghi suất chiếu
  phối hợp việc cập nhật với tạo booking.
- `showDate`/`showTime` được hiểu theo `Asia/Ho_Chi_Minh`. Không dời ngày dữ liệu
  offline sang ngày hiện tại để tạo lịch chiếu giả.

## Phiên truy cập Galaxy, HTML và chuyển hướng

Galaxy có thể trả HTTP 302 về chính URL API trong lần gọi đầu để cấp cookie
phiên công khai (đã quan sát cookie `muid_mly`). Trình duyệt tự lưu cookie đó;
HTTP client không lưu cookie sẽ lặp chuyển hướng và không nhận được JSON.
HTTP client Java hiện dùng `CookieManager` để giữ cookie theo host và gửi lại
trong các lần gọi tiếp theo, kể cả khi lấy danh sách phim sắp chiếu.

Bộ đồng bộ chỉ thử lại nếu phản hồi có `Set-Cookie` và `Location` trỏ đúng URL
đang gọi, tối đa 3 yêu cầu cho mỗi endpoint. Không đi theo chuyển hướng sang
host/path khác. Không cần sao chép Cookie đăng nhập từ trình duyệt. Cookie phiên
chỉ nằm trong bộ nhớ và được thiết lập lại sau khi backend khởi động lại.

Lỗi `no suitable HttpMessageConverter ... JsonNode ... text/html` xảy ra trước
khi xác định nội dung phản hồi. Client mới đọc UTF-8 rồi parse JSON bằng
ObjectMapper, nên JSON gắn nhầm Content-Type vẫn đọc được. Nếu nội dung thực
sự là HTML, chuyển hướng không hợp lệ/lặp quá giới hạn, HTTP 4xx/5xx,
JSON lỗi hoặc `data.total` khác số phần tử
`data.result`, backend trả HTTP 502 với nguyên nhân cụ thể, không cập nhật DB.
Nếu API phân trang, cần xác nhận tham số phân trang và lấy đủ các trang trước
khi áp dụng snapshot; backend không coi một trang là toàn bộ lịch chiếu.

ClientId hợp lệ trên trình duyệt có thể chưa đủ cho mọi môi trường triển khai.
Cần kiểm tra response thực tế trên máy/server triển khai nếu vẫn gặp lỗi.
Client xử lý cookie phiên thông thường, không thực thi challenge JavaScript.

Phạm vi đồng bộ và giới hạn về sơ đồ ghế, giá và vé thử nghiệm được trình bày
ở mục “Ranh giới hệ thống và quyền sở hữu dữ liệu” phía trên.

## Trình bày phạm vi khi bảo vệ đồ án

> Hệ thống của em đồng bộ định kỳ dữ liệu phim, thông tin rạp và lịch chiếu
> từ các endpoint của website Galaxy để tạo dữ liệu tham chiếu thực tế. Sơ đồ
> ghế và giá vé được cấu hình trong đồ án. Toàn bộ giữ ghế 10 phút, chống đặt
> trùng, xác nhận đơn và cập nhật giao diện vận hành độc lập bằng Redis,
> PostgreSQL và STOMP WebSocket. Thanh toán chạy trong môi trường sandbox;
> hệ thống không giữ chỗ hoặc phát hành vé có giá trị tại Galaxy.

## Kiểm thử không cần PostgreSQL/Redis

### Giảm chi phí vận hành

Bộ đồng bộ tải các suất đã có bằng một truy vấn theo lô, có khóa bản ghi và
sắp xếp theo ID nội bộ; vẫn dùng đối chiếu riêng khi nhận diện dữ liệu legacy.
Không tạo ghế trong đồng bộ. API đọc sơ đồ chỉ đọc khóa Redis của các ghế
`AVAILABLE` đang xét bằng `MGET`, không quét toàn bộ keyspace bằng `KEYS`.
Nhả nhiều ghế gửi một lệnh xóa danh sách khóa. Báo cáo occupancy dùng một
truy vấn nhóm để đếm ghế của toàn bộ suất, thay cho hai truy vấn mỗi suất.

Log SQL ở profile `dev` mặc định tắt. Đặt biến môi trường `SHOW_SQL=true` khi
cần xem câu SQL; điều này không ảnh hưởng lịch đồng bộ hoặc dữ liệu.

### Kiểm thử tự động

```powershell
.\mvnw.cmd '-Dtest=GalaxyApiClientTests,GalaxyDataImporterTests,GalaxySyncServiceTests,GalaxySyncSchedulerTests,GalaxySessionTransportTests,GalaxyMovieDetailsTests,GalaxyMovieDetailsServiceTests,MovieDetailsMappingTests,CinemaServiceTests,LocalSeatInventoryTests,SeatLockServiceTests,ShowtimeServiceTests,AdminReportServiceTests' test
```

Các test sử dụng HTTP giả lập, HTTP server loopback và repository mock: cookie
được cấp từ redirect 302 và tái sử dụng giữa các endpoint, giới hạn thử lại,
phản hồi JSON bị gắn nhầm
Content-Type, HTML thật, redirect 302, 403, snapshot thiếu, cập nhật lặp,
không giới hạn 100 suất, bảo toàn ghế/vé, không lấy `totalSeat`/`bookedSeat`
ghi đè trạng thái ghế nội bộ, ẩn bản ghi cũ, giới hạn/offline,
xung đột đồng bộ, trạng thái thất bại và lịch chạy lại. Chúng không thay thế
kiểm tra transaction/khóa trên PostgreSQL thật.

Kiểm tra chỉ đọc trực tiếp Galaxy bằng đúng HTTP client của backend:

```powershell
.\mvnw.cmd '-Dtest=GalaxyLiveApiTests' '-Dgalaxy.live=true' test
```

Test này lấy `GALAXY_CLIENT_ID` từ môi trường, xác nhận nhận đủ snapshot theo
`data.total` và đọc/ánh xạ một object phim chi tiết, không nhập DB. Nó chỉ chạy
khi chủ động đặt `galaxy.live=true`. `MovieDetailsMappingTests` kiểm tra mapping
JSONB/HQL bằng dialect PostgreSQL với connection provider không kết nối database.
Tổng số suất chiếu thay đổi theo thời điểm gọi, không được cố định theo mẫu JSON.
