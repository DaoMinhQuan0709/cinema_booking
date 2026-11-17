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

Trang lịch chiếu kết hợp danh sách rạp trong catalog và trong các suất: rạp hợp lệ chưa có suất trong ngày vẫn được giữ trong select/URL. Khi metadata chưa có hoặc lỗi, ID đã chọn không tự bị bỏ để hiển thị lịch rạp khác. Rạp sai tỉnh/thành hoặc không tồn tại được chuẩn hóa khi đủ dữ liệu thành công.

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
npm.cmd run test:cinemas-live
```

`test:cinemas-browser`: Edge headless với bản production, REST/ảnh mô phỏng; bao phủ thành công, lỗi, cache, response chậm/sai cấu trúc, ảnh lỗi, URL/Back/Forward, 390px/Tab/Enter và lịch chưa có suất. Bổ sung CTA tới chi tiết, mở trực tiếp/reload, giữ bộ lọc khi quay lại, ID sai/404/503, loading và một Footer. Gallery được kiểm tra vị trí ảnh hé hai bên, nút/chấm/bàn phím/vuốt, cuộn dọc, một/hai/nhiều ảnh, fallback và đổi route rạp. Bộ chọn rạp được kiểm tra với cache, đổi thành phố/rạp, giữ `date`/bỏ `movieId`, Back, thành phố hết rạp và lỗi/tải danh sách. Chọn ngày/phim được kiểm tra với URL/Back/Forward, ngày sai, rạp hết suất và API suất tải chậm/lỗi/sai cấu trúc. Lưới phim được kiểm tra chọn phim, nhãn tuổi, poster fallback và 2/3/6 cột. Panel được kiểm tra giờ/phòng/giá cơ bản, URL đặt vé và ID suất sai. Khối cuối trang được kiểm tra giá đúng ngày/rạp, vị trí và chỉ đường, thiếu mã nhúng; có ảnh chụp desktop/mobile. Kết quả này không xác nhận backend/DB hay Maps thật.

`test:cinemas-live`: Edge production với API localhost và ảnh CDN thật; chỉ cho GET/OPTIONS `/cinemas`, `/cinemas/:id`, `/showtimes` và `/movies`. Cần backend đang chạy và dữ liệu rạp đã có. Không khởi động lại backend, gọi sync, tạo ghế/booking hoặc sửa DB. Mặc định API `http://localhost:8080/api/v1`; có thể đặt `CINEMAS_TEST_API_BASE` sang địa chỉ loopback/cổng khác.

Hai lệnh dùng cổng preview/debug riêng (4206/9239 và 4207/9240), profile Edge tạm, tự đóng tài nguyên do script tạo và lưu `results.json`/ảnh trong đường dẫn temp được in ra. Có thể đặt `ADMIN_EDGE_PATH` nếu Edge không ở vị trí mặc định. Build lại trước khi kiểm tra thay đổi giao diện. Số rạp/ID trong kết quả live là snapshot, không hardcode lên ứng dụng.
