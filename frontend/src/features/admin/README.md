# Nền tảng Admin Portal — phần 3

Các màn hình `MovieManager`, `ShowtimeManager`, `ReportDashboard`, `DataSync` vẫn là
khung của phần 2. Service, hooks và component bên dưới sẵn sàng cho phần 4–8.

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
