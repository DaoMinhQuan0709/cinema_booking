# Admin Portal — báo cáo, phim, suất chiếu và Galaxy mẫu

`MovieManager` đã có danh sách/thêm/sửa phim ở phần 4; `ShowtimeManager` có
danh sách/thêm suất ở phần 5. `ReportDashboard` đã hoàn thành phần 7 trên dữ
liệu phần 6. `DataSync` đã hoàn thành phần 8. Phần 9 bổ sung nghiệm thu HTTP/
PostgreSQL/Redis thật, có Edge production và tài khoản ADMIN/CUSTOMER thử.
Xem [bàn giao Admin](../../../../ADMIN_PORTAL.md) để khởi động, cấp quyền,
chạy helper nghiệm thu và xem phạm vi kết quả; các bộ mô phỏng bên dưới vẫn độc lập.

## Quản lý phim — phần 4

Mở `/admin/movies` bằng tài khoản ADMIN. Danh sách đọc đúng một trang từ backend,
mặc định 10 phim, sắp xếp ID mới nhất trước. Tìm theo tên bằng nút Áp dụng/Enter;
đổi trạng thái hoặc số phim/trang cũng áp dụng tên đang nhập và trở về trang đầu.
Có cả Đang chiếu, Sắp chiếu, Ngừng chiếu và Tất cả trạng thái.

Bộ lọc lưu trong URL: `q`, `status`, `page` (bắt đầu từ 1), `size` (10/20/50).
Request backend dùng `keyword` và page bắt đầu từ 0. F5/Back giữ ngữ cảnh;
tham số sai được chuẩn hóa, trang vượt giới hạn chỉ tự điều chỉnh sau khi nhận
kết quả thành công. Khi sửa trạng thái khiến trang cuối không còn dữ liệu,
danh sách tự trở về trang còn tồn tại. Các tham số URL khác được giữ nguyên.

Nút Thêm phim và Sửa mở `MovieFormModal`, dùng đầy đủ chín trường writable của
`MovieCreateRequest`. Tên không rỗng/tối đa 255 ký tự; thời lượng nguyên dương
trong phạm vi Integer; ngày phải đúng lịch (không chuyển qua UTC, cho phép ngày
quá khứ); poster/trailer tùy chọn, chỉ URL HTTP(S) hợp lệ tối đa 500 ký tự.
Thể loại tối đa 500, phân loại tuổi tối đa 10 ký tự. Các trường tùy chọn để trống
được gửi `null` để xóa giá trị cũ. Các thông tin Galaxy ngoài DTO như quốc gia,
đạo diễn, diễn viên và ảnh ngang không được gửi khi sửa.

Lỗi client/server giữ nguyên form; 400 hiện theo trường, lỗi khác dùng thông báo
chung và một toast từ hook. Trong khi gửi, form/nút đóng/Escape bị khóa. Nếu mất
phản hồi, bản nháp còn nguyên và nút Kiểm tra lại danh sách chỉ GET để đối chiếu;
không tự POST lại. Sau lưu, các cache phim, lịch/báo cáo và catalog khách liên quan
được invalidate; phim mới trở về trang đầu nhưng vẫn giữ bộ lọc hiện tại. Poster
lỗi có fallback. Bảng cuộn ngang trong vùng riêng ở màn hình nhỏ.

Sau `npm.cmd run build`, chạy `npm.cmd run test:admin-movies-browser` để kiểm tra
màn hình production bằng Edge (có thể đặt `ADMIN_EDGE_PATH`). REST và catalog lưu
bằng bộ nhớ giả lập; kiểm tra F5 chỉ chứng minh frontend đọc lại bản ghi từ API
giả lập, không chứng minh DB thật đã lưu. JSON kết quả/ảnh desktop/390px nằm trong
thư mục tạm script in ra. Kiểm chứng API thật được bổ sung trong phần 9.

## Quản lý suất chiếu — phần 5

Mở `/admin/showtimes` bằng tài khoản ADMIN. Bộ lọc ngày/rạp/phim áp dụng ngay,
lưu `date=YYYY-MM-DD`, `cinemaId`, `movieId` trong URL để F5/Back khôi phục;
mặc định là hôm nay theo Việt Nam. Xóa bộ lọc giữ ngày đang chọn. Tham số sai
được chuẩn hóa trước request, các tham số không liên quan được giữ nguyên.
Ngày quá khứ được phép xem nhưng API chỉ trả các suất chưa bắt đầu, còn mở bán;
đây chưa phải danh sách lịch sử. Bảng hiện phim, rạp/phòng, hai mốc ngày giờ và
giá vé cơ bản bằng VND, không có sửa/xóa suất.

Phim dùng bộ chọn gom mọi trang catalog; phòng lấy từ `cinema.auditoriums`.
Lỗi tải phim/rạp có nút thử lại riêng và không chặn đọc lịch; chưa có danh mục
thì chưa thể thêm suất. Form kế thừa phim/rạp đang lọc; ngày tương lai gợi ý
bắt đầu lúc 10:00, hôm nay/quá khứ dùng mốc nửa giờ tiếp theo trong tương lai.
Đổi rạp luôn xóa phòng cũ; rạp chưa có phòng được giải thích tại trường phòng.

Kết thúc gợi ý = bắt đầu + thời lượng phim + 15 phút, tính đúng cả qua nửa đêm,
tháng và năm. Gợi ý tự cập nhật khi đổi phim/giờ bắt đầu; sau khi chỉnh tay, mốc
kết thúc được giữ đến khi bấm Dùng giờ gợi ý. Form chặn thiếu phim/phòng, phòng
không thuộc rạp, giờ bắt đầu không ở tương lai và kết thúc không sau bắt đầu.
Giá phải dương, tối đa 99.999.999,99 và 2 chữ số thập phân theo DECIMAL(10,2).

POST chỉ gửi `movieId`, `auditoriumId`, `startTime`, `endTime`, `basePrice`.
Hai mốc là `YYYY-MM-DDTHH:mm:ss` theo giờ Việt Nam (UTC+7), không chuyển sang
UTC bằng `toISOString()`; kiểm tra tương lai vẫn đúng khi trình duyệt ở múi giờ
khác. Backend Admin cũng dùng Clock theo `Asia/Ho_Chi_Minh` và chặn kết thúc
bằng bắt đầu; cần khởi động lại backend để áp dụng thay đổi này.

409 trùng lịch giữ toàn bộ form để sửa phòng/giờ, 400 hiện lỗi theo trường,
500/mất phản hồi giữ bản nháp. Trong khi gửi, khóa form/đóng/Escape và chống
gửi lặp. Không tự POST lại khi timeout; Kiểm tra lại danh sách chỉ GET bộ lọc
đang xem, cần đối chiếu đúng ngày/rạp/phim trước khi gửi lại. Sau thành công,
danh sách chuyển đến ngày/rạp/phim của suất mới; cache lịch/báo cáo và catalog
khách liên quan được invalidate, kể cả lịch khách đã có cache.

Sau build, chạy `npm.cmd run test:admin-showtimes-browser` trên Windows/Edge
(có thể đặt `ADMIN_EDGE_PATH`). Script kiểm tra màn hình production và lịch
khách thật với REST/danh mục lưu trong bộ nhớ mô phỏng: bộ lọc/F5/Back, phòng,
gợi ý qua nửa đêm, múi giờ Los Angeles, DTO/Bearer, validation/409/400/500,
timeout không retry, cập nhật lịch khách có cache, desktop/390px/bàn phím và
chặn CUSTOMER. JSON/ảnh nằm ở thư mục tạm script in ra. Backend có
`AdminShowtimeServiceTests` dùng Clock cố định và repository giả; các kết quả
này được bổ sung bằng HTTP/DB thật và kiểm tra xung đột thật trong phần 9.

## Dữ liệu báo cáo — phần 6

Backend giữ các trường KPI cũ; nhóm doanh thu thêm `id` để phân biệt phim/rạp
trùng tên. KPI và breakdown dùng cùng bộ lọc, vé nhóm không còn gán 0. Doanh thu
theo ngày tạo đơn CONFIRMED, gồm combo; vé yêu cầu ghế suất BOOKED. Đây chưa phải
báo cáo dòng tiền theo ngày thanh toán/hoàn tiền.

Occupancy gồm cả suất đã kết thúc/ngừng mở bán. Mỗi dòng thêm `showtimeId`,
`movieId`, `cinemaId`, `auditoriumId`, `startTime`, `active`, `capacitySource`.
Nguồn sức chứa là INVENTORY, ACTIVE_SEATS, ROOM_LAYOUT hoặc UNCONFIGURED;
`showtimesMissingCapacity` ở cấp báo cáo cho biết số suất thiếu cấu hình được
cảnh báo trong dashboard phần 7. `totalSeatsAvailable` vẫn là tổng sức chứa
(gồm ghế đã bán), không phải số ghế còn trống. Tỷ lệ chung là tổng BOOKED chia
tổng sức chứa, mẫu số 0 trả 0.0. Báo cáo không sinh ghế hoặc ghi dữ liệu.

Hai báo cáo có bộ ngày riêng: doanh thu dùng khoảng ngày tạo đơn, occupancy
dùng một ngày bắt đầu suất. `groupBy` nhận movie/cinema/none; ngày đảo ngược,
groupBy khác hoặc ID không dương trả 400. Xem [REPORTS.md](../../../../backend/cinema-booking-backend/REPORTS.md)
về cơ sở tính, nguồn sức chứa và cách chạy kiểm thử mock/PostgreSQL tạm.

## Dashboard báo cáo — phần 7

Mở `/admin/reports` bằng tài khoản ADMIN đã xác minh. Giao diện giữ nền tối/đỏ,
Be Vietnam Pro/Plus Jakarta Sans của Admin: KPI doanh thu/đơn/vé, biểu đồ thanh
Recharts theo phim hoặc rạp, bảng chi tiết và phần lấp đầy riêng.

Bộ lọc URL gồm `startDate`, `endDate`, `cinemaId`, `movieId`, `groupBy`,
`occupancyDate`. Mặc định doanh thu từ đầu tháng đến hôm nay theo Việt Nam,
nhóm theo phim; ngày lấp đầy mặc định hôm nay. Các ngày mặc định được ghi rõ
vào URL nên F5/Back giữ đúng ngữ cảnh, kể cả khi sang ngày mới; các tham số
không liên quan và hash được giữ. Ngày/ID/group sai định dạng được chuẩn hóa.
ID lịch sử ngoài danh mục vẫn được giữ và có lựa chọn mô tả tương ứng.

Rạp/phim áp dụng ngay cho cả hai báo cáo. Ngày doanh thu dùng bản nháp và chỉ
áp dụng bằng nút Áp dụng ngày; khoảng ngược/thiếu ngày báo lỗi theo trường,
không đổi dữ liệu/URL đã áp dụng. URL trực tiếp có hai ngày hợp lệ nhưng ngược
thứ tự chặn query doanh thu đến khi sửa, trong khi lấp đầy vẫn hoạt động.
Ngày lấp đầy áp dụng riêng; đổi ngày hoặc groupBy chỉ gọi lại báo cáo liên quan.
Đặt lại bộ lọc khôi phục mặc định và xóa cả bản nháp/lỗi ngày.

Biểu đồ chọn tối đa 10 nhóm có doanh thu cao nhất; bảng giữ đủ nhóm, phân trang
20 hàng ở phía client. Bảng lấp đầy phân trang độc lập. Tên trùng được phân biệt
bằng ID trên biểu đồ/bảng/bộ chọn; tooltip và bảng có tên đầy đủ. Biểu đồ hỗ trợ
Tab/phím mũi tên, không chạy animation; container tự đổi kích thước. Recharts
chỉ nằm trong module báo cáo lazy-load sau guard; CUSTOMER không tải bundle này.
Tham khảo [BarChart](https://recharts.github.io/en-US/api/BarChart/) khi mở rộng.

Số tiền/số lượng/% dùng định dạng Việt Nam; dữ liệu không có giá trị hiện “—”,
kết quả doanh thu rỗng thực sự hiện 0. Lấp đầy dùng tỷ lệ chung backend trả về,
không lấy trung bình các dòng. Sức chứa 0 hiện “—” cùng giải thích thay vì giả
lập tỷ lệ; suất thiếu cấu hình có cảnh báo dữ liệu chưa đầy đủ. Bảng hiển thị
nguồn sức chứa và suất đã ngừng mở bán, kèm phần Cách tính sức chứa.

Loading/rỗng/lỗi/thử lại độc lập giữa hai báo cáo; lỗi query không toast lặp.
Làm mới lỗi vẫn giữ dữ liệu cũ của đúng bộ lọc và ghi rõ trạng thái. Chuyển bộ
lọc không gắn dữ liệu cũ sang bộ lọc mới; signal/hủy request ngăn phản hồi chậm
ghi đè kết quả hiện tại. Lỗi danh mục có thử lại riêng, không ngăn tải báo cáo.
Dashboard chỉ GET; không mở sơ đồ ghế, sinh ghế hay gửi mutation.

Sau `npm.cmd run build`, chạy `npm.cmd run test:admin-reports-browser` trên
Windows/Edge, đặt `ADMIN_EDGE_PATH` nếu cần. Script kiểm tra màn hình production,
KPI/biểu đồ/bảng, F5/Back/hash, nhóm trùng tên, ngày riêng/ngày đảo ngược, danh
mục nhiều trang/lỗi, loading/rỗng/lỗi/thử lại, dữ liệu cũ, nguồn sức chứa, phân
trang, bàn phím, desktop/390px và phân quyền. API/số liệu đều mô phỏng; ảnh/JSON
nằm trong temp được script in ra. Chưa thay thế thử HTTP trên backend/DB ứng
dụng; dùng backend phần 6 đã khởi động lại để có đủ nguồn sức chứa/ID nhóm.

## Galaxy mẫu — phần 8

Mở `/admin/sync` bằng tài khoản ADMIN đã xác minh. Nút Nhập Galaxy mẫu gọi
`POST /admin/sync/galaxy/local-file?limitShowtimes=100`, body null, qua service
chung gắn Bearer. Dữ liệu lấy từ `data/galaxy_sessions.json` đóng gói sẵn trong
backend; không upload file hoặc nhập clientId. Mặc định xét 100 suất tương lai;
0 là tất cả, giới hạn phải là số nguyên 0–2.147.483.647. Giới hạn không chặn số
phim trong file được xử lý. Ngày mẫu giữ nguyên; file cũ có thể xử lý phim nhưng
không có suất tương lai, không tự dời lịch sang hôm nay.

Khi đang gửi, khóa giới hạn/nút nhập, chốt bằng ref và hook để hai submit cùng
lúc chỉ gửi một POST. Trạng thái pending được đọc từ mutation cache chung nên
chuyển trang Admin rồi quay lại trong cùng tab vẫn khóa gửi lặp. F5 không tự
POST lại; việc tải lại trang không chứng minh tác vụ backend đã hủy.

Kết quả nhận trong lần mở trang hiện nguồn LOCAL_FILE, thời gian backend hoàn
tất theo Việt Nam, giới hạn đã gửi và chín bộ đếm của GalaxySyncResponse: phim,
rạp, phòng, suất cập nhật/bỏ qua/ngừng mở bán, phim ngừng chiếu, ghế vật lý và
ghế theo suất. Đây là số bản ghi xử lý, gồm cả thêm/cập nhật; không gọi là toàn
bộ bản ghi mới. Bỏ qua suất có cảnh báo đối chiếu lịch/vé; số 0 ghế là bình thường
vì đồng bộ catalog không tạo ghế. Giá trị thiếu hiện “—”, nguồn khác LOCAL_FILE
có cảnh báo. Kết quả trước vẫn hiển thị nếu lần sau đang chạy hoặc lỗi; rời
trang/F5 không lưu lịch sử offline vì backend chưa có API lịch sử này.

400 hiện theo trường nếu có, 409 giữ giới hạn và chỉ GET trạng thái để chờ tác
vụ khác; 500 giữ bản nháp/kết quả trước. Hook xử lý một toast, component không
toast thêm. Timeout/mất phản hồi giữ thông tin lần gửi, không tự POST hoặc xếp
hàng gửi lại khi mạng trở lại. Timeout trình duyệt mặc định 60 giây không xác
nhận backend đã dừng. Nút Đọc catalog để đối chiếu chỉ GET số phim hiện tại,
rạp, suất mở bán và trạng thái, đồng thời làm mới các cache liên quan; đây
không phải xác nhận chắc chắn lần nhập đã hoàn tất. Người dùng đối chiếu dữ
liệu rồi chủ động quyết định gửi lại.

Bảng online riêng đọc `GET /admin/sync/galaxy/status`: lịch enabled/chu kỳ,
running dùng chung tác vụ, lastAttemptAt, lastSuccessAt và lastError. Mốc thành
công chỉ dành cho online đầy đủ, không lấy syncedAt offline gán vào đó. Lỗi
online cũ vẫn có thể hiện sau một lần nhập mẫu thành công. Trạng thái thuộc
instance backend và mất khi khởi động lại; mốc trống không phải bằng chứng chưa
từng đồng bộ. Có đọc lại thủ công và polling 2 giây khi tab đang theo dõi tác
vụ chạy; lỗi trạng thái giữ dữ liệu đọc trước, có retry riêng. Tắt lịch online
không chặn nhập offline; backend vẫn kiểm tra xung đột khi POST.

Sau thành công, invalidation phần 3 làm mới movies/cinemas/showtimes và mọi
cache Admin, gồm báo cáo và trạng thái. Liên kết phim/suất/báo cáo phục vụ đối
chiếu. Trạng thái ghế/booking không bị frontend chỉnh sửa. Lịch online có thể
cập nhật lại thông tin Galaxy sau lần nhập mẫu; xem
[GALAXY_SYNC.md](../../../../backend/cinema-booking-backend/GALAXY_SYNC.md).

Sau build, chạy `npm.cmd run test:admin-sync-browser` trên Windows/Edge, đặt
`ADMIN_EDGE_PATH` nếu cần. Script dùng màn hình production với REST/catalog/
trạng thái mô phỏng, kiểm tra giới hạn/DTO/null/Bearer, chống lặp, running/409,
400/500/timeout, đối chiếu chỉ GET, F5/chuyển trang khi pending, nguồn/bộ đếm,
giờ Việt Nam, cache đang có của khách/Admin, desktop/390px/bàn phím và 403/
CUSTOMER. Không gọi Galaxy online hoặc ghi DB ứng dụng. JSON/ảnh nằm ở thư mục
temp script in ra; kết quả HTTP/DB thật nằm riêng ở phần 9 và tài liệu bàn giao.

## Service và query

`services/adminService.js` dùng Axios chung để gắn Bearer và unwrap `ApiResponse`.
Các hàm nhận Axios options ở đối số cuối (`signal`, `timeout`), luôn tắt toast lỗi
ở interceptor để caller xử lý một lần:

| Hàm | API / kết quả |
| --- | --- |
| `getMovies(params, options)` | Dùng lại movieService, trả `PageResponse` với `content`, `pageNo` bắt đầu từ 0 |
| `getMovieOptions(params, options)` | Dùng lại movieService, gom mọi trang cho bộ chọn phim |
| `getCinemas(params, options)` | Dùng lại cinemaService; phòng nằm trong `auditoriums` |
| `getShowtimes(params, options)` | Dùng lại showtimeService; chỉ các suất còn mở bán |
| `createMovie(payload, options)` | POST `/admin/movies`, chỉ các trường `MovieCreateRequest` |
| `updateMovie(id, payload, options)` | PUT `/admin/movies/{id}`, cùng DTO thêm phim |
| `createShowtime(payload, options)` | POST `/admin/showtimes`: `movieId`, `auditoriumId`, `startTime`, `endTime`, `basePrice` |
| `getRevenue(params, options)` | GET `/admin/reports/revenue`: startDate/endDate/cinemaId/movieId/groupBy |
| `getOccupancy(params, options)` | GET `/admin/reports/occupancy`: date/cinemaId/movieId |
| `getSyncStatus(options)` | GET `/admin/sync/galaxy/status`, trạng thái sync online |
| `syncLocalFile({ limitShowtimes }, options)` | POST `/admin/sync/galaxy/local-file?limitShowtimes=100`, không upload file; mặc định timeout 60 giây |

`hooks/useAdminQueries.js` cung cấp `useAdminMovies`, `useAdminMovieOptions`,
`useAdminCinemas`, `useAdminShowtimes`, `useAdminRevenue`, `useAdminOccupancy`,
`useAdminSyncStatus`. Tất cả chỉ enabled khi `/users/me` đã xác minh ADMIN;
signal truyền tới Axios, kể cả từng trang khi gom danh sách phim. Lỗi 4xx và
hủy request không retry; lỗi mạng/5xx chỉ retry một lần. Trang phim giữ dữ liệu
trước trong lúc chuyển trang, nên dùng `isFetching` để khóa phân trang.

Keys nằm trong `adminKeys.js`, đều bắt đầu bằng `['admin']`. Không đặt dữ liệu
Admin vào cache công khai: đổi phiên/phân quyền sẽ hủy và xóa các keys Admin.

## Ghi dữ liệu và lỗi biểu mẫu

`hooks/useAdminMutations.js` cung cấp `useCreateMovie`, `useUpdateMovie`,
`useCreateShowtime`, `useSyncLocalFile`. Hook kiểm tra lại phiên trước khi gửi,
không retry và không xếp hàng chờ mạng trở lại. Hai lần gọi `mutateAsync` trong
cùng một lần gửi dùng chung promise. `mutate` cũng có cùng chốt chống gửi lặp.

- `mutateAsync(payload)` trả dữ liệu và reject khi lỗi; caller bắt lỗi để giữ form.
- `useUpdateMovie` nhận `{ id, ...MovieCreateRequest }`; các hook còn lại nhận DTO tương ứng.
- `isPending` khóa form/nút đóng modal trong cả thời gian gửi và làm mới cache.
- `fieldErrors` ánh xạ lỗi 400 theo đúng tên trường; `formError` là thông báo chung.
- `clearFieldError(name)` xóa lỗi khi sửa trường; `reset()` xóa trạng thái/lỗi khi mở form mới.
- Validation theo trường chỉ hiện inline. Các lỗi khác có một toast; caller không toast thêm.
- `outcomeUncertain` là mất phản hồi/timeout: giữ bản nháp và kiểm tra lại danh sách
  trước khi gửi lại. Lỗi mạng không chứng minh backend chưa ghi dữ liệu.
- Thành công chỉ toast một lần và làm mới cache Admin/catalog liên quan.
  Sửa phim làm mới phim, bộ chọn, lịch và báo cáo; thêm suất làm mới lịch/báo cáo;
  nhập mẫu làm mới cả catalog/rạp/báo cáo. Không ghi đè trạng thái sync online bằng
  kết quả nhập offline. Phản hồi khác phiên không phát toast/làm mới cache của phiên mới.

## UI dùng chung

- `components/AdminTable.jsx`: `columns: [{ key, label, render?, className? }]`,
  `rows`, `rowKey` (tên thuộc tính hoặc hàm), `caption`, `loading`, `fetching`,
  `error`, `onRetry`, `emptyTitle/emptyDescription/emptyAction`, `pagination`,
  `onPageChange`. `pagination` nhận trực tiếp `PageResponse`; chỉ vùng bảng cuộn
  ngang trên điện thoại. Lỗi làm mới giữ hàng cũ và thêm thông báo thử lại.
- `AdminModal`: `open`, `title`, `description`, `onClose`, `busy`, `children`,
  `footer`. Dùng dialog native để khóa focus/nền, đóng bằng Escape/nút X/backdrop,
  trả focus và khôi phục scroll khi đóng; `busy` ngăn đóng khi đang gửi.
- `AdminField`: bọc một input/select/textarea với `label`, `error`, `hint`,
  `required`; tự nối label và aria-describedby/aria-invalid. Ví dụ:

  ```jsx
  <AdminField label="Tên phim" required error={save.fieldErrors.title}>
    <input name="title" value={form.title} onChange={handleChange} />
  </AdminField>
  ```

- `AdminLoading`, `AdminEmpty`, `AdminError` trong `AdminStates.jsx` dùng độc lập
  cho các màn hình chưa có bảng. Lỗi query chỉ hiện ở UI, không cần toast thêm.

Hướng giao diện giữ bảng màu tối/đỏ và Be Vietnam Pro/Plus Jakarta Sans hiện có,
nhịp cách 4px, hàng bảng rõ ràng và focus nhìn thấy; chuyển động chỉ ở trạng thái
đang tải và tôn trọng reduced motion.

## Kiểm chứng

`npm.cmd run test:admin-browser` chạy phần 1, khung phần 2 và fixture phần 3 trong
Edge/Vite development với toàn bộ API giả lập. Fixture trong `scripts/fixtures/`
không phải entry production. Script ghi JSON và ảnh ở thư mục tạm được in khi xong.
`npm.cmd test` kiểm tra thêm ánh xạ lỗi, kết quả ghi không chắc chắn và chính sách
retry. Các kết quả này không thay cho tích hợp backend/DB thật ở phần 9.
