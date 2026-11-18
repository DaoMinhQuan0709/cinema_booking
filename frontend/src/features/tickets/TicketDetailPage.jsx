import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Ticket } from 'lucide-react';
import { formatTicketDateTime, formatTicketMoney, isBookingCode, ticketListHref, ticketSeatLabel, ticketSeatType, ticketText } from './ticketUtils';
import { useTicketDetail } from './useTicketQueries';
import { TicketContinue, TicketError, TicketLoading, TicketRefresh, TicketStatus } from './TicketUI';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
const PANEL_CLASS = 'min-w-0 rounded-2xl border border-surfaceBorder bg-surface p-5 sm:p-7';

function TicketContents({ ticket }) {
  const showtime = ticket.showtime || {};
  return <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.45fr)]">
    <div className="min-w-0 space-y-6">
      <section aria-labelledby="ticket-showtime" className={PANEL_CLASS}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">Buổi chiếu của bạn</p>
        <h2 id="ticket-showtime" className="break-words font-display text-2xl font-bold text-white sm:text-3xl">{ticketText(showtime.movieTitle)}</h2>
        <dl className="mt-6 grid gap-6 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Rạp / Phòng chiếu</dt><dd className="mt-2 break-words font-semibold text-white">{ticketText(showtime.cinemaName)}<span className="mt-1 block font-normal text-muted">{ticketText(showtime.auditoriumName)}</span></dd></div>
          <div><dt className="text-muted">Suất chiếu · Giờ Việt Nam</dt><dd className="mt-2 font-semibold tabular-nums text-white">{formatTicketDateTime(showtime.startTime)}</dd></div>
        </dl>
      </section>
      <section aria-labelledby="ticket-seats" className={PANEL_CLASS}>
        <h2 id="ticket-seats" className="text-lg font-bold text-white">Ghế đã đặt</h2>
        {Array.isArray(ticket.seats) && ticket.seats.length ? <ul className="mt-4 divide-y divide-surfaceBorder">
          {ticket.seats.map((seat, index) => <li key={seat?.showtimeSeatId ?? index} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
            <div className="min-w-0"><span className="break-all font-display text-xl font-bold text-white">{ticketSeatLabel(seat)}</span><span className="ml-3 text-muted">{ticketSeatType(seat?.seatType)}</span></div>
            <span className="tabular-nums text-white">{formatTicketMoney(seat?.price)}</span>
          </li>)}
        </ul> : <p className="mt-4 text-sm text-muted">Chưa có thông tin ghế.</p>}
      </section>
      <section aria-labelledby="ticket-products" className={PANEL_CLASS}>
        <h2 id="ticket-products" className="text-lg font-bold text-white">Bắp nước / Combo</h2>
        {Array.isArray(ticket.products) && ticket.products.length ? <ul className="mt-4 divide-y divide-surfaceBorder">
          {ticket.products.map((product, index) => <li key={product?.productId ?? index} className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm">
            <div className="min-w-0 flex-1"><h3 className="break-words font-semibold text-white">{ticketText(product?.productName)}</h3>
              <p className="mt-2 text-muted">Số lượng: {Number.isInteger(product?.quantity) && product.quantity > 0 ? product.quantity : 'Chưa cập nhật'} · Đơn giá: {formatTicketMoney(product?.unitPrice)}</p>
            </div>
            <p className="tabular-nums text-white"><span className="sr-only">Thành tiền: </span>{formatTicketMoney(product?.subtotal)}</p>
          </li>)}
        </ul> : <p className="mt-4 text-sm text-muted">{Array.isArray(ticket.products) ? 'Đơn này không có bắp nước hoặc combo.' : 'Chưa có thông tin bắp nước hoặc combo.'}</p>}
      </section>
    </div>
    <aside aria-label="Tóm tắt đơn và mã vé" className="min-w-0 space-y-6">
      <section aria-labelledby="ticket-summary" className={PANEL_CLASS}>
        <h2 id="ticket-summary" className="mb-5 text-lg font-bold text-white">Thông tin đơn</h2>
        <TicketStatus status={ticket.status} />
        <dl className="mt-6 space-y-5 text-sm">
          <div><dt className="text-muted">Ngày đặt</dt><dd className="mt-2 tabular-nums text-white">{formatTicketDateTime(ticket.createdAt)}</dd></div>
          {ticket.status === 'PENDING' && <div><dt className="text-muted">Hạn giữ chỗ · Giờ Việt Nam</dt><dd className="mt-2 tabular-nums text-white">{formatTicketDateTime(ticket.expiresAt)}</dd></div>}
          <div className="border-t border-dashed border-surfaceBorder pt-5"><dt className="text-muted">Tổng tiền</dt><dd className="mt-2 break-all font-display text-3xl font-bold tabular-nums text-white">{formatTicketMoney(ticket.totalAmount)}</dd></div>
        </dl>
        {ticket.status === 'PENDING' && <div className="mt-6"><TicketContinue ticket={ticket} /></div>}
      </section>
      <section aria-labelledby="ticket-qr" className={`${PANEL_CLASS} text-center`}>
        <Ticket aria-hidden="true" className="mx-auto mb-4 h-8 w-8 text-muted" strokeWidth={1.5} />
        <h2 id="ticket-qr" className="text-lg font-bold text-white">Mã vé</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{ticket.status === 'CONFIRMED'
          ? 'Mã QR hiện chưa khả dụng. Bạn có thể xem thông tin đơn tại đây.'
          : ticket.status === 'PENDING' ? 'Đơn đang chờ thanh toán. Mã vé chỉ dành cho đơn đã xác nhận.'
            : ticket.status === 'CANCELLED' || ticket.status === 'EXPIRED' ? 'Đơn này không có mã vé có hiệu lực.' : 'Chưa xác định được trạng thái đơn để hiển thị mã vé.'}</p>
      </section>
    </aside>
  </div>;
}

export default function TicketDetailPage() {
  const { bookingCode = '' } = useParams();
  const location = useLocation();
  const query = useTicketDetail(bookingCode);
  const validCode = isBookingCode(bookingCode);
  const listHref = ticketListHref(location.state);

  useEffect(() => { window.scrollTo(0, 0); }, [bookingCode]);

  return <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8 sm:px-10 sm:pb-24 lg:px-14">
    <nav aria-label="Đường dẫn" className="mb-10 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs leading-relaxed text-muted">
      <Link to="/" className={`rounded hover:text-white ${FOCUS_CLASS}`}>Trang chủ</Link>
      <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0" />
      <Link to={listHref} className={`rounded hover:text-white ${FOCUS_CLASS}`}>Vé của tôi</Link>
      <ArrowRight aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span aria-current="page" className="min-w-0 break-all text-white">{validCode ? bookingCode : 'Không tìm thấy vé'}</span>
    </nav>
    {validCode ? <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-surfaceBorder pb-8 sm:mb-10 sm:pb-10">
        <div className="min-w-0 border-l-4 border-primary pl-5 sm:pl-7">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Chi tiết vé</p>
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">Đơn đặt vé</h1>
          <p className="mt-4 text-sm text-muted">Mã đơn: <strong className="break-all font-mono text-white">{bookingCode}</strong></p>
        </div>
        <TicketRefresh query={query} />
      </header>
      <div className="space-y-6">
        {query.isPending && <TicketLoading />}
        {query.isError && <TicketError query={query} />}
        {query.data && <TicketContents ticket={query.data} />}
      </div>
    </> : <section aria-labelledby="ticket-detail-error" className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-surfaceBorder px-5 py-16 text-center">
      <Ticket aria-hidden="true" strokeWidth={1.5} className="h-10 w-10 text-muted" />
      <h1 id="ticket-detail-error" className="text-2xl font-bold text-white">Không tìm thấy vé</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">Mã đơn trong đường dẫn không hợp lệ. Bạn hãy chọn vé từ danh sách vé của mình.</p>
    </section>}
    <Link to={listHref} className={`mt-8 inline-flex min-h-11 items-center gap-2 rounded text-sm font-semibold text-muted hover:text-white ${FOCUS_CLASS}`}>
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />Về danh sách vé
    </Link>
  </div>;
}
