import { Check } from 'lucide-react';
import { MovieImage } from '../movies/MovieImage';
import { useComingSoonMovies, useNowShowingMovies } from '../movies/hooks/useMovies';
import { AGE_RATING_STYLE, buildMovieLookup } from './movieGridUtils';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

/**
 * Lưới phim có suất tại rạp đang xem (6/3/2 cột theo màn hình).
 * Bấm phim chỉ chọn phim (không chuyển sang /movies/:id) để mở danh sách giờ chiếu.
 * Poster/nhãn tuổi lấy bổ sung từ danh sách phim đã cache; thiếu dữ liệu thì dùng poster của suất
 * và ẩn nhãn, không bịa điểm đánh giá.
 *
 * @param {{ movies: { movieId: string, title: string, posterUrl?: string|null, showtimes: object[] }[],
 *           selectedMovieId: string, onSelect: (movieId: string) => void }} props
 */
const CinemaMovieGrid = ({ movies, selectedMovieId, onSelect }) => {
  const nowShowing = useNowShowingMovies();
  const comingSoon = useComingSoonMovies();
  const lookup = buildMovieLookup(nowShowing.data, comingSoon.data);

  return (
    <section aria-label="Phim đang chiếu tại rạp" className="mb-10 sm:mb-12">
      <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted">Chọn phim</h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-6">
        {movies.map(movie => {
          const info = lookup.get(movie.movieId);
          const selected = movie.movieId === selectedMovieId;
          const rating = info?.ageRating;
          return (
            <li key={movie.movieId} className="min-w-0">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${movie.title}${rating ? `, ${rating}` : ''}, ${movie.showtimes.length} suất chiếu`}
                onClick={() => onSelect(movie.movieId)}
                className={`group flex w-full cursor-pointer flex-col gap-3 rounded-xl text-left ${FOCUS_CLASS}`}
              >
                <span className={`relative block overflow-hidden rounded-xl border-2 transition-colors ${selected ? 'border-primary' : 'border-transparent group-hover:border-neutral-600'}`}>
                  <MovieImage src={info?.posterUrl || movie.posterUrl} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" />
                  {rating && (
                    <span className={`absolute left-2 top-2 rounded border px-1.5 py-0.5 text-[10px] font-bold ${AGE_RATING_STYLE[rating] ?? 'border-surfaceBorder bg-surface text-neutral-300'}`}>{rating}</span>
                  )}
                  {selected && (
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-primary py-1.5 text-xs font-semibold text-white">
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />Đã chọn
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className={`line-clamp-2 block break-words text-sm font-semibold leading-snug transition-colors ${selected ? 'text-primary' : 'text-white group-hover:text-primary'}`}>{movie.title}</span>
                  <span className="mt-1 block text-xs text-muted">{movie.showtimes.length} suất chiếu</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default CinemaMovieGrid;
