# Admin Portal — nền tảng và quản lý phim

`MovieManager` đã có danh sách/thêm/sửa phim ở phần 4. `ShowtimeManager`,
`ReportDashboard`, `DataSync` vẫn là khung; service, hooks và component dùng chung
sẵn sàng cho các phần 5–8.

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
thư mục tạm script in ra. Kiểm chứng API thật vẫn thuộc phần 9.

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
