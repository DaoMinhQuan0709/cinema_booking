# Trang “Rạp chiếu phim” và `/cinemas/:id`

Mục tiêu: giữ `/cinemas` làm danh sách tìm/lọc rạp, thêm trang chi tiết theo ba ảnh mẫu và luồng chọn suất ngay tại rạp.

**Bố cục:** carousel ảnh → tên/địa chỉ/hotline + chọn thành phố/rạp → ngày/phim/giờ chiếu → hai cột giá vé và thông tin/bản đồ → Footer. Theo xác nhận của người dùng, phần kết thúc là Footer; dùng Footer của `MainLayout` đúng một lần. Dùng màu nền tối/đỏ hiện có, responsive 6/3/2 cột phim và một cột thông tin trên mobile.

**Dữ liệu:** dùng API Spring Boot hiện có. Điểm đánh giá, bài giới thiệu dài và ảnh bảng giá chưa có trường nguồn: không tự tạo nội dung. Khối giá lấy `basePrice` theo ngày, ghi rõ giá cơ bản; giá cuối theo ghế/đơn. Bản đồ dùng mã iframe sao chép thủ công từ Google Maps theo ID rạp, không dùng Maps Embed API key. Mã chưa được cung cấp thì hiện thông báo và giữ nút chỉ đường.

**Thứ tự:** dữ liệu → route → chọn rạp/ngày/phim → chọn suất → thông tin cuối trang → kiểm chứng. Có thể chuẩn bị carousel và khối thông tin độc lập sau khi chốt dữ liệu; hoàn thành trang đích trước [kế hoạch header](header-my-tickets-navigation-plan.md).

## Công việc

- [x] 1. Thêm `features/cinemas/hooks/useCinemaDetail.js`, `useCinemaShowtimes.js`; mở rộng options của `services/cinemaService.js` → GET `/cinemas/:id` và `/showtimes?cinemaId=&date=` có cache theo ID/ngày, hủy request cũ, không bắt buộc `movieId`, không gọi Galaxy hoặc API tạo ghế.
- [x] 2. Tạo `CinemaDetailPage.jsx`, lazy route `cinemas/:id` trong `App.jsx`; đổi CTA của `CinemaCard.jsx` qua helper `getCinemaDetailHref` → mở trực tiếp/reload được, danh sách vẫn giữ tìm/lọc/Back; ID sai hoặc 404 có lối về danh sách.
- [x] 3. Tạo `CinemaGallery.jsx` chỉ dùng `imageUrls` (trường `image_urls`) → desktop hé ảnh hai bên, có nút/chấm, bàn phím/vuốt; một ảnh ẩn điều hướng, ảnh lỗi có fallback.
- [x] 4. Tạo `CinemaInfoHeader.jsx` với bộ chọn “Tìm rạp theo thành phố” → đổi thành phố lọc ô chọn rạp, chờ người dùng chọn; chọn rạp mới đổi route để ảnh/thông tin theo đúng rạp và cung cấp ID trên URL cho lịch/map ở các phần 5–8. Thành phố không có rạp hiện trạng thái rỗng; không tự nhảy sang rạp khác.
- [x] 5. Thêm xử lý `?date=&movieId=` trong `cinemaDetailUtils.js`: mặc định hôm nay theo giờ Việt Nam, dải 7 ngày, nhóm phim từ suất tương ứng → đổi rạp/ngày xóa chọn phim không còn phù hợp; rạp hết suất vẫn giữ đúng ID; Back/Forward khôi phục lựa chọn.
- [x] 6. Tạo `CinemaMovieGrid.jsx`: poster/tên và nhãn tuổi lấy bổ sung từ API phim có cache; dùng thao tác chọn phim riêng → không chuyển sang `/movies/:id` khi chọn, không bịa điểm đánh giá, phim đã chọn có trạng thái rõ ràng.
- [x] 7. Tạo `CinemaShowtimePanel.jsx` dưới lưới, hiện giờ/phòng/giá của phim đã chọn → bấm tới `/booking/:showtimeId` bằng ID nội bộ; loại suất đã bắt đầu, làm mới lịch định kỳ, xử lý tải/rỗng/lỗi độc lập với thông tin rạp.
- [x] 8. Tạo `CinemaPricingInfo.jsx` và `CinemaLocation.jsx` theo khối cuối ảnh 3 → giá bám dữ liệu suất; địa chỉ/hotline/map thuộc đúng rạp, iframe tải khi gần khung nhìn, có nút chỉ đường. Thiếu giá/địa chỉ/ảnh có thông báo; không sao chép chính sách giá chưa được backend áp dụng.
- [x] 9. Cập nhật `features/cinemas/README.md`, unit test logic URL/ngày/nhóm suất và `scripts/cinemas-browser-check.mjs` → bổ sung fixture chi tiết rạp/phim, đổi rạp nhanh, lỗi từng API, ảnh thiếu, một Footer, Tab/Enter và màn hình 390/768/1440px; chế độ live chỉ đọc catalog, không gọi tạo ghế/booking/sync.

## Kiểm chứng cuối

- [x] 10. Tại `frontend`, chạy `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:cinemas-browser`; khi backend sẵn sàng chạy script live đã cập nhật và kiểm tra Maps thật. Đạt khi danh sách → chi tiết → ngày → phim → suất dẫn đúng trang ghế (mô phỏng API ghế), không lẫn dữ liệu giữa các rạp, không tràn ngang và Footer chỉ xuất hiện một lần. Ghi riêng kết quả mô phỏng, API thật và phần còn thiếu dữ liệu/cấu hình.

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
- `getCinemaGallerySources` chỉ dùng `imageUrls` (trường `image_urls`), không lấy `imageLandscape`/`imagePortrait`, lọc URL HTTP(S) và loại trùng. Ảnh lỗi được bỏ qua; một ảnh ẩn nút/chấm và bỏ điểm Tab của khung ảnh; không có ảnh hoặc tất cả ảnh lỗi đều có thông báo. Đổi rạp/bộ ảnh đặt lại lựa chọn và trạng thái lỗi.
- Điều chỉnh nguồn ảnh theo yêu cầu: gallery không dùng ảnh ngang/dọc kể cả khi `imageUrls` thiếu, rỗng hoặc toàn bộ ảnh lỗi. Sau điều chỉnh, lint/build, 11 test tiện ích và 29 nhóm kiểm tra Edge mô phỏng đều đạt; kết quả tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-Nyz4eN`.
- Hỗ trợ nút trước/sau, chấm chọn ảnh, mũi tên/Home/End, Tab/Enter và vuốt ngang; vẫn cuộn dọc và zoom trên thiết bị cảm ứng. Có nhãn đọc màn hình, thông báo số ảnh, focus rõ và vùng bấm tối thiểu 44px. Chuyển ảnh không gọi thêm API.
- Bổ sung test nguồn ảnh, README và 7 nhóm kiểm tra gallery trong script Edge: ảnh hé hai bên, nút/chấm/bàn phím, vuốt ngang/cuộn dọc, giảm chuyển động, một/hai/nhiều ảnh, ảnh lỗi/thiếu và đổi rạp/Back. Sửa helper gửi Enter để Edge thực hiện kích hoạt nút bằng bàn phím đúng như thao tác thật.
- Kiểm tra tại `frontend`: `npm.cmd run lint` đạt; `npm.cmd test` đạt **115/115**; `npm.cmd run build` đạt; `npm.cmd run test:cinemas-browser` đạt **29 nhóm kiểm tra**, không lỗi JavaScript, không tràn ngang ở 390/768/1440px. Đã xem ảnh chụp gallery desktop/mobile. Edge dùng REST/ảnh mô phỏng, chưa xác nhận API/CDN thật; kết quả và ảnh lưu tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-BXGoDB`. Các phần 4–10 chưa hoàn tất.

**Phần 4 — hoàn tất ngày 17/11/2026.**

- Dùng `CinemaInfoHeader.jsx` do người dùng tạo thay header cũ; `getCinemaPickerState` giữ rạp hiện tại khi catalog đang tải/lỗi và lọc theo thành phố. Đổi thành phố chưa điều hướng; chọn rạp mới đổi URL, giữ `date` và router state, bỏ `movieId`. Trường hợp thành phố đã chọn không còn trong catalog vẫn giữ lựa chọn để báo rỗng rõ ràng.
- Rạp đang xem là nguồn thông tin ưu tiên khi catalog lưu cache có thành phố cũ. Đã bỏ hook đọc query trùng và phần giải thích dư trong component; thêm thông báo lúc danh sách rạp đang tải.
- Bổ sung test helper và kiểm tra Edge cho cache, đổi thành phố/rạp, Back, `date`/`movieId`, trạng thái rỗng, tải/lỗi/thử lại và catalog cũ. Lint, **116/116 test**, build và **35 nhóm Edge mô phỏng** đều đạt; kết quả ở `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-lJgbS1`. Lịch chiếu và bản đồ sẽ đọc ID rạp từ route khi được triển khai ở các phần 5–8.

**Phần 5 — hoàn tất ngày 17/11/2026.**

- `CinemaDetailSelection.jsx` nối dải 7 ngày, phim có suất còn mở bán và URL vào trang chi tiết. Mặc định hôm nay theo giờ Việt Nam; chọn ngày/phim tạo điểm Back, chuẩn hóa URL bằng replace. Query suất chỉ chạy sau khi có chi tiết rạp hợp lệ, theo đúng ID route và ngày; lọc lại ID/ngày trước khi nhóm phim để không hiển thị dữ liệu của rạp khác.
- `movieId` chỉ bị xóa khi phản hồi suất thành công xác nhận phim không còn suất; lúc tải/lỗi hoặc payload sai cấu trúc vẫn giữ lựa chọn và có nút thử lại. Rạp hết suất giữ ID trên route; không tự chọn phim đầu tiên. Đồng hồ cập nhật mỗi phút và khi tab được mở lại để loại suất đã bắt đầu.
- Hai điểm đối chiếu: `buildScheduleDays()` trả về `.date` với hôm nay ở đầu; `isInternalShowtimeId` kiểm tra bigint dương cho `movieId`. Helper ngày/giờ bỏ giá trị không hợp lệ và có 8 unit test. Lint, **124/124 test**, build và **42 nhóm Edge mô phỏng** đạt, không có lỗi JavaScript; kết quả tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-5ouGcn`. Phần lưới poster và panel giờ/giá thuộc phần 6–7.

**Phần 6 — hoàn tất ngày 17/11/2026.**

- `CinemaMovieGrid.jsx` hiển thị phim có suất tại rạp/ngày đang xem theo 2/3/6 cột, chọn phim bằng `movieId` trên URL và giữ ô chọn phim đồng bộ. Poster và nhãn tuổi bổ sung từ cache API phim; thiếu metadata dùng poster suất và ẩn nhãn tuổi, poster metadata lỗi cũng trở về poster suất. Lưới không điều hướng sang trang phim và không hiển thị điểm đánh giá không có dữ liệu.
- `movieGridUtils.js` tra cứu phim theo ID từ danh sách đang chiếu/sắp chiếu, có 2 unit test. Script Edge cho phép thêm GET `/movies`, mô phỏng metadata và kiểm tra chọn phim, cột responsive, fallback poster/nhãn; chế độ live vẫn chỉ đọc. Lint, **126/126 test**, build và **45 nhóm Edge mô phỏng** đạt, không có lỗi JavaScript; kết quả tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-KOJVxr`.

**Phần 7 — hoàn tất ngày 17/11/2026.**

- `CinemaShowtimePanel.jsx` nằm dưới lưới phim, hiện giờ/phòng và `basePrice` với nhãn “Giá cơ bản”; mỗi suất dùng liên kết `/booking/:showtimeId` bằng ID nội bộ, ID sai không được tính vào lưới hoặc panel. Không gọi API ghế cho đến khi người dùng mở trang đặt vé.
- Suất đã bắt đầu được loại theo giờ Việt Nam, cập nhật đồng hồ mỗi phút và khi quay lại tab; `useCinemaShowtimes` tự làm mới mỗi phút và khi focus. Lỗi làm mới giữ và hiển thị snapshot cũ có cảnh báo; dữ liệu tải/rỗng/lỗi tách khỏi thông tin rạp. `changeSelection` trên `main` chỉ có một lệnh `setSearchParams`, không có dòng trùng cần xóa. Lint, **126/126 test**, build và **47 nhóm Edge mô phỏng** đạt, không có lỗi JavaScript; kết quả tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-wZmH0E`.

**Phần 8 — hoàn tất ngày 17/11/2026.**

- `CinemaPricingInfo.jsx` hiển thị khoảng `basePrice` theo từng phim từ suất còn mở bán của đúng rạp/ngày; bỏ ID suất hoặc giá sai, có trạng thái tải/lỗi/thiếu giá. Ghi rõ đây là giá cơ bản, giá cuối tính khi chọn ghế và xác nhận đơn; không tạo bảng giá hoặc chính sách ngoài dữ liệu backend.
- `CinemaLocation.jsx` lấy địa chỉ, hotline, tọa độ từ chi tiết rạp hiện tại. Chỉ đường ưu tiên tọa độ hợp lệ, nếu thiếu thì dùng tên/địa chỉ/thành phố; thiếu cả hai thì không tạo liên kết. Iframe dùng `loading="lazy"`, mã nhúng Google Maps được cấu hình thủ công theo ID rạp. Gallery đã xử lý ảnh thiếu ở phần 3. Bản đồ thật chưa được kiểm tra trong phần này.
- Bổ sung 3 unit test helper giá/bản đồ, kiểm tra Edge cho giá/ngày/rạp, vị trí/chỉ đường, thiếu dữ liệu và ảnh chụp khối cuối trang desktop/mobile. Lint, **129/129 test**, build và **49 nhóm Edge mô phỏng** đạt, không có lỗi JavaScript; kết quả tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-EZjjyL`. Chưa kiểm tra API/DB thật.

**Điều chỉnh mục 8 — Google Maps iframe thủ công ngày 17/11/2026.**

- Theo lựa chọn mới của người dùng, bỏ nhánh OpenStreetMap và Maps Embed API có key. `cinemaGoogleMapEmbeds.js` nhận HTML iframe sao chép từ Google Maps theo ID rạp; chỉ lấy URL `src` HTTPS thuộc `www.google.com/maps/embed?pb=...`. Rạp thiếu mã vẫn hiện địa chỉ/hotline/chỉ đường; hướng dẫn điền trong README. Sau đó đã có 25 mã nhúng được thêm vào cấu hình.
- Lint, build, **131/131 unit test** và **49 nhóm Edge mô phỏng** đạt, không lỗi JavaScript; kết quả tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-LYDL2K`. Chưa kiểm tra iframe Google Maps thật trong lần chạy này.

**Phần 9 — hoàn tất ngày 18/11/2026.**

- README tổng hợp cách dùng trang, hướng dẫn cấu hình iframe Google Maps thủ công và phạm vi kiểm tra. Unit test bổ sung trường hợp `movieId` trùng trên URL, nhiều phòng cùng giờ và xác thực toàn bộ 25 mã nhúng hiện có đều có ID/URL hợp lệ. Chưa đối chiếu marker của từng mã với rạp trong DB thật.
- Script Edge có fixture hai phim/suất, phim đang và sắp chiếu; kiểm tra thứ tự giờ, giá/phòng, Tab/Enter chọn phim và ngày. Bổ sung API phim lỗi và hai trường hợp đổi rạp khi GET chi tiết hoặc suất của rạp cũ chưa kết thúc; không lẫn phim, giá, vị trí. Các nhánh catalog/chi tiết/suất lỗi, ảnh thiếu, một Footer và 390/768/1440px vẫn đạt. Chế độ live chỉ cho GET/OPTIONS các API catalog/lịch/phim; không gọi tạo ghế/booking/sync.
- Live script dùng rạp mẫu có địa chỉ nếu có, chấp nhận fallback khi thiếu địa chỉ/ảnh và kiểm tra một Footer ở trang chi tiết. Tại thời điểm kiểm tra không có backend lắng nghe cổng 8080 nên chưa chạy chế độ live; API/DB và bản đồ Google thật thuộc kiểm chứng mục 10.
- Tại `frontend`, lint, **133/133 unit test**, build và **54 nhóm Edge mô phỏng** đạt, không lỗi JavaScript; kết quả tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-tAFQiB`.

**Phần 10 — hoàn tất kiểm chứng ngày 18/11/2026.**

- Tại `frontend`, `npm.cmd run lint`, `npm.cmd test` (**133/133**), `npm.cmd run build` và `npm.cmd run test:cinemas-browser` (**55 nhóm**, không lỗi JavaScript) đều đạt. Kịch bản mới đi từ danh sách → chi tiết → ngày kế tiếp → phim → suất 502 đến đúng trang ghế ở 390px; hai GET chi tiết suất/ghế dùng response mô phỏng, không gửi request ghi booking. Không tràn ngang; Footer chỉ có một. Báo cáo và ảnh ở `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-qPulz6`.
- `npm.cmd run test:cinemas-browser -- --check-map` đạt **56 nhóm**. Iframe cấu hình cho rạp ID 9 nhận HTTP 200 và ảnh Edge hiển thị marker **Galaxy Cinema Nguyễn Du**; ảnh ở `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-gpU4om\cinema-google-map-9.png`. API rạp trong lần này vẫn là fixture; chưa xác nhận ID 9 hay 24 mã iframe còn lại tương ứng với dữ liệu DB thật.
- Sau khi backend được khởi động, `npm.cmd run test:cinemas-live` đạt **9 nhóm**, **21 request/21 response**, không lỗi JavaScript. Danh sách khớp **33 rạp** từ API thật; lọc/làm mới/chi tiết và lịch rạp hết suất đều đúng. Với rạp **62**, iframe Google Maps trả HTTP 200, ảnh Edge hiển thị marker **Galaxy CineX Hanoi Centre** đúng địa chỉ API; trang chi tiết ở 390/768/1440px không tràn ngang và chỉ có một Footer. Ngày **19/11/2026**, phim **88** tại rạp này hiển thị đúng **19 suất** và các link `/booking/:id` đều thuộc đúng rạp/ngày/phim. Ảnh và báo cáo tại `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-live-dHINHz`.
- `npm.cmd run test:cinemas-map-audit` đối chiếu **25 mã iframe** với catalog API: tất cả ID tồn tại, URL và nhãn địa điểm đều hợp lệ; tên địa điểm phù hợp khi xem danh sách audit. **8/33 rạp chưa có mã nhúng**: ID **10, 48, 51, 52, 57, 61, 64, 68**; giao diện đã có thông báo và nút chỉ đường thay thế khi có địa chỉ. Khoảng cách tâm khung bản đồ với tọa độ API chỉ là dữ liệu tham khảo, không đo độ lệch marker. Chỉ marker rạp 62 được xác nhận bằng ảnh live; các marker còn lại chưa được xem trực quan từng cái.
- Lượt kiểm tra cuối: lint, **133/133 unit test**, build và **55 nhóm Edge mô phỏng** đạt; mô phỏng ghế chỉ thực hiện GET, không tạo booking. Báo cáo mô phỏng ở `C:\Users\LOQ\AppData\Local\Temp\cinema-cinemas-mock-SyYub5`. Chế độ live chỉ đọc catalog/lịch/phim và không gọi API ghế hoặc ghi DB.
