import { AdminEmpty, AdminError, AdminLoading } from './AdminStates';

export function AdminPagination({ pageNo = 0, totalPages = 0, totalElements = 0, disabled = false, onPageChange }) {
  return (
    <nav aria-label="Phân trang bảng" className="flex flex-wrap items-center justify-between gap-3 border-t border-surfaceBorder px-5 py-4 text-sm">
      <p role="status" className="text-muted">{totalElements} mục · Trang {totalPages ? pageNo + 1 : 0}/{totalPages}</p>
      <div className="flex gap-2">
        {[
          { label: 'Trang trước', page: pageNo - 1, blocked: pageNo <= 0 },
          { label: 'Trang sau', page: pageNo + 1, blocked: totalPages === 0 || pageNo >= totalPages - 1 },
        ].map(({ label, page, blocked }) => (
          <button key={label} type="button" disabled={disabled || blocked || !onPageChange} onClick={() => onPageChange(page)}
            className="min-h-10 rounded-lg border border-surfaceBorder px-4 text-white hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

export default function AdminTable({ columns, rows = [], rowKey = 'id', caption, loading = false, fetching = false,
  error, onRetry, emptyTitle, emptyDescription, emptyAction, pagination, onPageChange }) {
  if (loading) return <AdminLoading />;
  if (error && rows.length === 0) return <AdminError error={error} onRetry={onRetry} retrying={fetching} />;
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-surfaceBorder bg-surface/40" aria-busy={fetching}>
      {error && <AdminError error={error} onRetry={onRetry} retrying={fetching} />}
      {fetching && <p role="status" className="border-b border-surfaceBorder px-5 py-2 text-xs text-muted">Đang cập nhật dữ liệu…</p>}
      {rows.length === 0 ? <AdminEmpty title={emptyTitle} description={emptyDescription} action={emptyAction} /> : (
        <div role="region" aria-label={caption || 'Bảng dữ liệu quản trị'} tabIndex={0}
          className="overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{caption || 'Bảng dữ liệu quản trị'}</caption>
            <thead className="border-b border-surfaceBorder bg-white/[0.025] text-xs text-muted">
              <tr>{columns.map(column => <th key={column.key} scope="col" className={`whitespace-nowrap px-5 py-4 font-semibold ${column.className || ''}`}>{column.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-surfaceBorder">
              {rows.map(row => (
                <tr key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey]} className="hover:bg-white/[0.025]">
                  {columns.map(column => <td key={column.key} className={`px-5 py-4 align-top ${column.className || ''}`}>
                    {column.render ? column.render(row) : row[column.key] ?? '—'}
                  </td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pagination && <AdminPagination {...pagination} disabled={fetching} onPageChange={onPageChange} />}
    </div>
  );
}
