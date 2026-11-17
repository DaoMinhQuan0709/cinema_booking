import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { isInternalShowtimeId } from '../../utils/showtimeId';
import { buildScheduleDays } from '../showtimes/scheduleUtils';
import { useCinemaShowtimes } from './hooks/useCinemaShowtimes';
import CinemaMovieGrid from './CinemaMovieGrid';
import CinemaShowtimePanel from './CinemaShowtimePanel';
import {
  dropUnavailableMovie, getOpenShowtimes, getVietnamNowKey, groupMoviesFromShowtimes,
  normalizeDetailParams, readDetailSelection, writeDetailSelection,
} from './cinemaDetailUtils';

const EMPTY_LIST = [];
const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

function useCinemaClock() {
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

const CinemaDetailSelection = ({ cinemaId }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useCinemaClock();
  const days = buildScheduleDays(now);
  const { date, movieId } = readDetailSelection(searchParams, days);
  const query = useCinemaShowtimes({ cinemaId, date });
  const hasData = Array.isArray(query.data);
  const invalidData = query.isSuccess && !hasData;
  const showtimeError = query.isError || invalidData;
  const openShowtimes = getOpenShowtimes(hasData ? query.data : EMPTY_LIST, getVietnamNowKey(now))
    .filter(slot => isInternalShowtimeId(slot.id) && String(slot.cinemaId) === String(cinemaId) && slot.startTime.slice(0, 10) === date);
  const movies = groupMoviesFromShowtimes(openShowtimes);
  const selectedMovie = movies.find(movie => movie.movieId === movieId);
  const currentSearch = searchParams.toString();
  const normalized = normalizeDetailParams(searchParams, days);
  const canonicalSearch = (query.isSuccess && !query.isFetching && hasData
    ? dropUnavailableMovie(normalized, movies) : normalized).toString();

  useEffect(() => {
    if (currentSearch !== canonicalSearch) {
      setSearchParams(previous => previous.toString() === currentSearch ? canonicalSearch : previous, {
        replace: true, preventScrollReset: true,
      });
    }
  }, [currentSearch, canonicalSearch, setSearchParams]);

  const changeSelection = selection => {
    setSearchParams(previous => writeDetailSelection(previous, selection), { preventScrollReset: true });
  };

  return (
    <section aria-label="Chọn ngày và phim tại rạp" className="mt-10 sm:mt-12">
      <div className="mb-5 flex items-center gap-3">
        <CalendarDays aria-hidden="true" className="h-6 w-6 text-primary" />
        <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">Lịch chiếu tại rạp</h2>
      </div>
      <div aria-label="Ngày chiếu" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 pt-1 sm:gap-3">
        {days.map(day => (
          <button
            key={day.date}
            type="button"
            aria-pressed={date === day.date}
            aria-label={`${day.label}, ${day.fullDate}`}
            onClick={() => changeSelection({ date: day.date })}
            className={`flex min-w-[94px] flex-1 shrink-0 flex-col items-center gap-1 rounded-xl border px-4 py-3.5 transition-colors ${FOCUS_CLASS} ${date === day.date ? 'border-primary bg-primary text-white' : 'border-surfaceBorder bg-surface/40 text-neutral-300 hover:border-neutral-500 hover:text-white'}`}
          >
            <span className="text-xs font-medium">{day.label}</span>
            <time dateTime={day.date} className="font-display text-xl font-extrabold tabular-nums sm:text-2xl">{day.dayMonth}</time>
          </button>
        ))}
      </div>

      <div className="mt-6 max-w-xl">
        <label htmlFor="cinema-detail-movie" className="mb-2 block text-sm font-medium text-white">Phim có suất chiếu</label>
        <select
          id="cinema-detail-movie"
          value={movieId}
          onChange={event => changeSelection({ movieId: event.target.value })}
          disabled={query.isFetching || !hasData || !movies.length}
          className={`w-full min-w-0 rounded-xl border border-surfaceBorder bg-surface px-3 py-3 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 ${FOCUS_CLASS}`}
        >
          <option value="">Chọn phim…</option>
          {movieId && !selectedMovie && <option value={movieId}>Đang kiểm tra phim đã chọn…</option>}
          {movies.map(movie => <option key={movie.movieId} value={movie.movieId}>{movie.title}</option>)}
        </select>
      </div>

      {movies.length > 0 && (
        <div className="mt-8">
          <CinemaMovieGrid movies={movies} selectedMovieId={movieId} onSelect={id => changeSelection({ movieId: id })} disabled={query.isFetching} />
        </div>
      )}

      {selectedMovie && <CinemaShowtimePanel movie={selectedMovie} />}

      {query.isPending && <p role="status" className="mt-5 text-sm text-muted">Đang tải suất chiếu tại rạp…</p>}
      {query.isFetching && hasData && <p role="status" className="mt-5 text-sm text-muted">Đang làm mới suất chiếu…</p>}
      {showtimeError && (
        <div role="alert" className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-white">
          <span>{hasData ? 'Chưa thể làm mới suất chiếu. Đang hiển thị dữ liệu trước đó.' : 'Không tải được suất chiếu. Vui lòng thử lại.'}</span>
          <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className={`inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 font-semibold hover:bg-primaryHover disabled:opacity-50 ${FOCUS_CLASS}`}>
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Thử lại
          </button>
        </div>
      )}
      {hasData && !query.isFetching && !showtimeError && (
        <p role="status" className="mt-5 text-sm text-muted">
          {!movies.length ? 'Rạp chưa có suất chiếu còn mở bán trong ngày này.' : selectedMovie
            ? `${selectedMovie.title}: ${selectedMovie.showtimes.length} suất chiếu còn mở bán.`
            : `${movies.length} phim có suất chiếu. Hãy chọn phim để xem lịch.`}
        </p>
      )}
    </section>
  );
};

export default CinemaDetailSelection;
