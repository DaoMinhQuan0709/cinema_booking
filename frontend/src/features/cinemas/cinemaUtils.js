import { isInternalShowtimeId } from '../../utils/showtimeId.js';

export const UNKNOWN_CITY = 'Chưa xác định';
const COLLATOR = new Intl.Collator('vi', { numeric: true });
const MAX_FILTER_LENGTH = 200;

export const normalizeCinemaSearch = value => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
  .toLowerCase().replace(/\s+/g, ' ').trim();

export const getCinemaCity = cinema => cinema.city?.trim() || UNKNOWN_CITY;

export const readCinemaFilters = params => ({
  q: (params.get('q') ?? '').slice(0, MAX_FILTER_LENGTH),
  city: (params.get('city') ?? '').trim().slice(0, MAX_FILTER_LENGTH),
});

export const writeCinemaFilters = (params, filters) => {
  const next = new URLSearchParams(params);
  for (const name of ['q', 'city']) {
    const value = String(filters[name] ?? '').slice(0, MAX_FILTER_LENGTH);
    if (value.trim()) next.set(name, name === 'city' ? value.trim() : value);
    else next.delete(name);
  }
  return next;
};

export const getCinemaCities = cinemas => [...new Set(cinemas.map(getCinemaCity))]
  .sort((a, b) => (a === UNKNOWN_CITY) - (b === UNKNOWN_CITY) || COLLATOR.compare(a, b));

export const filterCinemas = (cinemas, { q = '', city = '' } = {}) => {
  const keyword = normalizeCinemaSearch(q);
  const order = cinema => typeof cinema.displayOrder === 'number' && Number.isFinite(cinema.displayOrder)
    ? cinema.displayOrder : Infinity;
  return cinemas.filter(cinema => (!city || getCinemaCity(cinema) === city)
    && (!keyword || normalizeCinemaSearch(cinema.name).includes(keyword)))
    .sort((a, b) => {
      const aOrder = order(a), bOrder = order(b);
      return (aOrder === bOrder ? 0 : aOrder - bOrder)
        || COLLATOR.compare(a.name ?? '', b.name ?? '') || COLLATOR.compare(String(a.id), String(b.id));
    });
};

const getValidImageSources = sources => [...new Set(sources.filter(value => {
  if (typeof value !== 'string' || !value.trim()) return false;
  try { return ['https:', 'http:'].includes(new URL(value.trim()).protocol); }
  catch { return false; }
}).map(value => value.trim()))];

export const getCinemaImageSources = cinema => getValidImageSources([
  cinema.imageLandscape, cinema.imagePortrait, ...(Array.isArray(cinema.imageUrls) ? cinema.imageUrls : []),
]);

export const getCinemaGallerySources = cinema => getValidImageSources(
  Array.isArray(cinema.imageUrls) ? cinema.imageUrls : [],
);

export const getCinemaPhoneHref = phone => {
  if (typeof phone !== 'string' || !/^\+?[\d\s().-]+$/.test(phone.trim())) return null;
  const number = phone.trim().replace(/[\s().-]/g, '');
  return /^\+?\d{3,20}$/.test(number) ? `tel:${number}` : null;
};

export const getCinemaDetailHref = id => isInternalShowtimeId(id)
  ? `/cinemas/${encodeURIComponent(String(id))}` : null;

export const getCinemaPickerState = (cinemas, current, city) => {
  // The detail response is authoritative when the cached catalog has older cinema metadata.
  const source = [...cinemas.filter(item => String(item.id) !== String(current.id)), current];
  return {
    cities: getCinemaCities(source),
    options: filterCinemas(source, { city }),
    selectedId: city === getCinemaCity(current) ? String(current.id) : '',
  };
};
