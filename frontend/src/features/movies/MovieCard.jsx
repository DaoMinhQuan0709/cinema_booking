import { Link } from 'react-router-dom';
import { Film, Ticket } from 'lucide-react';

/**
 * Mau sac nhan do tuoi theo muc do (P nhe nhat -> C18 nang nhat).
 * Du lieu "ageRating" tu MovieResponse backend la mot trong: P, C13, C16, C18.
 */
const AGE_RATING_STYLE = {
  P: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
  C13: 'border-amber-500 text-amber-400 bg-amber-500/10',
  C16: 'border-orange-500 text-orange-400 bg-orange-500/10',
  C18: 'border-primary text-primary bg-primary/10',
};

/**
 * The hien thi 1 phim: poster doc ti le 2:3, nhan do tuoi va ten phim.
 * Toan the la 1 Link dan toi /movies/:id; khi hover
 * (desktop) hien overlay CTA "Mua ve" / "Xem chi tiet" tuy trang thai phim.
 *
 * @param {{ movie: { id, title, posterUrl, ageRating, status } }} props
 */
export const MovieCard = ({ movie }) => {
  const { id, title, posterUrl, ageRating, status } = movie;

  const ratingClass = AGE_RATING_STYLE[ageRating] || 'border-surfaceBorder text-neutral-300 bg-surface';
  const isComingSoon = status === 'COMING_SOON';

  return (
    <Link to={`/movies/${id}`} className="group relative flex flex-col outline-none">
      {/* Poster 2:3 */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-surface border border-surfaceBorder">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <Film className="h-10 w-10" />
          </div>
        )}

        {/* Nhan do tuoi */}
        {ageRating && (
          <span
            className={`absolute left-2.5 top-2.5 rounded-md border px-1.5 py-0.5 text-[11px] font-bold tracking-wide ${ratingClass}`}
          >
            {ageRating}
          </span>
        )}

        {/* Nhan "Sap chieu" cho phim COMING_SOON */}
        {isComingSoon && (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            Sắp chiếu
          </span>
        )}

        {/* Overlay CTA khi hover */}
        <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-primary/30">
            <Ticket className="h-3.5 w-3.5" />
            {isComingSoon ? 'Xem chi tiết' : 'Mua vé'}
          </span>
        </div>
      </div>

      {/* Thong tin phim */}
      <div className="mt-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-white transition-colors group-hover:text-primary">
          {title}
        </h3>
      </div>
    </Link>
  );
};

export default MovieCard;
