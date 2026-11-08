# Thiết kế trang Lịch chiếu

Ngày: 08/11/2026 (Asia/Ho_Chi_Minh).

Trạng thái: Người dùng đã xác nhận phạm vi, giả định, phương án 1, bố cục và
luồng dữ liệu. Đã triển khai và kiểm chứng ngày 09/11/2026.

## Phạm vi đã xác nhận

- Xây dựng trang công khai `/showtimes`, thay placeholder hiện có.
- Khách xem tất cả phim có suất mở bán trong một ngày, sau đó lọc thành phố,
  rạp và phim. Không bắt buộc chọn phim trước.
- Mặc định hôm nay, cho chọn hôm nay và 6 ngày tiếp theo theo giờ Việt Nam.
- Gom kết quả theo phim → rạp → các suất tăng dần theo giờ. Hai suất cùng giờ
  nhưng khác phòng vẫn là hai lựa chọn riêng.
- Poster/tên phim dẫn đến `/movies/:id`; giờ chiếu dẫn đến
  `/booking/:showtimeId`, dùng ID nội bộ dạng số.
- Giữ nền tối, điểm nhấn đỏ và giao diện desktop/mobile hiện tại.
- Phạm vi là đọc catalog và chọn suất. Trang này không gọi API sơ đồ ghế,
  không tạo kho ghế, giữ chỗ, đơn hàng hay thanh toán.

## Giả định và yêu cầu phi chức năng

- Phục vụ quy mô đồ án hiện tại, khoảng vài nghìn suất trong toàn hệ thống;
  chỉ tải suất của ngày đang xem, không nâng yêu cầu chịu tải backend.
- Bộ lọc không tải lại trang, thao tác trên dữ liệu ngày đã tải và tận dụng
  cache TanStack Query. Không cam kết thời gian phản hồi khi mạng/API lỗi.
- Không yêu cầu đăng nhập để xem lịch; không thu thập thông tin cá nhân.
  Frontend chỉ gọi API nội bộ, không gọi Galaxy trực tiếp.
- Catalog vẫn do bộ đồng bộ Galaxy hiện có cập nhật theo chu kỳ khoảng 5 phút;
  frontend không thể làm nguồn cập nhật nhanh hơn bộ đồng bộ này.
- Dữ liệu lịch cache một phút, làm mới mỗi phút khi trang đang mở. Đồng hồ
  frontend loại suất đã bắt đầu và cập nhật cửa sổ ngày khi sang ngày mới.
- Có skeleton, không có suất, lỗi/thử lại và khả năng tiếp tục xem lịch khi
  API thông tin rạp lỗi. Khi làm mới lỗi, giữ dữ liệu cũ và thông báo rõ.
- Tiếp tục dùng React Router, service, query keys, theme và cấu trúc feature
  hiện có. Không thêm thư viện cho trang này.

## Nhật ký quyết định

| Quyết định | Phương án đã cân nhắc | Lý do lựa chọn |
| --- | --- | --- |
| Xem tất cả phim của ngày trước khi lọc | Bắt buộc chọn phim trước | Người dùng muốn khám phá lịch toàn bộ phim. |
| Gom theo phim, bên trong chia theo rạp | Gom theo rạp rồi đến phim | Dễ so sánh lịch của cùng phim giữa các rạp; người dùng chọn phương án 1. |
| Giữ nền tối/đỏ | Đổi phong cách riêng cho lịch | Nhất quán giao diện đã có. |
| 7 ngày, mặc định hôm nay | Khoảng ngày dài hơn | Đúng giả định người dùng đã xác nhận và bộ chọn hiện có. |
| Ba dropdown thành phố/rạp/phim | Yêu cầu chọn tuần tự trước khi xem | Có thể xem ngay và thu hẹp lựa chọn khi cần. |
| Gọi lịch theo ngày, lọc các trường còn lại ở frontend | Gọi API riêng từng phim/rạp | Một snapshot ngày đủ dữ liệu để nhóm và lọc; tránh request theo số phim. |
| Giữ lựa chọn hợp lệ, reset sau tải thành công | Reset ngay trong lúc tải ngày mới | Tránh mất bộ lọc do trạng thái đang chờ phản hồi. |
| Lưu ngày và bộ lọc trên URL | Chỉ lưu state tạm | Back từ chọn ghế và chia sẻ URL giữ được ngữ cảnh. |
| API rạp lỗi chỉ làm mất bộ lọc thành phố | Chặn toàn bộ trang | Lịch đã có tên/ID rạp nên khách vẫn chọn được suất. |
| Không gọi API ghế từ trang lịch | Tải trước ghế từng suất | Giữ ranh giới catalog/kho ghế độc lập, tránh tạo dữ liệu không cần thiết. |

## Bố cục được duyệt

Đầu trang có breadcrumb và tiêu đề “Lịch chiếu”. Thanh 7 ngày bên dưới đánh dấu
ngày đang chọn bằng màu đỏ; điện thoại cuộn ngang riêng thanh ngày.

Ba dropdown thành phố, rạp, phim nằm cùng hàng trên desktop và xếp dọc trên
điện thoại. Mỗi dropdown có lựa chọn “Tất cả”. Đổi thành phố đưa rạp về tất cả.
Danh sách lựa chọn phản ánh các suất còn phù hợp của ngày đang xem.

Mỗi khối phim có poster và tên phim liên kết đến trang chi tiết. Các hàng rạp
hiển thị tên rạp và những nút giờ/giá cơ bản, tooltip tên phòng. Trên điện thoại,
poster nhỏ cạnh tiêu đề; các hàng rạp/giờ ở bên dưới và tự xuống dòng.

Hướng mỹ thuật: bảng lịch điện ảnh tối, nhịp ngày đỏ và các hàng suất gọn,
tiếp tục font Plus Jakarta Sans/Be Vietnam Pro và token màu hiện tại. Không
thêm hiệu ứng trang trí hay font tải ngoài mới. DFII: impact 3, fit 5,
feasibility 4, performance 4, consistency risk 2 → 14.

## Thành phần và luồng dữ liệu

- `features/showtimes/ShowtimesPage.jsx`: URL state, bộ chọn ngày, dropdown,
  trạng thái tải/lỗi và các khối lịch theo phim.
- Các hàm thuần riêng xử lý ngày giờ Việt Nam, chuẩn hóa URL, bộ lọc và nhóm
  kết quả để kiểm chứng các quy tắc quan trọng bằng Node test hiện có.
- Hook lịch ngày dùng cùng query key `showtimes/list` và `showtimeService`;
  dữ liệu rạp dùng lại `useCinemas`. Hook lịch trong trang chi tiết phim giữ
  nguyên điều kiện phải có movieId và date.
- `App.jsx` lazy-load trang mới dưới MainLayout tại `path="showtimes"`.

1. Chuẩn hóa date vào khoảng 7 ngày hiện tại, ID vào dạng số nội bộ hợp lệ.
2. Gọi `GET /showtimes?date=YYYY-MM-DD` và đọc `GET /cinemas` từ cache chung.
   Không cần tải danh sách phim hoặc chi tiết từng phim.
3. Chỉ dùng suất chưa bắt đầu của ngày đang chọn, không lọc theo NOW_SHOWING:
   phim COMING_SOON có suất bán trước vẫn hợp lệ.
4. Dựng các lựa chọn thành phố/rạp/phim theo dữ liệu ngày và bộ lọc địa điểm.
   Reset lựa chọn không còn tồn tại chỉ sau phản hồi lịch thành công. Khi rạp
   chưa tải được, không xóa city trên URL; tạm bỏ điều kiện thành phố.
5. Lọc rồi nhóm theo movieId/cinemaId, sắp tên phim/rạp theo tiếng Việt và giờ
   tăng dần; ID suất phân biệt các giờ trùng nhau.
6. Mỗi phút cập nhật đồng hồ và làm mới lịch khi trang đang hoạt động. Khi quay
   lại tab, làm mới nếu dữ liệu đã cũ; không để response ngày trước hiển thị
   dưới ngày mới.
7. URL lưu `date`, `city`, `cinemaId`, `movieId`. Tham số không hợp lệ được
   chuẩn hóa bằng replace; lựa chọn chủ động tạo lịch sử để Back hoạt động.

## Lỗi, tình huống biên và rủi ro đã ghi nhận

- Lần tải đầu lỗi: thông báo và nút thử lại, không giả dữ liệu rỗng thành thành
  công. Làm mới nền lỗi: giữ lịch đã có kèm cảnh báo dữ liệu chưa làm mới được.
- API cinemas lỗi: thông báo nhẹ/nút thử lại; vẫn dùng tên/ID rạp trong lịch,
  cho lọc rạp/phim và tạm vô hiệu hóa bộ lọc thành phố.
- Không có suất ngày đó khác với không có suất khớp bộ lọc; cung cấp thao tác
  đổi ngày hoặc xóa bộ lọc phù hợp.
- Ảnh thiếu/hỏng dùng MovieImage fallback. Không tự tạo thể loại, nhãn định
  dạng, độ tuổi hay metadata không nằm trong ShowtimeResponse.
- Người dùng đổi ngày nhanh: query key tách ngày, request có thể hủy khi
  không còn dùng; kết quả cũ không ghi đè màn hình ngày mới.
- Lịch/giá có thể đổi sau khi khách bấm. Backend đặt vé vẫn là nơi kiểm tra
  tính hợp lệ cuối cùng; trang lịch không khẳng định số ghế còn trống.

## Kế hoạch triển khai

1. Viết hàm ngày giờ/bộ lọc/nhóm cùng test các quy tắc dữ liệu và URL; thêm
   hook lịch ngày, hỗ trợ hủy request tương thích các caller hiện có.
2. Dựng trang và route lazy-load, hoàn thiện responsive, trạng thái truy cập
   bàn phím, loading/error/empty và giữ bộ lọc qua URL.
3. Chạy test/lint/build frontend; kiểm tra trình duyệt với phản hồi mô phỏng
   cho ngày, bộ lọc, Back, điều hướng và lỗi, desktop/mobile. Cập nhật README
   và kết quả kiểm chứng vào tài liệu này.

## Kiểm chứng dự kiến

- Ngày giờ Việt Nam, 7 ngày qua cuối tháng/năm, URL ngày/ID không hợp lệ.
- Lọc thành phố/rạp/phim, reset đúng thời điểm, giữ city khi API rạp lỗi.
- Gom phim/rạp, giá/giờ, giữ hai suất cùng giờ khác phòng, loại suất quá giờ.
- Back/Forward và quay lại từ booking giữ ngày/bộ lọc; route booking dùng
  đúng ID nội bộ, không gọi API ghế trong quá trình xem lịch.
- Không có suất, lỗi lịch/rạp, retry, đổi ngày nhanh và ảnh lỗi.
- Desktop/mobile không tràn trang, nút giờ xuống dòng, dropdown và liên kết
  dùng được bằng bàn phím.

## Kết quả triển khai và kiểm chứng

- Trang và route lazy-load đã hoàn thành, dùng các endpoint hiện có, không
  thay đổi backend/schema và không thêm dependency.
- Thêm `scheduleUtils` cùng 12 test cho ngày giờ Việt Nam, ranh giới cuối
  tháng/năm/năm nhuận, URL sai, suất hết giờ, nhóm và thứ tự, lựa chọn phim/rạp,
  reset sau tải thành công và phục hồi bộ lọc thành phố khi metadata trở lại.
- `npm.cmd test`: 35/35 test frontend đạt, gồm các test phim/chọn ghế hiện có.
- `npm.cmd run lint` và `npm.cmd run build`: đạt. Chunk trang Lịch chiếu khoảng
  16,55 kB (gzip 5,43 kB), chỉ tải khi mở route.
- Kiểm tra Edge headless trên bản build với API mô phỏng, desktop 1440px và
  mobile 390px: nhóm phim/rạp, giá/giờ, hai phòng trùng giờ, bộ lọc và URL,
  điều hướng booking ID nội bộ, Back/Forward, đổi ngày liên tiếp và phản hồi
  ngày cũ bị trễ đều đạt; không có lỗi JavaScript runtime.
- Xác nhận không gọi API ghế khi chỉ xem/lọc lịch. Request ghế trong bài kiểm
  tra chỉ phát sinh sau khi mở trang booking và cũng được mô phỏng.
- Xác nhận ngày giờ đúng khi trình duyệt đặt ở America/Los_Angeles; cập nhật
  đồng hồ loại suất đã bắt đầu và chuyển cửa sổ ngày qua nửa đêm Việt Nam.
- Lỗi lịch ban đầu/retry, lỗi làm mới giữ cache, lỗi API rạp/khôi phục metadata
  và ngày không có suất đều được kiểm tra trên trình duyệt.
- Mobile không tràn trang; thanh ngày cuộn độc lập, bộ lọc và liên kết giờ có
  thể focus bằng bàn phím. Kiểm tra ảnh chụp desktop/mobile đã hoàn thành.
- Các kiểm tra trình duyệt dùng dữ liệu mô phỏng, không ghi vào backend hay
  Galaxy; không thay thế kiểm thử chịu tải hoặc đối chiếu catalog trực tiếp.
- Đã cập nhật `frontend/README.md` và `ke_hoach_frontend.md`. Script kiểm tra
  trình duyệt tạm thời đã được gỡ khỏi workspace sau khi chạy xong.
