# Trang “Rạp chiếu phim” và `/cinemas/:id`

Mục tiêu: giữ `/cinemas` làm danh sách tìm/lọc rạp, thêm trang chi tiết theo ba ảnh mẫu và luồng chọn suất ngay tại rạp.

**Bố cục:** carousel ảnh → tên/địa chỉ/hotline + chọn thành phố/rạp → ngày/phim/giờ chiếu → hai cột giá vé và thông tin/bản đồ → Footer. Theo xác nhận của người dùng, phần kết thúc là Footer; dùng Footer của `MainLayout` đúng một lần. Dùng màu nền tối/đỏ hiện có, responsive 6/3/2 cột phim và một cột thông tin trên mobile.

**Dữ liệu:** dùng API Spring Boot hiện có. Điểm đánh giá, bài giới thiệu dài và ảnh bảng giá chưa có trường nguồn: không tự tạo nội dung. Khối giá lấy `basePrice` theo ngày, ghi rõ giá cơ bản; giá cuối theo ghế/đơn. Bản đồ động dự kiến dùng Maps Embed API, cần key cấu hình và giới hạn tên miền; thiếu cấu hình phải ghi nhận phần nhúng chưa hoàn tất.

**Thứ tự:** dữ liệu → route → chọn rạp/ngày/phim → chọn suất → thông tin cuối trang → kiểm chứng. Có thể chuẩn bị carousel và khối thông tin độc lập sau khi chốt dữ liệu; hoàn thành trang đích trước [kế hoạch header](header-my-tickets-navigation-plan.md).

## Công việc

- [x] 1. Thêm `features/cinemas/hooks/useCinemaDetail.js`, `useCinemaShowtimes.js`; mở rộng options của `services/cinemaService.js` → GET `/cinemas/:id` và `/showtimes?cinemaId=&date=` có cache theo ID/ngày, hủy request cũ, không bắt buộc `movieId`, không gọi Galaxy hoặc API tạo ghế.
- [x] 2. Tạo `CinemaDetailPage.jsx`, lazy route `cinemas/:id` trong `App.jsx`; đổi CTA của `CinemaCard.jsx` qua helper `getCinemaDetailHref` → mở trực tiếp/reload được, danh sách vẫn giữ tìm/lọc/Back; ID sai hoặc 404 có lối về danh sách.
- [x] 3. Tạo `CinemaGallery.jsx` dùng `imageUrls`/ảnh đại diện → desktop hé ảnh hai bên, có nút/chấm, bàn phím/vuốt; một ảnh ẩn điều hướng, ảnh lỗi có fallback.
- [ ] 4. Tạo `CinemaInfoHeader.jsx` với bộ chọn “Tìm rạp theo thành phố” → đổi thành phố lọc ô chọn rạp, chờ người dùng chọn; chọn rạp mới đổi route và đồng bộ ảnh/thông tin/lịch/map. Thành phố không có rạp hiện trạng thái rỗng; không tự nhảy sang rạp khác.
- [ ] 5. Thêm xử lý `?date=&movieId=` trong `cinemaDetailUtils.js`: mặc định hôm nay theo giờ Việt Nam, dải 7 ngày, nhóm phim từ suất tương ứng → đổi rạp/ngày xóa chọn phim không còn phù hợp; rạp hết suất vẫn giữ đúng ID; Back/Forward khôi phục lựa chọn.
- [ ] 6. Tạo `CinemaMovieGrid.jsx`: poster/tên và nhãn tuổi lấy bổ sung từ API phim có cache; dùng thao tác chọn phim riêng → không chuyển sang `/movies/:id` khi chọn, không bịa điểm đánh giá, phim đã chọn có trạng thái rõ ràng.
- [ ] 7. Tạo `CinemaShowtimePanel.jsx` dưới lưới, hiện giờ/phòng/giá của phim đã chọn → bấm tới `/booking/:showtimeId` bằng ID nội bộ; loại suất đã bắt đầu, làm mới lịch định kỳ, xử lý tải/rỗng/lỗi độc lập với thông tin rạp.
- [ ] 8. Tạo `CinemaPricingInfo.jsx` và `CinemaLocation.jsx` theo khối cuối ảnh 3 → giá bám dữ liệu suất; địa chỉ/hotline/map thuộc đúng rạp, iframe tải khi gần khung nhìn, có nút chỉ đường. Thiếu giá/địa chỉ/ảnh có thông báo; không sao chép chính sách giá chưa được backend áp dụng.
- [ ] 9. Cập nhật `features/cinemas/README.md`, unit test logic URL/ngày/nhóm suất và `scripts/cinemas-browser-check.mjs` → bổ sung fixture chi tiết rạp/phim, đổi rạp nhanh, lỗi từng API, ảnh thiếu, một Footer, Tab/Enter và màn hình 390/768/1440px; chế độ live chỉ đọc catalog, không gọi tạo ghế/booking/sync.

## Kiểm chứng cuối

- [ ] 10. Tại `frontend`, chạy `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:cinemas-browser`; khi backend sẵn sàng chạy script live đã cập nhật và kiểm tra Maps thật. Đạt khi danh sách → chi tiết → ngày → phim → suất dẫn đúng trang ghế (mô phỏng API ghế), không lẫn dữ liệu giữa các rạp, không tràn ngang và Footer chỉ xuất hiện một lần. Ghi riêng kết quả mô phỏng, API thật và phần còn thiếu dữ liệu/cấu hình.

## Tiến độ thực hiện

**Phần 1 — hoàn tất ngày 16/11/2026.**

- `useCinemaDetail(id)` dùng `cinemaKeys.detail(id)`, giữ dữ liệu mới trong 30 phút; `getCinemaById(id, options)` nhận `signal` và `skipErrorToast`, vẫn hỗ trợ cách gọi chỉ truyền ID.
- `useCinemaShowtimes({ cinemaId, date })` dùng `showtimeKeys.list({ cinemaId, date })`, giữ dữ liệu mới trong 1 phút. ID dạng số/chuỗi dùng chung cache; không truyền `movieId`, không gọi Galaxy hoặc API ghế. Chưa có ID hợp lệ/ngày thì không tự tải; chuẩn hóa ngày/URL thuộc phần 5.
- Hai hook truyền AbortSignal xuống Axios để hủy request khi đổi khóa hoặc unmount; không dùng dữ liệu của rạp/ngày trước làm placeholder. Trạng thái tải/lỗi và làm mới độc lập; không retry lỗi 4xx, retry một lần với lỗi mạng/5xx.
- Thêm 9 test trong `frontend/src/features/cinemas/hooks/cinemaQueries.test.js`: cache, ngày rỗng, đổi rạp/ngày khi request đang chạy, phản hồi muộn, unmount, ID sai, 404 và lỗi làm mới. Dùng hook/service/React Query/Axios thật với HTTP adapter mô phỏng; không truy cập backend.
- Kiểm tra tại `frontend`: `npm.cmd run lint` đạt; `npm.cmd test` đạt **113/113**; `npm.cmd run build` đạt. Chưa thực hiện kiểm tra trình duyệt chi tiết rạp hoặc API thật; các phần 2–10 vẫn chưa hoàn tất.

**Phần 2 — hoàn tất ngày 16/11/2026.**

- Thêm `CinemaDetailPage.jsx` và lazy route `/cinemas/:id` trong `MainLayout`. Trang lấy thông tin theo ID trên URL, hiển thị tên/thành phố/địa chỉ/hotline từ API; có loading, lỗi/thử lại, fallback khi thiếu thông tin và lối về danh sách. ID sai không gọi API; 404 có thông báo không tìm thấy, không retry.
- CTA của `CinemaCard` đổi thành “Xem chi tiết rạp”, dùng `getCinemaDetailHref`. Router state giữ query tìm/lọc của danh sách cho breadcrumb và liên kết “Về danh sách rạp”; Back/Forward và reload giữ lựa chọn. Mở trực tiếp không cần state hoặc dữ liệu danh sách đã tải.
- Giữ font, màu tối/đỏ và dấu nhấn bên trái của trang danh sách; Footer do `MainLayout` cung cấp đúng một lần. Gallery, bộ chọn rạp, ngày/phim/suất, giá và bản đồ chưa triển khai trong phần này.
- Cập nhật test helper URL, README và các nhánh kiểm thử bị ảnh hưởng bởi CTA mới. Script trình duyệt bổ sung GET `/cinemas/:id` trong phạm vi chỉ đọc; kiểm tra mở trực tiếp/reload, cache/Back/Forward, giữ bộ lọc, ID sai/404/503, payload null, loading, Tab/Enter và 390/768/1440px. Phạm vi kiểm thử đầy đủ ở phần 9 vẫn chưa hoàn tất.
- Kiểm tra tại `frontend`: `npm.cmd run lint` đạt; `npm.cmd test` đạt **114/114**; `npm.cmd run build` đạt; `npm.cmd run test:cinemas-browser` đạt **22 nhóm kiểm tra**, không lỗi JavaScript, không tràn ngang. Edge dùng REST/ảnh mô phỏng, chưa xác nhận API thật; kết quả và ảnh lưu tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-ABno7U`.

**Phần 3 — hoàn tất ngày 17/11/2026.**

- Thêm `CinemaGallery.jsx` trước thông tin rạp, giữ giao diện tối/đỏ hiện có: ảnh chính ở giữa, desktop hé ảnh hai bên; mobile hiển thị ảnh chính trong khung 16:9. Không thêm thư viện carousel, không tự chuyển ảnh.
- `getCinemaGallerySources` ưu tiên thứ tự `imageUrls`, bổ sung ảnh ngang/dọc, lọc URL HTTP(S) và loại trùng. Ảnh lỗi được bỏ qua; một ảnh ẩn nút/chấm và bỏ điểm Tab của khung ảnh; không có ảnh hoặc tất cả ảnh lỗi đều có thông báo. Đổi rạp/bộ ảnh đặt lại lựa chọn và trạng thái lỗi.
- Hỗ trợ nút trước/sau, chấm chọn ảnh, mũi tên/Home/End, Tab/Enter và vuốt ngang; vẫn cuộn dọc và zoom trên thiết bị cảm ứng. Có nhãn đọc màn hình, thông báo số ảnh, focus rõ và vùng bấm tối thiểu 44px. Chuyển ảnh không gọi thêm API.
- Bổ sung test nguồn ảnh, README và 7 nhóm kiểm tra gallery trong script Edge: ảnh hé hai bên, nút/chấm/bàn phím, vuốt ngang/cuộn dọc, giảm chuyển động, một/hai/nhiều ảnh, ảnh lỗi/thiếu và đổi rạp/Back. Sửa helper gửi Enter để Edge thực hiện kích hoạt nút bằng bàn phím đúng như thao tác thật.
- Kiểm tra tại `frontend`: `npm.cmd run lint` đạt; `npm.cmd test` đạt **115/115**; `npm.cmd run build` đạt; `npm.cmd run test:cinemas-browser` đạt **29 nhóm kiểm tra**, không lỗi JavaScript, không tràn ngang ở 390/768/1440px. Đã xem ảnh chụp gallery desktop/mobile. Edge dùng REST/ảnh mô phỏng, chưa xác nhận API/CDN thật; kết quả và ảnh lưu tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-BXGoDB`. Các phần 4–10 chưa hoàn tất.
