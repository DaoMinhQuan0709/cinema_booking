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

/** Chỉ dùng tọa độ hợp lệ; thiếu key Google thì nhúng OpenStreetMap khi có tọa độ. */
export function getCinemaMapLinks(cinema, apiKey = '') {
  const latitude = validCoordinate(cinema.latitude, 90);
  const longitude = validCoordinate(cinema.longitude, 180);
  const address = typeof cinema.address === 'string' ? cinema.address.trim() : '';
  const city = typeof cinema.city === 'string' ? cinema.city.trim() : '';
  const name = typeof cinema.name === 'string' ? cinema.name.trim() : '';
  const destination = latitude !== null && longitude !== null
    ? `${latitude},${longitude}`
    : address ? [name, address, city].filter(Boolean).join(', ') : '';
  if (!destination) return { embedUrl: null, embedProvider: null, directionsUrl: null };

  const directionsUrl = `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination })}`;
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (key) return {
    embedUrl: `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key, q: destination })}`,
    embedProvider: 'google',
    directionsUrl,
  };
  if (latitude === null || longitude === null || Math.abs(latitude) >= 85 || Math.abs(longitude) >= 180) {
    return { embedUrl: null, embedProvider: null, directionsUrl };
  }

  const bbox = [longitude - 0.005, latitude - 0.003, longitude + 0.005, latitude + 0.003]
    .map(value => value.toFixed(6)).join(',');
  return {
    embedUrl: `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({ bbox, layer: 'mapnik', marker: `${latitude},${longitude}` })}`,
    embedProvider: 'openstreetmap',
    directionsUrl,
  };
}
