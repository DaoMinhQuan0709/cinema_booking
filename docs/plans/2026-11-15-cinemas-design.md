# Thiết kế trang rạp chiếu phim

Ngày: 15/11/2026. Trạng thái: **đã được người dùng xác nhận, đã triển khai và kiểm chứng**.

Người dùng đã xác nhận phạm vi A, giả định phi chức năng, chọn phương án A và yêu cầu lưu tài liệu, lập kế hoạch, triển khai. Kế hoạch: [cinemas-implementation.md](../../cinemas-implementation.md).

## Mục tiêu và ranh giới

- Hoàn thiện `/cinemas` cho khách truy cập, không bắt buộc đăng nhập.
- Dùng dữ liệu API thật: tên, địa chỉ, tỉnh/thành, ảnh và điện thoại.
- Tìm theo tên rạp, kết hợp lọc tỉnh/thành; URL giữ lựa chọn khi tải lại, chia sẻ và Back/Forward.
- Nút “Xem lịch chiếu” mang ID rạp nội bộ sang `/showtimes`; rạp hợp lệ chưa có suất trong ngày vẫn được giữ trong bộ lọc.
- Hỗ trợ desktop, điện thoại, bàn phím và các trạng thái tải/rỗng/lỗi/thiếu metadata.
- Đổi tên menu “Rạp & Giá vé” thành “Rạp chiếu phim”.
- Không nhúng lịch/giá, bản đồ, slideshow, vị trí người dùng hoặc quản trị rạp vào trang này.

## Dữ liệu đã kiểm tra

Commit nền `471be34` đã bổ sung API Galaxy `/api/v2/mobile/cinemas`, lưu metadata và trả qua `GET /api/v1/cinemas`, `GET /api/v1/cinemas/{id}`. Không sửa phần đồng bộ trong tính năng này.

API bổ sung `galaxyCinemaId`, `siteId`, `slug`, `galaxyCityId`, `latitude`, `longitude`, `phone`, `imageLandscape`, `imagePortrait`, `imageUrls`, `cinemaType`, `displayOrder` so với response công khai trước đó.

Khảo sát API nội bộ thật trước triển khai: 33 rạp, 32 có ảnh/điện thoại/tọa độ, 31 có `cinemaType`, tổng 138 ảnh gallery; 7 rạp có `city = "Chưa xác định"`. Đây là snapshot khảo sát, không hardcode lên sản phẩm. Không suy diễn số phòng/ghế trong catalog là toàn bộ cấu hình Galaxy. Không suy diễn `premium` thành tiện ích/ưu đãi chưa được nguồn xác nhận.

## Giả định phi chức năng

- Quy mô vài chục đến khoảng 200 rạp; tìm/lọc trong dữ liệu đã tải, không gọi API mỗi ký tự.
- Chỉ đọc dữ liệu công khai; không thu thập vị trí, không có chức năng ghi DB hoặc giao dịch Galaxy.
- Dùng service, React Query/cache 30 phút hiện có và nút làm mới; không cam kết dữ liệu tức thời theo mỗi lượt sync 5 phút.
- Lỗi tải hiển thị rõ và cho thử lại; lỗi làm mới giữ snapshot cũ kèm cảnh báo; không thay dữ liệu bằng danh sách giả.
- Nhóm dự án tiếp tục bảo trì bằng React/Tailwind hiện có; không thêm thư viện/dịch vụ bên ngoài.

## Phương án đã cân nhắc

A — danh sách thẻ rạp (được chọn): xem trực tiếp ảnh, địa chỉ, tỉnh/thành, điện thoại và hành động. Ít trạng thái chọn trung gian, phù hợp dữ liệu hiện có, dễ kiểm thử/responsive.

B — danh sách rạp và vùng thông tin riêng: phù hợp khi có nhiều nội dung chi tiết nhưng thêm thao tác chọn, quản lý focus và bố cục điện thoại. Chưa cần ở phạm vi hiện tại.

## Giao diện và thành phần

- Lazy `CinemasPage` trong `MainLayout`, giữ Header/Footer/AuthModal/CineBot.
- Hướng thẩm mỹ: điện ảnh tối, bố cục biên tập tiết chế; ảnh rạp là điểm nhận diện, tiêu đề lớn và dấu nhấn đỏ theo các trang phim/lịch hiện có. Giữ font Plus Jakarta Sans/Be Vietnam Pro, token màu và nhịp khoảng cách của dự án. DFII: tác động 3, phù hợp 5, khả thi 5, hiệu năng 4, rủi ro nhất quán 2 → 15.
- Bộ lọc tỉnh/thành, ô tìm theo tên có nhãn, số kết quả, nút xóa bộ lọc/làm mới.
- Thẻ 2–3 cột trên desktop, một cột trên điện thoại: ảnh ngang cố định tỷ lệ, tên/địa chỉ đầy đủ, tỉnh/thành, điện thoại và liên kết lịch chiếu.
- Ảnh tải lazy, có kích thước cố định tránh xê dịch; thử ảnh ngang, dọc hoặc ảnh gallery hợp lệ; hết ảnh/ảnh lỗi hiện khung dự phòng. Chỉ dùng URL HTTP(S).
- Chỉ tạo liên kết `tel:` khi giá trị điện thoại có định dạng phù hợp; thiếu điện thoại hiện đang cập nhật. Không hiển thị mã kỹ thuật trên thẻ.
- Dùng HTML ngữ nghĩa, nhãn cho input/select, focus rõ, thông báo `role=status/alert`; không dựa vào hover để thực hiện hành động.

## Dòng dữ liệu và URL

- `cinemaService.getCinemas` và `useCinemas` dùng chung dữ liệu `['cinemas', 'list', {}]` với các trang khác; truyền AbortSignal để hủy yêu cầu khi không còn cần.
- `/cinemas?q=...&city=...`: chuẩn hóa/cắt độ dài hợp lý, giữ tham số không liên quan; sửa từ khóa dùng replace để không tạo lịch sử mỗi ký tự, đổi tỉnh/thành/xóa bộ lọc tạo điểm Back.
- Tìm tên bỏ dấu và không phân biệt hoa/thường (bao gồm Đ/đ); tỉnh/thành dùng giá trị catalog, giữ lựa chọn chưa có kết quả thay vì tự xóa lọc.
- Sắp xếp `displayOrder` có giá trị trước, sau đó tên tiếng Việt và ID để ổn định; không sửa mảng cache gốc.
- Danh sách tỉnh/thành lấy từ toàn bộ catalog, không phụ thuộc từ khóa; thiếu tỉnh/thành về nhóm “Chưa xác định”, không tự đoán từ địa chỉ.
- Liên kết `/showtimes?cinemaId=...` chỉ dùng ID nội bộ dương hợp lệ, không dùng UUID/siteId Galaxy.

## Giữ lựa chọn khi sang lịch chiếu

`resolveScheduleFilters` hiện suy ra danh sách rạp từ suất trong ngày nên tự bỏ rạp chưa có suất. Đổi sang kết hợp catalog rạp với các rạp trong response suất chiếu; metadata catalog là nguồn tên/tỉnh/thành khi có.

- Rạp hợp lệ vẫn có trong select khi ngày đó không có suất; hiển thị trạng thái rỗng và cho đổi ngày.
- Đổi ngày không làm mất rạp/tỉnh/thành hợp lệ. Rạp không thuộc tỉnh/thành được chọn vẫn được reset như trước.
- Rạp không có trong cả catalog và danh sách suất được reset sau response thành công; không reset dựa trên dữ liệu đang tải hoặc lỗi làm mới.
- Nếu API rạp lỗi/chưa tải được: dùng thông tin suất khi có, giữ ID rạp được truyền vào nếu chưa đủ metadata để xác định ID không tồn tại. Không mở rộng kết quả sang tất cả rạp do thiếu metadata.
- Phim không còn suất phù hợp vẫn có thể reset như logic cũ; các route chọn ghế và checkout giữ nguyên.

## Rủi ro và kiểm chứng

- Metadata không đầy đủ, ảnh CDN lỗi, tỉnh/thành chưa xác định: có fallback rõ; không sửa dữ liệu backend để che thiếu thông tin.
- Catalog cache có thể cũ: nút làm mới; lỗi giữ dữ liệu cũ kèm cảnh báo, không khẳng định là dữ liệu mới nhất.
- Filter URL/Back và metadata đến muộn: không để response cũ ghi đè URL mới; kiểm thử trường hợp lịch không có suất và API rạp lỗi.
- Unit test có ý nghĩa cho Unicode, lọc kết hợp, thứ tự, URL, URL ảnh/điện thoại/ID và bộ lọc lịch.
- Chạy lint, toàn bộ unit test frontend và production build.
- Edge production với REST mô phỏng: tải/rỗng/lỗi/refresh/cached data, ảnh lỗi, tìm/lọc, URL/Back, mobile/keyboard và liên kết lịch không có suất; báo riêng kết quả mô phỏng.
- Edge với API thật tại localhost: đọc catalog, kiểm tra thẻ khớp API, tìm/lọc, refresh và mở lịch theo ID; không gọi API ghế, tạo booking, sync hay sửa DB. Chụp desktop/mobile và lưu báo cáo/artifact.

## Nhật ký quyết định

| Mã | Quyết định | Phương án khác | Lý do |
| --- | --- | --- | --- |
| D01 | Trang là danh bạ rạp công khai | Nhúng lịch/giá ngay trên trang | Người dùng chọn phạm vi A |
| D02 | Đổi menu thành “Rạp chiếu phim” | Giữ “Rạp & Giá vé” | Tên phản ánh đúng phạm vi |
| D03 | Thẻ có ảnh và thông tin trực tiếp | Danh sách kèm vùng chi tiết | Người dùng chọn phương án A; metadata mới đã có ảnh |
| D04 | Dùng API nội bộ/cache, lọc phía client | Gọi Galaxy hoặc API mỗi ký tự | Quy mô khoảng 200 rạp, không thêm phụ thuộc |
| D05 | Giữ rạp hợp lệ dù không có suất trong ngày | Tự về tất cả rạp | Tôn trọng rạp được chọn từ danh bạ |
| D06 | Giữ nhóm tỉnh/thành chưa xác định | Đoán/sửa địa phương từ frontend | Tránh tự sửa nghĩa dữ liệu nguồn |
| D07 | Ảnh đại diện có fallback, không slideshow | Dùng toàn bộ gallery trong modal | Đủ cho tra cứu, giảm tải và độ phức tạp |
| D08 | Tách kiểm thử mô phỏng và API thật chỉ đọc | Gộp chung kết quả | Giữ rõ bằng chứng và giới hạn kiểm chứng |

Không còn câu hỏi chặn triển khai. Rủi ro thấp vì trang công khai chỉ đọc, không thay giao dịch hoặc schema; không cần vòng thẩm định nhiều agent.

## Kết quả triển khai

Đã hoàn tất theo kế hoạch: lazy route `/cinemas`, thẻ ảnh/điện thoại, tìm/lọc/URL/cache, các trạng thái tải/rỗng/lỗi và giữ rạp khi lịch trong ngày trống. `cinemaService` từ chối payload danh sách sai cấu trúc; query truyền AbortSignal. Không thay phần đồng bộ rạp của commit nền.

Lint, build và 104 unit test đạt. Edge production/REST mô phỏng đạt 15 nhóm; Edge/API localhost thật chỉ đọc đạt 5 nhóm, đối chiếu 33 rạp và ảnh CDN, gồm rạp chưa có suất và viewport 390px. Cả hai chế độ không có lỗi runtime. Đây là kiểm chứng tương tác trên tập dữ liệu hiện có; không phải đo tải đồng thời hay xác nhận mọi ảnh CDN luôn sẵn sàng.

Đã xem ảnh desktop/mobile sau khi ảnh trong viewport tải xong. Script đóng preview và Edge/profile do nó tạo; artifact lưu để đối chiếu. Các lần chạy fixture ban đầu được sửa ở chính kịch bản kiểm tra (không truy cập localStorage của `about:blank`, ảnh lỗi phải có nội dung không giải mã được), sau đó chạy mô phỏng lại đạt đầy đủ. Đường dẫn báo cáo/ảnh và hướng dẫn chạy lại nằm trong kế hoạch triển khai/README tính năng.
