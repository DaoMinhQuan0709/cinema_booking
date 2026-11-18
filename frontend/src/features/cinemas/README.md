# Trang rạp chiếu phim

`/cinemas` và `/cinemas/:id` là các trang công khai dùng `MainLayout`, lazy-load từ `App.jsx`. Thiết kế danh sách được xác nhận ở [tài liệu thiết kế](../../../../docs/plans/2026-11-15-cinemas-design.md); tiến độ/kết quả ở [kế hoạch danh sách](../../../../cinemas-implementation.md) và [kế hoạch chi tiết](../../../../cinemas-detail-page-plan.md).

- `CinemasPage.jsx`: tìm tên không dấu, lọc tỉnh/thành, URL/Back, đếm kết quả và loading/rỗng/lỗi/làm mới.
- `CinemaCard.jsx`: ảnh đại diện có fallback, tên/địa chỉ/tỉnh/thành, điện thoại và liên kết chi tiết qua `getCinemaDetailHref` bằng ID nội bộ.
- `CinemaDetailPage.jsx`: hiện thông tin cơ bản theo ID trên URL, loading/lỗi/thử lại và trang không tìm thấy cho ID sai/404. Mở trực tiếp/reload không phụ thuộc danh sách; Back/Forward và liên kết về danh sách giữ bộ lọc qua router state khi đi từ thẻ rạp. Dùng Footer của `MainLayout` đúng một lần.
- `CinemaGallery.jsx`: carousel trước thông tin rạp, chỉ dùng `imageUrls` (trường `image_urls`), giữ nguyên thứ tự nguồn, lọc URL và loại trùng. Desktop hé ảnh hai bên; có nút/chấm, mũi tên/Home/End, Tab/Enter và vuốt ngang, vẫn cho cuộn dọc/zoom. Không tự chạy. Chỉ còn một ảnh thì ẩn điều hướng; ảnh lỗi được bỏ qua, thiếu ảnh hoặc tất cả ảnh lỗi có thông báo. Đổi rạp/bộ ảnh đặt lại lựa chọn và trạng thái lỗi.
- `CinemaInfoHeader.jsx`: hiện tên/địa chỉ/hotline và bộ chọn thành phố/rạp trên trang chi tiết. Đổi thành phố chỉ lọc danh sách; chọn rạp mới đổi URL, giữ `date` và router state, xóa `movieId`. Chi tiết rạp được ưu tiên khi catalog trong cache cũ hơn. Khi danh sách đang tải hoặc lỗi vẫn giữ rạp hiện tại; có nút thử lại khi lỗi. Thành phố không còn rạp sẽ hiện trạng thái rỗng và khóa ô chọn rạp.
- `CinemaDetailSelection.jsx` và `cinemaDetailUtils.js`: dải 7 ngày theo giờ Việt Nam, chọn phim có suất còn mở bán và lưu `date`/`movieId` trên URL. URL sai được chuẩn hóa bằng replace, không tự thêm ngày khi thiếu; Back/Forward khôi phục lựa chọn. Đổi ngày giữ phim trong lúc tải và chỉ bỏ khi suất tải thành công xác nhận phim không còn; lỗi hoặc payload sai giữ lựa chọn và có thử lại. Không tự chọn phim đầu tiên, rạp hết suất vẫn giữ ID route.
- `CinemaMovieGrid.jsx` và `movieGridUtils.js`: lưới phim có suất trong ngày theo 2/3/6 cột, bấm chọn phim cập nhật `movieId` trên URL mà không mở trang phim. Poster/nhãn tuổi lấy thêm từ cache API phim đang chiếu và sắp chiếu; thiếu metadata thì dùng poster từ suất và ẩn nhãn, poster API lỗi cũng có fallback. Phim được chọn có viền và trạng thái rõ, không hiển thị điểm đánh giá không có dữ liệu.
- `CinemaShowtimePanel.jsx`: giờ/phòng/giá cơ bản của phim đã chọn (`/booking/:showtimeId` bằng ID nội bộ), bỏ suất đã bắt đầu theo giờ Việt Nam tính lại mỗi phút. Suất có ID sai không được tính vào lưới hoặc panel. `useCinemaShowtimes` tự làm mới mỗi phút và khi quay lại tab; lỗi làm mới vẫn hiện dữ liệu cũ cùng cảnh báo, tải/rỗng/lỗi của lịch tách khỏi thông tin rạp.
- `CinemaPricingInfo.jsx`: giá cơ bản theo từng phim từ các suất còn mở bán của đúng rạp/ngày; chỉ hiện giá dương hợp lệ, bỏ suất có ID sai. Khi thiếu giá hoặc lịch chiếu đang tải/lỗi có thông báo; giá cuối được tính khi chọn ghế và xác nhận đơn, không hiển thị chính sách giá chưa có dữ liệu.
- `CinemaLocation.jsx`: địa chỉ, hotline và chỉ đường của rạp đang xem. Bản đồ Google Maps lấy iframe sao chép thủ công từ `cinemaGoogleMapEmbeds.js`, tra theo ID trên `/cinemas/:id`; chỉ dùng `src` HTTPS của đường dẫn `/maps/embed?pb=...` thuộc `www.google.com`. Iframe dùng `loading="lazy"`. Khi chưa có mã, hiện thông báo và vẫn cho chỉ đường bằng tọa độ hoặc địa chỉ. Không gọi Maps Embed API và không dùng OpenStreetMap.
- `useCinemaDetail` cache thông tin rạp theo ID với stale time 30 phút; `useCinemaShowtimes` lấy dữ liệu theo rạp/ngày với stale time 1 phút. Cả hai truyền AbortSignal xuống Axios, không trộn snapshot khi đổi khóa và không yêu cầu `movieId`.
- `cinemaUtils.js`: xử lý Unicode, sắp `displayOrder` rồi tên, giữ nhóm “Chưa xác định”, kiểm tra URL ảnh và số điện thoại.
- Dùng `cinemaService`/`useCinemas` hiện có; cache 30 phút dùng chung. Làm mới chủ động lấy lại API; lỗi làm mới giữ snapshot cũ có cảnh báo.
- Lọc trong danh sách đã tải, không gọi API mỗi ký tự. URL dùng `q`/`city`; nhập từ khóa replace lịch sử, đổi tỉnh/thành tạo điểm Back; giữ tham số không liên quan.
- Trang không gọi Galaxy, API sơ đồ ghế hoặc API ghi. Ảnh HTTP(S) lấy trực tiếp từ CDN nguồn và giữ tỷ lệ; thẻ/ảnh bên cạnh lazy-load, ảnh chính của gallery tải ngay. Thiếu metadata có thông báo dự phòng.

Header desktop/mobile và footer có mục “Vé của tôi” tới `/profile/bookings`. Trang vé hiện vẫn là placeholder; danh sách/chi tiết vé chưa được triển khai. Dropdown tài khoản desktop giữ lối tắt vé; menu mobile chỉ có một mục vé trong điều hướng chính và đóng sau khi chọn. “Rạp chiếu phim” active ở cả danh sách và chi tiết.

Màn hình lịch chung đã được gỡ. URL cũ `/showtimes?cinemaId=<id>` được `LegacyShowtimesRedirect` chuyển bằng `replace` tới `/cinemas/<id>`, chỉ giữ `date` hợp lệ theo lịch và `movieId` bigint nội bộ hợp lệ. Trang đích tiếp tục kiểm tra dải 7 ngày/phim còn suất. Thiếu/sai định dạng `cinemaId` chuyển về `/cinemas`, giữ `city` (trim, tối đa 200 ký tự) nếu có; ID đúng định dạng nhưng không tồn tại hiển thị trạng thái không tìm thấy của trang rạp. Tham số trùng dùng giá trị đầu tiên. API `/api/v1/showtimes`, lịch trong trang phim và `/admin/showtimes` tiếp tục hoạt động; `scheduleUtils.js` và test của nó vẫn được giữ.

## Thêm bản đồ Google Maps thủ công

1. Mở đúng rạp trên Google Maps ở máy tính → **Chia sẻ** → **Nhúng bản đồ** → **Sao chép HTML**. Xác nhận marker/địa chỉ trùng với rạp trong hệ thống.
2. Lấy ID rạp từ URL trang chi tiết, ví dụ `/cinemas/2` có ID `2`.
3. Mở `cinemaGoogleMapEmbeds.js` và thêm một mục theo ID. Dán nguyên mã thật vào chuỗi template; có thể dán riêng URL `src` thay cho toàn bộ iframe.
4. Build lại frontend. Component chỉ dùng `src` đã kiểm tra; không thực thi HTML đã dán. Rạp chưa có mục trong file sẽ hiện thông báo thay bản đồ, nút Chỉ đường vẫn hoạt động khi có tọa độ/địa chỉ.

Mã nhúng thủ công này khác URL Maps Embed API `/maps/embed/v1/...` có `key`; không dùng API key trong `.env`. ID trong file cần cập nhật nếu dữ liệu được tạo lại với ID mới.

```js
export const cinemaGoogleMapEmbeds = {
  '2': `<iframe src="https://www.google.com/maps/embed?pb=..." width="600" height="450"></iframe>`,
};
```

## Kiểm thử lặp lại

Chạy tại thư mục `frontend`:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:cinemas-browser
npm.cmd run test:cinemas-browser -- --check-map
npm.cmd run test:cinemas-map-audit
npm.cmd run test:cinemas-live
```

`test:cinemas-browser`: Edge headless với bản production và REST/ảnh mô phỏng, gồm các nhóm sau:

- Danh sách/chi tiết: bộ lọc, cache, mở trực tiếp/reload, Back/Forward, ID sai/404/503, lỗi và phản hồi chậm của từng API danh sách/chi tiết. Đổi rạp khi GET chi tiết hoặc GET suất cũ còn chờ không lẫn thông tin, phim, giá hoặc vị trí.
- Điều hướng mới: khách/đã đăng nhập ở 390/768/1440px, header/footer và dropdown desktop tới trang vé tạm; mobile không lặp mục vé, chọn xong đóng menu; active rạp/ vé, Back/Forward và reload. Nhánh URL cũ được kiểm tra riêng: chuyển hướng replace giữ ngày/phim, thiếu/sai ID về danh sách giữ city, ngày/phim sai bị bỏ, ID không tồn tại tới trang 404 rạp. Kiểm tra thêm lịch trong trang phim; trang quản trị suất và invalidation lịch tại rạp được kiểm tra bởi `test:admin-showtimes-browser` và `test:admin-sync-browser`.
- Gallery và bộ chọn rạp: ảnh thiếu/lỗi, một/hai/nhiều ảnh, bàn phím/vuốt, cache danh sách, thành phố rỗng/lỗi/tải, đổi rạp giữ ngày và bỏ phim cũ.
- Ngày/phim/suất: URL ngày/phim sai, rạp/ngày hết suất, lỗi/tải/sai payload của API suất, lỗi API phim vẫn dùng poster từ suất. Fixture hai phim kiểm tra thứ tự theo giờ, phim sắp chiếu, giá/phòng, Tab/Enter chọn ngày/phim và liên kết `/booking/:showtimeId` bằng ID nội bộ. Một kịch bản đi từ danh sách → chi tiết → ngày → phim → suất đến sơ đồ ghế ở 390px; hai GET chi tiết suất/ghế được mô phỏng, không tạo booking.
- Giao diện 390/768/1440px không tràn ngang, một Footer; khối giá/vị trí và trạng thái chưa có mã iframe Google Maps có ảnh chụp desktop/mobile. URL iframe trong `cinemaGoogleMapEmbeds.js` được unit test kiểm tra định dạng. Mặc định Edge mô phỏng không tải Google Maps thật; thêm `--check-map` để tải iframe thật của rạp ID 9, ghi HTTP status và chụp ảnh. Chế độ này vẫn mô phỏng API rạp, nên không xác nhận ID trong DB.

`test:cinemas-map-audit`: GET danh sách rạp từ API localhost, đối chiếu toàn bộ ID có mã nhúng với catalog, kiểm tra URL/tên địa điểm trong mã và liệt kê rạp chưa có mã. Khoảng cách tọa độ in ra là từ **tâm khung bản đồ** tới tọa độ API, không phải sai số của marker; cần xem ảnh bản đồ để xác nhận vị trí thực tế.

`test:cinemas-live`: Edge production với API localhost và ảnh CDN thật; chỉ cho GET/OPTIONS `/cinemas`, `/cinemas/:id`, `/showtimes` và `/movies`. Cần backend đang chạy và dữ liệu rạp đã có. Script kiểm tra iframe Google Maps của rạp mẫu từ API thật, chi tiết rạp ở 390/768/1440px và ngày/phim/suất theo dữ liệu thật, nhưng không mở trang ghế bằng API thật. Script chỉ đọc catalog/lịch/phim; không khởi động lại backend, gọi sync, tạo ghế/booking hoặc sửa DB. Mặc định API `http://localhost:8080/api/v1`; có thể đặt `CINEMAS_TEST_API_BASE` sang địa chỉ loopback/cổng khác.

Hai lệnh dùng cổng preview/debug riêng (4206/9239 và 4207/9240), profile Edge tạm, tự đóng tài nguyên do script tạo và lưu `results.json`/ảnh trong đường dẫn temp được in ra. Có thể đặt `ADMIN_EDGE_PATH` nếu Edge không ở vị trí mặc định. Build lại trước khi kiểm tra thay đổi giao diện. Số rạp/ID trong kết quả live là snapshot, không hardcode lên ứng dụng.
