import { isInternalShowtimeId } from '../../utils/showtimeId.js';

const CLOCK_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const COLLATOR = new Intl.Collator('vi', { numeric: true });
const FILTER_NAMES = ['date', 'city', 'cinemaId', 'movieId'];

/** Galaxy and the backend exchange cinema-local times without a UTC offset. */
export function getVietnamClock(now = new Date()) {
  const parts = Object.fromEntries(CLOCK_FORMATTER.formatToParts(now).map(part => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return { date, dateTime: `${date}T${parts.hour}:${parts.minute}:${parts.second}` };
}

export function buildScheduleDays(now = new Date()) {
  const { date } = getVietnamClock(now);
  const noon = new Date(`${date}T12:00:00+07:00`).getTime();
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(noon + index * 24 * 60 * 60 * 1000);
    const iso = getVietnamClock(day).date;
    return {
      date: iso,
      label: index === 0 ? 'Hôm nay' : index === 1 ? 'Ngày mai' : WEEKDAYS[day.getUTCDay()],
      dayMonth: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      fullDate: `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`,
    };
  });
}

export function readScheduleFilters(params, days) {
  const date = params.get('date');
  const city = params.get('city')?.trim() ?? '';
  return {
    date: days.some(day => day.date === date) ? date : days[0].date,
    city: city.length <= 200 ? city : '',
    cinemaId: isInternalShowtimeId(params.get('cinemaId')) ? params.get('cinemaId') : '',
    movieId: isInternalShowtimeId(params.get('movieId')) ? params.get('movieId') : '',
  };
}

export function writeScheduleFilters(params, filters) {
  const next = new URLSearchParams(params);
  FILTER_NAMES.forEach(name => {
    if (filters[name]) next.set(name, filters[name]);
    else next.delete(name);
  });
  return next;
}

export function getUpcomingShowtimes(showtimes, date, now = new Date()) {
  const { dateTime } = getVietnamClock(now);
  return showtimes.filter(slot =>
    slot.startTime?.slice(0, 10) === date && slot.startTime.slice(0, 19) > dateTime
  );
}

/** Keep URL selections while loading, and keep city when its metadata is unavailable. */
export function resolveScheduleFilters(showtimes, cinemas, filters, { canReset = false, hasCinemaData = false } = {}) {
  const cityByCinema = new Map(cinemas.map(cinema => [String(cinema.id), cinema.city?.trim() ?? '']));
  const cinemaMap = new Map(showtimes.map(slot => [String(slot.cinemaId), {
    id: String(slot.cinemaId), label: slot.cinemaName, city: cityByCinema.get(String(slot.cinemaId)) ?? '',
  }]));
  const allCinemas = [...cinemaMap.values()].sort((a, b) => COLLATOR.compare(a.label, b.label));
  const cities = [...new Set(allCinemas.map(cinema => cinema.city).filter(Boolean))].sort(COLLATOR.compare);
  const city = canReset && hasCinemaData && !cities.includes(filters.city) ? '' : filters.city;
  const cinemasInCity = allCinemas.filter(cinema => !hasCinemaData || !city || cinema.city === city);
  const cinemaId = canReset && !cinemasInCity.some(cinema => cinema.id === filters.cinemaId) ? '' : filters.cinemaId;
  const allowedCinemas = new Set(cinemasInCity.map(cinema => cinema.id));
  const locationSlots = showtimes.filter(slot =>
    allowedCinemas.has(String(slot.cinemaId)) && (!cinemaId || String(slot.cinemaId) === cinemaId)
  );
  const movies = [...new Map(locationSlots.map(slot => [String(slot.movieId), {
    id: String(slot.movieId), label: slot.movieTitle,
  }])).values()].sort((a, b) => COLLATOR.compare(a.label, b.label));
  const movieId = canReset && !movies.some(movie => movie.id === filters.movieId) ? '' : filters.movieId;

  return {
    filters: { ...filters, city, cinemaId, movieId },
    cities: cities.map(label => ({ id: label, label })),
    cinemas: cinemasInCity,
    movies,
    showtimes: locationSlots.filter(slot => !movieId || String(slot.movieId) === movieId),
  };
}

export function groupScheduleByMovie(showtimes, cinemas) {
  const cityByCinema = new Map(cinemas.map(cinema => [String(cinema.id), cinema.city?.trim() ?? '']));
  const movies = new Map();
  showtimes.forEach(slot => {
    const movieId = String(slot.movieId);
    if (!movies.has(movieId)) {
      movies.set(movieId, { movieId, title: slot.movieTitle, posterUrl: slot.posterUrl, cinemas: new Map(), showtimeCount: 0 });
    }
    const movie = movies.get(movieId);
    if (!movie.posterUrl && slot.posterUrl) movie.posterUrl = slot.posterUrl;
    const cinemaId = String(slot.cinemaId);
    if (!movie.cinemas.has(cinemaId)) {
      movie.cinemas.set(cinemaId, {
        cinemaId, name: slot.cinemaName, city: cityByCinema.get(cinemaId), slots: [],
      });
    }
    movie.cinemas.get(cinemaId).slots.push(slot);
    movie.showtimeCount++;
  });
  return [...movies.values()].map(movie => ({
    ...movie,
    cinemas: [...movie.cinemas.values()]
      .sort((a, b) => COLLATOR.compare(a.name, b.name))
      .map(cinema => ({
        ...cinema,
        slots: cinema.slots.sort((a, b) => a.startTime.localeCompare(b.startTime) || COLLATOR.compare(String(a.id), String(b.id))),
      })),
  })).sort((a, b) => COLLATOR.compare(a.title, b.title));
}
