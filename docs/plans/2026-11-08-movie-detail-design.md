# Thiết kế trang chi tiết phim và đồng bộ metadata Galaxy

Ngày: 08/11/2026 (Asia/Ho_Chi_Minh).

Trạng thái: Đã được người dùng duyệt và triển khai ngày 08/11/2026.

## Yêu cầu đã xác nhận

- Trang `/movies/:id` phục vụ khách xem thông tin và chọn suất chiếu.
- Bố cục theo ảnh tham khảo, giữ nền tối và điểm nhấn đỏ của PremierCinema.
- Ảnh ngang lớn ở đầu trang; nhấn ảnh hoặc nút Play để mở trailer.
- Poster bên trái, thông tin phim ở giữa, cột phim đang chiếu ở bên phải.
- Có đạo diễn và diễn viên khi nguồn trả dữ liệu. Giữ thời lượng, ngày khởi chiếu,
  nhãn độ tuổi, thể loại và nội dung phim ở trang chi tiết.
- Bộ chọn suất chiếu tiếp tục hoạt động ở dưới nội dung phim.
- Điện thoại sắp nội dung thành một cột. Trailer chỉ tải sau khi người dùng bấm.

## Bằng chứng nguồn dữ liệu

Đã kiểm tra HTTP 200 từ endpoint công khai:

`GET https://www.galaxycine.vn/api/v2/mobile/movies/ach-diese-luecke-diese-entsetzliche-luecke`

Phần `data` có `directors`, `actors`, `imageLandscape`, `imagePortrait`, `country`,
`categories`, `description` và `trailer`. `directors` và `actors` là mảng đối tượng
có `name`. `categories` là mảng đối tượng có tên thể loại.

Các API danh sách đang chiếu/sắp chiếu không chứa đầy đủ những thông tin này.
Backend hiện chưa lưu slug, ảnh ngang, quốc gia, đạo diễn và diễn viên.
Galaxy không phải API đối tác có cam kết duy trì hợp đồng dữ liệu; response cần
được xác thực và có phương án giữ dữ liệu cũ khi nguồn thay đổi.

## Giả định và yêu cầu vận hành

- Phục vụ quy mô catalog hiện có, khoảng vài chục đến vài trăm phim; không tăng
  số request Galaxy theo số khách mở trang chi tiết.
- Giữ chu kỳ đồng bộ phim/rạp/lịch chiếu 5 phút. Tải metadata chi tiết chạy riêng,
  không giữ transaction database trong lúc chờ HTTP và không chặn đồng bộ catalog.
- Mặc định đề xuất: kiểm tra công việc bổ sung mỗi phút, tối đa 20 phim/lượt,
  một request tại một thời điểm; làm mới metadata sau 6 giờ. Lượt đầu ưu tiên phim
  chưa có chi tiết. Đây là cấu hình vận hành, không phải cam kết hoàn tất theo giờ.
- Khi lỗi, giữ chi tiết cũ và đợi ít nhất 5 phút trước khi thử lại phim đó. Trạng
  thái cập nhật thành công và lần thử gần nhất phải phân biệt được; tránh một nhóm
  phim lỗi liên tục chiếm toàn bộ lượt xử lý.
- Thiết kế ban đầu phục vụ một tiến trình backend như môi trường hiện tại. Nhiều
  instance cần cơ chế nhận việc chung trước khi mở rộng bộ đồng bộ chi tiết.
- Frontend đọc dữ liệu nội bộ; không cần cookie đăng nhập Galaxy hay gọi Galaxy
  từ trình duyệt. Mô tả HTML từ nguồn được chuyển sang nội dung an toàn, không
  render trực tiếp HTML chưa xử lý. Chỉ nhúng trailer YouTube có URL/video ID hợp lệ.
- Thiếu dữ liệu bổ sung hoặc lỗi tải ảnh không được ngăn khách chọn suất chiếu.
- Tiếp tục dùng `MovieDetail`, `TrailerModal`, `ShowtimeSelector`, query hooks và
  REST client hiện có để việc bảo trì nằm trong cấu trúc dự án.

## Thiết kế dữ liệu và API

Lưu thêm vào phim: slug Galaxy, ảnh ngang (`landscapeUrl`), quốc gia, danh sách tên
đạo diễn, danh sách tên diễn viên, thời điểm đồng bộ chi tiết thành công và thời
điểm thử gần nhất. Không cần xây dựng module tiểu sử nghệ sĩ cho phạm vi này.

Thể loại lấy từ tên trong `categories` và ánh xạ vào thông tin thể loại hiện có;
chọn độ dài lưu trữ đủ cho nhiều thể loại. Mô tả và trailer hợp lệ được bổ sung từ
API chi tiết. API danh sách vẫn quyết định phân loại đang chiếu/sắp chiếu; việc có
suất bán trước không được đổi trạng thái phim.

`GET /api/v1/movies/{id}` trả thêm các trường tùy chọn cho frontend. API danh sách
giữ tương thích; không tạo request truy vấn chi tiết Galaxy trong handler đọc phim.
Response thiếu mảng nghệ sĩ có thể dùng danh sách rỗng; frontend ẩn dòng không có
dữ liệu thay vì tự tạo tên hoặc nhãn thể loại.

Dev dùng cơ chế cập nhật schema hiện có. Bổ sung SQL có thể chạy lại trong thư mục
`db/manual` để môi trường production với `ddl-auto=validate` thêm cột trước deploy.

## Luồng đồng bộ

1. Bộ đồng bộ catalog hiện có lưu slug và ảnh ngang cùng phim từ danh sách.
2. Tác vụ bổ sung chọn phim Galaxy đang chiếu/sắp chiếu chưa có chi tiết hoặc đã
   hết hạn làm mới, theo giới hạn mỗi lượt.
3. Client gọi `/api/v2/mobile/movies/{slug}`. Slug được mã hóa thành một path segment;
   không nhận URL nguồn tùy ý từ khách.
4. Chỉ nhận response thành công có `data.id` khớp ID Galaxy đã lưu; xác thực kiểu
   dữ liệu trước khi cập nhật. Response hỏng không được ghi đè metadata đã có.
5. Ghi metadata trong transaction ngắn cho từng phim. Không đổi ID nội bộ, trạng
   thái catalog, lịch chiếu, giá, ghế hoặc booking từ response chi tiết.
6. Một phim lỗi không rollback catalog hoặc các phim đã bổ sung thành công. Ghi
   log nguyên nhân, giữ dữ liệu cũ, áp dụng khoảng chờ trước khi thử lại.

## Bố cục và tương tác

Desktop dùng ảnh ngang lớn trên cùng, không làm mờ poster để thay ảnh ngang khi
nguồn đã có ảnh phù hợp. Banner có nút Play ở giữa và tên truy cập rõ ràng cho
bàn phím/trình đọc màn hình. Không tự phát khi mới vào trang.

Phía dưới, poster hơi chồng lên mép banner. Vùng nội dung có breadcrumb về danh
sách đúng mục, tên phim, nhãn độ tuổi, thời lượng/ngày khởi chiếu, quốc gia, thể
loại và các dòng đạo diễn/diễn viên. Tên nghệ sĩ là thông tin văn bản/chip, không
trỏ đến route nghệ sĩ chưa tồn tại trong dự án.

Cột bên phải giới thiệu tối đa 3 phim đang chiếu khác phim hiện tại, có ảnh và
liên kết nội bộ đến trang chi tiết. Nếu không có phim phù hợp, bỏ cột trống để
phần nội dung chính dùng khoảng rộng đó. Điện thoại đặt phần giới thiệu sau nội
dung và bộ chọn suất, tránh che hoặc đẩy lịch chiếu quá xa.

Phần nội dung phim và bộ chọn suất chiếu nằm dưới thông tin chính. Khi mở phim
khác bằng liên kết trong trang, cập nhật nội dung, đóng trailer và về đầu trang.
Ảnh thiếu/lỗi có fallback; thiếu trailer thì banner không trở thành nút phát.
Modal hỗ trợ đóng bằng Escape, nút đóng, thao tác bên ngoài và quản lý focus.

## Kiểm tra và tiêu chí hoàn thành

- Backend: parse đúng một object chi tiết, ánh xạ danh sách tên/thể loại; từ chối
  response lỗi, ID không khớp và redirect không hợp lệ; giữ metadata cũ khi HTTP lỗi.
- Bộ đồng bộ: chỉ chọn phim đến hạn, giới hạn lượt, lùi lần thử thất bại; không tạo
  ghế và không ảnh hưởng việc áp dụng snapshot catalog khi chi tiết lỗi.
- API nội bộ: phim cũ chưa có metadata vẫn đọc được; SQL thêm cột không phá dữ liệu.
- Frontend: kiểm tra banner, play/đóng trailer, dữ liệu đủ/thiếu, ảnh lỗi, chuyển
  giữa phim, cột đề xuất và chọn suất chiếu trên desktop/mobile.
- Chạy lint, unit test liên quan và build. Kiểm tra trình duyệt với API giả lập;
  chỉ chạy kiểm thử trực tiếp Galaxy khi cần xác minh hợp đồng dữ liệu.
- Không thay đổi quy trình khóa ghế, thanh toán hoặc danh sách ở trang chủ.

## Nhật ký quyết định

| Quyết định | Phương án đã cân nhắc | Lý do và trạng thái |
| --- | --- | --- |
| Giữ nền tối/đỏ, bố cục theo ảnh | Đổi toàn bộ sang nền trắng | Người dùng đã chọn giữ nhận diện hiện tại. |
| Có sidebar phim đang chiếu, responsive và giữ chọn suất | Chỉ đổi banner | Người dùng đã xác nhận toàn bộ bản tóm tắt và giả định. |
| Đồng bộ metadata về backend | Tải bổ sung khi khách mở phim lần đầu | Người dùng đã chọn phương án 1: trang không phụ thuộc kết nối Galaxy lúc đọc. |
| Metadata chạy riêng, có giới hạn và thời hạn làm mới | Gọi chi tiết mọi phim trong mỗi lượt catalog | Đã duyệt: tránh tăng độ trễ catalog và lượng request không cần thiết. |
| Lưu danh sách tên nghệ sĩ cùng phim | Xây thêm module nghệ sĩ | Đã duyệt: đủ cho thông tin đang cần hiển thị, giảm phạm vi bảo trì. |

## Câu hỏi còn mở

Không còn câu hỏi mở. Người dùng đã xác nhận yêu cầu, chọn phương án 1 và duyệt
thiết kế chi tiết, bao gồm các giá trị mặc định vận hành.

## Kế hoạch triển khai

1. Bổ sung cột metadata, DTO, SQL cập nhật schema và lưu slug/ảnh ngang từ catalog.
2. Thêm client đọc object chi tiết, kiểm tra dữ liệu và tác vụ bổ sung chạy riêng.
3. Cập nhật bố cục `MovieDetail`, fallback ảnh và modal trailer có hỗ trợ bàn phím.
4. Kiểm thử mapping/đồng bộ, tương tác trình duyệt, cập nhật hướng dẫn chạy.

## Kết quả kiểm tra

- 69 kiểm thử backend bằng mock, HTTP cục bộ và Hibernate metadata đạt; không mở
  kết nối database thật. Mapping JSONB và HQL truy vấn phim đến hạn hợp lệ.
- Kiểm tra chỉ đọc Galaxy bằng HTTP client Java thật đạt: ba danh sách catalog
  đầy đủ và một object chi tiết được kiểm tra/ánh xạ thành công.
- Frontend lint, 11 unit test và production build đạt.
- Kiểm tra Edge headless với API giả lập và ảnh công khai Galaxy đạt trên desktop
  1440px/mobile 390px: dữ liệu nghệ sĩ, banner, chỉ phát sau khi bấm, Escape,
  phục hồi focus, loại phim hiện tại khỏi đề xuất, chuyển phim về đầu trang,
  ảnh lỗi dùng fallback, thiếu metadata/trailer và chuyển sang route booking.
- SQL đã được chuẩn bị nhưng chưa chạy trên database thật. Dev cần khởi động lại
  backend để cập nhật schema và để các tác vụ nền bổ sung dữ liệu theo lô.
