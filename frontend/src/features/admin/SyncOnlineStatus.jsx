import { RefreshCw } from 'lucide-react';
import { AdminError, AdminLoading } from './components/AdminStates';
import { formatSyncCount, formatSyncTime } from './syncUtils';

export default function SyncOnlineStatus({ query, importing }) {
  const status = query.data;
  const interval = Number(status?.intervalMs);
  const schedule = status?.enabled === true ? 'Đã bật lịch online' : status?.enabled === false ? 'Đang tắt lịch online' : 'Chưa xác định lịch online';
  return <aside aria-labelledby="admin-sync-online-title" className="min-w-0 self-start rounded-2xl border border-surfaceBorder bg-surface/30 p-5 sm:p-6">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Nguồn online</p>
        <h2 id="admin-sync-online-title" className="font-display text-lg font-bold text-white">Trạng thái đồng bộ</h2></div>
      <button type="button" aria-label="Đọc lại trạng thái" onClick={() => void query.refetch()} disabled={query.isFetching}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-surfaceBorder px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <RefreshCw aria-hidden="true" className={`h-4 w-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Đọc lại
      </button>
    </header>
    <p className="mb-5 text-xs leading-relaxed text-muted">Mốc online đầy đủ được backend ghi nhận riêng. Kết quả nhập file mẫu không cập nhật mốc này.</p>
    {query.isPending ? <AdminLoading label="Đang đọc trạng thái…" /> : <>
      {query.isError && <div className="mb-4 space-y-2"><AdminError title="Chưa đọc được trạng thái" error={query.error} onRetry={() => void query.refetch()} retrying={query.isFetching} />
        {status && <p className="text-xs text-muted">Đang hiển thị trạng thái đã đọc trước đó.</p>}</div>}
      {status && <div aria-busy={query.isFetching} className="space-y-5">
        <div className="space-y-2 text-sm">
          <p id="admin-sync-running" role="status" className={importing || status.running ? 'font-semibold text-amber-200' : 'text-neutral-300'}>
            {importing ? 'Đang xử lý yêu cầu nhập mẫu trong tab này' : status.running ? 'Backend đang có tác vụ đồng bộ' : 'Không ghi nhận tác vụ đang chạy'}
          </p>
          <p id="admin-sync-schedule" className="text-xs text-muted">{schedule}</p>
          {Number.isSafeInteger(interval) && interval > 0 && <p className="text-xs leading-relaxed text-muted">Chu kỳ: {interval % 60_000 === 0 ? `${formatSyncCount(interval / 60_000)} phút` : interval % 1_000 === 0 ? `${formatSyncCount(interval / 1_000)} giây` : `${formatSyncCount(interval)} ms`} sau mỗi lần hoàn tất.</p>}
        </div>
        <dl className="space-y-4 text-xs leading-relaxed">
          <div><dt className="text-muted">Lần thử online gần nhất</dt><dd id="admin-sync-last-attempt" className="mt-1.5 break-words font-medium tabular-nums text-white">{formatSyncTime(status.lastAttemptAt)}</dd></div>
          <div><dt className="text-muted">Online đầy đủ thành công gần nhất</dt><dd id="admin-sync-last-success" className="mt-1.5 break-words font-medium tabular-nums text-white">{formatSyncTime(status.lastSuccessAt)}</dd></div>
        </dl>
        {status.lastError && <div role="alert" className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
          <p className="font-semibold text-red-300">Lỗi online gần nhất</p><p id="admin-sync-online-error" className="mt-2 whitespace-pre-wrap break-words text-muted">{status.lastError}</p>
        </div>}
        <p className="text-[11px] leading-relaxed text-muted">Giờ Việt Nam (UTC+7). Trạng thái thuộc instance backend đang phục vụ và có thể mất khi khởi động lại; trường trống không xác nhận lịch sử trước đó.</p>
      </div>}
    </>}
  </aside>;
}
