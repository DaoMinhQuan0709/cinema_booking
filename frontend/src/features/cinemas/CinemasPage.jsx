import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, RefreshCw, Search, SearchX, X } from 'lucide-react';
import { useCinemas } from '../movies/hooks/useShowtimes';
import CinemaCard from './CinemaCard';
import { filterCinemas, getCinemaCities, readCinemaFilters, writeCinemaFilters } from './cinemaUtils';

const EMPTY_LIST = [];
const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
const FIELD_CLASS = 'w-full min-w-0 rounded-xl border border-surfaceBorder bg-surface py-3 text-sm text-white outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-1 focus:ring-primary';

const CinemasSkeleton = () => (
  <div role="status" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <span className="sr-only">Đang tải danh sách rạp…</span>
    {[0, 1, 2, 3, 4, 5].map(index => (
      <div key={index} aria-hidden="true" className="overflow-hidden rounded-2xl border border-surfaceBorder bg-surface/30 motion-safe:animate-pulse">
        <div className="aspect-video bg-surface" />
        <div className="space-y-4 p-6">
          <div className="h-3 w-1/3 rounded bg-surface" /><div className="h-6 w-3/4 rounded bg-surface" />
          <div className="h-12 rounded bg-surface" /><div className="h-10 rounded bg-surface" />
        </div>
      </div>
    ))}
  </div>
);

const CinemasPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readCinemaFilters(searchParams);
  const query = useCinemas({}, { skipErrorToast: true });
  const hasData = Array.isArray(query.data);
  const cinemas = hasData ? query.data : EMPTY_LIST;
  const cities = getCinemaCities(cinemas);
  const visible = filterCinemas(cinemas, filters);
  const hasFilters = Boolean(filters.q.trim() || filters.city);
  const currentSearch = searchParams.toString();
  const canonicalSearch = writeCinemaFilters(searchParams, filters).toString();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (currentSearch !== canonicalSearch) {
      setSearchParams(previous => previous.toString() === currentSearch ? canonicalSearch : previous, {
        replace: true, preventScrollReset: true,
      });
    }
  }, [currentSearch, canonicalSearch, setSearchParams]);

  const changeFilter = (name, value) => {
    setSearchParams(previous => writeCinemaFilters(previous, { ...readCinemaFilters(previous), [name]: value }), {
      replace: name === 'q', preventScrollReset: true,
    });
  };

  const clearFilters = () => setSearchParams(previous => writeCinemaFilters(previous, {}), { preventScrollReset: true });

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8 sm:px-10 sm:pb-24 lg:px-14">
      <nav aria-label="Đường dẫn" className="mb-10 flex items-center gap-2 text-xs text-muted">
        <Link to="/" className={`rounded transition-colors hover:text-white ${FOCUS_CLASS}`}>Trang chủ</Link>
        <ArrowRight aria-hidden="true" className="h-3 w-3" />
        <span aria-current="page" className="text-white">Rạp chiếu phim</span>
      </nav>

      <header className="mb-8 flex items-end justify-between gap-6 border-b border-surfaceBorder pb-8 sm:mb-10 sm:pb-10">
        <div className="max-w-2xl border-l-4 border-primary pl-5 sm:pl-7">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Điểm hẹn màn ảnh lớn</p>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">Rạp chiếu phim<span className="text-primary">.</span></h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted sm:text-base">Tìm rạp cho buổi hẹn tiếp theo. Khám phá không gian, xem địa chỉ và chọn lịch chiếu dành cho bạn.</p>
        </div>
        {hasData && <p className="hidden shrink-0 border-l border-surfaceBorder pl-8 text-right md:block"><strong className="block font-display text-6xl font-extrabold tabular-nums tracking-tight text-white">{cinemas.length}</strong><span className="mt-2 block text-xs text-muted">rạp trong danh sách</span></p>}
      </header>

      <section aria-label="Tìm và lọc rạp" className="mb-8 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(200px,280px)] sm:gap-5">
        <div className="min-w-0">
          <label htmlFor="cinema-search" className="mb-2 block text-xs font-medium text-muted">Tìm theo tên rạp</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input id="cinema-search" type="search" value={filters.q} maxLength={200} onChange={event => changeFilter('q', event.target.value)} placeholder="Nhập tên rạp bạn muốn tìm…" className={`${FIELD_CLASS} pl-11 pr-4`} />
          </div>
        </div>
        <div className="min-w-0">
          <label htmlFor="cinema-city" className="mb-2 block text-xs font-medium text-muted">Tỉnh / thành phố</label>
          <select id="cinema-city" value={filters.city} onChange={event => changeFilter('city', event.target.value)} className={`${FIELD_CLASS} cursor-pointer px-3`}>
            <option value="">Tất cả tỉnh / thành phố</option>
            {filters.city && !cities.includes(filters.city) && <option value={filters.city}>{filters.city}</option>}
            {cities.map(city => <option key={city} value={city}>{city}</option>)}
          </select>
        </div>
      </section>

      <section aria-label="Danh sách rạp">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-surfaceBorder pb-5">
          <p role="status" aria-live="polite" className="text-sm text-muted">{query.isLoading ? 'Đang tìm rạp…' : hasData ? <><strong className="font-semibold text-white">{visible.length} rạp</strong>{hasFilters ? ' phù hợp' : ' dành cho bạn'}</> : 'Danh sách rạp'}</p>
          <div className="flex flex-wrap items-center gap-4">
            {hasFilters && <button type="button" onClick={clearFilters} className={`inline-flex min-h-10 items-center gap-1.5 rounded text-xs text-muted hover:text-white ${FOCUS_CLASS}`}><X aria-hidden="true" className="h-3.5 w-3.5" />Xóa bộ lọc</button>}
            {hasData && <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className={`inline-flex min-h-10 items-center gap-1.5 rounded text-xs text-muted hover:text-white disabled:opacity-50 ${FOCUS_CLASS}`}><RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Làm mới</button>}
          </div>
        </div>

        {query.isError && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <p className="max-w-2xl text-sm leading-relaxed text-white">{hasData ? 'Chưa thể làm mới danh sách rạp. Đang hiển thị dữ liệu đã tải trước đó.' : 'Không tải được danh sách rạp. Vui lòng thử lại.'}</p>
            <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className={`inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50 ${FOCUS_CLASS}`}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Thử lại</button>
          </div>
        )}

        {query.isLoading ? <CinemasSkeleton /> : hasData && (visible.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{visible.map(cinema => <CinemaCard key={cinema.id} cinema={cinema} />)}</div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surfaceBorder px-5 py-16 text-center">
            {hasFilters ? <SearchX aria-hidden="true" strokeWidth={1.5} className="mb-1 h-10 w-10 text-muted" /> : <Building2 aria-hidden="true" strokeWidth={1.5} className="mb-1 h-10 w-10 text-muted" />}
            <h2 className="text-lg font-semibold text-white">{hasFilters ? 'Không tìm thấy rạp phù hợp' : 'Chưa có rạp trong danh sách'}</h2>
            <p className="max-w-md text-sm leading-relaxed text-muted">{hasFilters ? 'Bạn hãy thử tên khác hoặc xóa bộ lọc để xem thêm rạp.' : 'Bạn hãy quay lại sau hoặc làm mới để xem thông tin rạp được cập nhật.'}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className={`mt-2 min-h-11 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover ${FOCUS_CLASS}`}>Xóa bộ lọc</button>}
          </div>
        ))}
      </section>
    </div>
  );
};

export default CinemasPage;
