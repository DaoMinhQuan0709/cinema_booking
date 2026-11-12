import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, RefreshCw, Search, X } from 'lucide-react';
import { MovieImage } from '../movies/MovieImage';
import AdminTable from './components/AdminTable';
import MovieFormModal from './MovieFormModal';
import { useAdminMovies } from './hooks/useAdminQueries';
import { ADMIN_MOVIE_STATUSES, formatMovieDate, MOVIE_PAGE_SIZES, readMovieFilters, writeMovieFilters } from './movieForm';

const controlClass = 'min-h-11 rounded-xl border border-surfaceBorder bg-surface px-3 py-2.5 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';
const buttonClass = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function MovieFilters({ filters, onChange }) {
  const [keyword, setKeyword] = useState(filters.keyword);
  return (
    <form id="admin-movie-filters" role="search" aria-label="Tìm và lọc phim" onSubmit={event => { event.preventDefault(); onChange({ keyword: keyword.trim(), page: 0 }); }}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-surfaceBorder bg-surface/30 p-4 sm:p-5">
      <div className="min-w-0 flex-1 basis-full sm:basis-56">
        <label htmlFor="admin-movie-keyword" className="mb-2 block text-xs font-medium text-muted">Tìm theo tên phim</label>
        <input id="admin-movie-keyword" name="keyword" type="search" value={keyword} onChange={event => setKeyword(event.target.value)} maxLength={255}
          placeholder="Nhập tên phim…" className={`${controlClass} w-full`} />
      </div>
      <div className="min-w-0 flex-1 basis-40 sm:flex-none">
        <label htmlFor="admin-movie-status" className="mb-2 block text-xs font-medium text-muted">Trạng thái</label>
        <select id="admin-movie-status" name="status" value={filters.status} onChange={event => onChange({ status: event.target.value, keyword: keyword.trim(), page: 0 })} className={`${controlClass} w-full`}>
          <option value="">Tất cả trạng thái</option>
          {ADMIN_MOVIE_STATUSES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="admin-movie-size" className="mb-2 block text-xs font-medium text-muted">Phim mỗi trang</label>
        <select id="admin-movie-size" name="size" value={filters.size} onChange={event => onChange({ size: Number(event.target.value), keyword: keyword.trim(), page: 0 })} className={controlClass}>
          {MOVIE_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
        </select>
      </div>
      <button type="submit" className={`${buttonClass} border border-surfaceBorder text-white hover:bg-white/5`}><Search aria-hidden="true" className="h-4 w-4" />Áp dụng</button>
      {(filters.keyword || filters.status) && <button type="button" onClick={() => onChange({ keyword: '', status: '', page: 0 })}
        className={`${buttonClass} text-muted hover:text-white`}><X aria-hidden="true" className="h-4 w-4" />Xóa bộ lọc</button>}
    </form>
  );
}

export default function MovieManager() {
  const [params, setParams] = useSearchParams();
  const filters = readMovieFilters(params);
  const canonical = writeMovieFilters(params, filters).toString();
  const [editor, setEditor] = useState(null);
  const query = useAdminMovies({ page: filters.page, size: filters.size, sort: 'id,desc',
    ...(filters.keyword ? { keyword: filters.keyword } : {}), ...(filters.status ? { status: filters.status } : {}) });

  useEffect(() => {
    if (canonical !== params.toString()) setParams(canonical, { replace: true, preventScrollReset: true });
  }, [canonical, params, setParams]);

  const lastPage = Math.max(0, (query.data?.totalPages || 0) - 1);
  const resetPage = query.isSuccess && !query.isPlaceholderData && !query.isFetching && filters.page > lastPage;
  useEffect(() => {
    if (resetPage) setParams(previous => writeMovieFilters(previous, { ...readMovieFilters(previous), page: lastPage }), { replace: true, preventScrollReset: true });
  }, [resetPage, lastPage, setParams]);

  function changeFilters(changes) {
    setParams(previous => writeMovieFilters(previous, { ...readMovieFilters(previous), ...changes }), { preventScrollReset: true });
  }

  const columns = [
    { key: 'title', label: 'Phim', render: movie => <div className="flex min-w-56 items-start gap-3">
      <MovieImage src={movie.posterUrl} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded-md object-cover" />
      <div className="min-w-0">
        <p className="max-w-xs break-words font-semibold text-white">{movie.title}</p>
        <p className="mt-1 max-w-xs break-words text-xs leading-relaxed text-muted">{movie.genre || 'Chưa có thể loại'}</p>
        {movie.ageRating && <span className="mt-2 inline-block rounded border border-surfaceBorder px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300">{movie.ageRating}</span>}
      </div>
    </div> },
    { key: 'durationMinutes', label: 'Thời lượng', className: 'whitespace-nowrap', render: movie => movie.durationMinutes ? `${movie.durationMinutes} phút` : '—' },
    { key: 'releaseDate', label: 'Ngày phát hành', className: 'whitespace-nowrap', render: movie => formatMovieDate(movie.releaseDate) },
    { key: 'status', label: 'Trạng thái', className: 'whitespace-nowrap', render: movie => {
      const status = ADMIN_MOVIE_STATUSES.find(option => option.value === movie.status);
      return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${status?.className || 'border-surfaceBorder text-muted'}`}>{status?.label || 'Chưa xác định'}</span>;
    } },
    { key: 'actions', label: 'Thao tác', className: 'text-right', render: movie => <button type="button" aria-label={`Sửa phim ${movie.title}`} disabled={query.isFetching}
      onClick={() => setEditor({ movie })} className={`${buttonClass} min-h-10 border border-surfaceBorder px-3 text-neutral-300 hover:bg-white/5 hover:text-white`}>
      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />Sửa
    </button> },
  ];

  return (
    <section aria-labelledby="admin-page-title">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div className="border-l-4 border-primary pl-4">
          <h1 id="admin-page-title" className="font-display text-2xl font-bold text-white sm:text-3xl">Quản lý phim</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">Thêm phim, cập nhật thông tin và quản lý trạng thái hiển thị.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching} className={`${buttonClass} border border-surfaceBorder text-neutral-300 hover:bg-white/5`}>
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Làm mới
          </button>
          <button type="button" onClick={() => setEditor({ movie: null })} className={`${buttonClass} bg-primary text-white hover:bg-primaryHover`}><Plus aria-hidden="true" className="h-4 w-4" />Thêm phim</button>
        </div>
      </header>
      <MovieFilters key={JSON.stringify([filters.keyword, filters.status, filters.size])} filters={filters} onChange={changeFilters} />
      <p className="mb-3 text-xs text-muted sm:hidden">Vuốt ngang để xem đủ các cột trong bảng.</p>
      <AdminTable columns={columns} rows={query.data?.content || []} caption="Danh sách phim quản trị"
        loading={query.isPending || query.isPlaceholderData || resetPage} fetching={query.isFetching} error={query.error} onRetry={() => void query.refetch()}
        emptyTitle="Không có phim phù hợp" emptyDescription="Thử đổi bộ lọc hoặc thêm phim mới." pagination={query.data} onPageChange={page => changeFilters({ page })} />
      {editor && <MovieFormModal key={editor.movie?.id || 'create'} movie={editor.movie} onClose={() => setEditor(null)}
        onCheckList={() => query.refetch({ throwOnError: true })}
        onSaved={(_movie, created) => { setEditor(null); if (created && filters.page > 0) changeFilters({ page: 0 }); }} />}
    </section>
  );
}
