import { isInternalShowtimeId } from '../../utils/showtimeId.js';

const validPrice = value => {
  if (value == null || value === '' || (typeof value !== 'number' && typeof value !== 'string')) return null;
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
};

/** Giá cơ bản của các suất còn mở bán, theo từng phim trong ngày đã chọn. */
export function getCinemaPriceRows(movies) {
  return movies.map(movie => {
    const prices = movie.showtimes
      .filter(slot => isInternalShowtimeId(slot.id))
      .map(slot => validPrice(slot.basePrice))
      .filter(price => price !== null);
    return prices.length ? {
      movieId: movie.movieId,
      title: movie.title,
      min: Math.min(...prices),
      max: Math.max(...prices),
    } : null;
  }).filter(Boolean);
}

const validCoordinate = (value, limit) => {
  if (value == null || value === '' || (typeof value !== 'number' && typeof value !== 'string')) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && Math.abs(coordinate) <= limit ? coordinate : null;
};

/** Chỉ nhận URL iframe được Google Maps cấp qua "Chia sẻ → Nhúng bản đồ". */
export function getManualGoogleEmbedUrl(value) {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const source = input.startsWith('<iframe')
    ? /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(input)?.slice(1).find(Boolean)
    : input;
  if (!source) return null;
  try {
    const url = new URL(source.replaceAll('&amp;', '&'));
    return url.protocol === 'https:' && url.hostname === 'www.google.com'
      && url.pathname === '/maps/embed' && url.searchParams.has('pb') && url.searchParams.get('pb')
      && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** URL iframe lấy từ cấu hình thủ công, còn nút chỉ đường lấy tọa độ/địa chỉ của rạp. */
export function getCinemaMapLinks(cinema, manualEmbed = '') {
  const latitude = validCoordinate(cinema.latitude, 90);
  const longitude = validCoordinate(cinema.longitude, 180);
  const address = typeof cinema.address === 'string' ? cinema.address.trim() : '';
  const city = typeof cinema.city === 'string' ? cinema.city.trim() : '';
  const name = typeof cinema.name === 'string' ? cinema.name.trim() : '';
  const destination = latitude !== null && longitude !== null
    ? `${latitude},${longitude}`
    : address ? [name, address, city].filter(Boolean).join(', ') : '';
  const embedUrl = getManualGoogleEmbedUrl(manualEmbed);
  return {
    embedUrl,
    directionsUrl: destination ? `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination })}` : null,
  };
}
