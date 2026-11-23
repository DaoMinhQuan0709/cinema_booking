# Thiết kế xóa phim và suất chiếu, ngăn Galaxy nhập lại

Ngày: 15/11/2026 (Asia/Ho_Chi_Minh).

Trạng thái: Người dùng đã xác nhận yêu cầu, phương án A và cả ba phần thiết kế.
Đã hoàn tất rà soát theo skill `multi-agent-brainstorming`; Integrator / Arbiter
kết luận **APPROVED** ngày 15/11/2026. Đã triển khai và nghiệm thu sau khi người
dùng yêu cầu chuyển bước; kết quả tại [kế hoạch triển khai](../../admin-deletion-implementation.md).
Chưa áp dụng schema hoặc khởi động lại backend vận hành.
Git trước khi ghi tài liệu sạch, HEAD `db43fd7` (sửa logic ngày chiếu).

## 1. Yêu cầu đã xác nhận

- ADMIN có thể xóa phim và xóa riêng suất chiếu từ giao diện quản trị.
- Xóa phim bao gồm các suất thuộc phim; hộp thoại phải nêu rõ số suất bị ảnh hưởng,
  không chỉ các suất đang xuất hiện trên trang hoặc trong bộ lọc hiện tại.
- Chặn toàn bộ thao tác nếu có đơn CONFIRMED hoặc PENDING trong phạm vi xóa.
  Không xóa một phần và không tự hủy đơn, hủy vé hoặc hoàn tiền.
- CANCELLED/EXPIRED không tự chặn xóa, nhưng phải kiểm tra các thanh toán chưa rõ
  kết quả. PENDING quá hạn vẫn chặn đến khi quy trình hết hạn chuyển trạng thái.
- Dữ liệu Galaxy đã xóa không quay lại sau restart, sync tự động, sync thủ công,
  nhập JSON hoặc file mẫu. Xóa một suất không chặn phim và các suất khác.
- Giữ đơn, thanh toán, vé, liên kết lịch sử và báo cáo. Không làm giao diện khôi
  phục, xóa hàng loạt hoặc hệ thống hoàn tiền trong phạm vi này.

## 2. Giả định và yêu cầu phi chức năng đã xác nhận

- Áp dụng cho phim/suất Galaxy và dữ liệu do admin tạo; phục vụ quy mô đồ án,
  hàng chục nghìn suất. Chưa có cam kết SLA hoặc chỉ tiêu tải cụ thể.
- Xóa đơn lẻ cần phản hồi nhanh; dùng truy vấn theo ID, bộ lọc có chỉ mục và
  kiểm tra tập hợp, tránh truy vấn từng đơn/suất hoặc quét toàn bộ danh mục.
- Chỉ ADMIN được xem thông tin kiểm tra xóa và thực hiện DELETE. Kiểm tra quyền
  tại backend; không trả tên, email, mã đơn hoặc dữ liệu cá nhân của khách.
- Dấu xóa lưu trong PostgreSQL, giao dịch nguyên tử; phải xử lý đồng thời với
  đặt vé, thanh toán, tạo/sửa suất và đồng bộ, kể cả nhiều backend instance.
- Dùng hạ tầng Java/Spring Boot/PostgreSQL/Redis và UI hiện có. Nhóm dự án tiếp
  tục bảo trì; không thêm dịch vụ vận hành hoặc hệ thống hàng đợi riêng.
- Mã Galaxy là danh tính nguồn. Nếu Galaxy cấp mã mới hoàn toàn thì xem là dữ
  liệu mới; không suy đoán danh tính bằng tên phim để mở rộng danh sách chặn.

## 3. Hiện trạng đã đối chiếu

- `AdminMovieController` và `AdminShowtimeController` có DELETE; service đang
  gọi `deleteById`, chưa có điều kiện nghiệp vụ hoặc dấu xóa.
- `Movie` giữ `galaxyMovieId` duy nhất; `Showtime` giữ `galaxySessionId` duy nhất.
  `Showtime.active` phục vụ ngừng mở bán, importer có thể đặt lại thành true.
- `GalaxyDataImporter` là điểm ghi chung cho online/JSON/file; online có cả
  sessions, now-showing và coming-soon. Importer còn nhận lại dữ liệu cũ qua
  khớp phim local theo tên và khớp suất local theo phòng/phim/giờ.
- Importer có PostgreSQL advisory transaction lock; booking đang khóa đọc suất
  trước giữ ghế Redis và tạo đơn. Khóa sync hiện tại chưa bảo vệ thao tác xóa.
- `GalaxyMovieDetailsService`/`GalaxyMovieDetailsWriter` cập nhật chi tiết theo
  một luồng khác với importer; phải loại dữ liệu đã xóa tại cả đọc và ghi.
- `PaymentServiceImpl.settle` có thể xác nhận đơn EXPIRED khi callback thành
  công đến muộn và ghế vẫn có thể bán. `PaymentReturnService` chỉ xác minh chữ
  ký và hiển thị, không settle; hiện không có worker truy vấn kết quả gateway.
- Báo cáo đọc lịch sử độc lập với `active`; không được làm bộ lọc xóa mặc định
  gây mất liên kết báo cáo. Mở sơ đồ ghế có thể sinh inventory tại backend.
- Dev đang dùng Hibernate `ddl-auto=update`, prod dùng `validate`; cần thay đổi
  schema có hướng dẫn riêng, không giả định prod tự tạo cột/chỉ mục.

## 4. Phương án đã chọn và dữ liệu

Chọn A: xóa mềm thống nhất. Phương án B là danh sách loại trừ riêng kết hợp xóa
vật lý khi không có lịch sử; không chọn vì tăng số nguồn trạng thái và nhánh xử lý.

Thêm `deletedAt` (Instant, nullable) và `deletedByUserId` (Long, nullable) cho
Movie và Showtime. Lưu ID người thao tác do phiên đăng nhập backend xác định,
không nhận ID này từ client. Không cascade xóa tài khoản sang dấu xóa. Ghi cả
hai giá trị cùng lúc; bản ghi cũ có cả hai null và vẫn hoạt động như trước.

- Giữ nguyên khóa chính, mã Galaxy, nội dung phim/suất, inventory, đơn và tiền.
- Dấu xóa độc lập với MovieStatus và Showtime.active. Suất được xóa có thêm
  active=false, nhưng active=false đơn thuần không có nghĩa admin đã xóa.
- Xóa phim đánh dấu phim và mọi suất chưa được đánh dấu thuộc phim, kể cả suất
  local và suất lịch sử đủ điều kiện. Giữ dấu xóa cũ của các suất đã xóa trước.
- Bản ghi đã xóa không được sửa, dùng để tạo suất mới hoặc tự khôi phục qua API.
- Không dùng bộ lọc Hibernate toàn cục khiến lịch sử không join được Movie/
  Showtime. Tách rõ truy vấn danh mục hoạt động và truy vấn lịch sử nội bộ.
- Tạo cột nullable và chỉ mục phù hợp theo kế hoạch triển khai; không sửa dữ
  liệu nghiệp vụ hoặc tự gắn dấu xóa cho ENDED/inactive hiện hữu.

Schema cần xét chỉ mục `bookings(showtime_id, status)` cho kiểm tra theo phạm
vi xóa, cùng chỉ mục lookup attempt theo booking và mã giao dịch provider.
Chọn chỉ mục bằng kế hoạch truy vấn trên dữ liệu thử đại diện, không thêm chỉ
mục chỉ vì có trường mới hoặc đếm từng suất bằng vòng lặp N+1.

## 5. Quy tắc đọc và đồng bộ

Danh mục phim, tìm kiếm, gợi ý chatbot, danh sách suất và ô chọn admin bỏ qua
deletedAt khác null; suất cũng bị loại nếu phim cha đã xóa. Chi tiết công khai
và sơ đồ ghế trả 404 khi phim/suất đã xóa, kể cả inventory đã tồn tại. Đặt vé
mới và tạo suất kiểm tra lại điều kiện tại backend, không tin cache frontend.

Lịch sử đơn, thanh toán, vé và truy vấn báo cáo vẫn join dữ liệu đã xóa. Giữ
nguyên phạm vi lịch sử của báo cáo; không loại suất đã xóa khỏi occupancy chỉ
vì đó là dấu xóa mới. Không sinh inventory để kiểm tra hoặc xóa.

Tại importer, lấy tập mã phim/suất bị xóa cần thiết cho snapshot và bỏ qua trước
upsert/tạo phòng/suất. Áp dụng cho mọi vòng xử lý sessions, now-showing,
coming-soon, full/limited và đối soát kết thúc phim/ngừng suất.

- Phim đã xóa: không upsert từ bất kỳ endpoint nào; bỏ qua mọi session mang mã
  phim đó, kể cả mã session chưa từng có trong DB.
- Suất đã xóa: không upsert, không kích hoạt lại và không nhận lại bản ghi này
  qua nhánh khớp local. Phim và suất khác vẫn được nhập bình thường.
- Không nhận lại phim local đã xóa bằng nhánh khớp tên. Nếu nguồn xuất hiện mã
  Galaxy mới, xử lý như danh tính mới, không hồi sinh bản ghi local đã xóa.
  Truy vấn nhận local phải lọc deletedAt IS NULL và galaxyMovieId IS NULL ngay
  trong SQL/JPQL, chọn bản ghi xác định nếu trùng tên; không dùng Optional theo
  tên rồi lọc sau vì các bản ghi xóa mềm vẫn có thể trùng tên.
- Worker cập nhật chi tiết lọc khi chọn công việc và đọc lại dấu xóa dưới khóa
  trước ghi; phản hồi HTTP đến muộn không được ghi đè dấu xóa hoặc sửa bản ghi.
  Câu bulk UPDATE `claimGalaxyDetails` cũng phải có deletedAt IS NULL, không
  chỉ lọc ở candidate hoặc writer.
- Bổ sung hai số đếm loại trừ phim/suất; đếm mỗi mã một lần trong snapshot.
  Không gộp với số suất đổi phòng/giờ bị rút khỏi bán. UI sync giải thích rõ.

## 6. Điều kiện xóa và thanh toán

Chỉ xóa khi toàn bộ phạm vi không có đơn PENDING/CONFIRMED và không có thanh
toán chưa giải quyết. Kiểm tra tất cả các lần thử thanh toán liên quan, không
chỉ lần mới nhất; phân loại theo trạng thái đang lưu, không dựa vào tuổi đơn.

- PENDING luôn chặn; CONFIRMED luôn chặn, kể cả suất đã diễn ra.
- CANCELLED/EXPIRED chỉ được đi tiếp khi không có attempt kết quả PENDING
  (gồm CREATING/READY/UNKNOWN chưa chốt) hoặc tiền cần đối soát.
- SUCCESS, REFUND_REQUIRED hoặc trạng thái tiền không nhất quán/chưa rõ phải
  chặn để xử lý. REFUNDED/FAILED đã chốt không tự chặn nếu đơn không còn thuộc
  nhóm bảo vệ. Không tự chuyển trạng thái thanh toán để cho phép xóa.
- Kết quả kiểm tra trả số lượng và nhóm lý do; không trả danh tính khách.

Callback/IPN phải kiểm tra dấu xóa dưới cùng cơ chế bảo vệ đồng thời trước khi
CONFIRMED/BOOKED hoặc phát hành vé. Nếu xác nhận đã nhận tiền nhưng dữ liệu đã
xóa thì ghi nhận giao dịch và REFUND_REQUIRED theo cơ chế hiện có; không tạo
vé hoặc tự gọi hoàn tiền. Không tin query parameter trình duyệt để xác nhận
tiền; không bổ sung worker truy vấn gateway trong phần mở rộng này.

Không chỉ thêm điều kiện vào canBook sau nhánh trả sớm hiện có. Với dữ liệu đã
xóa, callback thành công có chữ ký, tài khoản merchant, số tiền và định danh
giao dịch hợp lệ phải được phân loại trước khi bỏ qua attempt không PENDING.
Tình huống EXPIRED + FAILED, sau đó xóa, rồi callback thành công phải được ghi
nhận để xử lý tiền, không trả alreadyConfirmed và bỏ mất bằng chứng.

Gắn định danh giao dịch provider và thời điểm nhận tiền với đúng attempt để
không ghi đè giao dịch của attempt khác trên Payment tổng hợp. Nếu schema hiện
tại chưa đủ thì bổ sung tối thiểu các trường này trên PaymentAttempt; không
xây ledger hoặc luồng hoàn tiền mới. Phân biệt trùng chính giao dịch đã nhận
với kết quả mâu thuẫn: trùng thì không ghi/hoàn tiền/phát vé lần nữa; mâu thuẫn
thì giữ bằng chứng đã có và ghi cảnh báo đối soát, không ghi đè thành công cũ.
Chỉ mở rộng nhánh an toàn cho phim/suất đã xóa, không thiết kế lại toàn bộ
thanh toán của các đơn không bị ảnh hưởng.

Chuẩn hóa provider theo method cố định VNPAY; chuẩn hóa transactionId
theo định dạng provider, không biến đổi làm mất danh tính giao dịch. PostgreSQL
phải có ràng buộc duy nhất `(method, provider_transaction_id)` cho ID đã ghi
nhận (giá trị null chưa xác minh được phép lặp). Mỗi lần ghi nhận thành công
đều đi qua ràng buộc này, không chỉ nhánh phim/suất đã xóa. Xung đột giữa hai
attempt/đơn trả kết quả có kiểm soát theo giao thức IPN, giữ bằng chứng cũ và
ghi cảnh báo; không gán một giao dịch cho đơn thứ hai hoặc trả thành công giả
sau khi transaction đã rollback. Callback cùng attempt/cùng transaction là
idempotent. Đối chiếu cả transactionNo lịch sử trên Payment; không đoán attempt
từ việc cùng booking hoặc ghi đè giao dịch legacy chưa đối chiếu được.

## 7. Giao dịch và phối hợp khóa

Không chỉ kiểm tra rồi ghi dấu xóa ở hai thời điểm rời nhau. Thiết kế khóa phải
áp dụng cho mọi đường ghi có thể tạo suất/đơn hoặc xác nhận tiền.

Thứ tự chung khi một transaction cần nhiều loại khóa:

1. Khóa điều phối catalog/sync PostgreSQL có sẵn, nếu là sync hoặc admin ghi
   catalog; booking/thanh toán không lấy khóa toàn cục này.
2. Movie theo ID tăng dần: khóa độc quyền cho thao tác xóa/thay đổi catalog;
   khóa chia sẻ cho đặt vé và các kiểm tra bán hàng/thanh toán có liên quan.
3. Showtime theo ID tăng dần: xóa lấy khóa ghi; booking/thanh toán giữ khóa đọc;
   tạo inventory dùng khóa ghi trước khi khóa phòng theo luồng hiện có.
4. Booking theo ID tăng dần khi cần cập nhật, sau đó ghế theo ID tăng dần.

Chỉ lấy các khóa cần thiết, không nâng khóa đọc thành ghi giữa giao dịch. Sync
phải lấy khóa Movie trước khi khóa các Showtime; không giữ thứ tự cũ khóa các
suất trước rồi mới xử lý phim. Admin tạo suất phải kiểm tra phim dưới khóa để
không thêm suất vào phim vừa xóa. Guard đọc cho callback cho phép nhìn thấy
dấu xóa để ghi nhận tiền, không trả 404 làm mất xử lý kết quả provider.

Các luồng đang lấy Booking trước rồi truy cập suất/phim phải được rà soát lại
để cùng thứ tự nếu bổ sung khóa catalog; không thêm thứ tự ngược gây deadlock.
Lookup ID sơ bộ dùng projection; sau khi chờ khóa phải đọc lại/refresh entity,
kiểm tra quan hệ và dấu xóa mới nhất, tránh first-level cache cũ.

Khi lập kế hoạch triển khai phải lập bảng các đường gọi cần guard, ít nhất:
createBooking; tạo/sửa suất admin; importer; chọn/claim/ghi chi tiết Galaxy;
inventory (kể cả đã có ghế); IPN; hai transaction reserve/finalize URL thanh
toán; cancel/cleanup; BookingProductsService và PaymentReturnService gọi lồng
getBookingByCode. Không thêm khóa catalog vào hàm đọc lịch sử một cách máy móc
rồi để caller đang giữ khóa Booking; luồng không cần catalog guard tiếp tục
đọc lịch sử mà không lấy nó. Không giữ khóa DB trong lúc gọi provider HTTP.

Nếu booking chốt trước thì xóa thấy PENDING/CONFIRMED và thất bại; nếu xóa chốt
trước thì booking mới bị từ chối. Callback đến sau không phát hành vé. Sync
trước xóa phải hoàn tất rồi xóa kiểm tra lại; sync sau xóa phải thấy dấu xóa.

Xóa phim kiểm tra và đánh dấu toàn bộ phạm vi trong một transaction; một lỗi
hoặc blocker hoàn tác toàn bộ. Đặt thời gian chờ khóa hữu hạn, trả xung đột
khi bận; không gọi API Galaxy/cổng thanh toán trong lúc giữ khóa DB. Không
quét hoặc xóa hàng loạt khóa Redis; giữ cơ chế token/TTL và cleanup hiện có.
Timeout phải có hiệu lực thực sự tại PostgreSQL (kiểm chứng với transaction
đối thủ giữ khóa), không chỉ dựa vào hint JPA có thể bị provider bỏ qua.

## 8. API và xác nhận phạm vi

Giữ DELETE `/api/v1/admin/movies/{id}` và `/api/v1/admin/showtimes/{id}`, thay
hành vi xóa vật lý bằng xóa mềm. Bổ sung GET `.../{id}/deletion-preview` chỉ cho
ADMIN, trả trong ApiResponse: thông tin nhận diện, số suất chưa xóa trong toàn
phim, số blocker theo nhóm, canDelete và scopeToken.

scopeToken là dấu vân tay ổn định của phạm vi và nội dung nhận diện hiển thị,
tính theo thứ tự ID, không phải quyền truy cập. Không dùng bộ nhớ process để
lưu token, không đưa dữ liệu cá nhân vào token. Phạm vi bao gồm các ID suất và
các dữ liệu tên/rạp/phòng/giờ cần xác nhận, không chỉ một số đếm dễ bị trùng.

Preview phải đọc trong một snapshot nhất quán (một truy vấn hoặc transaction
read-only REPEATABLE READ). Số suất, thông tin hiển thị, blockers và token đều
được tính từ cùng snapshot đó; không lấy count ở trước rồi lấy danh sách ID
ở một snapshot mới. Với cùng nội dung xác nhận, token và số đếm phải khớp.

Client gửi token qua `If-Match` khi DELETE. Backend xác thực quyền, khóa và
đọc lại trước so sánh; luôn kiểm tra lại blockers, bất kể token còn đúng.

| Trường hợp | Kết quả |
| --- | --- |
| Không có phiên / không phải ADMIN | 401 / 403 theo cơ chế hiện có |
| ID chưa từng tồn tại | 404 |
| Đã xóa | 200, không ghi đè dấu xóa ban đầu; có thể xác nhận kết quả qua preview |
| Bản ghi còn sống nhưng thiếu xác nhận phạm vi | 428, yêu cầu tải preview |
| Phạm vi/nội dung xác nhận đã đổi | 412, yêu cầu xem và xác nhận lại |
| Có đơn/vé/tiền cần bảo vệ hoặc khóa đang bận | 409, lý do có cấu trúc |
| Đủ điều kiện | 200, thông tin số phim/suất vừa được đánh dấu xóa |

Preview của bản ghi đã xóa trả trạng thái đã xóa cho ADMIN để đối chiếu yêu cầu
bị mất phản hồi; không dùng GET chi tiết công khai để suy đoán DELETE thành công.
GET preview không giữ khóa cho đến lúc người dùng bấm xác nhận, không ghi dữ
liệu hay sinh ghế. DELETE luôn đánh giá snapshot mới nhất dưới khóa.

## 9. Giao diện và cache

- Thêm nút Xóa từng dòng MovieManager/ShowtimeManager, dùng modal chung và
  focus/bàn phím/mobile hiện có. Nêu đây là gỡ khỏi danh sách hoạt động, không
  xóa đơn hoặc số liệu lịch sử; bản đầu chưa có thao tác khôi phục.
- Modal tải preview từ server. Với phim hiện tổng số suất bị ảnh hưởng; với
  suất hiện tên phim/rạp/phòng/giờ Việt Nam. Không lấy số suất từ bảng hiện tại.
- Khi có blocker thì không cho xác nhận; có hành động Kiểm tra lại sau khi
  trạng thái thay đổi. Không hứa rằng chờ hết thời gian giữ ghế chắc chắn xóa được.
  Phân biệt: vé CONFIRMED không được xóa theo quy tắc hiện tại; đơn PENDING
  cần xử lý trạng thái; tiền chưa rõ cần đối soát; khóa bận có thể kiểm tra lại.
  Không gộp thành thông báo chung chờ rồi thử lại cho mọi loại blocker.
- Khi gửi giữ modal mở, khóa nút xác nhận và các cách đóng (nút đóng, Escape,
  bấm nền); chỉ đóng sau thành công. Không gửi lặp, không optimistic remove.
  Lỗi hoặc mất phản hồi giữ nội dung và cho kiểm tra lại. 409 cập nhật lý do;
  412/428 yêu cầu xem preview mới và bấm xác nhận lại, không tự gửi DELETE mới.
- Mất phản hồi hiển thị Chưa xác định kết quả và Kiểm tra lại, chỉ GET preview.
  Nếu đã xóa thì đối chiếu thành công; nếu chưa thì tải preview và để người
  dùng quyết định. Không tự retry DELETE kể cả sau refresh hoặc có mạng lại.
- Sau thành công làm mới cache admin, catalog khách, các lựa chọn phim/suất
  và báo cáo có liên quan; giữ URL bộ lọc, điều chỉnh trang trống nếu cần.
  Lịch sử không biến mất chỉ vì phim/suất bị loại khỏi danh sách hoạt động.
- Cache/modal gắn với phiên admin, hủy phản hồi cũ khi đổi tài khoản; dùng lại
  cơ chế session và mutation hiện có. Không gọi dịch vụ ngoài trực tiếp từ UI.

## 10. Kiểm chứng bắt buộc trước bàn giao tính năng

Chưa chạy kiểm thử tính năng trong giai đoạn thiết kế. Các mục dưới đây là
tiêu chí nghiệm thu, không phải kết quả đã đạt.

| Lớp kiểm chứng | Các tình huống chính |
| --- | --- |
| Unit/service và phân quyền | 401/403, danh tính người xóa, từng blocker, nhiều attempt, PENDING quá hạn, xóa lặp, giữ dấu cũ, rollback toàn bộ, scopeToken/412/428; schema prod validate |
| Importer và worker chi tiết | Online ba nguồn, limited/full, local JSON/file, phim chặn session mới, xóa riêng suất, tên local trùng bản ghi đã xóa, đối soát, claim sau khi xóa, phản hồi chi tiết đến muộn, số đếm loại trừ |
| Catalog và lịch sử | Danh sách/chi tiết/chatbot không lộ dữ liệu xóa; sơ đồ có inventory vẫn bị chặn; không sinh ghế khi preview/xóa; lịch sử/báo cáo giữ dữ liệu |
| PostgreSQL/Redis thật trong môi trường thử | SQL dấu xóa/actor, giao dịch nguyên tử, hai backend context cùng DB, xóa so với booking/sync/tạo suất/callback bằng barrier/latch và timeout hữu hạn; thêm suất xen giữa các truy vấn preview không làm count/token lệch nhau |
| Thanh toán | Đơn hết hạn nhưng attempt chưa chốt chặn xóa; callback đến muộn không phát vé sau xóa, gồm attempt FAILED trước xóa; nhận tiền gắn đúng attempt, REFUND_REQUIRED không tự hoàn; phân biệt gửi trùng và kết quả mâu thuẫn, giữ giao dịch cũ; hai đơn tranh cùng provider transactionId chỉ một được ghi nhận |
| Edge mô phỏng riêng | Modal/preview, số suất ngoài bộ lọc, blocker, 409/412/428, mất phản hồi, không retry, cập nhật cache, phân trang, đổi phiên, bàn phím và 390px |
| HTTP/Edge với ứng dụng và DB thử thật | Hành trình ADMIN/CUSTOMER, DELETE thật, API/SQL đối chiếu; tạo lại application context trên cùng DB thử rồi chạy importer fixture xác nhận dấu xóa vẫn có hiệu lực |

Đồng thời chạy lint/unit/build frontend và hồi quy backend liên quan tới
catalog, booking, checkout, thanh toán, sync và báo cáo. Báo riêng kiểm thử
mô phỏng, DB/Redis thật và những tích hợp ngoài chưa chạy. Fixture sync/cổng
thanh toán không chứng minh Galaxy/VNPay bên ngoài hoạt động thật.

Không xóa phim/suất hoặc thay đổi cấu hình DB vận hành để nghiệm thu. Dùng
PostgreSQL/Redis thử riêng và helper hiện có, dừng đúng các tiến trình thử đã
tạo, giữ log/artifact để đối chiếu. Không tự commit/push hoặc khởi động lại
backend người dùng đang dùng trong giai đoạn thiết kế.

## 11. Triển khai schema và phiên bản ứng dụng

Đây là yêu cầu bàn giao cho bước triển khai, chưa thực hiện trên hệ thống:

1. Chuẩn bị SQL bổ sung cột nullable/chỉ mục/ràng buộc tương thích dữ liệu hiện
   có, kiểm tra dữ liệu xung đột trước tạo UNIQUE. Không xóa dữ liệu, không tự
   suy ra người xóa hoặc giao dịch provider còn thiếu bằng phỏng đoán.
2. Áp dụng và nghiệm thu trên DB thử; kiểm tra backend profile prod với
   `ddl-auto=validate`, không dựa vào dev update để coi schema hoàn tất.
3. Khi triển khai thực tế, tạm dừng thao tác ghi, dừng toàn bộ instance/worker
   cũ; bổ sung schema và chạy toàn bộ instance bằng phiên bản hiểu dấu xóa.
   Chỉ cho sử dụng chức năng xóa và bật lại worker sau khi đối chiếu phiên bản.
4. Không chạy đồng thời backend cũ không hiểu dấu xóa với backend mới khi đã
   cho phép xóa. Rollback sau khi có dấu xóa chỉ dùng phiên bản vẫn tôn trọng
   dấu xóa; không quay về bản cũ hoặc xóa dấu xóa để làm ứng dụng cũ chạy được.

Chưa cam kết zero-downtime hoặc rolling deployment cho phần mở rộng quy mô
đồ án này. Không tự chạy các bước triển khai thực tế trong giai đoạn thiết kế.

## 12. Nhật ký quyết định

| Mã | Quyết định | Phương án cân nhắc và lý do | Trạng thái |
| --- | --- | --- | --- |
| D01 | Chặn xóa khi có đơn PENDING/CONFIRMED | Người dùng chọn A thay vì gỡ khỏi bán dù đã có vé; bảo vệ cam kết với khách | Người dùng xác nhận |
| D02 | Xóa phim kèm các suất đủ điều kiện, nguyên tử | Người dùng chọn A thay vì buộc xóa từng suất; xác nhận rõ phạm vi | Người dùng xác nhận |
| D03 | Xóa mềm giữ mã Galaxy | Chọn A thay danh sách loại trừ riêng + xóa vật lý có điều kiện; giữ liên kết và một nguồn trạng thái | Người dùng xác nhận |
| D04 | Dấu xóa riêng, loại khỏi bán nhưng giữ lịch sử | Không dùng ENDED/inactive làm dấu xóa vì sync có thể sửa; không lọc Hibernate toàn cục | Người dùng xác nhận phần dữ liệu |
| D05 | Mọi đường sync và chi tiết tôn trọng dấu xóa | Không chỉ chặn ở scheduler hoặc UI; phim đã xóa chặn cả session mới của phim | Người dùng xác nhận phần dữ liệu |
| D06 | Kiểm tra dưới khóa, phối hợp booking/sync/tạo suất/thanh toán | Không chỉ kiểm tra trên preview; không khóa toàn cục mọi khách mua vé | Người dùng xác nhận phần giao dịch; đã rà soát kỹ thuật, cần chứng minh bằng kiểm thử khi triển khai |
| D07 | Kiểm tra tiền chưa chốt; callback muộn không phát vé sau xóa | Không coi EXPIRED là chắc chắn không còn tiền; dùng REFUND_REQUIRED hiện có, không tự hoàn | Người dùng xác nhận phần thanh toán |
| D08 | Preview có token phạm vi, DELETE kiểm tra lại | Không đếm suất từ bảng đang lọc hoặc tin lần kiểm tra cũ; API chi tiết hóa bằng If-Match | Người dùng xác nhận luồng UI/API |
| D09 | Không tự retry hoặc xóa hàng khỏi UI trước phản hồi | Đối chiếu qua GET khi chưa rõ kết quả; tránh báo thành công sai | Người dùng xác nhận luồng lỗi |
| D10 | Không có khôi phục/hàng loạt/hủy vé/hoàn tiền tự động | Giới hạn phạm vi đã chốt, không thêm chức năng trong rà soát | Người dùng xác nhận |
| D11 | Báo riêng mô phỏng và kiểm chứng môi trường thử thật | Không coi fixture là API ngoài thật; không dùng DB vận hành để thử | Người dùng xác nhận chiến lược kiểm thử |
| D12 | Cập nhật schema và toàn bộ instance trước mở xóa; rollback phải hiểu dấu xóa | Không chạy mã cũ làm hồi sinh dữ liệu; dùng kế hoạch triển khai có bước dừng ghi thay vì thêm hạ tầng rolling deployment | Làm rõ từ rà soát ràng buộc, không thay đổi mục tiêu |
| D13 | Danh tính giao dịch provider duy nhất, gắn đúng attempt | Không chỉ khóa Booking vì hai đơn có thể tranh cùng transactionId; giữ dữ liệu đối soát, không thêm ledger/hoàn tiền | Làm rõ từ rà soát ràng buộc, cần kiểm chứng DB |

## 13. Rà soát thiết kế và bàn giao

Theo yêu cầu của skill brainstorming cho thiết kế ảnh hưởng booking/thanh toán,
chuyển thiết kế và nhật ký quyết định sang `multi-agent-brainstorming`.
Các vai trò rà soát lần lượt, không tự triển khai hoặc bổ sung yêu cầu:

1. Skeptic / Challenger: REVISE ban đầu; đã tiếp nhận và sửa S01–S04 dưới đây.
2. Constraint Guardian: REVISE ban đầu; đã tiếp nhận và sửa C01–C04 dưới đây.
3. User Advocate: không có blocker phương án A; đã làm rõ U01–U02 trước bàn giao.
4. Integrator / Arbiter: **APPROVED**, không còn blocker thiết kế; đủ điều kiện
   chuyển sang lập kế hoạch triển khai. Chấp nhận toàn bộ phản biện và cách xử
   lý S01–S04, C01–C04, U01–U02; không có phản biện bị bác bỏ hoặc để ngỏ.

| Mã | Phản biện | Quyết định xử lý và lý do |
| --- | --- | --- |
| S01 | D07: FAILED trả sớm có thể bỏ qua thành công thực tế sau xóa | Tiếp nhận; mục 6 phân loại callback thành công hợp lệ trước early return cho dữ liệu đã xóa, lưu bằng chứng theo attempt, phân biệt trùng/mâu thuẫn; bổ sung test, không thêm hoàn tiền tự động |
| S02 | D08: count và token có thể đọc hai snapshot khác nhau | Tiếp nhận; mục 8 bắt buộc snapshot nhất quán cho toàn bộ preview; DELETE vẫn kiểm tra dưới khóa; thêm test tạo suất xen giữa đọc preview |
| S03 | D05: claim chi tiết phim có thể ghi sau xóa | Tiếp nhận; câu bulk UPDATE cũng lọc deletedAt IS NULL, thêm test race claim |
| S04 | D05: Optional findByTitle có thể chọn nhầm/lỗi khi còn bản ghi xóa mềm trùng tên | Tiếp nhận; lọc nguồn/xóa ngay trong query nhận local và chọn xác định; thêm test trùng tên |
| C01 | D03/D05: mã cũ không hiểu dấu xóa khi rollout hoặc rollback | Tiếp nhận; mục 11 quy định schema, dừng phiên bản/worker cũ trước mở xóa, prod validate và rollback tương thích; không xóa dấu để hạ phiên bản |
| C02 | D07: cùng giao dịch provider có thể ghi vào hai attempt/đơn | Tiếp nhận; mục 6 yêu cầu chuẩn hóa danh tính, UNIQUE theo provider/transactionId, xử lý conflict/legacy và kiểm chứng tranh chấp hai đơn |
| C03 | Mục 2/6: kiểm tra blocker có thể quét toàn bộ Booking | Tiếp nhận; mục 4 xét chỉ mục theo showtime/status và kế hoạch truy vấn, không N+1 |
| C04 | D06: các caller đang giữ Booking có thể gây đảo thứ tự khóa mới | Tiếp nhận; mục 7 liệt kê bảng đường gọi cần rà soát, không gắn guard máy móc vào đọc lịch sử, xác minh timeout PostgreSQL thật |
| U01 | D09: câu khóa nút xác nhận và đóng modal có thể hiểu là tự đóng khi gửi | Tiếp nhận; mục 9 giữ modal mở, khóa nút/các cách đóng lúc request đang chạy, chỉ đóng sau thành công; lỗi/không rõ kết quả giữ nội dung |
| U02 | D01/D07: thông báo thử lại chung có thể khiến admin nghĩ chờ sẽ xóa được vé CONFIRMED | Tiếp nhận; mục 9 phân biệt vé đã xác nhận, PENDING cần xử lý, tiền cần đối soát và khóa tạm bận |

Phán quyết trên chỉ phê duyệt thiết kế. Sau đó người dùng yêu cầu lập kế hoạch
và triển khai; kết quả kiểm chứng mới được lưu riêng trong kế hoạch triển khai
và admin-portal-plan.md. Không dùng số liệu nghiệm thu cũ để đánh dấu tiêu chí mới.
