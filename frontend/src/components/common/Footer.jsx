import { Link } from 'react-router-dom';
import { Film, Phone, Mail, MapPin, ShieldCheck, CreditCard } from 'lucide-react';

/**
 * Component Footer chan trang toan he thong PremierCinema.
 * Phong cach toi gian, sang trong, mang dam tinh dien anh.
 */
export const Footer = () => {
  return (
    <footer className="w-full bg-[#08080C] border-t border-surfaceBorder text-muted text-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Cot 1: Gioi thieu thuong hieu */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2.5 group text-white focus:outline-none">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                <Film className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-extrabold tracking-wider text-white">
                PREMIER<span className="text-primary">CINEMA</span>
              </span>
            </Link>
            <p className="text-xs text-muted leading-relaxed">
              Hệ thống đặt vé xem phim trực tuyến thế hệ mới với công nghệ giữ chỗ thời gian thực,
              chống nghẽn tải cao và tích hợp trợ lý AI thông minh CineBot.
            </p>
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Giao dịch an toàn & bảo mật tuyệt đối</span>
            </div>
          </div>

          {/* Cot 2: Kham pha dien anh */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Khám Phá
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link to="/movies?status=NOW_SHOWING" className="hover:text-primary transition-colors">
                  Phim đang chiếu
                </Link>
              </li>
              <li>
                <Link to="/movies?status=COMING_SOON" className="hover:text-primary transition-colors">
                  Phim sắp khởi chiếu
                </Link>
              </li>
              <li>
                <Link to="/showtimes" className="hover:text-primary transition-colors">
                  Lịch chiếu toàn quốc
                </Link>
              </li>
              <li>
                <Link to="/cinemas" className="hover:text-primary transition-colors">
                  Hệ thống cụm rạp
                </Link>
              </li>
              <li>
                <span className="text-neutral-500 cursor-not-allowed">
                  Bắp nước & Combo ưu đãi
                </span>
              </li>
            </ul>
          </div>

          {/* Cot 3: Chinh sach & Tro giup */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Quy Định & Hỗ Trợ
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <span className="hover:text-primary transition-colors cursor-pointer">
                  Điều khoản sử dụng
                </span>
              </li>
              <li>
                <span className="hover:text-primary transition-colors cursor-pointer">
                  Chính sách bảo mật thông tin
                </span>
              </li>
              <li>
                <span className="hover:text-primary transition-colors cursor-pointer">
                  Quy trình giữ chỗ 10 phút
                </span>
              </li>
              <li>
                <span className="hover:text-primary transition-colors cursor-pointer">
                  Chính sách đổi trả & hoàn vé
                </span>
              </li>
              <li>
                <span className="hover:text-primary transition-colors cursor-pointer">
                  Câu hỏi thường gặp (FAQ)
                </span>
              </li>
            </ul>
          </div>

          {/* Cot 4: Cong thanh toan & Lien he */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Đối Tác Thanh Toán
            </h4>
            <div className="flex flex-wrap gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-surface border border-surfaceBorder text-xs text-neutral-300 flex items-center gap-1.5 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-blue-400" /> VNPay
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-surface border border-surfaceBorder text-xs text-neutral-300 flex items-center gap-1.5 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-pink-400" /> MoMo
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-surface border border-surfaceBorder text-xs text-neutral-300 flex items-center gap-1.5 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Visa / Master
              </div>
            </div>

            <div className="pt-2 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span className="text-neutral-300 font-semibold">1900 1234</span>
                <span className="text-[10px] text-muted">(8:00 - 22:00)</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-primary" />
                <span className="text-neutral-300">support@premiercinema.vn</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="text-neutral-300">Hồ Chí Minh & Hà Nội</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 border-t border-surfaceBorder/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <p>© {new Date().getFullYear()} PREMIERCINEMA. Toàn bộ bản quyền được bảo lưu.</p>
          <p className="text-[11px] text-neutral-500">
            Hệ thống Đặt vé xem phim High-Concurrency & Tích hợp Trợ lý AI.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

