import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import { tokenStorage } from '../../config/tokenStorage';
import AdminModal from './components/AdminModal';
import { AdminError, AdminLoading } from './components/AdminStates';
import { useDeletionPreview } from './hooks/useAdminQueries';
import { useDeleteCatalog } from './hooks/useAdminMutations';
import { adminInvalidationKeys } from './adminKeys';
import { formatShowtimeTime } from './showtimeForm';

const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export default function DeleteCatalogModal({ kind, item, onClose, onDeleted }) {
  const query = useDeletionPreview(kind, item.id);
  const remove = useDeleteCatalog();
  const client = useQueryClient();
  const [mustCheck, setMustCheck] = useState(false);
  const [message, setMessage] = useState('');
  const session = useRef(tokenStorage.getSessionId());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && session.current === tokenStorage.getSessionId();
  const preview = query.data;
  const movie = kind === 'movies';

  async function finish() {
    await Promise.all(adminInvalidationKeys.sync.map(queryKey => client.invalidateQueries({ queryKey })));
    if (current()) onDeleted();
  }

  async function check() {
    setMessage('');
    const result = await query.refetch();
    if (!current()) return;
    if (result.isSuccess) {
      remove.reset();
      setMustCheck(false);
      if (result.data.deleted) {
        setMessage('Đã xác nhận dữ liệu đã được xóa.');
        await finish();
      } else setMessage('Đã kiểm tra lại. Hãy xem phạm vi và bấm xác nhận nếu vẫn muốn xóa.');
    }
  }

  async function submit() {
    if (mustCheck || !preview?.canDelete || query.isFetching || remove.isPending) return;
    setMessage('');
    try {
      await remove.mutateAsync({ kind, id: item.id, scopeToken: preview.scopeToken });
      if (current()) onDeleted();
    } catch {
      // Mọi lỗi đều yêu cầu GET mới trước lần xác nhận tiếp theo; không tự gửi lại DELETE.
      if (current()) setMustCheck(true);
    }
  }

  return <AdminModal open title={movie ? 'Xóa phim' : 'Xóa suất chiếu'} onClose={onClose} busy={remove.isPending}
    description="Gỡ khỏi danh sách hoạt động và ngăn Galaxy nhập lại. Giữ lịch sử đơn và báo cáo; hiện chưa có thao tác khôi phục."
    footer={<>
      <button type="button" disabled={remove.isPending} onClick={onClose} className={`${buttonClass} border border-surfaceBorder`}>Đóng</button>
      <button type="button" disabled={remove.isPending || query.isFetching} onClick={() => void check()} className={`${buttonClass} border border-surfaceBorder`}>
        <RefreshCw aria-hidden="true" className="h-4 w-4" />Kiểm tra lại</button>
      <button type="button" disabled={remove.isPending || query.isFetching || !query.isFetchedAfterMount || !preview?.canDelete || mustCheck || query.isError}
        onClick={() => void submit()} className={`${buttonClass} bg-primary text-white hover:bg-primaryHover`}>
        {remove.isPending ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
        {remove.isPending ? 'Đang xóa…' : 'Xác nhận xóa'}</button>
    </>}>
    {query.isPending && <AdminLoading label="Đang kiểm tra phạm vi xóa…" />}
    {query.isError && <AdminError title="Không thể kiểm tra phạm vi xóa" error={query.error} onRetry={() => void check()} />}
    {preview && <div className="space-y-4 text-sm leading-relaxed">
      <p className="break-words text-lg font-semibold">{preview.title}</p>
      {preview.deleted ? <p role="status">Dữ liệu đã được xóa khỏi danh sách hoạt động.</p>
        : <p>{movie ? `Xóa phim cùng ${preview.showtimeCount} suất chiếu chưa xóa trên toàn bộ phim, kể cả ngoài bộ lọc hiện tại.` : 'Chỉ xóa suất chiếu này; phim và các suất khác vẫn được giữ.'}</p>}
      {!movie && preview.showtimes?.map(slot => <p key={slot.id} className="rounded-xl border border-surfaceBorder p-4">
        {slot.cinemaName} · {slot.auditoriumName}<br />{formatShowtimeTime(slot.startTime.replace(' ', 'T'))}</p>)}
      {preview.blockers?.length > 0 && <div role="alert" className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-red-300">
        {preview.blockers.map(blocker => <p key={blocker.reason}>{blocker.message} ({blocker.count})</p>)}
      </div>}
    </div>}
    {remove.formError && <p role="alert" className="mt-4 rounded-xl border border-primary/30 p-4 text-sm text-red-300">
      {remove.outcomeUncertain ? 'Chưa xác định được kết quả xóa. Bấm Kiểm tra lại để đối chiếu trước khi thao tác tiếp.' : remove.formError}
    </p>}
    {message && <p role="status" className="mt-4 text-sm text-muted">{message}</p>}
  </AdminModal>;
}
