# Thiết kế trang Checkout

Ngày: 09/11/2026 (Asia/Ho_Chi_Minh).

Trạng thái: Người dùng đã xác nhận phạm vi, giả định, phương án 1, bố cục,
luồng dữ liệu, xử lý lỗi và kiểm thử. Rà soát kỹ thuật đã hoàn tất với phán
quyết APPROVED của Integrator/Arbiter. Đã triển khai và kiểm chứng ngày
09/11/2026; phạm vi và giới hạn kiểm chứng được ghi ở cuối tài liệu.

## Phạm vi đã xác nhận

- Xây dựng `/checkout/:bookingCode` cho khách đã đăng nhập và giữ ghế.
- Sau khi giữ ghế thành công, chuyển sang Checkout bằng mã đơn backend trả về.
- Hiển thị phim, rạp, phòng, suất chiếu, ghế, combo và tổng tiền của đơn.
- Đếm ngược theo `expiresAt`; tải lại trang hoặc quay lại tab không gia hạn.
- Cho chọn combo bắp nước và VNPay/MoMo Sandbox trên một trang.
- Chỉ lưu combo khi bấm “Thanh toán ngay”, sau đó tạo URL thanh toán.
- Bổ sung API cập nhật combo cho đơn đang chờ thanh toán còn hạn.
- Cho hủy giữ chỗ để chọn lại ghế, có xác nhận và chờ backend hủy thành công.
- Xử lý đăng nhập, quyền sở hữu, hết hạn, lỗi mạng, thay đổi giá và nhiều tab.
- Trang kết quả thanh toán, vé điện tử, QR, chatbot và admin là các bước sau.

## Giả định và yêu cầu phi chức năng

- Dùng nền tối, điểm nhấn đỏ, font và MainLayout hiện có; hỗ trợ desktop/mobile.
- Phục vụ quy mô đồ án hiện tại và danh mục combo nhỏ. Nhiều người dùng có thể
  checkout đồng thời; chưa cam kết chỉ tiêu tải, độ trễ hoặc SLA mới.
- Countdown chạy trên trình duyệt, không gọi API mỗi giây. Thời hạn và quyền
  thanh toán thực tế luôn được backend kiểm tra lại. Dùng thời gian server
  và một Clock giờ Việt Nam thống nhất, không phụ thuộc đồng hồ máy khách.
- Đơn, giá, quyền sở hữu, trạng thái và kết quả thanh toán do backend quyết định.
  Frontend không giữ khóa cổng thanh toán, không xác nhận thành công bằng query
  parameter, không coi số tiền client gửi lên là giá có thẩm quyền.
- Tải lại trang phải lấy đơn từ API. Cache đơn gắn với tài khoản và mã đơn;
  phản hồi của tài khoản cũ không được hiển thị sau khi đổi tài khoản.
- Khi mất mạng, bảo toàn thông tin đã lưu và không tự gửi lại POST tạo thanh
  toán. Trường hợp chưa biết cổng đã nhận yêu cầu hay chưa phải được hiển thị rõ.
- Dùng tiếp React Router, TanStack Query, Axios/service và Spring Boot hiện có.
  Thay đổi backend tập trung vào cập nhật combo và bảo vệ việc chốt thanh toán.
- Tài khoản Sandbox, khóa hợp lệ và URL IPN truy cập được từ cổng thanh toán
  là điều kiện cho kiểm thử trực tiếp. Không đưa thông tin bí mật vào tài liệu.
- Các thay đổi Git đang có, gồm bỏ theo dõi metadata và `application.yml`,
  phải được giữ nguyên; không commit hoặc push trong công việc thiết kế.

## Nhật ký quyết định

| Quyết định | Phương án đã cân nhắc | Lý do và trạng thái |
| --- | --- | --- |
| Checkout đầy đủ: vé, countdown, combo, VNPay/MoMo | Làm thanh toán trước combo; chỉ làm vé/countdown | Người dùng chọn phạm vi 1 và xác nhận bản tóm tắt. |
| Một trang, lưu combo khi bấm thanh toán | Tự lưu từng lần đổi số lượng; chia thành nhiều màn hình | Người dùng chọn phương án 1; ít request và dễ bảo trì. |
| Giữ theme tối/đỏ, hai cột desktop và một cột mobile | Phong cách riêng hoặc nhiều bước | Nhất quán dự án; bố cục đã được xác nhận. |
| Dùng `expiresAt` có sẵn, không đặt lại 10 phút | Tạo timer mới khi vào Checkout | Không gia hạn giữ ghế khi reload hoặc chọn combo; đã xác nhận. |
| Backend tính lại tiền, xác nhận giá mới trước khi tạo URL | Tin tổng tiền frontend; tạo URL ngay khi giá thay đổi | Người dùng xác nhận quy tắc không thanh toán âm thầm bằng giá khác. |
| Kiểm tra phiên bản đơn và chốt combo khi bắt đầu thanh toán | Chỉ khóa nút phía frontend | Ngăn tab khác thay đổi đơn giữa lưu combo và tạo URL; đã xác nhận. |
| Hủy rõ ràng qua API, chỉ điều hướng sau thành công | Tự hủy khi đóng tab hoặc unload | Luồng đã xác nhận; không phụ thuộc sự kiện unload. |
| Không tự retry POST hoặc giả kết quả thanh toán | Gửi lại mù khi timeout; URL callback giả thành công | Luồng lỗi đã xác nhận; phải phân biệt lỗi chắc chắn và kết quả chưa biết. |
| Thực hiện callback/QR ở bước kế tiếp | Gộp toàn bộ vé điện tử vào Checkout | Giữ phạm vi đã xác nhận. |

## Bố cục được duyệt

Đầu trang có tiêu đề “Hoàn tất đặt vé”, tiến trình “Chọn ghế → Thanh toán →
Kết quả” và thời gian giữ ghế còn lại.

Desktop dùng hai cột. Cột trái hiển thị thẻ combo với ảnh, tên, mô tả ngắn,
đơn giá và nút tăng/giảm từ 0; bên dưới là lựa chọn VNPay/MoMo Sandbox.
Cột phải sticky hiển thị thông tin vé, các vị trí ghế, tiền vé, combo đã chọn,
tổng tạm tính và nút “Thanh toán ngay”. Ghế đôi giữ nguyên hai vị trí và giá
đã lưu trong đơn, không tính lại bằng công thức loại ghế ở frontend.

Mobile xếp thông tin vé/countdown trước, tiếp đến combo và phương thức thanh
toán. Thanh tổng tạm tính/nút thanh toán ghim cuối màn hình, có khoảng đệm
để không che nội dung hoặc vùng an toàn của thiết bị.

Nút “Hủy giữ ghế để chọn lại” mở xác nhận. Có skeleton, thông báo lỗi/thử lại,
danh mục combo trống, ảnh fallback và trạng thái đang lưu/tạo thanh toán.

## Thành phần và dữ liệu

- Route lazy-load `checkout/:bookingCode` dưới MainLayout.
- Feature Checkout tổ chức trong phần booking, tách phần gọi API, quản lý
  dữ liệu, countdown, combo, phương thức và tóm tắt đơn khi cần tái sử dụng.
- Tái sử dụng `bookingService`, `formatCurrency`, AuthModal và cách đọc thời
  gian giữ ghế; bổ sung product service và triển khai payment service đang rỗng.
- Query đơn phân biệt tài khoản/mã đơn. Lựa chọn combo tạm nằm trong trang;
  không ghi đè lựa chọn đang chỉnh bằng một phản hồi refetch cũ.
- Danh mục combo và đơn tải độc lập. Lỗi combo không xóa combo đã lưu trong đơn.
- Khi EDITABLE mà catalog lỗi/chưa tải xong, chặn nút bắt đầu thanh toán và
  cho thử lại; không biến dữ liệu thiếu thành `products: []`. Vẫn hiển thị
  combo đã lưu. READY tiếp tục URL cũ không phụ thuộc việc tải lại catalog.
  Combo đã lưu nhưng ngừng bán vẫn hiện cảnh báo và cho bỏ rõ ràng.
- Nếu có đơn giữ ghế được khôi phục ở trang chọn ghế, có đường tiếp tục đến
  đúng Checkout; không POST tạo thêm đơn cho cùng lượt giữ ghế.

## Hợp đồng cập nhật combo đề xuất

`PUT /api/v1/bookings/{bookingCode}/products` thay toàn bộ lựa chọn combo,
nhận `{expectedRevision, products: [{productId, quantity}]}`; expectedRevision
là checkoutRevision của đơn khách đang xem. POST create-url cũng bổ sung
expectedRevision bên cạnh bookingCode/paymentMethod hiện tại.
Danh sách rỗng nghĩa là bỏ combo; số lượng 0 được frontend loại khỏi request.

Backend xác thực người dùng, khóa bản ghi booking trong transaction rồi
kiểm tra quyền, trạng thái `PENDING`, hạn giữ, phiên bản và trạng thái tạo
thanh toán. Kiểm tra ID, số lượng nguyên dương, sản phẩm còn bán và giá hợp
lệ; tổng tiền phải nằm trong giới hạn dữ liệu tiền tệ đang dùng.

Tổng vé dùng giá đã lưu trong `BookingSeat`; combo được tính lại từ catalog.
Cập nhật các dòng combo và tổng tiền nguyên khối, giữ nguyên `expiresAt`,
ghế và TTL Redis. Gửi lại cùng lựa chọn không được cộng dồn số lượng.
Tiền qua cổng dùng VND nguyên, kiểm tra chuyển đổi chính xác; không cắt bỏ
phần lẻ bằng longValue hoặc làm tròn để che dữ liệu giá không hợp lệ.

Phản hồi trả chi tiết đơn đã lưu và dấu phiên bản mới. Phiên bản không khớp
luôn trả 409 trước khi cập nhật, kể cả khi danh sách ID/số lượng trông giống
nhau. Sau lỗi mạng, GET lại đơn để biết PUT trước đó có được lưu hay không.
Thay toàn bộ lựa chọn bảo đảm gửi lặp không cộng dồn sản phẩm; phản hồi HTTP
của request lặp vẫn có thể khác vì phiên bản đã thay đổi.

`checkoutRevision` là SHA-256 của JSON chuẩn hóa UTF-8, có nhãn phiên bản
định dạng. Nội dung gồm bookingCode, trạng thái, deadline epoch milliseconds, danh sách ID ghế/
giá vé đã lưu, danh sách ID combo/số lượng/đơn giá đã lưu và tổng tiền.
ID là chuỗi thập phân, các mảng sắp ID tăng dần, tiền là chuỗi thập phân
đúng hai chữ số lẻ với dấu chấm; giữ thứ tự trường cố định. Không dùng JSON
số thực, tên/ảnh hoặc thứ tự phần tử client gửi lên. Từ chối ID trùng.

Revision phản ánh giá đã lưu trong đơn, không trộn giá catalog đang đổi
vào phép băm. PUT mới tính lại combo theo catalog. Client so sánh từng đơn
giá và tổng backend trả với lựa chọn đã thấy; nếu thay đổi thì hiển thị rõ
và chỉ POST tạo URL sau một lần xác nhận chủ động. Request POST gửi revision
của đúng snapshot đã xác nhận. Tab khác đổi combo, kể cả cùng tổng tiền,
phải tạo revision khác. Client không tự tính revision.

Nếu khách từ chối giá mới, đóng xác nhận và trở lại chỉnh combo, không tạo
URL và không hủy giữ ghế. Snapshot backend vừa lưu vẫn là nguồn dữ liệu hiện
tại; hiển thị giá mới rõ ràng, hạn giữ vẫn tiếp tục chạy.

## Luồng thanh toán và kiểm soát đồng thời

1. Sau POST giữ ghế thành công, điều hướng đến Checkout. GET chi tiết đơn từ
   backend, kiểm tra quyền/trạng thái và lấy catalog combo.
2. Người dùng chỉnh lựa chọn tạm. Hiển thị “Tạm tính”; không gọi PUT mỗi lần bấm.
3. Bấm “Thanh toán ngay”: chặn bấm lặp, chụp lựa chọn/phương thức và PUT combo.
4. So sánh các đơn giá/tổng tiền backend vừa trả với phần khách đã thấy. Nếu
   có thay đổi, hiển thị giá mới và yêu cầu xác nhận; không tạo URL ngay.
5. POST `/payments/create-url` kèm mã đơn, phương thức và phiên bản đã xác
   nhận. Backend kiểm tra lại dưới cùng cơ chế khóa booking với PUT combo.
6. Khi bắt đầu tạo phiên thanh toán, chốt giỏ hàng, số tiền và phương thức.
   Tab khác không được sửa combo hoặc tạo phiên khác để thay số tiền đã chốt.
7. Chỉ điều hướng đến URL cổng được backend xác nhận hợp lệ, cho phép đúng
   HTTPS/host Sandbox theo cấu hình. Không điều hướng tới URL callback giả.

Việc khóa nút ở frontend không thay cho bảo vệ server. PUT, đặt trước phiên
thanh toán, hủy, IPN và hết hạn lấy khóa booking trước, sau đó khóa các ghế
liên quan theo ID tăng dần khi cần sửa ghế. Khóa chỉ lấy trên bản ghi chính,
không dùng join fetch nullable để khóa PostgreSQL. Danh sách ứng viên từ cron
chỉ dùng để chọn ID; phải đọc lại trạng thái/deadline sau khi lấy khóa.

Nhánh dọn ghế mồ côi cũng phải khóa ghế ứng viên và kiểm tra lại trạng thái,
lockedUntil, chủ/lượt giữ hiện tại và quan hệ với đơn còn hiệu lực. Nhánh
này không lấy thêm khóa booking sau khóa ghế: nếu cần xử lý một booking thì
chuyển sang luồng booking-first. Không nhả ghế mới hoặc BOOKED từ danh sách
ứng viên cũ. IPN chỉ xác nhận booking sau khi kiểm tra các ghế dưới khóa.

Redis/WebSocket phát sinh từ transaction chỉ thực hiện sau commit, theo đúng
những ghế thực sự thay đổi. Nhả Redis phải compare-and-delete đúng token của
lượt giữ, không xóa key của lượt mới; cùng userId không đủ phân biệt hai lượt.
Thông báo ghế cần thứ tự/version để client không vá một RELEASE cũ lên HOLD
mới. Đây là bảo vệ hẹp cho các đường ghi cạnh tranh với Checkout, không phải
thay kiến trúc khóa hai tầng hay xây hệ thống messaging mới.

Post-commit là best-effort có bắt lỗi và log; lỗi Redis/publication không
được biến một hủy/giữ/thanh toán đã commit thành phản hồi “đã rollback”. DB
là nguồn có thẩm quyền. Không hứa delivery bền vững hoặc thêm outbox trong
phạm vi đồ án này. Mất thông báo được sửa bằng GET khi focus/reconnect và
làm mới sơ đồ định kỳ khoảng 30 giây khi trang đang hiển thị; lỗi mạng phải
hiện trạng thái chưa đồng bộ. GET Checkout cũng làm mới khi quay lại tab.

Nếu không nhả được một key Redis cũ, key chỉ được phép tồn tại đến TTL gốc
(tối đa thời gian giữ ghế cấu hình, mặc định 600 giây), không gia hạn. Khách
có thể tạm chưa chọn lại được ghế đó dù hủy đã commit; giao diện cần báo
trạng thái phù hợp và backend từ chối an toàn. Đây là giới hạn sẵn sàng đã
ghi nhận, không phải bảo đảm phục hồi ngay sau mọi lỗi hạ tầng. Kiểm thử phải
chứng minh rollback không phát event và lỗi sau commit không sửa kết quả DB.

## Tạo phiên lặp và kết quả chưa biết

Đây là phần bảo vệ cần bổ sung vào backend hiện tại, không phải hành vi đang có.

- Giữ ràng buộc một Payment/booking hiện có. Lưu attempt tạo thanh toán riêng
  để giữ lịch sử định danh cổng và chỉ cho một attempt chưa kết thúc trên cùng
  booking. Bản ghi gồm attemptId, Payment/booking, phương thức, revision/giá
  đã chốt, provider orderId/requestId/transaction reference, trạng thái tạo,
  thời điểm/lease tạo, deadline và URL đã nhận. Không lưu khóa ký hoặc bí mật
  merchant trong attempt. URL đầy đủ có thể chứa chữ ký/token nên được lưu
  như dữ liệu nhạy cảm để tiếp tục phiên; chỉ cấp qua API đã kiểm tra quyền.
- Tách trạng thái tạo URL khỏi kết quả tài chính `PaymentStatus`; không dùng
  “đang tạo URL” để suy ra đã thanh toán.
- Dùng transaction ngắn để đặt trước ngữ cảnh, kết thúc transaction rồi mới
  gọi MoMo với timeout hữu hạn. Ghi kết quả bằng transaction ngắn tiếp theo.
  Không giữ khóa DB trong khi chờ phản hồi HTTP của cổng.
- Với URL đã có và đơn còn hợp lệ, yêu cầu lặp cùng ngữ cảnh trả lại URL đó.
  Không tạo orderId mới chỉ vì client bấm lại hoặc mất phản hồi.
- Trong lúc tạo hoặc chưa rõ kết quả, server giữ số tiền/phương thức đã chốt.
  GET đơn cung cấp trạng thái đủ cho frontend hiển thị “đang kiểm tra” và
  đồng bộ lại. Không tự mở quyền sửa combo vì một timeout.
- Yêu cầu bị cổng từ chối chắc chắn được phân biệt với timeout/mất kết nối.
  Chỉ đánh dấu REJECTED khi có bằng chứng cổng cho biết không có giao dịch
  còn khả năng thu tiền. REJECTED cho phép chỉnh combo/phương thức và thử lại
  trong hạn cũ; attempt cũ được giữ để đối chiếu. Không suy luận điều này chỉ
  từ mã HTTP, lỗi mạng hoặc một trường resultCode không được phân loại rõ.
- Nếu không thể xác định kết quả trong phạm vi tích hợp hiện tại, hiển thị
  trạng thái chưa biết, chặn tạo giao dịch mới và cho kiểm tra lại đơn. Không
  cam kết tự phục hồi hoàn toàn; đây là đánh đổi độ sẵn sàng để giữ nhất quán.
- Hết hạn/đã hủy trong lúc cổng trả lời thì không trả URL để thanh toán mới.
  Xử lý IPN đến muộn tiếp tục theo chính sách backend, không để client ghi
  lại `PENDING` hoặc `CONFIRMED`.

Quy tắc đóng băng chỉ áp dụng khi còn attempt có thể nhận thanh toán hoặc
kết quả chưa biết. Không bắt người dùng tạo lượt giữ ghế mới sau mọi lỗi.
Khi có phiên đang hoạt động, hiển thị: “Đơn đã bắt đầu thanh toán. Combo và
phương thức đang được giữ nguyên để tránh tạo giao dịch trùng.” Nếu chưa rõ
kết quả: “Chưa xác định được kết quả kết nối. Vui lòng kiểm tra lại trạng thái.”

### Trạng thái tạo và tiếp tục phiên

Đây là trạng thái tạo URL, tách khỏi BookingStatus và kết quả tài chính.
`GET /bookings/{code}` bổ sung checkoutRevision và checkout gồm state,
canEditProducts, phương thức đang chốt, deadline và URL tiếp tục nếu hợp lệ.
Chỉ owner/admin được đọc; không trả định danh kỹ thuật hoặc URL cho khách khác.
Log chỉ ghi attemptId/bookingCode, provider, trạng thái và mã lỗi đã lọc;
không ghi URL đầy đủ, chữ ký, token hoặc nguyên bộ tham số IPN. Xóa các dòng
log hiện tại đang xuất full URL/IPN parameters trong phạm vi tích hợp này.

| Trạng thái | Điều kiện và chuyển tiếp | Thao tác của khách |
| --- | --- | --- |
| EDITABLE | Chưa có attempt đang hoạt động; POST hợp lệ đặt trước CREATING. | Chọn combo/phương thức, PUT rồi POST bằng revision đã xác nhận. |
| CREATING | Intent đã commit, có một worker đang tạo URL trong lease hữu hạn. Kết quả hợp lệ → READY; bằng chứng từ chối → REJECTED; timeout/crash/quá lease → UNKNOWN. | Chờ hoặc kiểm tra lại đơn; không PUT/tạo attempt mới. |
| READY | URL hợp lệ đã lưu, đơn còn PENDING và trong hạn. | Nút “Tiếp tục thanh toán” dùng URL đã lưu; không PUT combo trước. |
| UNKNOWN | Có thể đã gửi ra cổng, chưa đủ bằng chứng xác định kết quả. Đối soát đúng attempt → READY/REJECTED/kết quả tài chính; không tạo định danh mới. | Kiểm tra lại; không sửa giỏ hoặc gửi lại mù. |
| REJECTED | Cổng xác nhận attempt không còn có thể thu tiền. Attempt được đóng và lưu lịch sử; đơn hợp lệ trở về EDITABLE. | Có thể chỉnh lựa chọn hoặc thử lại bằng hành động chủ động. |
| CLOSED | Booking CONFIRMED/CANCELLED/EXPIRED hoặc deadline đã qua. | Hiển thị kết quả phù hợp, không bắt đầu thanh toán mới. |

Mất tiến trình trước commit intent không tạo attempt. Crash sau commit nhưng
trước HTTP cũng trở thành UNKNOWN vì worker khác không biết HTTP đã gửi chưa.
Crash sau phản hồi cổng nhưng trước lưu URL phục hồi bằng đúng định danh cũ.
Kết quả HTTP đến sau IPN/hủy/hết hạn chỉ được bổ sung bằng chứng cho đúng
attempt, không đưa booking/financial state về PENDING hoặc tự mở lại Checkout.
Worker cũ sau khi hết lease không được ghi đè một kết quả mới hơn.

Luồng EDITABLE mới thực hiện PUT → POST. READY tiếp tục URL có sẵn; CREATING/
UNKNOWN chỉ đồng bộ trạng thái. Gửi lặp cùng attempt/revision/phương thức trả
lại kết quả đã lưu hoặc trạng thái chờ; sai ngữ cảnh trả xung đột. Mở GET
không kích hoạt giao dịch mới hoặc tự gọi create của cổng.

### Ràng buộc IPN

Xác thực chữ ký và đối chiếu provider/merchant, định danh attempt/reference,
orderId/requestId khi cổng cung cấp, số tiền và đơn vị theo ngữ cảnh đã lưu.
Không chỉ cắt prefix bookingCode hoặc tự tạo Payment khi không thấy bản ghi.
VNPay TxnRef của attempt mới và MoMo orderId phải ánh xạ về đúng attempt;
requestId dùng đối chiếu theo loại callback thực tế của cổng.

IPN đến sớm sau commit intent vẫn có ngữ cảnh để kiểm tra. IPN trùng không
bán vé/nhả ghế/phát fulfillment lần nữa. SUCCESS không bị IPN lỗi hoặc worker
HTTP cũ đưa về FAILED; REFUND_REQUIRED/REFUNDED không bị thông báo lặp đưa về
PENDING. IPN sau CANCELLED/EXPIRED áp dụng chính sách hiện có với kiểm tra
quyền sở hữu/trạng thái ghế dưới khóa, không ghi đè lượt giữ mới.

Payment cũ thiếu định danh attempt không được tự gán một định danh mới rồi
coi là giao dịch chưa gửi. Giữ nguyên lịch sử, phân loại chưa xác định và
xử lý bảo thủ đến khi có bằng chứng đối soát hoặc hết/hủy đơn.

### Căn cứ tích hợp MoMo

MoMo mô tả requestId là khóa idempotency; vì vậy phục hồi phải giữ đúng ID
và nội dung của yêu cầu cũ. Gửi lại có thể trả trạng thái đang xử lý, không
được diễn giải thành từ chối chắc chắn. Tham khảo [API Idempotency](https://developers.momo.vn/v3/docs/payment/api/result-handling/idempotency/).

Có API truy vấn theo orderId để lấy trạng thái. API này không được coi là
nguồn chắc chắn trả lại payUrl; phục hồi URL chỉ thực hiện khi có phản hồi
create hợp lệ hoặc URL đã lưu. Tham khảo [Check Transaction Status](https://developers.momo.vn/v3/docs/payment/api/payment-api/query/).

Phân loại kết quả theo [List Result Codes](https://developers.momo.vn/v3/docs/payment/api/result-handling/resultcode/),
không xem mọi resultCode khác 0 là terminal/no-order. Ngưỡng timeout/lease
phải tương thích thời gian chờ theo hợp đồng cổng và được ghi vào cấu hình.

## Countdown, hủy và trạng thái đơn

- Backend dùng Clock với zone Asia/Ho_Chi_Minh cho tạo hold, kiểm tra hạn và
  cron liên quan; không dùng timezone mặc định của host để so deadline.
- Giữ `expiresAt` cũ cho caller hiện tại; bổ sung `serverTime` dạng Instant
  và `checkout.expiresAt` có offset/Instant rõ ràng. Countdown Checkout dùng
  khoảng cách hai mốc server này, neo vào đồng hồ monotonic của trình duyệt
  và tính lại mỗi nhịp; không tin Date.now của máy khách hoặc trừ dồn số giây.
  Ước lượng thời gian truyền từ request/response để không cộng thêm thời gian.
- Khi quay lại tab hoặc sau sleep, lấy lại trạng thái/time baseline trước
  khi cho thanh toán. Tại 0, GET server có thể hiệu chỉnh thời gian còn lại
  nếu chỉ là sai số truyền/hiển thị; client không tuyên bố hết hạn chỉ từ
  đồng hồ cục bộ. Đổi timezone/đồng hồ máy khách không làm đặt lại hạn giữ.
- Tại 0, khóa thao tác tạo thanh toán và GET đơn. `CONFIRMED` được ưu tiên
  hiển thị đã thanh toán; không báo hết hạn cho đơn đã được xác nhận.
- `EXPIRED`, `CANCELLED` hoặc `PENDING` đã quá deadline đều không được tạo URL
  mới. Hiện thông báo phù hợp và nút về trang chủ; backend thực hiện nhả ghế.
- Lỗi GET tại thời điểm hết giờ không được suy ra thành công; tiếp tục khóa
  thao tác, thông báo chưa kiểm tra được và cho thử lại.
- Hủy rõ ràng: xác nhận → DELETE cancel → vô hiệu hóa cache liên quan → về
  sơ đồ cùng suất. Lỗi hủy giữ người dùng ở Checkout với thông báo.
- Xác nhận hủy theo trạng thái: EDITABLE nói rõ ghế sẽ được trả lại. Với
  CREATING/READY/UNKNOWN, phải thêm “Hủy giữ ghế không hủy giao dịch tại cổng.
  Giao dịch có thể vẫn trả kết quả và cần được kiểm tra riêng.” Nút xác nhận
  là “Vẫn hủy giữ ghế”, không ghi “Đã hủy thanh toán” chỉ từ DELETE thành công.
  Thông báo sau hủy không hứa hoàn tiền tự động hoặc kết quả tài chính đã rõ.
- Không dùng unload để hủy, không tự hủy khi reload hoặc đóng tab.

## Lỗi và tình huống biên

| Trường hợp | Hành vi |
| --- | --- |
| Chưa đăng nhập / hết phiên | Yêu cầu đăng nhập, kiểm tra lại đơn; không lộ cache người khác. |
| 403 / 404 | Thông báo không thể truy cập đơn, không hiển thị vé cũ. |
| Lỗi GET ban đầu | Hiển thị lỗi/thử lại, không giả thành đơn rỗng hợp lệ. |
| Lỗi làm mới | Thông báo dữ liệu chưa xác nhận, ngăn thanh toán khi trạng thái chưa rõ. |
| Combo tải lỗi / danh mục rỗng | Giữ thông tin vé và combo đã lưu; phân biệt lỗi với hết combo. |
| Combo ngừng bán / giá thay đổi | Cập nhật thông tin, cho chỉnh hoặc xác nhận lại giá. |
| Tab khác đổi đơn / đã chốt thanh toán | Báo xung đột, đồng bộ lại; không âm thầm ghi đè. |
| PUT thành công, POST tạo URL lỗi | Giữ giỏ đã lưu và hạn giữ cũ, kiểm tra ngữ cảnh thanh toán trước khi thử tiếp. |
| Tạo URL mất phản hồi | Kiểm tra lại ngữ cảnh đã lưu; không tự tạo mã giao dịch mới. |
| Đổi tài khoản khi request đang chạy | Bỏ phản hồi không còn thuộc tài khoản hiện tại, xóa trạng thái riêng của đơn. |
| URL trả về không hợp lệ | Không điều hướng, báo lỗi và cho kiểm tra lại đơn. |

## Rủi ro phát hiện khi đọc mã nguồn

- `PaymentServiceImpl.createPaymentUrl` hiện cập nhật lại phương thức/số tiền
  trên Payment cũ, chưa có kiểm soát phiên bản hoặc khóa chung với sửa combo.
- Nhánh MoMo hiện tạo `orderId` mới mỗi lần và trả URL callback có
  `resultCode=0` nếu thiếu `payUrl` hoặc có exception. Phải bỏ fallback giả
  thành công này trước khi kết nối Checkout với cổng.
- Callback và QR chưa nằm trong phạm vi Checkout: việc chuyển được sang cổng
  không chứng minh toàn bộ quy trình trả kết quả đã hoàn thành.
- Tích hợp cổng có kết quả chưa biết không thể giải quyết chỉ bằng chống
  double-click. Cần ngữ cảnh bền vững và hành vi phục hồi không gửi lặp mù.
- DDL cho dữ liệu phiên tạo thanh toán và hợp đồng API bổ sung cần được ghi
  rõ trong kế hoạch triển khai; không tự chạy migration trên dữ liệu người dùng
  trong giai đoạn thiết kế.

## Kế hoạch triển khai và kiểm chứng

1. Chốt hợp đồng revision/ngữ cảnh thanh toán, thay đổi dữ liệu tối thiểu và
   quy tắc khóa; viết test backend cho quyền, giá, trạng thái và cạnh tranh.
2. Bổ sung PUT combo; lưu toàn bộ lựa chọn nguyên khối, bảo toàn giá vé/hạn giữ.
3. Bảo vệ create-url/gửi lặp/timeout, loại bỏ MoMo fallback; kiểm tra hành vi
   IPN, cancel và expiry liên quan dưới cùng quy tắc đồng thời.
4. Xây route, service, hook và các khối UI Checkout; nối điều hướng từ giữ
   ghế mới/đơn đã khôi phục, countdown, xác nhận thay đổi giá và hủy.
5. Test backend có ý nghĩa cho rollback, nội dung đơn thay đổi, request lặp,
   cổng timeout, IPN sớm và thay trạng thái khi đang tạo URL. Kiểm thử khóa
   phải chạy với PostgreSQL phù hợp; mock đơn thuần không chứng minh chống race.
6. Chạy test/lint/build frontend, kiểm tra trình duyệt desktop/mobile với API
   mô phỏng: reload, account switch, nhiều tab, lỗi từng bước và xác nhận giá.
7. Kiểm tra Sandbox thật khi có cấu hình hợp lệ; báo rõ phần nào mô phỏng và
   phần nào đã gọi cổng, không báo thanh toán thành công chỉ từ query string.
8. Cập nhật tài liệu frontend/kế hoạch sau khi triển khai; giữ nguyên thay đổi
   đang có của người dùng, không commit hoặc push tự động.

## Nhật ký rà soát kỹ thuật

Thực hiện lần lượt Skeptic, Constraint Guardian, User Advocate và
Integrator/Arbiter theo skill multi-agent-brainstorming. Kết quả rà soát không
thay thế việc chạy kiểm thử hoặc đối chiếu cấu hình môi trường thật.

| Mã | Phản biện | Giải quyết và lý do |
| --- | --- | --- |
| S1 | Khóa booking chưa bao phủ cron ghế mồ côi; side effect trước commit có thể nhả ghế sai. | Tiếp nhận: quy định recheck dưới khóa cho cả hai cron, kiểm tra lượt giữ, Redis compare-and-delete và phát sau commit; cần test PostgreSQL cạnh tranh IPN/cancel/expiry và xử lý thông báo cũ. |
| S2 | Phục hồi chưa có state contract; luồng PUT trước mọi POST không chạy được với giỏ đã khóa. | Tiếp nhận: bổ sung bảng trạng thái, trường GET, lease/crash windows và tách EDITABLE khỏi resume READY/UNKNOWN. |
| S3 | IPN chỉ nhận diện booking và có thể tự tạo Payment, chưa ràng buộc attempt đã chốt. | Tiếp nhận: đối chiếu provider/attempt/amount, intent commit trước HTTP, kết quả đơn điệu và không tạo Payment từ IPN không nhận diện. |
| S4 | Revision chưa định nghĩa rõ; stale-identical có thể bỏ qua đổi giá. | Tiếp nhận: chuẩn hóa ID/tiền/thứ tự/giá đã lưu; mọi stale revision trả 409, xác nhận giá theo snapshot, kiểm thử cùng tổng nhưng khác item/đơn giá. |
| S5 | Bắt tạo lượt giữ ghế mới sau mọi lỗi là hạn chế chưa được khách xác nhận. | Tiếp nhận: bỏ hạn chế tổng quát; chỉ khóa khi còn khả năng thanh toán/kết quả chưa biết. Từ chối chắc chắn cho chỉnh/thử lại trong hạn cũ, lưu lịch sử attempt; thêm nội dung thông báo rõ. |
| C1 | Lỗi sau commit chưa có giới hạn nhất quán và có thể báo sai rollback. | Tiếp nhận: DB có thẩm quyền, cô lập/log lỗi side effect, resync focus/reconnect/GET định kỳ; TTL Redis giữ nguyên tối đa 600 giây mặc định. Chấp nhận chậm đồng bộ có giới hạn và không thêm outbox; cần test lỗi sau commit. |
| C2 | Countdown phụ thuộc clock/timezone client và LocalDateTime.now của host. | Tiếp nhận: Clock giờ Việt Nam dùng chung cho các đường giữ/kiểm tra/hết hạn; bổ sung serverTime/deadline có offset, countdown neo monotonic và đồng bộ lại khi focus/0. Test timezone khác, clock skew và sleep. |
| C3 | Lưu URL có chữ ký mâu thuẫn với yêu cầu không ghi chữ ký; log hiện tại lộ URL/IPN. | Tiếp nhận: phân biệt khóa merchant không được lưu với URL nhạy cảm cần lưu cho resume; giới hạn owner/admin, lọc URL/chữ ký/token/IPN khỏi log và lỗi. Test quyền đọc URL. |
| U1 | Hủy giữ ghế khi READY/UNKNOWN có thể bị hiểu là hủy giao dịch tại cổng. | Tiếp nhận: xác nhận theo trạng thái, nêu rõ chỉ hủy giữ ghế; không hứa đã hủy giao dịch/hoàn tiền. Test EDITABLE và CREATING/READY/UNKNOWN. |
| U2 | Chưa rõ khi khách không chấp nhận giá mới. | Tiếp nhận: quay lại chỉnh combo, giữ snapshot giá mới đã lưu, không tạo URL/hủy đơn/gia hạn. |
| U3 | Chưa rõ có cho thanh toán khi catalog lỗi hay không. | Tiếp nhận: chặn bắt đầu thanh toán khi EDITABLE và catalog chưa sẵn sàng, cho thử lại; không xóa combo đã lưu. Resume READY độc lập catalog. |

Phán quyết Integrator/Arbiter: **APPROVED — sẵn sàng triển khai**.

- S1–S5: tiếp nhận và đã giải quyết ở mức thiết kế; không còn hạn chế buộc
  tạo lượt giữ ghế mới sau mọi lỗi cổng.
- C1–C3: tiếp nhận và đã giải quyết bằng chính sách DB có thẩm quyền, giới
  hạn cache, clock server và bảo vệ URL/log nhạy cảm.
- U1–U3: tiếp nhận và đã giải quyết bằng thông báo hủy theo trạng thái,
  hành vi từ chối giá mới và quy tắc catalog lỗi/resume.
- Không có phản biện bị bác bỏ hoặc blocker thiết kế chưa xử lý.

Các giới hạn đã ghi nhận: UNKNOWN có thể phải chờ bằng chứng mới được tiếp
tục; hủy giữ ghế không bảo đảm hủy giao dịch tại cổng; Redis lỗi có thể giữ
key đến TTL gốc; Payment cũ cần xử lý bảo thủ; callback/QR làm ở bước sau.

Phán quyết này chỉ áp dụng cho thiết kế. Triển khai cần chứng minh tính
nguyên khối, khóa PostgreSQL, correlation cổng, lease/kết quả đến muộn,
migration, quyền truy cập và các ca lỗi đã nêu; kết quả triển khai nằm dưới.

Nguồn quy trình: [brainstorming](../../.agents/skills/brainstorming/SKILL.md).
Rà soát theo các vai trò của skill multi-agent-brainstorming, với phản biện
và cách giải quyết được giữ trong nhật ký trên.

## Kết quả triển khai và kiểm chứng

- Đã có route lazy-load Checkout, điều hướng sau giữ ghế và đường tiếp tục
  cho đơn khôi phục. Giao diện hai cột desktop/một cột mobile, thông tin vé,
  combo, phương thức, timer server và nút thanh toán/hủy đã hoàn thành.
- PUT combo thay toàn bộ lựa chọn, kiểm tra owner/revision/hạn giữ, tính lại
  giá combo từ catalog và giữ giá vé/deadline đã lưu. Giá đổi yêu cầu xác nhận
  rõ từng đơn giá/tổng tiền; 409 yêu cầu tải lại lựa chọn trước khi thanh toán.
- Attempt được đặt trước trong transaction ngắn, gọi cổng ngoài transaction,
  lưu URL để resume, không tạo ID mới khi UNKNOWN. Đã bỏ MoMo fallback thành công.
- IPN đối chiếu attempt, chữ ký, merchant, request/reference và số tiền.
  Đã áp dụng khóa/recheck cho cancel/expiry/IPN, token Redis compare-delete,
  side effect sau commit và version message ghế; sơ đồ làm mới khoảng 30 giây.
- `npm.cmd test`: 56 test đạt; lint và production build đạt. Checkout tải
  riêng, khoảng 8 kB gzip; không thêm dependency.
- Bộ backend chọn lọc: 33 test đạt, không skip. Gồm 14 ca PostgreSQL dùng
  service/repository thật trên schema riêng, 1 ca Redis thật bằng key ngẫu
  nhiên, 2 ca Gateway và 16 ca API/giữ ghế/suất chiếu hồi quy.
- PostgreSQL đã kiểm tra hai tab cạnh tranh revision, intent/gateway ngoài
  transaction, request lặp, timeout, cancel trong lúc chờ cổng, IPN sớm/trùng,
  IPN cạnh tranh cả hai cron, rollback, lỗi sau commit, giá vé bất biến,
  quyền sở hữu, thanh toán legacy và snapshot cũ trước create-url.
- Migration `db/manual/checkout.sql` được chạy lặp trong schema kiểm thử,
  gồm index chỉ cho một attempt đang hoạt động trên mỗi booking. Schema và
  key kiểm thử được dọn; không áp dụng migration hoặc tạo đơn trên schema thật.
- Edge headless trên production build: 12 luồng đạt, không có runtime exception.
  Bao gồm desktop/mobile 390px không tràn, clock lệch +24 giờ và timezone
  America/Los_Angeles, combo/giá mới, 409, combo ngừng bán sau chọn, catalog lỗi,
  mất phản hồi đã tạo URL, UNKNOWN không POST lại, hủy lỗi/thử lại, hết hạn,
  403 và điều hướng từ trang ghế. REST/STOMP/cổng đều được mô phỏng.
- Đã cập nhật kế hoạch frontend và README; hướng dẫn migration/API/khởi chạy
  nằm trong [CHECKOUT.md](../../backend/cinema-booking-backend/CHECKOUT.md).

Chưa kiểm thử merchant VNPay/MoMo thật hoặc luồng callback/QR. UNKNOWN hiện
đồng bộ từ dữ liệu đã lưu/IPN, chưa có job tự đối soát toàn bộ trạng thái từ
cổng. Side effect sau commit vẫn best-effort, key Redis cũ có thể tồn tại đến
TTL gốc khi hạ tầng lỗi. Không thực hiện commit/push hoặc đổi cấu hình bí mật.
