import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { getTicketCheckoutHref, ticketStatusLabel } from './ticketUtils';

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
const tones = {
  CONFIRMED: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
  PENDING: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  CANCELLED: 'border-red-400/25 bg-red-400/10 text-red-300',
  EXPIRED: 'border-surfaceBorder bg-background text-muted',
};

export function TicketStatus({ status }) {
  return <span className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${Object.hasOwn(tones, status) ? tones[status] : tones.EXPIRED}`}>
    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />{ticketStatusLabel(status)}
  </span>;
}

export function TicketContinue({ ticket }) {
  const href = getTicketCheckoutHref(ticket);
  return href ? <Link to={href} className={`inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primaryHover ${focus}`}>Tiếp tục đơn</Link> : null;
}

export function TicketRefresh({ query }) {
  return <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-surfaceBorder px-4 py-3 text-sm text-white hover:bg-surface disabled:opacity-50 ${focus}`}>
    <RefreshCw aria-hidden="true" className={`h-4 w-4 ${query.isFetching ? 'motion-safe:animate-spin' : ''}`} />
    {query.isFetching ? 'Đang tải' : 'Làm mới'}
  </button>;
}

export function TicketLoading() {
  return <p role="status" className="rounded-2xl border border-surfaceBorder bg-surface px-6 py-16 text-center text-sm text-muted">Đang tải thông tin vé…</p>;
}

export function TicketError({ query }) {
  const status = query.error?.response?.status;
  const message = status === 403 ? 'Bạn không có quyền xem đơn đặt vé này.' : status === 404 ? 'Không tìm thấy đơn đặt vé này.' : 'Không thể tải thông tin vé. Vui lòng thử lại.';
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-400/25 bg-red-400/5 p-6 text-sm text-red-200">
    <p>{query.data ? 'Chưa làm mới được dữ liệu. Thông tin bên dưới có thể chưa cập nhật.' : message}</p>
    <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className={`min-h-11 rounded-lg px-4 font-semibold underline disabled:opacity-50 ${focus}`}>Thử lại</button>
  </div>;
}
