export const informationLinks = [
  { to: '/terms', label: 'Điều khoản sử dụng', number: '01' },
  { to: '/privacy', label: 'Bảo mật thông tin', number: '02' },
  { to: '/booking-guide', label: 'Giữ chỗ 10 phút', number: '03' },
  { to: '/refund-policy', label: 'Đổi trả & hoàn vé', number: '04' },
  { to: '/faq', label: 'Câu hỏi thường gặp', number: '05' },
];

// Copy describes the implemented booking flow; it does not promise refund eligibility or processing deadlines.
export const documents = {
  terms: {
    number: '01', eyebrow: 'Thông tin sử dụng dịch vụ', title: 'Điều khoản sử dụng',
    description: 'Những điều cần biết để mỗi lần đặt vé đều rõ ràng, từ chọn suất chiếu đến nhận vé.',
    takeaway: 'Kiểm tra đúng phim, rạp, ngày giờ và ghế trước khi bắt đầu thanh toán.',
    sections: [
      { id: 'account', title: 'Tài khoản của bạn', paragraphs: ['Bạn có thể khám phá phim, rạp và danh mục bắp nước mà không cần đăng nhập. Đăng nhập là bước cần thiết để giữ ghế, thanh toán và xem vé của mình.', 'Sử dụng thông tin liên hệ chính xác, bảo vệ mật khẩu và đăng xuất trên thiết bị dùng chung. Không chia sẻ tài khoản, mã xác thực hoặc thông tin thanh toán cho người khác.'] },
      { id: 'booking', title: 'Đặt vé & giữ ghế', paragraphs: ['Chọn phim, suất chiếu và ghế còn trống. Ghế chỉ được giữ khi hệ thống xác nhận tạo đơn thành công; thao tác chọn ghế trên sơ đồ chưa phải là xác nhận giữ chỗ.', 'Đơn có thời hạn giữ ghế 10 phút. Thời gian còn lại được hiển thị trong quá trình đặt vé và tiếp tục chạy khi chọn bắp nước hoặc chuyển sang cổng thanh toán. Khi hết hạn, kiểm tra lại trạng thái đơn trước khi đặt mới.'], link: { to: '/booking-guide', label: 'Xem quy trình giữ chỗ' } },
      { id: 'price', title: 'Giá vé, sản phẩm & thanh toán', paragraphs: ['Kiểm tra chi tiết ghế, sản phẩm, số lượng và tổng tiền trên màn hình thanh toán. Danh mục và giá sản phẩm có thể thay đổi; hệ thống yêu cầu xác nhận nếu giá combo thay đổi khi cập nhật đơn.', 'Chỉ sử dụng phương thức thanh toán hiển thị tại bước thanh toán. Kết quả trên cổng thanh toán cần được hệ thống đối soát; hãy kiểm tra trạng thái trong “Vé của tôi” trước khi thực hiện lại giao dịch.'] },
      { id: 'ticket', title: 'Sử dụng vé tại rạp', paragraphs: ['Sau khi đơn được xác nhận thanh toán thành công, mở “Vé của tôi” để xem chi tiết và mã vé. Giữ riêng mã vé của bạn và xuất trình theo hướng dẫn tại rạp.', 'Kiểm tra phân loại độ tuổi của phim và nội quy rạp. Đến sớm để có thời gian kiểm tra vé và nhận bắp nước nếu có trong đơn.'], link: { to: '/profile/bookings', label: 'Mở vé của tôi' } },
      { id: 'assistance', title: 'Thay đổi đơn & hỗ trợ', paragraphs: ['Hủy giữ ghế chưa thanh toán khác với đổi hoặc hoàn vé đã thanh toán. Website hiện không có thao tác tự đổi suất chiếu, đổi ghế hoặc hoàn tiền cho vé đã thanh toán.', 'Nếu thông tin đơn chưa đúng hoặc giao dịch có vấn đề, chuẩn bị mã đặt vé và liên hệ hỗ trợ để kiểm tra trường hợp cụ thể. Việc hoàn tiền không được xác nhận chỉ bằng thao tác gửi yêu cầu.'], link: { to: '/refund-policy', label: 'Tìm hiểu đổi trả & hoàn vé' } },
    ],
  },
  privacy: {
    number: '02', eyebrow: 'Thông tin tài khoản & giao dịch', title: 'Bảo mật thông tin',
    description: 'Hiểu thông tin bạn cung cấp, cách phiên đăng nhập hoạt động và cách bảo vệ tài khoản khi đặt vé.',
    takeaway: 'Không gửi mật khẩu, mã OTP hoặc đầy đủ thông tin thẻ qua email hay khung chat.',
    sections: [
      { id: 'information', title: 'Thông tin trong quá trình sử dụng', paragraphs: ['Khi đăng ký và sử dụng tài khoản, bạn cung cấp thông tin như họ tên, email và mật khẩu. Các đơn đặt vé gắn với tài khoản lưu thông tin suất chiếu, ghế, sản phẩm, số tiền và trạng thái giao dịch.', 'Thông tin này phục vụ đăng nhập, xử lý đơn, hiển thị lịch sử vé và hỗ trợ kiểm tra giao dịch. Hãy kiểm tra email của bạn để có thể nhận thông tin liên quan đến đơn.'] },
      { id: 'session', title: 'Phiên đăng nhập trên thiết bị', paragraphs: ['Website lưu token đăng nhập và thông tin người dùng trong bộ nhớ cục bộ của trình duyệt (localStorage) để duy trì phiên và làm mới đăng nhập khi cần.', 'Chỉ đăng nhập trên thiết bị đáng tin cậy. Khi dùng máy tính chung, hãy đăng xuất sau khi sử dụng; không sao chép hoặc gửi token đăng nhập cho người khác.'] },
      { id: 'payment', title: 'Thông tin thanh toán', paragraphs: ['Khi chọn thanh toán, bạn được chuyển đến cổng thanh toán tương ứng. Kiểm tra địa chỉ website và thông tin đơn trước khi xác nhận.', 'Thông tin xác thực giao dịch cần được nhập tại cổng thanh toán. Không cung cấp mã OTP, mật khẩu ngân hàng hoặc thông tin thẻ trong phần mô tả yêu cầu hỗ trợ.'] },
      { id: 'chat', title: 'Khi trò chuyện với CineBot', paragraphs: ['Chỉ gửi thông tin cần thiết cho câu hỏi về phim, lịch chiếu hoặc hướng dẫn đặt vé. Tránh gửi thông tin nhạy cảm vào cuộc trò chuyện.', 'CineBot hỗ trợ tra cứu và hướng dẫn; trạng thái trên chi tiết đơn đặt vé là nơi bạn cần kiểm tra kết quả giao dịch.'] },
      { id: 'contact', title: 'Yêu cầu liên quan đến thông tin cá nhân', paragraphs: ['Để yêu cầu kiểm tra hoặc điều chỉnh thông tin, liên hệ bộ phận hỗ trợ bằng email gắn với tài khoản và mô tả nội dung cần xử lý.', 'Đối với yêu cầu về dữ liệu hoặc đóng tài khoản, bộ phận hỗ trợ cần xác minh chủ tài khoản và phản hồi phạm vi xử lý. Chỉ cung cấp thông tin cần thiết để xác minh và trao đổi yêu cầu.'] },
    ],
  },
  refunds: {
    number: '04', eyebrow: 'Hướng dẫn xử lý đơn đặt vé', title: 'Đổi trả & hoàn vé',
    description: 'Xác định đúng trạng thái đơn để biết bước tiếp theo khi muốn thay đổi vé hoặc cần kiểm tra thanh toán.',
    takeaway: 'Hủy giữ ghế không đồng nghĩa với hủy giao dịch tại cổng thanh toán hoặc xác nhận hoàn tiền.',
    sections: [
      { id: 'unpaid', title: 'Đơn đang giữ ghế, chưa thanh toán', paragraphs: ['Khi đơn vẫn còn cho phép chỉnh sửa, bạn có thể điều chỉnh bắp nước hoặc chọn “Hủy giữ ghế” trong luồng đặt vé. Các ghế được giải phóng sau khi hệ thống xác nhận hủy.', 'Nếu muốn chọn ghế hoặc suất chiếu khác, hủy đơn giữ ghế cũ rồi chọn lại. Đơn chưa thanh toán cũng có thể hết hạn theo thời gian giữ chỗ.'] },
      { id: 'paid', title: 'Vé đã thanh toán thành công', paragraphs: ['Website hiện chưa cung cấp thao tác tự đổi phim, đổi suất, đổi ghế hoặc hoàn vé đã thanh toán. Mở chi tiết vé và liên hệ hỗ trợ nếu bạn cần kiểm tra khả năng xử lý.', 'Điều kiện chấp nhận, số tiền và thời gian hoàn tiền cần được bộ phận hỗ trợ xác nhận cho từng trường hợp. Không xem việc gửi yêu cầu là xác nhận được đổi hoặc hoàn vé.'], link: { to: '/profile/bookings', label: 'Kiểm tra đơn đặt vé' } },
      { id: 'pending', title: 'Đã trừ tiền nhưng chưa thấy vé', paragraphs: ['Kiểm tra lại trạng thái trong “Vé của tôi”. Kết quả thanh toán có thể cần được cập nhật từ cổng thanh toán; không vội thanh toán lại cùng một đơn khi kết quả còn chưa rõ.', 'Nếu ghế đã hết hạn hoặc bạn đã hủy giữ ghế nhưng giao dịch vẫn có kết quả, liên hệ hỗ trợ để đối soát. Hủy trên website không tự hủy giao dịch đang diễn ra tại cổng.'] },
      { id: 'request', title: 'Chuẩn bị yêu cầu hỗ trợ', paragraphs: ['Cung cấp mã đặt vé, email tài khoản, thời điểm giao dịch, số tiền và phương thức thanh toán. Nếu có ảnh chụp giao dịch, hãy che số thẻ, số tài khoản và thông tin riêng tư không cần thiết.', 'Mô tả ngắn vấn đề và kết quả bạn đang thấy trên chi tiết đơn. Không gửi mật khẩu, mã OTP hoặc mã bảo mật thẻ.'] },
    ],
  },
};

export const faqCategories = ['Tất cả', 'Đặt vé', 'Thanh toán', 'Bắp nước', 'Tài khoản'];
export const faqItems = [
  { id: 'start', category: 'Đặt vé', question: 'Làm thế nào để đặt vé xem phim?', answer: 'Chọn phim, tìm suất chiếu tại rạp phù hợp, chọn ghế rồi đăng nhập để giữ chỗ. Tiếp theo, chọn thêm bắp nước nếu muốn, kiểm tra tổng tiền và hoàn tất thanh toán trong thời gian giữ ghế.', to: '/movies', link: 'Khám phá phim' },
  { id: 'hold', category: 'Đặt vé', question: '10 phút giữ ghế bắt đầu từ khi nào?', answer: 'Thời gian bắt đầu khi hệ thống xác nhận tạo đơn giữ ghế thành công. Đồng hồ vẫn tiếp tục chạy khi bạn chọn bắp nước, chuyển trang hoặc sang cổng thanh toán. Tải lại trang không gia hạn thời gian.', to: '/booking-guide', link: 'Xem hướng dẫn giữ chỗ' },
  { id: 'locked', category: 'Đặt vé', question: 'Vì sao ghế vừa chọn lại không còn trống?', answer: 'Sơ đồ ghế cập nhật theo tình trạng thực tế. Người khác có thể giữ ghế trước khi đơn của bạn được xác nhận. Hãy cập nhật sơ đồ và chọn ghế còn trống; chỉ xem ghế đã được giữ khi nhận xác nhận của hệ thống.' },
  { id: 'tickets', category: 'Đặt vé', question: 'Tôi xem vé đã mua ở đâu?', answer: 'Đăng nhập bằng tài khoản đã đặt vé, mở “Vé của tôi” và chọn đơn để xem trạng thái, chi tiết suất chiếu và mã vé khi đơn đã thanh toán thành công.', to: '/profile/bookings', link: 'Mở vé của tôi' },
  { id: 'methods', category: 'Thanh toán', question: 'Tôi có thể thanh toán bằng cách nào?', answer: 'Các phương thức được hiển thị tại bước thanh toán. Luồng hiện tại có lựa chọn VNPay và MoMo; hãy đọc thông tin trên màn hình trước khi tiếp tục. Phương thức được chốt khi bắt đầu tạo phiên thanh toán.' },
  { id: 'charged', category: 'Thanh toán', question: 'Tài khoản đã bị trừ tiền nhưng đơn chưa thành công?', answer: 'Mở chi tiết đơn để kiểm tra lại trạng thái trước khi thanh toán thêm. Nếu kết quả chưa rõ, lưu mã đặt vé cùng thông tin giao dịch và liên hệ hỗ trợ để đối soát. Không gửi OTP hoặc mật khẩu ngân hàng.', to: '/refund-policy#pending', link: 'Xem hướng dẫn kiểm tra giao dịch' },
  { id: 'refund', category: 'Thanh toán', question: 'Tôi có thể đổi hoặc hoàn vé trực tuyến không?', answer: 'Website chưa có thao tác tự đổi hoặc hoàn vé đã thanh toán. Bạn cần liên hệ hỗ trợ để kiểm tra trường hợp cụ thể. Hủy đơn đang giữ ghế không phải là yêu cầu hoàn tiền.', to: '/refund-policy', link: 'Đổi trả & hoàn vé' },
  { id: 'combo', category: 'Bắp nước', question: 'Có bắt buộc mua bắp nước khi đặt vé không?', answer: 'Không. Bạn có thể tiếp tục đặt vé mà không chọn thêm sản phẩm. Bắp nước được thêm tại bước sau khi giữ ghế và trước khi thanh toán.', to: '/concessions', link: 'Xem danh mục bắp nước' },
  { id: 'edit', category: 'Bắp nước', question: 'Tôi có thể thay đổi combo đã chọn không?', answer: 'Bạn có thể chỉnh sửa khi đơn còn thời gian và ở trạng thái cho phép chỉnh sửa. Khi bắt đầu tạo phiên thanh toán, combo và phương thức được chốt. Kiểm tra lại số lượng, giá và tổng tiền trước khi xác nhận.' },
  { id: 'login', category: 'Tài khoản', question: 'Tôi có cần đăng nhập để xem phim và rạp không?', answer: 'Bạn có thể xem danh sách phim, lịch chiếu, thông tin rạp và bắp nước mà không cần tài khoản. Đăng nhập là bước cần thiết để giữ ghế, thanh toán và quản lý vé của mình.' },
  { id: 'privacy', category: 'Tài khoản', question: 'Làm thế nào để bảo vệ tài khoản của tôi?', answer: 'Dùng mật khẩu riêng, giữ bí mật mã xác thực và đăng xuất khi sử dụng thiết bị chung. Không chia sẻ token đăng nhập hoặc mã vé. Liên hệ hỗ trợ khi phát hiện thông tin tài khoản không chính xác.', to: '/privacy', link: 'Thông tin bảo mật' },
];
