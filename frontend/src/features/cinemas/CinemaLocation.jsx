import { ExternalLink, MapPin, Phone } from 'lucide-react';
import { getCinemaPhoneHref } from './cinemaUtils';
import { getCinemaMapLinks } from './cinemaDetailInfoUtils';
import { cinemaGoogleMapEmbeds } from './cinemaGoogleMapEmbeds';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

const CinemaLocation = ({ cinema }) => {
  const address = typeof cinema.address === 'string' ? cinema.address.trim() : '';
  const phoneHref = getCinemaPhoneHref(cinema.phone);
  const { embedUrl, directionsUrl } = getCinemaMapLinks(cinema, cinemaGoogleMapEmbeds[String(cinema.id)]);

  return (
    <section aria-labelledby="cinema-location-title" className="min-w-0 rounded-2xl border border-surfaceBorder bg-surface/60 p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <MapPin aria-hidden="true" className="h-6 w-6 shrink-0 text-primary" />
        <h2 id="cinema-location-title" className="font-display text-xl font-bold text-white sm:text-2xl">Thông tin rạp</h2>
      </div>
      <p className="min-w-0 break-words text-sm leading-relaxed text-white">{address || 'Địa chỉ đang cập nhật'}</p>
      <div className="mt-3 flex items-start gap-2 text-sm text-muted">
        <Phone aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        {phoneHref ? <a href={phoneHref} className={`rounded hover:text-white ${FOCUS_CLASS}`}>{cinema.phone}</a> : <span>Điện thoại đang cập nhật</span>}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-surfaceBorder bg-background">
        {embedUrl ? (
          <iframe
            key={embedUrl}
            title={`Bản đồ ${cinema.name || 'rạp'}`}
            src={embedUrl}
            width="600"
            height="300"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="block aspect-[4/3] w-full border-0 sm:aspect-video"
          />
        ) : (
          <p role="status" className="flex min-h-[220px] items-center justify-center px-5 text-center text-sm leading-relaxed text-muted">
            {directionsUrl ? 'Bản đồ Google Maps của rạp đang cập nhật. Bạn có thể mở chỉ đường để xem vị trí rạp.' : 'Vị trí rạp đang cập nhật.'}
          </p>
        )}
      </div>

      {directionsUrl && (
        <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primaryHover ${FOCUS_CLASS}`}>
          Chỉ đường <ExternalLink aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">(mở trong tab mới)</span>
        </a>
      )}
    </section>
  );
};

export default CinemaLocation;
