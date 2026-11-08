import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Calendar, Clock, Film, Play } from 'lucide-react';
import { useMovieDetail, useMoviePreview } from './hooks/useMovies';
import { MovieImage } from './MovieImage';
import { TrailerModal } from './TrailerModal';
import { ShowtimeSelector } from './ShowtimeSelector';
import { getYouTubeVideoId } from './trailerUtils';

const AGE_RATING_STYLE = {
  P: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400',
  C13: 'border-amber-500/50 bg-amber-500/15 text-amber-400',
  C16: 'border-orange-500/50 bg-orange-500/15 text-orange-400',
  C18: 'border-primary/50 bg-primary/15 text-primary',
};
const EMPTY_MOVIES = [];

function formatReleaseDate(value) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

const DetailSkeleton = () => (
  <div aria-label="Đang tải thông tin phim" aria-busy="true" className="animate-pulse motion-reduce:animate-none">
    <div className="h-60 bg-surface sm:h-96" />
    <div className="mx-auto grid max-w-[1440px] gap-8 px-6 py-8 sm:grid-cols-[220px_minmax(0,1fr)] sm:px-10 lg:px-14">
      <div className="aspect-[2/3] w-44 rounded-xl bg-surface sm:w-full" />
      <div className="space-y-5 pt-3">
        <div className="h-4 w-1/2 rounded bg-surface" />
        <div className="h-9 w-3/4 rounded bg-surface" />
        <div className="h-24 rounded bg-surface" />
      </div>
    </div>
  </div>
);

const MetadataRow = ({ label, values }) => values?.length ? (
  <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
    <dt className="pt-2 text-sm text-muted">{label}</dt>
    <dd className="flex min-w-0 flex-wrap gap-2">
      {values.map(value => (
        <span key={value} className="max-w-full break-words rounded-lg border border-surfaceBorder bg-surface/60 px-3 py-1.5 text-sm leading-relaxed text-neutral-200">
          {value}
        </span>
      ))}
    </dd>
  </div>
) : null;

const RelatedMovies = ({ movies }) => (
  <aside aria-label="Phim đang chiếu" className="min-w-0 border-t border-surfaceBorder pt-8 lg:border-t-0 lg:pt-8">
    <h2 className="mb-6 border-l-4 border-primary pl-3 text-lg font-bold uppercase tracking-wide text-white">Phim đang chiếu</h2>
    <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-1">
      {movies.map(movie => (
        <Link key={movie.id} to={`/movies/${movie.id}`} className="group block min-w-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-surfaceBorder bg-surface">
            <MovieImage src={movie.landscapeUrl} fallbackSrc={movie.posterUrl} alt={movie.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none" />
            {movie.ageRating && <span className="absolute bottom-3 right-3 rounded-md bg-background/90 px-2 py-1 text-xs font-bold text-white">{movie.ageRating}</span>}
          </div>
          <h3 className="mt-3 text-sm font-semibold leading-relaxed text-white transition-colors group-hover:text-primary">{movie.title}</h3>
        </Link>
      ))}
    </div>
    <Link to="/movies?status=NOW_SHOWING" className="mt-6 inline-flex items-center gap-2 rounded text-sm font-semibold text-primary hover:text-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
      Tất cả phim đang chiếu <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </Link>
  </aside>
);

const MovieDetailContent = ({ movie, recommendations }) => {
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const { title, description, durationMinutes, releaseDate, posterUrl, landscapeUrl, trailerUrl,
    genre, country, directors, actors, ageRating, status } = movie;
  const isComingSoon = status === 'COMING_SOON';
  const catalogPath = `/movies?status=${isComingSoon ? 'COMING_SOON' : 'NOW_SHOWING'}`;
  const canPlay = Boolean(getYouTubeVideoId(trailerUrl));
  const Banner = canPlay ? 'button' : 'div';
  const genres = genre ? genre.split(/[,/]/).map(value => value.trim()).filter(Boolean) : [];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex-1 pb-16 sm:pb-24">
      <Banner
        {...(canPlay ? { type: 'button', onClick: () => setIsTrailerOpen(true), 'aria-label': `Xem trailer ${title}` } : {})}
        className={`group relative isolate block h-[240px] w-full overflow-hidden border-b border-surfaceBorder bg-background sm:h-[380px] lg:h-[460px] ${canPlay ? 'cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary' : ''}`}
      >
        <div className="mx-auto h-full max-w-[1440px]">
          <MovieImage src={landscapeUrl} fallbackSrc={posterUrl} alt={canPlay ? '' : title} className="h-full w-full object-cover object-center" />
        </div>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent" />
        {canPlay && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 pb-4 sm:pb-0">
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-white/30 bg-white/95 text-background shadow-2xl transition-colors group-hover:bg-primary group-hover:text-white sm:h-20 sm:w-20">
              <Play aria-hidden="true" className="ml-1 h-7 w-7 fill-current sm:h-8 sm:w-8" />
            </span>
            <span className="rounded-full bg-background/70 px-4 py-1.5 text-xs font-semibold tracking-wide text-white">Xem trailer</span>
          </span>
        )}
      </Banner>

      <div className={`relative mx-auto grid w-full max-w-[1440px] gap-10 px-6 sm:px-10 lg:gap-10 lg:px-14 ${recommendations.length ? 'lg:grid-cols-[minmax(0,1fr)_250px] xl:grid-cols-[minmax(0,1fr)_290px]' : ''}`}>
        <div className="min-w-0">
          <div className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-7 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-8">
            <div className="relative -mt-12 mx-auto w-40 self-start sm:-mt-14 sm:mx-0 sm:w-full">
              <div className="aspect-[2/3] overflow-hidden rounded-xl border-2 border-surfaceBorder bg-surface shadow-2xl shadow-black/50">
                <MovieImage src={posterUrl} alt={`Poster ${title}`} className="h-full w-full object-cover" />
              </div>
            </div>

            <div className="min-w-0 sm:pt-7">
              <nav aria-label="Đường dẫn" className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed text-muted">
                <Link to="/" className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Trang chủ</Link>
                <span aria-hidden="true">/</span>
                <Link to={catalogPath} className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{isComingSoon ? 'Phim sắp chiếu' : 'Phim đang chiếu'}</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page" className="text-neutral-300">{title}</span>
              </nav>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                {ageRating && <span className={`rounded-md border px-2 py-1 text-xs font-bold ${AGE_RATING_STYLE[ageRating] ?? 'border-surfaceBorder bg-surface text-white'}`}>{ageRating}</span>}
                {isComingSoon && <span className="rounded-md border border-surfaceBorder bg-surface px-2 py-1 text-xs font-medium text-muted">Sắp chiếu</span>}
              </div>
              <h1 className="break-words font-display text-2xl font-extrabold leading-snug tracking-tight text-white sm:text-3xl xl:text-4xl">{title}</h1>

              <div className="mb-7 mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-neutral-300">
                {durationMinutes > 0 && <span className="inline-flex items-center gap-1.5"><Clock aria-hidden="true" className="h-4 w-4 text-primary" />{durationMinutes} phút</span>}
                {releaseDate && <span className="inline-flex items-center gap-1.5"><Calendar aria-hidden="true" className="h-4 w-4 text-primary" />{formatReleaseDate(releaseDate)}</span>}
              </div>

              <dl className="space-y-3">
                {country && <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 py-1 sm:grid-cols-[96px_minmax(0,1fr)]"><dt className="text-sm text-muted">Quốc gia</dt><dd className="break-words text-sm leading-relaxed text-neutral-200">{country}</dd></div>}
                <MetadataRow label="Thể loại" values={genres} />
                <MetadataRow label="Đạo diễn" values={directors} />
                <MetadataRow label="Diễn viên" values={actors} />
              </dl>
            </div>
          </div>

          {description && (
            <section aria-labelledby="movie-description-title" className="mt-10 border-t border-surfaceBorder pt-8">
              <h2 id="movie-description-title" className="mb-4 border-l-4 border-primary pl-3 text-lg font-bold text-white">Nội dung phim</h2>
              <p className="whitespace-pre-line text-sm leading-7 text-neutral-300">{description}</p>
            </section>
          )}

          <div className="mt-10 border-t border-surfaceBorder pt-8">
            <ShowtimeSelector movieId={movie.id} />
          </div>
        </div>
        {recommendations.length > 0 && <RelatedMovies movies={recommendations} />}
      </div>

      <TrailerModal isOpen={isTrailerOpen} onClose={() => setIsTrailerOpen(false)} trailerUrl={trailerUrl} title={title} />
    </div>
  );
};

export const MovieDetail = () => {
  const { id } = useParams();
  const { data: movie, isLoading, isError, refetch } = useMovieDetail(id);
  const { data: nowShowing } = useMoviePreview('NOW_SHOWING', 4);
  const recommendations = (nowShowing?.content ?? EMPTY_MOVIES).filter(item => String(item.id) !== String(id)).slice(0, 3);

  if (isLoading) return <DetailSkeleton />;
  if (!movie) return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <Film aria-hidden="true" className="h-10 w-10 text-muted" />
      <h1 className="text-xl font-bold text-white">Không tải được thông tin phim</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">Phim có thể chưa khả dụng hoặc kết nối đang gián đoạn.</p>
      {isError && <button type="button" onClick={() => refetch()} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryHover">Thử lại</button>}
      <Link to="/movies" className="text-sm text-muted hover:text-white">Về danh sách phim</Link>
    </div>
  );

  return <MovieDetailContent key={String(id)} movie={movie} recommendations={recommendations} />;
};

export default MovieDetail;
