import { useId, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapPin, Phone, RefreshCw, SearchX } from 'lucide-react';
import { useCinemas } from '../movies/hooks/useShowtimes';
import { getCinemaCity, getCinemaDetailHref, getCinemaPhoneHref, getCinemaPickerState } from './cinemaUtils';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
const FIELD_CLASS = 'w-full min-w-0 cursor-pointer rounded-xl border border-surfaceBorder bg-surface px-3 py-3 text-sm text-white outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50';
const EMPTY_LIST = [];

const CinemaInfoHeader = ({ cinema }) => {
  const cityId = useId();
  const cinemaId = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const query = useCinemas({}, { skipErrorToast: true });
  const [city, setCity] = useState(() => getCinemaCity(cinema));

  const catalog = Array.isArray(query.data) ? query.data : EMPTY_LIST;
  const { cities, options, selectedId } = getCinemaPickerState(catalog, cinema, city);
  const phoneHref = getCinemaPhoneHref(cinema.phone);
  const chooseCinema = (event) => {
    const href = getCinemaDetailHref(event.target.value);
    if (!href || href === location.pathname) return;
    const date = new URLSearchParams(location.search).get('date');
    navigate({ pathname: href, search: date ? `?${new URLSearchParams({ date })}` : '' }, { state: location.state });
  };

  return (
    <header className="border-b border-surfaceBorder pb-10 sm:pb-12">
      <div className="border-l-4 border-primary pl-5 sm:pl-7">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{getCinemaCity(cinema)}</p>
        <h1 className="break-words font-display text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">{cinema.name?.trim() || 'Thông tin rạp'}</h1>
        <div className="mt-6 flex max-w-3xl items-start gap-3 text-sm leading-relaxed text-muted sm:text-base">
          <MapPin aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
          <p className="min-w-0 break-words">{cinema.address?.trim() || 'Địa chỉ đang cập nhật'}</p>
        </div>
        <div className="mt-4 flex items-start gap-3 text-sm leading-relaxed text-muted sm:text-base">
          <Phone aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
          <p className="min-w-0 break-words">{phoneHref ? <>Hotline: <a href={phoneHref} className={`rounded text-white hover:text-primary ${FOCUS_CLASS}`}>{cinema.phone}</a></> : 'Điện thoại đang cập nhật'}</p>
        </div>
      </div>

      <section aria-label="Chọn rạp khác" className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:max-w-3xl">
        <div className="min-w-0">
          <label htmlFor={cityId} className="mb-2 block text-xs font-medium text-muted">Tìm rạp theo thành phố</label>
          <select id={cityId} value={city} onChange={event => setCity(event.target.value)} className={FIELD_CLASS}>
            {!cities.includes(city) && <option value={city}>{city}</option>}
            {cities.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={cinemaId} className="mb-2 block text-xs font-medium text-muted">Rạp</label>
          <select id={cinemaId} value={selectedId} onChange={chooseCinema} disabled={!options.length} className={FIELD_CLASS}>
            {selectedId === '' && <option value="" disabled>{options.length ? 'Chọn rạp…' : 'Chưa có rạp'}</option>}
            {options.map(item => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
          </select>
        </div>

        {!options.length && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
            <SearchX aria-hidden="true" className="h-4 w-4 shrink-0" />
            {city} hiện chưa có rạp. Bạn hãy chọn thành phố khác.
          </p>
        )}
        {query.isPending && <p role="status" className="text-sm text-muted sm:col-span-2">Đang tải danh sách rạp khác…</p>}
        {query.isError && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted sm:col-span-2">
            <span>{catalog.length ? 'Chưa thể làm mới danh sách rạp.' : 'Chưa tải được danh sách rạp khác.'}</span>
            <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className={`inline-flex min-h-11 items-center gap-1.5 rounded px-2 text-white hover:text-primary disabled:opacity-50 ${FOCUS_CLASS}`}>
              <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}`} />Thử lại
            </button>
          </div>
        )}
      </section>
    </header>
  );
};

export default CinemaInfoHeader;
