import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, Building2, MapPin, Phone } from 'lucide-react';
import { getCinemaCity, getCinemaDetailHref, getCinemaImageSources, getCinemaPhoneHref } from './cinemaUtils';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

const CinemaCard = ({ cinema }) => {
  const location = useLocation();
  const [failedSources, setFailedSources] = useState([]);
  const source = getCinemaImageSources(cinema).find(url => !failedSources.includes(url));
  const phoneHref = getCinemaPhoneHref(cinema.phone);
  const detailHref = getCinemaDetailHref(cinema.id);

  return (
    <article aria-labelledby={`cinema-name-${cinema.id}`} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-surfaceBorder bg-surface/30 transition-colors hover:border-neutral-600">
      <div className="relative aspect-video overflow-hidden border-b border-surfaceBorder bg-surface">
        {source ? (
          <img
            src={source}
            alt={`Không gian ${cinema.name}`}
            loading="lazy"
            decoding="async"
            width="960"
            height="540"
            onError={() => setFailedSources(previous => [...previous, source])}
            className="h-full w-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted">
            <Building2 aria-hidden="true" strokeWidth={1} className="h-10 w-10" />
            <span className="text-xs">Ảnh rạp đang cập nhật</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="mb-2 text-xs font-medium text-primary">{getCinemaCity(cinema)}</p>
        <h2 id={`cinema-name-${cinema.id}`} className="break-words font-display text-xl font-bold leading-snug text-white">{cinema.name}</h2>
        <div className="mt-4 flex items-start gap-2.5 text-sm leading-relaxed text-muted">
          <MapPin aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
          <p className="min-w-0 break-words">{cinema.address?.trim() || 'Địa chỉ đang cập nhật'}</p>
        </div>
        <div className="mt-4 flex items-center gap-2.5 text-sm text-muted">
          <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
          {phoneHref ? (
            <a href={phoneHref} aria-label={`Gọi ${cinema.name}: ${cinema.phone}`} className={`rounded text-neutral-300 transition-colors hover:text-white ${FOCUS_CLASS}`}>{cinema.phone}</a>
          ) : <span>Điện thoại đang cập nhật</span>}
        </div>
        {detailHref && (
          <div className="mt-auto pt-6">
            <Link to={detailHref} state={{ cinemasSearch: location.search }} aria-label={`Xem chi tiết ${cinema.name}`} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border border-surfaceBorder bg-surface px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-primary hover:bg-primary ${FOCUS_CLASS}`}>
              Xem chi tiết rạp <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
};

export default CinemaCard;
