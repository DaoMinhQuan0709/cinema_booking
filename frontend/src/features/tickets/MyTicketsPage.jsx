import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

/**
 * Khung trang danh sách vé (/profile/bookings). Mục 1 của my-tickets-page-plan.md chỉ dựng khung
 * và guard đăng nhập; truy vấn, thẻ vé và bộ lọc trạng thái được thêm ở mục 2.
 */
const MyTicketsPage = () => {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8 sm:px-10 sm:pb-24 lg:px-14">
      <nav aria-label="Đường dẫn" className="mb-10 flex items-center gap-2 text-xs text-muted">
        <Link to="/" className={`rounded transition-colors hover:text-white ${FOCUS_CLASS}`}>Trang chủ</Link>
        <ArrowRight aria-hidden="true" className="h-3 w-3" />
        <span aria-current="page" className="text-white">Vé của tôi</span>
      </nav>

      <header className="mb-8 border-b border-surfaceBorder pb-8 sm:mb-10 sm:pb-10">
        <div className="max-w-2xl border-l-4 border-primary pl-5 sm:pl-7">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Lịch sử đặt vé</p>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">Vé của tôi<span className="text-primary">.</span></h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted sm:text-base">Xem lại các đơn đặt vé, theo dõi trạng thái thanh toán và mở mã vé cho buổi chiếu sắp tới.</p>
        </div>
      </header>

      <section aria-label="Danh sách vé">
        <p role="status" className="rounded-2xl border border-dashed border-surfaceBorder px-5 py-16 text-center text-sm text-muted">
          Danh sách vé đang được hoàn thiện ở bước tiếp theo.
        </p>
      </section>
    </div>
  );
};

export default MyTicketsPage;
