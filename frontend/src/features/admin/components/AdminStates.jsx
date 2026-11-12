import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import { getAdminError } from '../adminErrors';

export function AdminLoading({ label = 'Đang tải dữ liệu…' }) {
  return (
    <div role="status" className="flex min-h-40 items-center justify-center gap-3 px-5 py-10 text-sm text-muted">
      <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none text-primary" />
      {label}
    </div>
  );
}

export function AdminEmpty({ title = 'Chưa có dữ liệu', description = 'Dữ liệu phù hợp sẽ xuất hiện tại đây.', action }) {
  return (
    <div role="status" className="flex min-h-48 flex-col items-center px-5 py-10 text-center">
      <Inbox aria-hidden="true" className="mb-3 h-8 w-8 text-muted" />
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function AdminError({ error, title = 'Không thể tải dữ liệu', onRetry, retrying = false }) {
  return (
    <div role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
      <AlertCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">{title}</p>
        <p className="mt-1 break-words text-sm text-muted">{getAdminError(error).message}</p>
      </div>
      {onRetry && <button type="button" disabled={retrying} onClick={onRetry}
        className="rounded-lg border border-surfaceBorder px-4 py-2 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        {retrying ? 'Đang thử lại…' : 'Thử lại'}
      </button>}
    </div>
  );
}
