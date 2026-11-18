import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Ticket } from 'lucide-react';
import { isBookingCode, MY_TICKETS_PATH } from './ticketUtils';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

/**
 * Khung trang chi tiết vé (/profile/bookings/:bookingCode). Mục 1 chỉ kiểm tra định dạng mã đơn và
 * dựng khung; dữ liệu đơn, ghế/combo và QR được thêm ở các mục 2 và 5. Chưa gọi API nào.
 */
const TicketDetailPage = () => {
  const { bookingCode = '' } = useParams();
  const location = useLocation();
  const validCode = isBookingCode(bookingCode);
  // Dùng router state để quay về danh sách với bộ lọc cũ (được điền từ mục 2) mà URL chi tiết vẫn chia sẻ được.
  const listHref = { pathname: MY_TICKETS_PATH, search: typeof location.state?.ticketsSearch === 'string' ? location.state.ticketsSearch : '' };

  useEffect(() => { window.scrollTo(0, 0); }, [bookingCode]);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8 sm:px-10 sm:pb-24 lg:px-14">
      <nav aria-label="Đường dẫn" className="mb-10 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs leading-relaxed text-muted">
        <Link to="/" className={`rounded hover:text-white ${FOCUS_CLASS}`}>Trang chủ</Link>
        <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0" />
        <Link to={listHref} className={`rounded hover:text-white ${FOCUS_CLASS}`}>Vé của tôi</Link>
        <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0" />
        <span aria-current="page" className="min-w-0 break-all text-white">{validCode ? bookingCode : 'Không tìm thấy vé'}</span>
      </nav>

      {validCode ? (
        <>
          <header className="mb-8 border-b border-surfaceBorder pb-8 sm:mb-10 sm:pb-10">
            <div className="border-l-4 border-primary pl-5 sm:pl-7">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Chi tiết vé</p>
              <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">Đơn đặt vé</h1>
              <p className="mt-4 text-sm text-muted">Mã đơn: <strong className="break-all font-mono text-white">{bookingCode}</strong></p>
            </div>
          </header>
          <p role="status" className="rounded-2xl border border-dashed border-surfaceBorder px-5 py-16 text-center text-sm text-muted">
            Thông tin chi tiết vé đang được hoàn thiện ở bước tiếp theo.
          </p>
        </>
      ) : (
        <section aria-labelledby="ticket-detail-error" className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-surfaceBorder px-5 py-16 text-center">
          <Ticket aria-hidden="true" strokeWidth={1.5} className="h-10 w-10 text-muted" />
          <h1 id="ticket-detail-error" className="text-2xl font-bold text-white">Không tìm thấy vé</h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">Mã đơn trong đường dẫn không hợp lệ. Bạn hãy chọn vé từ danh sách vé của mình.</p>
        </section>
      )}

      <Link to={listHref} className={`mt-8 inline-flex min-h-11 items-center gap-2 rounded text-sm font-semibold text-muted hover:text-white ${FOCUS_CLASS}`}>
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />Về danh sách vé
      </Link>
    </div>
  );
};

export default TicketDetailPage;
