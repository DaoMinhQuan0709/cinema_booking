import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, X } from 'lucide-react';
import { MovieImage } from '../movies/MovieImage';
import { formatCurrency } from '../../utils/formatCurrency';
import AdminTable from './components/AdminTable';
import { AdminError } from './components/AdminStates';
import { useAdminCinemas, useAdminMovieOptions, useAdminShowtimes } from './hooks/useAdminQueries';
import ShowtimeFormModal from './ShowtimeFormModal';
import { formatShowtimeTime, readShowtimeFilters, writeShowtimeFilters } from './showtimeForm';

const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const controlClass = 'min-h-11 w-full min-w-0 rounded-xl border border-surfaceBorder bg-surface px-3 py-2.5 text-sm text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function CatalogSelect({ name, label, value, items, disabled, onChange }) {
  return <div className="min-w-0">
    <label htmlFor={`admin-showtime-${name}`} className="mb-2 block text-xs font-medium text-muted">{label}</label>
    <select id={`admin-showtime-${name}`} name={name} value={value} disabled={disabled} onChange={event => onChange({ [name]: event.target.value })} className={controlClass}>
      <option value="">{name === 'movieId' ? 'Tất cả phim' : 'Tất cả rạp'}</option>
      {value && !items.some(item => String(item.id) === value) && <option value={value}>{label} #{value}</option>}
      {items.map(item => <option key={item.id} value={item.id}>{item.title || item.name}</option>)}
    </select>
  </div>;
}

export default function ShowtimeManager() {
  const [params, setParams] = useSearchParams();
  const filters = readShowtimeFilters(params);
  const currentSearch = params.toString();
  const canonical = writeShowtimeFilters(params, filters).toString();
  const [editor, setEditor] = useState(null);
  const moviesQuery = useAdminMovieOptions({ size: 100, sort: 'title,asc' });
  const cinemasQuery = useAdminCinemas();
  const query = useAdminShowtimes({ date: filters.date, ...(filters.cinemaId ? { cinemaId: filters.cinemaId } : {}), ...(filters.movieId ? { movieId: filters.movieId } : {}) });
  const movies = moviesQuery.data?.content || [];
  const cinemas = cinemasQuery.data || [];
  const canCreate = movies.length > 0 && cinemas.length > 0;

  useEffect(() => {
    if (canonical !== currentSearch) setParams(previous => previous.toString() === currentSearch ? canonical : previous, { replace: true, preventScrollReset: true });
  }, [canonical, currentSearch, setParams]);

  function changeFilters(changes) {
    setParams(previous => writeShowtimeFilters(previous, { ...readShowtimeFilters(previous), ...changes }), { preventScrollReset: true });
  }

  const columns = [
    { key: 'movieTitle', label: 'Phim', render: slot => <div className="flex min-w-52 items-start gap-3">
      <MovieImage src={slot.posterUrl} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded-md object-cover" />
      <div><p className="max-w-xs break-words font-semibold text-white">{slot.movieTitle}</p><p className="mt-2 text-xs text-muted">Suất #{slot.id}</p></div>
    </div> },
    { key: 'cinemaName', label: 'Rạp / Phòng', render: slot => <div className="min-w-36"><p className="font-medium text-white">{slot.cinemaName}</p><p className="mt-2 text-xs text-muted">{slot.auditoriumName}</p></div> },
    { key: 'startTime', label: 'Bắt đầu', className: 'whitespace-nowrap tabular-nums', render: slot => <time dateTime={`${slot.startTime}+07:00`}>{formatShowtimeTime(slot.startTime)}</time> },
    { key: 'endTime', label: 'Kết thúc', className: 'whitespace-nowrap tabular-nums', render: slot => <time dateTime={`${slot.endTime}+07:00`}>{formatShowtimeTime(slot.endTime)}</time> },
    { key: 'basePrice', label: 'Giá vé cơ bản', className: 'whitespace-nowrap text-right tabular-nums', render: slot => formatCurrency(slot.basePrice) },
  ];

  return (
    <section aria-labelledby="admin-page-title">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div className="border-l-4 border-primary pl-4">
          <h1 id="admin-page-title" className="font-display text-2xl font-bold text-white sm:text-3xl">Quản lý suất chiếu</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">Xem lịch đang mở bán và xếp suất chiếu mới theo từng phòng.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className={`${buttonClass} border border-surfaceBorder text-neutral-300 hover:bg-white/5`}>
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Làm mới
          </button>
          <button type="button" disabled={!canCreate} onClick={() => setEditor({ ...filters })} className={`${buttonClass} bg-primary text-white hover:bg-primaryHover`}><Plus aria-hidden="true" className="h-4 w-4" />Thêm suất chiếu</button>
        </div>
      </header>
      <div className="mb-5 grid gap-3">
        {moviesQuery.isError && <AdminError title="Không thể tải danh sách phim" error={moviesQuery.error} onRetry={() => void moviesQuery.refetch()} retrying={moviesQuery.isFetching} />}
        {cinemasQuery.isError && <AdminError title="Không thể tải danh sách rạp và phòng" error={cinemasQuery.error} onRetry={() => void cinemasQuery.refetch()} retrying={cinemasQuery.isFetching} />}
        {(moviesQuery.isPending || cinemasQuery.isPending) && <p role="status" className="text-sm text-muted">Đang tải phim, rạp và phòng để thêm suất…</p>}
        {moviesQuery.isSuccess && cinemasQuery.isSuccess && !canCreate && <p role="status" className="text-sm text-muted">Cần có phim và rạp trong danh mục trước khi thêm suất chiếu.</p>}
      </div>
      <form id="admin-showtime-filters" aria-label="Lọc suất chiếu" onSubmit={event => event.preventDefault()} className="mb-4 grid min-w-0 items-end gap-4 rounded-2xl border border-surfaceBorder bg-surface/30 p-4 sm:grid-cols-3 sm:p-5">
        <div className="min-w-0">
          <label htmlFor="admin-showtime-date" className="mb-2 block text-xs font-medium text-muted">Ngày chiếu</label>
          <input id="admin-showtime-date" name="date" type="date" max="9999-12-31" value={filters.date} onChange={event => changeFilters({ date: event.target.value })} className={`${controlClass} [color-scheme:dark]`} />
        </div>
        <CatalogSelect name="cinemaId" label="Rạp" value={filters.cinemaId} items={cinemas} disabled={!cinemasQuery.data} onChange={changeFilters} />
        <CatalogSelect name="movieId" label="Phim" value={filters.movieId} items={movies} disabled={!moviesQuery.data} onChange={changeFilters} />
        {(filters.cinemaId || filters.movieId) && <button type="button" onClick={() => changeFilters({ cinemaId: '', movieId: '' })} className={`${buttonClass} justify-self-start text-muted hover:text-white sm:col-span-3`}><X aria-hidden="true" className="h-4 w-4" />Xóa bộ lọc</button>}
      </form>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs leading-relaxed text-muted">
        <p>Chỉ hiển thị suất chưa bắt đầu, còn mở bán. Tất cả ngày giờ theo Việt Nam (UTC+7).</p>
        {query.data && <p role="status" className="tabular-nums">{query.data.length} suất chiếu</p>}
      </div>
      <p className="mb-3 text-xs text-muted sm:hidden">Vuốt ngang để xem đủ các cột trong bảng.</p>
      <AdminTable columns={columns} rows={query.data || []} caption="Danh sách suất chiếu quản trị" loading={query.isPending} fetching={query.isFetching}
        error={query.error} onRetry={() => void query.refetch()} emptyTitle="Không có suất chiếu phù hợp" emptyDescription="Chọn ngày, rạp hoặc phim khác; các suất đã bắt đầu không xuất hiện trong danh sách này." />
      {editor && <ShowtimeFormModal filters={editor} movies={movies} cinemas={cinemas} onClose={() => setEditor(null)} onCheckList={() => query.refetch({ throwOnError: true })}
        onSaved={slot => { setEditor(null); changeFilters({ date: slot.startTime.slice(0, 10), cinemaId: String(slot.cinemaId), movieId: String(slot.movieId) }); }} />}
    </section>
  );
}
