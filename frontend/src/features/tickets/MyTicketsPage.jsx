import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Ticket } from 'lucide-react';
import { useTicketHistory } from './useTicketQueries';
import { TicketContinue, TicketError, TicketLoading, TicketRefresh, TicketStatus } from './TicketUI';
import { countTickets, filterTickets, formatTicketDateTime, formatTicketMoney, getTicketDetailHref, readTicketStatus, TICKET_FILTERS, ticketListSearch, ticketText } from './ticketUtils';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

function TicketCard({ ticket, returnState }) {
  const href = getTicketDetailHref(ticket.bookingCode);
  return <article aria-label={`Đơn ${ticketText(ticket.bookingCode)}`} className="grid min-w-0 overflow-hidden rounded-2xl border border-surfaceBorder bg-surface lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(15rem,0.9fr)]">
    <div className="min-w-0 border-l-2 border-primary p-5 sm:p-6">
      <p className="mb-3 break-all font-mono text-xs tracking-wide text-muted">{ticketText(ticket.bookingCode)}</p>
      <h2 className="break-words font-display text-xl font-bold leading-snug text-white sm:text-2xl">{ticketText(ticket.movieTitle)}</h2>
      <p className="mt-4 break-words text-sm font-medium text-white">{ticketText(ticket.cinemaName)}</p>
      <p className="mt-1 break-words text-sm text-muted">{ticketText(ticket.auditoriumName)}</p>
    </div>
    <dl className="grid min-w-0 content-center gap-5 border-t border-surfaceBorder px-5 py-5 sm:px-6 lg:border-t-0">
      <div><dt className="text-xs text-muted">Suất chiếu · Giờ Việt Nam</dt><dd className="mt-2 break-words text-base font-semibold tabular-nums text-white">{formatTicketDateTime(ticket.showStartTime)}</dd></div>
      <div><dt className="text-xs text-muted">Ngày đặt</dt><dd className="mt-2 text-sm tabular-nums text-muted">{formatTicketDateTime(ticket.createdAt)}</dd></div>
    </dl>
    <div className="flex min-w-0 flex-col items-start gap-4 border-t border-dashed border-surfaceBorder p-5 sm:p-6 lg:border-l lg:border-t-0">
      <TicketStatus status={ticket.status} />
      <dl><dt className="text-xs text-muted">Tổng tiền</dt><dd className="mt-1 break-all font-display text-2xl font-bold tabular-nums text-white">{formatTicketMoney(ticket.totalAmount)}</dd></dl>
      <div className="mt-auto flex w-full flex-wrap items-center gap-3">
        <TicketContinue ticket={ticket} />
        {href && <Link to={href} state={returnState} className={`inline-flex min-h-11 items-center gap-2 rounded px-1 text-sm font-semibold text-white hover:text-primaryHover ${FOCUS_CLASS}`}>Xem chi tiết<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>}
      </div>
    </div>
  </article>;
}

export default function MyTicketsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = useTicketHistory();
  const status = readTicketStatus(location.search);
  const search = ticketListSearch(location.search);
  const counts = countTickets(query.data || []);
  const tickets = filterTickets(query.data || [], status);

  useEffect(() => { window.scrollTo(0, 0); }, []);
  useEffect(() => {
    if (search !== location.search) navigate({ pathname: location.pathname, search, hash: location.hash }, { replace: true });
  }, [search, location.pathname, location.search, location.hash, navigate]);

  return <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8 sm:px-10 sm:pb-24 lg:px-14">
    <nav aria-label="Đường dẫn" className="mb-10 flex items-center gap-2 text-xs text-muted">
      <Link to="/" className={`rounded hover:text-white ${FOCUS_CLASS}`}>Trang chủ</Link>
      <ArrowRight aria-hidden="true" className="h-3 w-3" />
      <span aria-current="page" className="text-white">Vé của tôi</span>
    </nav>
    <header className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-surfaceBorder pb-8 sm:mb-10 sm:pb-10">
      <div className="max-w-2xl border-l-4 border-primary pl-5 sm:pl-7">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Lịch sử đặt vé</p>
        <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">Vé của tôi<span className="text-primary">.</span></h1>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted sm:text-base">Những buổi chiếu của bạn, trong một nơi. Xem thông tin vé hoặc tiếp tục đơn đang chờ thanh toán.</p>
      </div>
      <TicketRefresh query={query} />
    </header>
    <div role="group" aria-label="Lọc theo trạng thái đơn" className="mb-6 flex flex-wrap gap-2">
      {TICKET_FILTERS.map(filter => <button key={filter.value} type="button" aria-pressed={status === filter.value}
        onClick={() => { if (filter.value !== status) navigate({ pathname: location.pathname, search: ticketListSearch(location.search, filter.value), hash: location.hash }); }}
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${FOCUS_CLASS} ${status === filter.value ? 'border-primary bg-primary text-white' : 'border-surfaceBorder text-muted hover:border-muted hover:text-white'}`}>
        {filter.label}<span className="rounded-full bg-background/20 px-2 py-0.5 text-xs tabular-nums">{query.data ? counts[filter.value] : '—'}</span>
      </button>)}
    </div>
    <section aria-label="Danh sách vé" className="space-y-4">
      {query.isPending && <TicketLoading />}
      {query.isError && <TicketError query={query} />}
      {query.data && <>
        <p role="status" className="pb-2 text-xs text-muted">{tickets.length} đơn đặt vé · Mới nhất trước</p>
        {tickets.map((ticket, index) => <TicketCard key={ticket.id ?? ticket.bookingCode ?? index} ticket={ticket} returnState={{ ticketsSearch: search, ticketsHash: location.hash }} />)}
        {tickets.length === 0 && <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-surfaceBorder px-6 py-16 text-center">
          <Ticket aria-hidden="true" strokeWidth={1.5} className="h-10 w-10 text-muted" />
          <h2 className="text-xl font-bold text-white">{query.data.length ? 'Chưa có vé ở trạng thái này' : 'Bạn chưa có đơn đặt vé nào'}</h2>
          <p className="text-sm text-muted">{query.data.length ? 'Chọn trạng thái khác để xem các đơn của bạn.' : 'Khám phá phim và chọn buổi chiếu tiếp theo của bạn.'}</p>
          {query.data.length ? <button type="button" onClick={() => navigate({ pathname: location.pathname, search: ticketListSearch(location.search, 'ALL'), hash: location.hash })} className={`min-h-11 rounded px-4 text-sm font-semibold text-white underline ${FOCUS_CLASS}`}>Xem tất cả vé</button>
            : <Link to="/movies" className={`inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primaryHover ${FOCUS_CLASS}`}>Khám phá phim</Link>}
        </div>}
      </>}
    </section>
  </div>;
}
