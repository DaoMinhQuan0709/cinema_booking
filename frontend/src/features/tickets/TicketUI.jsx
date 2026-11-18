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

export function TicketLoading({ variant = 'list' }) {
  if (variant === 'detail') {
    return <div role="status" aria-label="Đang tải thông tin chi tiết vé" className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.45fr)]">
      <div className="space-y-6">
        <div className="animate-pulse rounded-2xl border border-surfaceBorder bg-surface p-6 space-y-4">
          <div className="h-3 w-28 rounded bg-surfaceBorder/60" />
          <div className="h-7 w-2/3 rounded bg-surfaceBorder" />
          <div className="grid gap-4 pt-2 sm:grid-cols-2">
            <div className="h-10 rounded bg-surfaceBorder/40" />
            <div className="h-10 rounded bg-surfaceBorder/40" />
          </div>
        </div>
        <div className="animate-pulse rounded-2xl border border-surfaceBorder bg-surface p-6 space-y-4">
          <div className="h-5 w-32 rounded bg-surfaceBorder" />
          <div className="h-12 rounded bg-surfaceBorder/40" />
          <div className="h-12 rounded bg-surfaceBorder/40" />
        </div>
      </div>
      <aside className="space-y-6">
        <div className="animate-pulse rounded-2xl border border-surfaceBorder bg-surface p-6 space-y-4">
          <div className="h-5 w-32 rounded bg-surfaceBorder" />
          <div className="h-6 w-24 rounded-full bg-surfaceBorder/60" />
          <div className="space-y-3 pt-4">
            <div className="h-4 w-full rounded bg-surfaceBorder/40" />
            <div className="h-4 w-3/4 rounded bg-surfaceBorder/40" />
            <div className="h-8 w-1/2 rounded bg-surfaceBorder" />
          </div>
        </div>
      </aside>
      <span className="sr-only">Đang tải thông tin vé…</span>
    </div>;
  }

  return <div role="status" aria-label="Đang tải danh sách vé" className="space-y-4">
    {[1, 2, 3].map(item => <div key={item} className="grid animate-pulse overflow-hidden rounded-2xl border border-surfaceBorder bg-surface lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(15rem,0.9fr)]">
      <div className="border-l-2 border-primary/40 p-5 sm:p-6 space-y-3">
        <div className="h-3 w-32 rounded bg-surfaceBorder/60" />
        <div className="h-6 w-3/4 rounded bg-surfaceBorder" />
        <div className="h-4 w-1/2 rounded bg-surfaceBorder/50" />
      </div>
      <div className="grid content-center gap-4 border-t border-surfaceBorder p-5 sm:p-6 lg:border-t-0">
        <div className="h-4 w-3/4 rounded bg-surfaceBorder/40" />
        <div className="h-4 w-1/2 rounded bg-surfaceBorder/40" />
      </div>
      <div className="flex flex-col justify-between gap-4 border-t border-dashed border-surfaceBorder p-5 sm:p-6 lg:border-l lg:border-t-0">
        <div className="h-6 w-24 rounded-full bg-surfaceBorder/60" />
        <div className="h-7 w-28 rounded bg-surfaceBorder" />
      </div>
    </div>)}
    <span className="sr-only">Đang tải thông tin vé…</span>
  </div>;
}

export function TicketError({ query }) {
  const status = query.error?.response?.status;
  const message = status === 403 ? 'Bạn không có quyền xem đơn đặt vé này.' : status === 404 ? 'Không tìm thấy đơn đặt vé này.' : 'Không thể tải thông tin vé. Vui lòng thử lại.';
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-400/25 bg-red-400/5 p-6 text-sm text-red-200">
    <p>{query.data ? 'Chưa làm mới được dữ liệu. Thông tin bên dưới có thể chưa cập nhật.' : message}</p>
    <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()} className={`min-h-11 rounded-lg px-4 font-semibold underline disabled:opacity-50 ${focus}`}>Thử lại</button>
  </div>;
}
