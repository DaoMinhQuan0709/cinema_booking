import { isInternalShowtimeId } from '../../utils/showtimeId.js';
import { getVietnamClock } from '../showtimes/scheduleUtils.js';

const COLLATOR = new Intl.Collator('vi', { numeric: true });
const compareKeys = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATETIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?$/;

/** YYYY-MM-DD hợp lệ theo lịch (từ chối 2026-02-30). */
export function isValidDateKey(value) {
  const match = DATE_PATTERN.exec(typeof value === 'string' ? value : '');
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Đọc ?date=&movieId= theo dải ngày hiện có (days[i].date, hôm nay là phần tử đầu).
 * Ngày thiếu/sai/ngoài dải rơi về hôm nay; movieId sai thành ''.
 * @param {URLSearchParams} params
 * @param {{ date: string }[]} days
 */
export function readDetailSelection(params, days) {
  const dates = days.map(day => day.date);
  const rawDate = params.get('date') ?? '';
  const dateInRange = isValidDateKey(rawDate) && dates.includes(rawDate);
  const rawMovie = params.get('movieId') ?? '';
  return {
    date: dateInRange ? rawDate : dates[0] ?? '',
    movieId: isInternalShowtimeId(rawMovie) ? rawMovie : '',
    dateInRange,
  };
}

/**
 * Ghi lại date/movieId; chỉ đổi khóa có trong `selection` ('' = xóa), giữ tham số khác,
 * bỏ tham số trùng và không sửa params gốc.
 */
export function writeDetailSelection(params, selection) {
  const next = new URLSearchParams(params);
  for (const name of ['date', 'movieId']) {
    if (!(name in selection)) continue;
    const value = String(selection[name] ?? '');
    if (value) next.set(name, value);
    else next.delete(name);
  }
  return next;
}

/** URL chuẩn: ngày ngoài dải/sai và movieId sai bị bỏ; không tự thêm date khi URL chưa có. */
export function normalizeDetailParams(params, days) {
  const { date, movieId, dateInRange } = readDetailSelection(params, days);
  return writeDetailSelection(params, { date: params.has('date') && dateInRange ? date : '', movieId });
}

/** Giờ Việt Nam hiện tại dạng YYYY-MM-DDTHH:mm:ss, so sánh được với startTime của backend. */
export function getVietnamNowKey(now = new Date()) {
  return getVietnamClock(now).dateTime;
}

function toLocalKey(value) {
  const match = LOCAL_DATETIME_PATTERN.exec(typeof value === 'string' ? value : '');
  if (!match || !isValidDateKey(match[1])) return null;
  const [, date, hour, minute, second = '00'] = match;
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  return `${date}T${hour}:${minute}:${second}`;
}

/** Chỉ giữ suất có giờ hợp lệ và bắt đầu SAU thời điểm hiện tại (giờ Việt Nam). */
export const getOpenShowtimes = (showtimes, nowKey) =>
  showtimes.filter(showtime => {
    const key = toLocalKey(showtime?.startTime);
    return key !== null && key > nowKey;
  });

/**
 * Gom suất theo phim: phim sắp theo suất sớm nhất rồi tên, suất sắp theo giờ.
 * Bỏ suất thiếu giờ hợp lệ hoặc movieId không phải ID nội bộ.
 */
export function groupMoviesFromShowtimes(showtimes) {
  const movies = new Map();
  for (const showtime of showtimes) {
    if (!showtime || typeof showtime !== 'object') continue;
    const startKey = toLocalKey(showtime.startTime);
    const movieId = String(showtime.movieId ?? '');
    if (!startKey || !isInternalShowtimeId(movieId)) continue;
    if (!movies.has(movieId)) movies.set(movieId, { movieId, title: '', posterUrl: null, showtimes: [] });
    const movie = movies.get(movieId);
    movie.title ||= typeof showtime.movieTitle === 'string' ? showtime.movieTitle.trim() : '';
    movie.posterUrl ||= typeof showtime.posterUrl === 'string' ? showtime.posterUrl : null;
    movie.showtimes.push({ showtime, startKey });
  }
  return [...movies.values()].map(movie => ({
    ...movie,
    title: movie.title || 'Phim chưa có tên',
    showtimes: movie.showtimes
      .sort((a, b) => compareKeys(a.startKey, b.startKey) || COLLATOR.compare(String(a.showtime.id), String(b.showtime.id)))
      .map(item => item.showtime),
  })).sort((a, b) => compareKeys(toLocalKey(a.showtimes[0].startTime), toLocalKey(b.showtimes[0].startTime))
    || COLLATOR.compare(a.title, b.title));
}

/**
 * Xóa movieId không còn suất trong rạp/ngày hiện tại. Chỉ gọi sau khi query THÀNH CÔNG
 * (không gọi khi đang tải/lỗi để không mất lựa chọn). Trả về cùng tham chiếu nếu không đổi.
 */
export function dropUnavailableMovie(params, movies) {
  const movieId = params.get('movieId');
  if (movieId === null) return params;
  if (isInternalShowtimeId(movieId) && movies.some(movie => movie.movieId === movieId)) return params;
  return writeDetailSelection(params, { movieId: '' });
}
