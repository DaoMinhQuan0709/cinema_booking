import { getCinemaDetailHref, readCinemaFilters } from '../features/cinemas/cinemaUtils.js';
import { isValidDateKey } from '../features/cinemas/cinemaDetailUtils.js';
import { isInternalShowtimeId } from '../utils/showtimeId.js';

/** Translate bookmarked schedule URLs; the destination validates available dates/movies. */
export function getLegacyShowtimesHref(params) {
  const detailHref = getCinemaDetailHref(params.get('cinemaId'));
  const next = new URLSearchParams();
  if (detailHref) {
    const date = params.get('date');
    const movieId = params.get('movieId');
    if (isValidDateKey(date)) next.set('date', date);
    if (isInternalShowtimeId(movieId)) next.set('movieId', movieId);
  } else {
    const { city } = readCinemaFilters(params);
    if (city) next.set('city', city);
  }
  const search = next.toString();
  return `${detailHref || '/cinemas'}${search ? `?${search}` : ''}`;
}
