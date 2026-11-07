import { Film } from 'lucide-react';
import { MovieCard } from './MovieCard';

const SkeletonCard = () => (
  <div className="flex flex-col gap-3">
    <div className="aspect-[2/3] w-full animate-pulse rounded-xl border border-surfaceBorder bg-surface" />
    <div className="h-3.5 w-4/5 animate-pulse rounded bg-surface" />
    <div className="h-3 w-1/2 animate-pulse rounded bg-surface" />
  </div>
);

/**
 * Luoi hien thi danh sach phim (dung o Trang chu, Trang danh sach phim).
 * Tu xu ly 3 trang thai: dang tai (skeleton), rong (empty state), co du lieu.
 *
 * @param {Object} props
 * @param {object[]} [props.movies] danh sach MovieResponse tu backend
 * @param {boolean} [props.isLoading]
 * @param {string} [props.emptyMessage] thong diep khi danh sach rong
 * @param {number} [props.skeletonCount] so the skeleton hien thi khi dang tai
 */
export const MovieList = ({
  movies = [],
  isLoading = false,
  emptyMessage = 'Hiện chưa có phim nào trong danh mục này.',
  skeletonCount = 10,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!movies.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-surfaceBorder py-16 text-center">
        <Film className="h-8 w-8 text-muted" />
        <p className="max-w-xs text-sm text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
};

export default MovieList;
