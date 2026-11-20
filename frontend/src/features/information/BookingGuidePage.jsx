import { Link } from 'react-router-dom';
import { ArrowRight, Check, Clock3, Film, Popcorn, Ticket, CreditCard, Info } from 'lucide-react';
import InformationLayout from './InformationLayout';

const steps = [
  { icon: Film, title: 'Chọn đúng buổi chiếu', description: 'Tìm phim, rạp, ngày giờ và chọn ghế còn trống trên sơ đồ. Kiểm tra kỹ trước khi tiếp tục.', note: 'Chọn ghế chưa bắt đầu giữ chỗ.' },
  { icon: Ticket, title: 'Xác nhận giữ ghế', description: 'Đăng nhập và bấm “Tiếp tục”. Khi hệ thống xác nhận tạo đơn thành công, ghế được giữ và thời hạn 10 phút bắt đầu.', note: 'Theo dõi đồng hồ trên đơn của bạn.' },
  { icon: Popcorn, title: 'Thêm chút vị điện ảnh', description: 'Chọn bắp nước, điều chỉnh số lượng hoặc bỏ qua bước này. Xem lại sản phẩm và tổng tiền trước khi thanh toán.', note: 'Thời gian giữ ghế vẫn tiếp tục chạy.' },
  { icon: CreditCard, title: 'Hoàn tất thanh toán', description: 'Chọn phương thức đang hỗ trợ và làm theo hướng dẫn tại cổng thanh toán. Hoàn thành trong thời hạn hiển thị của đơn.', note: 'Chuyển sang cổng không gia hạn giữ ghế.' },
  { icon: Check, title: 'Kiểm tra vé của bạn', description: 'Sau thanh toán, kiểm tra trạng thái đơn. Khi được xác nhận thành công, mở chi tiết vé để xem thông tin và mã vé.', note: 'Giữ mã vé riêng và xuất trình tại rạp.' },
];

export default function BookingGuidePage() {
  return <InformationLayout number="03" eyebrow="Một hành trình, năm bước" title="Giữ chỗ 10 phút" description="Một khoảng thời gian riêng để bạn hoàn tất buổi hẹn với màn ảnh lớn. Nắm rõ từng bước trước khi bắt đầu.">
    <section className="hold-ticket" aria-label="Thời hạn giữ chỗ">
      <div className="hold-ticket-main"><p className="information-eyebrow"><Clock3 size={15} aria-hidden="true" />THỜI GIAN GIỮ GHẾ</p><strong>10<span>phút</span></strong><p>Từ lúc hệ thống xác nhận giữ chỗ thành công.</p></div>
      <div className="hold-ticket-stub"><span>MỘT ĐƠN</span><Ticket size={32} strokeWidth={1.25} aria-hidden="true" /><span>MỘT THỜI HẠN</span></div>
    </section>
    <p className="hold-caption">Đây là hướng dẫn. Đồng hồ thời gian thực nằm trong đơn đặt vé của bạn.</p>
    <ol className="hold-steps">{steps.map(({ icon: Icon, title, description, note }, index) => <li key={title}>
      <div className="hold-step-marker"><span>{String(index + 1).padStart(2, '0')}</span></div>
      <div><div className="hold-step-heading"><Icon size={19} aria-hidden="true" /><h2>{title}</h2></div><p>{description}</p><small>{note}</small></div>
    </li>)}</ol>
    <section className="information-takeaway"><Info size={20} aria-hidden="true" /><div><h2>Nếu thời gian đã hết?</h2><p>Kiểm tra trạng thái đơn trước khi chọn lại ghế. Nếu đã thực hiện thanh toán nhưng chưa có vé, hãy kiểm tra giao dịch và liên hệ hỗ trợ; tránh thanh toán lặp khi kết quả còn chưa rõ.</p><Link className="information-text-link" to="/refund-policy#pending">Hướng dẫn kiểm tra giao dịch<ArrowRight size={16} aria-hidden="true" /></Link></div></section>
    <div className="information-actions"><Link className="information-button" to="/movies">Chọn phim ngay<ArrowRight size={17} aria-hidden="true" /></Link><Link className="information-text-link" to="/faq">Tôi vẫn còn câu hỏi<ArrowRight size={16} aria-hidden="true" /></Link></div>
  </InformationLayout>;
}
