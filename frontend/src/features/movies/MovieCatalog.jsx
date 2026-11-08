import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Clapperboard, RefreshCw, Search, X } from 'lucide-react';
import { useComingSoonMovies, useNowShowingMovies } from './hooks/useMovies';
import { MovieList } from './MovieList';
import { filterCatalogMovies, MOVIE_SORTS, MOVIE_STATUSES } from './catalogFilters';

const EMPTY_MOVIES = [];

export const MovieCatalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') === 'COMING_SOON' ? 'COMING_SOON' : 'NOW_SHOWING';
  const keyword = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort');
  const sort = MOVIE_SORTS.some(option => option.key === sortParam) ? sortParam : 'default';
  const nowShowing = useNowShowingMovies();
  const comingSoon = useComingSoonMovies();
  const queries = { NOW_SHOWING: nowShowing, COMING_SOON: comingSoon };
  const current = queries[status];
  const movies = current.data?.content ?? EMPTY_MOVIES;
  const filteredMovies = filterCatalogMovies(movies, keyword, sort);
  const hasFilters = keyword.trim() || sort !== 'default';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  function updateParam(name, value, replace = false) {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set(name, value);
      else next.delete(name);
      return next;
    }, { replace, preventScrollReset: true });
  }

  function resetFilters() {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      next.delete('q');
      next.delete('sort');
      return next;
    }, { preventScrollReset: true });
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8 sm:px-10 sm:pb-24 lg:px-14">
      <nav aria-label="Đường dẫn" className="mb-10 flex items-center gap-2 text-xs text-muted">
        <Link to="/" className="rounded transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Trang chủ</Link>
        <ArrowRight aria-hidden="true" className="h-3 w-3" />
        <span aria-current="page" className="text-white">Phim</span>
      </nav>

      <header className="mb-10 flex items-end justify-between gap-6 border-b border-surfaceBorder pb-10 sm:mb-12">
        <div className="max-w-2xl border-l-4 border-primary pl-5 sm:pl-7">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Thế giới điện ảnh</p>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Khám phá <span className="text-primary">phim.</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
            Từ những câu chuyện đang lên màn ảnh đến những bộ phim bạn đang chờ đợi. Chọn bộ phim cho buổi hẹn tiếp theo.
          </p>
        </div>
        <Clapperboard aria-hidden="true" strokeWidth={1} className="hidden h-24 w-24 shrink-0 -rotate-12 text-surfaceBorder md:block" />
      </header>

      <section aria-label="Danh sách phim">
        <div className="mb-6 grid grid-cols-2 border-b border-surfaceBorder sm:flex sm:gap-8">
          {MOVIE_STATUSES.map(tab => (
            <button
              key={tab.key}
              type="button"
              aria-pressed={status === tab.key}
              onClick={() => updateParam('status', tab.key)}
              className={`relative flex items-center justify-center gap-2 border-b-2 px-1 pb-4 pt-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:justify-start sm:text-base ${status === tab.key ? 'border-primary text-white' : 'border-transparent text-muted hover:text-white'}`}
            >
              {tab.label}
              {queries[tab.key].data && (
                <span className={`rounded-md px-2 py-0.5 text-xs tabular-nums ${status === tab.key ? 'bg-primary/15 text-primary' : 'bg-surface text-muted'}`}>
                  {queries[tab.key].data.content.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-md">
            <label htmlFor="movie-search" className="mb-2 block text-xs font-medium text-muted">Tìm theo tên phim</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                id="movie-search"
                type="search"
                value={keyword}
                onChange={event => updateParam('q', event.target.value, true)}
                placeholder="Bạn muốn xem phim gì?"
                className="w-full rounded-xl border border-surfaceBorder bg-surface py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="w-full sm:w-56">
            <label htmlFor="movie-sort" className="mb-2 block text-xs font-medium text-muted">Sắp xếp</label>
            <select
              id="movie-sort"
              value={sort}
              onChange={event => updateParam('sort', event.target.value === 'default' ? '' : event.target.value)}
              className="w-full rounded-xl border border-surfaceBorder bg-surface px-3 py-3 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {MOVIE_SORTS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </div>
        </div>

        <div role="status" aria-live="polite" className="mb-5 flex min-h-6 flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p>{current.isLoading ? 'Đang tải danh sách phim…' : current.data ? `${filteredMovies.length} phim${keyword.trim() ? ` phù hợp với “${keyword.trim()}”` : ' dành cho bạn'}` : ''}</p>
          {hasFilters && (
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 rounded text-xs text-muted hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <X aria-hidden="true" className="h-3.5 w-3.5" /> Xóa bộ lọc
            </button>
          )}
        </div>

        {current.isError && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <p className="text-sm text-white">Không tải được danh sách phim. Vui lòng thử lại.</p>
            <button type="button" onClick={() => current.refetch()} disabled={current.isFetching} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              <RefreshCw aria-hidden="true" className="h-4 w-4" /> Thử lại
            </button>
          </div>
        )}

        {(!current.isError || current.data) && (
          <MovieList
            movies={filteredMovies}
            isLoading={current.isLoading}
            skeletonCount={15}
            emptyMessage={keyword.trim() ? 'Không tìm thấy phim phù hợp. Hãy thử tên khác hoặc xóa bộ lọc.' : status === 'COMING_SOON' ? 'Hiện chưa có phim sắp chiếu. Bạn quay lại sau nhé.' : 'Hiện chưa có phim đang chiếu. Bạn quay lại sau nhé.'}
          />
        )}
      </section>
    </div>
  );
};

export default MovieCatalog;
