import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, CalendarX, ChevronRight, MapPin, RefreshCw, X } from 'lucide-react';
import { MovieImage } from '../movies/MovieImage';
import { useCinemas } from '../movies/hooks/useShowtimes';
import { formatCurrency } from '../../utils/formatCurrency';
import { useDailyShowtimes } from './hooks/useDailyShowtimes';
import {
  buildScheduleDays, getUpcomingShowtimes, groupScheduleByMovie,
  readScheduleFilters, resolveScheduleFilters, writeScheduleFilters,
} from './scheduleUtils';

const EMPTY_LIST = [];
const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

function useScheduleClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => {
      if (document.visibilityState !== 'hidden') setNow(new Date());
    };
    const timer = window.setInterval(update, 60 * 1000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);
  return now;
}

const ScheduleSelect = ({ name, label, allLabel, value, options, disabled, onChange, pendingLabel }) => (
  <div className="min-w-0">
    <label htmlFor={`schedule-${name}`} className="mb-2 block text-xs font-medium text-muted">{label}</label>
    <select
      id={`schedule-${name}`}
      value={value}
      onChange={event => onChange(name, event.target.value)}
      disabled={disabled}
      className="w-full min-w-0 cursor-pointer rounded-xl border border-surfaceBorder bg-surface px-3 py-3 text-sm text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-default disabled:opacity-50"
    >
      <option value="">{allLabel}</option>
      {value && !options.some(option => option.id === value) && <option value={value}>{pendingLabel}</option>}
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </div>
);

const ScheduleSkeleton = () => (
  <div role="status" className="space-y-6">
    <span className="sr-only">Đang tải lịch chiếu…</span>
    {[0, 1, 2].map(index => (
      <div key={index} aria-hidden="true" className="grid animate-pulse grid-cols-[72px_minmax(0,1fr)] gap-4 rounded-2xl border border-surfaceBorder bg-surface/40 p-5 motion-reduce:animate-none sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-6 sm:p-6">
        <div className="aspect-[2/3] rounded-lg bg-surface sm:row-span-2" />
        <div className="space-y-3 py-3">
          <div className="h-6 w-3/4 rounded bg-surface" />
          <div className="h-3 w-1/2 rounded bg-surface" />
        </div>
        <div className="col-span-2 flex flex-wrap gap-3 border-t border-surfaceBorder pt-5 sm:col-span-1 sm:col-start-2">
          {[0, 1, 2, 3].map(slot => <div key={slot} className="h-16 w-24 rounded-lg bg-surface" />)}
        </div>
      </div>
    ))}
  </div>
);

const MovieSchedule = ({ movie }) => (
  <article aria-labelledby={`schedule-movie-${movie.movieId}`} className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-x-4 gap-y-5 rounded-2xl border border-surfaceBorder bg-surface/30 p-5 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-x-6 sm:p-6">
    <Link to={`/movies/${movie.movieId}`} aria-label={`Xem chi tiết ${movie.title}`} className={`row-start-1 self-start overflow-hidden rounded-lg border border-surfaceBorder sm:row-span-2 ${FOCUS_CLASS}`}>
      <MovieImage src={movie.posterUrl} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover transition-opacity hover:opacity-80" />
    </Link>
    <header className="col-start-2 min-w-0 self-center sm:self-start">
      <h2 id={`schedule-movie-${movie.movieId}`} className="font-display text-lg font-bold leading-snug text-white sm:text-2xl">
        <Link to={`/movies/${movie.movieId}`} className={`rounded transition-colors hover:text-primary ${FOCUS_CLASS}`}>{movie.title}</Link>
      </h2>
      <p className="mt-2 text-xs text-muted sm:text-sm">{movie.cinemas.length} rạp · {movie.showtimeCount} suất chiếu</p>
      <Link to={`/movies/${movie.movieId}`} className={`mt-3 inline-flex items-center gap-1 rounded text-xs text-neutral-300 transition-colors hover:text-white ${FOCUS_CLASS}`}>
        Chi tiết phim <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </header>
    <div className="col-span-2 min-w-0 border-t border-surfaceBorder sm:col-span-1 sm:col-start-2">
      {movie.cinemas.map(cinema => (
        <section key={cinema.cinemaId} aria-label={cinema.name} className="grid min-w-0 gap-3 border-b border-surfaceBorder py-5 last:border-b-0 last:pb-0 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-5">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-relaxed text-white">{cinema.name}</h3>
            {cinema.city && <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted"><MapPin aria-hidden="true" className="h-3 w-3 shrink-0" />{cinema.city}</p>}
          </div>
          <div className="flex min-w-0 flex-wrap gap-2.5">
            {cinema.slots.map(slot => (
              <Link
                key={slot.id}
                to={`/booking/${slot.id}`}
                title={slot.auditoriumName}
                aria-label={`${slot.startTime.slice(11, 16)}, ${cinema.name}, ${slot.auditoriumName}`}
                className={`group flex min-w-[96px] flex-col items-center justify-center gap-1 rounded-lg border border-surfaceBorder bg-background px-3 py-2.5 transition-colors hover:border-primary hover:bg-primary/10 ${FOCUS_CLASS}`}
              >
                <time dateTime={slot.startTime} className="text-base font-bold tabular-nums text-white transition-colors group-hover:text-primary">{slot.startTime.slice(11, 16)}</time>
                <span className="text-[11px] text-muted">{slot.basePrice == null ? 'Xem giá vé' : `từ ${formatCurrency(slot.basePrice)}`}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  </article>
);

export const ShowtimesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useScheduleClock();
  const days = buildScheduleDays(now);
  const requested = readScheduleFilters(searchParams, days);
  const dailyQuery = useDailyShowtimes(requested.date);
  const cinemaQuery = useCinemas({}, { skipErrorToast: true });
  const hasData = Array.isArray(dailyQuery.data);
  const hasCinemaData = Array.isArray(cinemaQuery.data);
  const cinemas = hasCinemaData ? cinemaQuery.data : EMPTY_LIST;
  const upcoming = getUpcomingShowtimes(hasData ? dailyQuery.data : EMPTY_LIST, requested.date, now);
  const resolved = resolveScheduleFilters(upcoming, cinemas, requested, {
    canReset: dailyQuery.isSuccess && !dailyQuery.isFetching,
    hasCinemaData,
  });
  const { filters } = resolved;
  const groups = groupScheduleByMovie(resolved.showtimes, cinemas);
  const currentSearch = searchParams.toString();
  const canonicalSearch = writeScheduleFilters(searchParams, filters).toString();
  const hasFilters = Boolean(filters.city || filters.cinemaId || filters.movieId);
  const selectedDay = days.find(day => day.date === filters.date);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (currentSearch !== canonicalSearch) {
      // An older response must not replace a newer navigation's query string.
      setSearchParams(previous => previous.toString() === currentSearch ? canonicalSearch : previous, {
        replace: true, preventScrollReset: true,
      });
    }
  }, [currentSearch, canonicalSearch, setSearchParams]);

  function changeFilter(name, value) {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (value) next.set(name, value);
      else next.delete(name);
      if (name === 'city') next.delete('cinemaId');
      return next;
    }, { preventScrollReset: true });
  }

  function clearFilters() {
    setSearchParams(previous => writeScheduleFilters(previous, { date: filters.date }), { preventScrollReset: true });
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pb-16 pt-8 sm:px-10 sm:pb-24 lg:px-14">
      <nav aria-label="Đường dẫn" className="mb-10 flex items-center gap-2 text-xs text-muted">
        <Link to="/" className={`rounded transition-colors hover:text-white ${FOCUS_CLASS}`}>Trang chủ</Link>
        <ArrowRight aria-hidden="true" className="h-3 w-3" />
        <span aria-current="page" className="text-white">Lịch chiếu</span>
      </nav>

      <header className="mb-8 flex items-end justify-between gap-6 border-b border-surfaceBorder pb-8 sm:mb-10 sm:pb-10">
        <div className="max-w-2xl border-l-4 border-primary pl-5 sm:pl-7">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Hẹn nhau tại rạp</p>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">Lịch chiếu<span className="text-primary">.</span></h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted sm:text-base">Chọn ngày, tìm bộ phim yêu thích và giờ chiếu dành cho bạn.</p>
        </div>
        <CalendarDays aria-hidden="true" strokeWidth={1} className="hidden h-24 w-24 shrink-0 text-surfaceBorder md:block" />
      </header>

      <section aria-label="Chọn ngày và lọc lịch chiếu">
        <div aria-label="Ngày chiếu" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 pt-1 sm:gap-3">
          {days.map(day => (
            <button
              key={day.date}
              type="button"
              aria-pressed={day.date === filters.date}
              aria-label={`${day.label}, ${day.fullDate}`}
              onClick={() => changeFilter('date', day.date)}
              className={`flex min-w-[94px] flex-1 shrink-0 flex-col items-center gap-1 rounded-xl border px-4 py-3.5 transition-colors ${FOCUS_CLASS} ${day.date === filters.date ? 'border-primary bg-primary text-white' : 'border-surfaceBorder bg-surface/40 text-neutral-300 hover:border-neutral-500 hover:text-white'}`}
            >
              <span className="text-xs font-medium">{day.label}</span>
              <time dateTime={day.date} className="font-display text-xl font-extrabold tabular-nums sm:text-2xl">{day.dayMonth}</time>
            </button>
          ))}
        </div>

        <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-3 sm:gap-5">
          <ScheduleSelect name="city" label="Thành phố" allLabel="Tất cả thành phố" value={filters.city} options={resolved.cities} pendingLabel={filters.city} disabled={dailyQuery.isLoading || !hasCinemaData} onChange={changeFilter} />
          <ScheduleSelect name="cinemaId" label="Rạp" allLabel="Tất cả rạp" value={filters.cinemaId} options={resolved.cinemas} pendingLabel="Rạp đã chọn" disabled={dailyQuery.isLoading || !hasData} onChange={changeFilter} />
          <ScheduleSelect name="movieId" label="Phim" allLabel="Tất cả phim" value={filters.movieId} options={resolved.movies} pendingLabel="Phim đã chọn" disabled={dailyQuery.isLoading || !hasData} onChange={changeFilter} />
        </div>
      </section>

      {cinemaQuery.isError && (
        <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surfaceBorder bg-surface p-4 text-xs leading-relaxed text-muted">
          <p>{hasCinemaData ? 'Thông tin thành phố chưa được làm mới. Bạn vẫn có thể xem lịch và chọn suất.' : 'Chưa tải được thông tin thành phố. Bạn vẫn có thể lọc rạp, phim và chọn suất chiếu.'}</p>
          <button type="button" onClick={() => cinemaQuery.refetch()} disabled={cinemaQuery.isFetching} className={`inline-flex items-center gap-2 rounded font-semibold text-white hover:text-primary disabled:opacity-50 ${FOCUS_CLASS}`}>
            <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${cinemaQuery.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Thử lại thông tin rạp
          </button>
        </div>
      )}

      <section aria-label={`Lịch chiếu ngày ${selectedDay.fullDate}`} className="mt-8 sm:mt-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-surfaceBorder pb-5">
          <div role="status" aria-live="polite" className="text-sm text-muted">
            {dailyQuery.isLoading ? 'Đang tìm suất chiếu…' : hasData ? <><strong className="font-semibold text-white">{groups.length} phim</strong><span className="mx-2 text-surfaceBorder">/</span>{resolved.showtimes.length} suất chiếu · {selectedDay.fullDate}</> : `Ngày ${selectedDay.fullDate}`}
          </div>
          <div className="flex items-center gap-4">
            {hasFilters && <button type="button" onClick={clearFilters} className={`inline-flex items-center gap-1.5 rounded text-xs text-muted hover:text-white ${FOCUS_CLASS}`}><X aria-hidden="true" className="h-3.5 w-3.5" />Xóa bộ lọc</button>}
            {hasData && <button type="button" onClick={() => dailyQuery.refetch()} disabled={dailyQuery.isFetching} className={`inline-flex items-center gap-1.5 rounded text-xs text-muted hover:text-white disabled:opacity-50 ${FOCUS_CLASS}`}><RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${dailyQuery.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Làm mới</button>}
          </div>
        </div>

        {dailyQuery.isError && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <p className="text-sm leading-relaxed text-white">{hasData ? 'Chưa thể làm mới lịch chiếu. Đang hiển thị dữ liệu đã tải trước đó.' : 'Không tải được lịch chiếu. Vui lòng thử lại.'}</p>
            <button type="button" onClick={() => dailyQuery.refetch()} disabled={dailyQuery.isFetching} className={`inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primaryHover disabled:opacity-50 ${FOCUS_CLASS}`}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${dailyQuery.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Thử lại</button>
          </div>
        )}

        {dailyQuery.isLoading ? <ScheduleSkeleton /> : hasData && (groups.length ? (
          <div className="space-y-6">{groups.map(movie => <MovieSchedule key={movie.movieId} movie={movie} />)}</div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surfaceBorder px-5 py-16 text-center">
            <CalendarX aria-hidden="true" strokeWidth={1.5} className="mb-1 h-10 w-10 text-muted" />
            <h2 className="text-lg font-semibold text-white">{hasFilters ? 'Không có suất chiếu phù hợp' : 'Chưa có suất chiếu trong ngày này'}</h2>
            <p className="max-w-md text-sm leading-relaxed text-muted">{hasFilters ? 'Bạn hãy xóa bộ lọc hoặc chọn ngày khác để tìm thêm lịch chiếu.' : 'Bạn hãy chọn ngày khác hoặc quay lại sau để xem lịch mới.'}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className={`mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover ${FOCUS_CLASS}`}>Xóa bộ lọc</button>}
          </div>
        ))}
      </section>
    </div>
  );
};

export default ShowtimesPage;
