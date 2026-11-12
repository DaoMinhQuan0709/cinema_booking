import { getVietnamClock } from '../showtimes/scheduleUtils.js';
import { isInternalShowtimeId } from '../../utils/showtimeId.js';
import { isCalendarDate } from './movieForm.js';

// LocalDateTime in the API is Vietnam wall time. Never serialize it with toISOString().
export function normalizeShowtimeTime(value) {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value || ''));
  if (!match || !isCalendarDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] || 0) > 59) return '';
  return `${match[1]}T${match[2]}:${match[3]}:${match[4] || '00'}`;
}

export function suggestShowtimeEnd(startTime, durationMinutes) {
  const start = normalizeShowtimeTime(startTime);
  if (!start || !Number.isInteger(durationMinutes) || durationMinutes < 1) return '';
  const end = new Date(Date.parse(`${start}+07:00`) + (durationMinutes + 15) * 60_000);
  if (!Number.isFinite(end.getTime())) return '';
  const suggested = getVietnamClock(end).dateTime;
  return normalizeShowtimeTime(suggested) ? suggested.slice(0, 16) : '';
}

export function readShowtimeFilters(params, now = new Date()) {
  return {
    date: isCalendarDate(params.get('date') || '') ? params.get('date') : getVietnamClock(now).date,
    cinemaId: isInternalShowtimeId(params.get('cinemaId')) ? params.get('cinemaId') : '',
    movieId: isInternalShowtimeId(params.get('movieId')) ? params.get('movieId') : '',
  };
}

export function writeShowtimeFilters(params, filters) {
  const next = new URLSearchParams(params);
  for (const name of ['date', 'cinemaId', 'movieId']) {
    if (filters[name]) next.set(name, filters[name]);
    else next.delete(name);
  }
  return next;
}

export function toShowtimeForm(filters, now = new Date()) {
  const clock = getVietnamClock(now);
  const nextHalfHour = new Date(Math.ceil((now.getTime() + 60_000) / 1_800_000) * 1_800_000);
  const startTime = filters.date > clock.date ? `${filters.date}T10:00` : getVietnamClock(nextHalfHour).dateTime.slice(0, 16);
  return { movieId: filters.movieId || '', cinemaId: filters.cinemaId || '', auditoriumId: '', startTime, endTime: '', basePrice: '' };
}

export function prepareShowtime(values, { movies = [], cinemas = [], now = new Date() } = {}) {
  const errors = {};
  const movie = movies.find(item => String(item.id) === values.movieId);
  const cinema = cinemas.find(item => String(item.id) === values.cinemaId);
  const auditorium = cinema?.auditoriums?.find(item => String(item.id) === values.auditoriumId);
  const validId = id => isInternalShowtimeId(id) && Number.isSafeInteger(Number(id));
  if (!movie || !validId(values.movieId)) errors.movieId = 'Vui lòng chọn phim trong danh sách.';
  if (!cinema) errors.cinemaId = 'Vui lòng chọn rạp.';
  if (!auditorium || !validId(values.auditoriumId)) errors.auditoriumId = 'Vui lòng chọn phòng thuộc rạp đã chọn.';
  const startTime = normalizeShowtimeTime(values.startTime);
  const endTime = normalizeShowtimeTime(values.endTime);
  if (!startTime) errors.startTime = 'Vui lòng nhập ngày giờ bắt đầu hợp lệ.';
  else if (Date.parse(`${startTime}+07:00`) <= now.getTime()) errors.startTime = 'Giờ bắt đầu phải ở tương lai theo giờ Việt Nam.';
  if (!endTime) errors.endTime = 'Vui lòng nhập ngày giờ kết thúc hợp lệ.';
  else if (startTime && endTime <= startTime) errors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu.';
  const price = String(values.basePrice ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0 || Number(price) > 99_999_999.99) {
    errors.basePrice = 'Giá vé phải lớn hơn 0, tối đa 99.999.999,99 VND và có tối đa 2 chữ số thập phân.';
  }
  return { errors, payload: { movieId: Number(values.movieId), auditoriumId: Number(values.auditoriumId), startTime, endTime, basePrice: Number(price) } };
}

export function formatShowtimeTime(value) {
  const local = normalizeShowtimeTime(value);
  return local ? `${local.slice(11, 16)} · ${local.slice(8, 10)}/${local.slice(5, 7)}/${local.slice(0, 4)}` : '—';
}
