import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Database, FileJson, LoaderCircle, TriangleAlert } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { tokenStorage } from '../../config/tokenStorage';
import AdminField from './components/AdminField';
import SyncOnlineStatus from './SyncOnlineStatus';
import { adminInvalidationKeys, adminKeys } from './adminKeys';
import { retryAdminQuery } from './adminErrors';
import { useSyncLocalFile } from './hooks/useAdminMutations';
import { useAdminSyncStatus } from './hooks/useAdminQueries';
import { DEFAULT_SYNC_LIMIT, formatSyncCount, formatSyncLimit, formatSyncTime, prepareSyncLimit, SYNC_COUNTERS, syncStatusPollInterval } from './syncUtils';

const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const catalogLinks = [
  { to: '/admin/movies', label: 'Danh sách phim' },
  { to: '/admin/showtimes', label: 'Suất mở bán' },
  { to: '/admin/reports', label: 'Báo cáo' },
];

export default function DataSync() {
  const [limit, setLimit] = useState(DEFAULT_SYNC_LIMIT);
  const [clientError, setClientError] = useState('');
  const [attempt, setAttempt] = useState(null);
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const [checkError, setCheckError] = useState('');
  const submitting = useRef(false);
  const limitRef = useRef(null);
  const save = useSyncLocalFile();
  const pendingImports = useIsMutating({ mutationKey: ['admin', 'mutation', 'sync-local-file'] });
  const importing = save.isPending || pendingImports > 0;
  const status = useAdminSyncStatus({ refetchInterval: query => syncStatusPollInterval(query, importing) });
  const locked = importing || status.data?.running === true;
  const client = useQueryClient();

  async function submit(event) {
    event.preventDefault();
    if (submitting.current || locked || checking || status.isPending) return;
    const { error, payload } = prepareSyncLimit(limit);
    setClientError(error || '');
    if (error) { limitRef.current?.focus(); return; }
    submitting.current = true;
    const request = { limit: payload.limitShowtimes, startedAt: new Date().toISOString() };
    setAttempt(request); setCatalog(null); setCheckError('');
    try {
      const data = await save.mutateAsync(payload);
      setResult({ data, request });
    } catch (error) {
      // Hook xử lý lỗi/toast; 409 chỉ đọc trạng thái, không tự gửi lại POST.
      if (error?.response?.status === 409) void status.refetch();
    } finally { submitting.current = false; }
  }

  async function checkCatalog() {
    if (checking || importing) return;
    const sessionId = tokenStorage.getSessionId();
    setChecking(true); setCheckError(''); setCatalog(null);
    const movieParams = { page: 0, size: 1, sort: 'id,desc' };
    const read = (queryKey, queryFn) => client.fetchQuery({ queryKey, queryFn, staleTime: 0, retry: retryAdminQuery });
    try {
      const [movies, cinemas, showtimes] = await Promise.all([
        read(adminKeys.movieList(movieParams), ({ signal }) => adminService.getMovies(movieParams, { signal })),
        read(adminKeys.cinemaList(), ({ signal }) => adminService.getCinemas({}, { signal })),
        read(adminKeys.showtimeList(), ({ signal }) => adminService.getShowtimes({}, { signal })),
        status.refetch({ throwOnError: true }),
      ]);
      if (sessionId !== tokenStorage.getSessionId()) return;
      await Promise.all(adminInvalidationKeys.sync.map(queryKey => client.invalidateQueries({ queryKey })));
      setCatalog({ movies: movies.totalElements, cinemas: cinemas.length, showtimes: showtimes.length, checkedAt: new Date().toISOString() });
    } catch {
      setCheckError('Chưa đọc đủ dữ liệu để đối chiếu. Hãy thử đọc lại trước khi gửi lại yêu cầu nhập.');
    } finally { setChecking(false); }
  }

  return (
    <section aria-labelledby="admin-page-title" className="min-w-0">
      <header className="mb-7 border-l-4 border-primary pl-4">
        <h1 id="admin-page-title" className="font-display text-2xl font-bold text-white sm:text-3xl">Nhập dữ liệu mẫu</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Nhập catalog Galaxy từ file offline đã đóng gói trong backend.</p>
      </header>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="admin-sync-form-title" className="rounded-2xl border border-surfaceBorder bg-surface/30 p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <FileJson aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-primary" />
              <div className="min-w-0"><span className="mb-2 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-200">Galaxy mẫu · Offline</span>
                <h2 id="admin-sync-form-title" className="font-display text-lg font-bold text-white">Nhập file mẫu</h2>
                <p className="mt-2 break-all text-xs text-muted">data/galaxy_sessions.json</p>
              </div>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-muted">Ngày trong file được giữ nguyên. File cũ có thể cập nhật phim nhưng không thêm suất tương lai. Lịch online tự động có thể cập nhật lại các bản ghi Galaxy sau đó.</p>
            <form id="admin-sync-form" onSubmit={submit} noValidate className="space-y-5" aria-busy={importing}>
              <fieldset disabled={locked} className="min-w-0">
                <AdminField label="Giới hạn suất chiếu" required error={clientError || save.fieldErrors.limitShowtimes}
                  hint="Mặc định 100; 0 là tất cả suất tương lai trong file. Giới hạn không áp dụng cho số phim xử lý.">
                  <input ref={limitRef} name="limitShowtimes" type="number" inputMode="numeric" min="0" max="2147483647" step="1" value={limit}
                    onChange={event => { setLimit(event.target.value); setClientError(''); save.clearFieldError('limitShowtimes'); }} />
                </AdminField>
              </fieldset>
              <button type="submit" disabled={locked || checking || status.isPending} className={`${buttonClass} bg-primary text-white hover:bg-primaryHover`}>
                {importing ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Database aria-hidden="true" className="h-4 w-4" />}
                {importing ? 'Đang nhập mẫu…' : 'Nhập Galaxy mẫu'}
              </button>
              {importing && <p role="status" className="text-sm leading-relaxed text-muted">Đang chờ kết quả từ backend. Yêu cầu đang chạy được giữ khi chuyển qua các trang Admin trong tab này.</p>}
              {!importing && status.data?.running && <p role="status" className="text-sm text-amber-200">Backend đang có tác vụ đồng bộ. Trạng thái sẽ được đọc lại để mở nút khi hoàn tất.</p>}
            </form>
            {save.formError && <div role="alert" className="mt-5 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed text-red-300">
              <p>{save.outcomeUncertain ? 'Chưa xác định được kết quả nhập. Backend có thể vẫn đang xử lý; hãy đọc lại catalog và trạng thái trước khi gửi lại.' : save.formError}</p>
              {attempt && <p className="text-xs text-muted">Giới hạn lần gửi: {formatSyncLimit(attempt.limit)} · Gửi từ tab này lúc {formatSyncTime(attempt.startedAt)} (Việt Nam).</p>}
              {save.error?.response?.status === 409 && <p className="text-xs text-muted">Có tác vụ khác đang đồng bộ. Chờ trạng thái cập nhật trước khi chủ động thử lại.</p>}
              {save.outcomeUncertain && <button type="button" onClick={() => void checkCatalog()} disabled={checking || importing} className={`${buttonClass} border border-surfaceBorder text-white hover:bg-white/5`}>
                {checking ? 'Đang đọc catalog…' : 'Đọc catalog để đối chiếu'}
              </button>}
            </div>}
            {checkError && <p role="alert" className="mt-4 text-sm leading-relaxed text-red-300">{checkError}</p>}
            {catalog && <div id="admin-sync-catalog-check" role="status" className="mt-4 rounded-xl border border-surfaceBorder bg-background p-4 text-sm leading-relaxed text-neutral-300">
              <p>Catalog đã đọc lúc {formatSyncTime(catalog.checkedAt)} (Việt Nam): {formatSyncCount(catalog.movies)} phim · {formatSyncCount(catalog.cinemas)} rạp · {formatSyncCount(catalog.showtimes)} suất còn mở bán.</p>
              <p className="mt-2 text-xs text-muted">Đây là dữ liệu hiện tại để đối chiếu, không xác nhận lần nhập đã hoàn tất. Kiểm tra danh sách trước khi gửi lại.</p>
            </div>}
            <p className="mt-5 text-xs leading-relaxed text-muted">Đây là dữ liệu mẫu offline, không chứng minh catalog Galaxy đang được cập nhật online. Các bộ đếm gồm cả bản ghi thêm mới và cập nhật.</p>
          </section>

          {result ? <section id="admin-sync-result" aria-labelledby="admin-sync-result-title" className="rounded-2xl border border-surfaceBorder bg-surface/30 p-5 sm:p-6">
            <header className="mb-5">
              <h2 id="admin-sync-result-title" className="font-display text-lg font-bold text-white">Kết quả nhập mẫu gần nhất</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted">Kết quả nhận trong lần mở trang này; tải lại hoặc rời trang sẽ không giữ lịch sử kết quả.</p>
              {(importing || save.isError) && <p className="mt-2 text-xs text-amber-200">Đang hiển thị kết quả của lần nhập thành công trước đó.</p>}
            </header>
            <dl className="mb-5 space-y-3 border-b border-surfaceBorder pb-5 text-sm">
              <div><dt className="text-xs text-muted">Nguồn phản hồi</dt><dd id="admin-sync-result-source" className="mt-1 font-semibold text-white">{result.data?.source === 'LOCAL_FILE' ? 'File mẫu offline (LOCAL_FILE)' : 'Chưa xác nhận nguồn file mẫu'}</dd></div>
              <div><dt className="text-xs text-muted">Backend hoàn tất lúc · giờ Việt Nam</dt><dd id="admin-sync-result-time" className="mt-1 break-words tabular-nums text-white">{formatSyncTime(result.data?.syncedAt)}</dd></div>
              <div><dt className="text-xs text-muted">Giới hạn đã gửi</dt><dd id="admin-sync-result-limit" className="mt-1 text-white">{formatSyncLimit(result.request.limit)}</dd></div>
            </dl>
            {result.data?.source !== 'LOCAL_FILE' && <p role="alert" className="mb-4 text-sm text-amber-200">Phản hồi chưa xác nhận nguồn LOCAL_FILE. Hãy đối chiếu dữ liệu trước khi coi đây là kết quả file mẫu.</p>}
            {result.data?.message && <p className="mb-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-300">{result.data.message}</p>}
            <dl className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3">
              {SYNC_COUNTERS.map(({ key, label }) => <div key={key} className="min-w-0 rounded-xl border border-surfaceBorder bg-background p-4">
                <dt className="text-xs leading-relaxed text-muted">{label}</dt><dd id={`admin-sync-count-${key}`} className="mt-3 break-words font-display text-2xl font-bold tabular-nums text-white">{formatSyncCount(result.data?.[key])}</dd>
              </div>)}
            </dl>
            {Number(result.data?.totalShowtimesSkipped) > 0 && <div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm leading-relaxed text-amber-200">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /><p>Có {formatSyncCount(result.data.totalShowtimesSkipped)} suất bị bỏ qua do thay đổi lịch/phòng. Cần đối chiếu lịch và vé liên quan.</p>
            </div>}
            <p className="mt-5 text-xs leading-relaxed text-muted">Nhập catalog không tạo ghế. Ghế được tạo khi mở sơ đồ suất lần đầu; trạng thái ghế và vé đang có được giữ theo backend.</p>
          </section> : <p className="px-1 text-sm leading-relaxed text-muted">Chưa có kết quả nhập mẫu trong lần mở trang này. Trạng thái online bên cạnh không phải lịch sử nhập offline.</p>}

          <nav aria-label="Đối chiếu dữ liệu sau nhập" className="flex flex-wrap gap-3">
            {catalogLinks.map(link => <Link key={link.to} to={link.to} className={`${buttonClass} border border-surfaceBorder text-neutral-300 hover:bg-white/5`}>{link.label}<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>)}
          </nav>
        </div>
        <SyncOnlineStatus query={status} importing={importing} />
      </div>
    </section>
  );
}
