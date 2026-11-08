import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Film, Play } from 'lucide-react';
import { useMovieDetail } from './hooks/useMovies';
import { TrailerModal } from './TrailerModal';
import { ShowtimeSelector } from './ShowtimeSelector';

const AGE_RATING_STYLE = {
  P: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
  C13: 'border-amber-500 text-amber-400 bg-amber-500/10',
  C16: 'border-orange-500 text-orange-400 bg-orange-500/10',
  C18: 'border-primary text-primary bg-primary/10',
};

function formatDuration(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h}g ${m}p`;
}

function formatReleaseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const DetailSkeleton = () => (
  <div className="mx-auto w-full max-w-[1200px] animate-pulse px-6 py-10 sm:px-10 lg:px-14">
    <div className="mb-8 h-5 w-32 rounded bg-surface" />
    <div className="flex flex-col gap-8 sm:flex-row">
      <div className="aspect-[2/3] w-full max-w-[260px] rounded-xl border border-surfaceBorder bg-surface" />
      <div className="flex-1 space-y-4">
        <div className="h-9 w-3/4 rounded bg-surface" />
        <div className="h-4 w-1/2 rounded bg-surface" />
        <div className="h-24 w-full rounded bg-surface" />
      </div>
    </div>
  </div>
);

/**
 * Trang chi tiet 1 phim (/movies/:id): banner mo, poster, the loai, thoi luong,
 * ngay khoi chieu, do tuoi, mo ta va nut xem Trailer (mo TrailerModal).
 * Phia duoi la ShowtimeSelector (chon ngay / thanh pho / rap / gio chieu).
 */
export const MovieDetail = () => {
  const { id } = useParams();
  const { data: movie, isLoading, isError } = useMovieDetail(id);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

  if (isLoading) return <DetailSkeleton />;

  if (isError || !movie) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <Film className="h-10 w-10 text-muted" />
        <h2 className="text-xl font-bold text-white">Không tìm thấy phim này</h2>
        <p className="max-w-xs text-sm text-muted">Phim có thể đã bị gỡ hoặc đường dẫn không đúng.</p>
        <Link
          to="/"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primaryHover"
        >
          <ArrowLeft className="h-4 w-4" />
          Về trang chủ
        </Link>
      </div>
    );
  }

  const { title, description, durationMinutes, releaseDate, posterUrl, trailerUrl, genre, ageRating, status } =
    movie;

  const ratingClass = AGE_RATING_STYLE[ageRating] || 'border-surfaceBorder text-neutral-300 bg-surface';
  const duration = formatDuration(durationMinutes);
  const releaseLabel = formatReleaseDate(releaseDate);
  const isComingSoon = status === 'COMING_SOON';

  return (
    <div className="flex-1">
      {/* Banner mo phia sau */}
      <div className="relative h-[280px] w-full overflow-hidden sm:h-[380px]">
        {posterUrl && (
          <img
            src={posterUrl}
            alt=""
            aria-hidden="true"
            className="h-full w-full scale-110 object-cover opacity-40 blur-2xl"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/40" />
      </div>

      <div className="mx-auto -mt-32 w-full max-w-[1200px] px-6 pb-16 sm:-mt-48 sm:px-10 lg:px-14">
        <Link
          to="/"
          className="relative mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Link>

        <div className="relative flex flex-col gap-8 sm:flex-row">
          {/* Poster */}
          <div className="mx-auto w-full max-w-[220px] shrink-0 sm:mx-0 sm:max-w-[260px]">
            <div className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-surfaceBorder bg-surface shadow-2xl shadow-black/60">
              {posterUrl ? (
                <img src={posterUrl} alt={title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted">
                  <Film className="h-12 w-12" />
                </div>
              )}
            </div>
          </div>

          {/* Thong tin */}
          <div className="flex-1 pt-2">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {ageRating && (
                <span className={`rounded-md border px-2 py-0.5 text-xs font-bold tracking-wide ${ratingClass}`}>
                  {ageRating}
                </span>
              )}
              {isComingSoon && (
                <span className="rounded-md border border-surfaceBorder bg-surface px-2 py-0.5 text-xs font-semibold text-neutral-300">
                  Sắp chiếu
                </span>
              )}
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
              {duration && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {duration}
                </span>
              )}
              {releaseLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  Khởi chiếu {releaseLabel}
                </span>
              )}
              {genre && <span>{genre}</span>}
            </div>

            {description && (
              <p className="mt-6 max-w-2xl text-sm leading-relaxed text-neutral-300">{description}</p>
            )}

            {trailerUrl && (
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => setIsTrailerOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-surfaceBorder bg-surface px-5 py-2.5 text-sm font-semibold text-white transition-all hover:border-primary/50 hover:bg-surface/80"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Xem Trailer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chon suat chieu */}
        <div className="mt-14 border-t border-surfaceBorder pt-10">
          <ShowtimeSelector movieId={movie.id} />
        </div>
      </div>

      <TrailerModal
        isOpen={isTrailerOpen}
        onClose={() => setIsTrailerOpen(false)}
        trailerUrl={trailerUrl}
        title={title}
      />
    </div>
  );
};

export default MovieDetail;
