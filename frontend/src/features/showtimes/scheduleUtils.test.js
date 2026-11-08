import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScheduleDays, getUpcomingShowtimes, getVietnamClock, groupScheduleByMovie,
  readScheduleFilters, resolveScheduleFilters, writeScheduleFilters,
} from './scheduleUtils.js';

const now = new Date('2026-11-08T08:00:00Z'); // 15:00 in Vietnam
const days = buildScheduleDays(now);
const cinemas = [{ id: 1, city: 'Hà Nội' }, { id: 2, city: 'TP. Hồ Chí Minh' }];
const slots = [
  { id: 9, movieId: 10, movieTitle: 'Bộ phim B', cinemaId: 2, cinemaName: 'Rạp B', startTime: '2026-11-08T19:00:00' },
  { id: 7, movieId: 10, movieTitle: 'Bộ phim B', cinemaId: 1, cinemaName: 'Rạp A', startTime: '2026-11-08T18:00:00' },
  { id: 8, movieId: 10, movieTitle: 'Bộ phim B', cinemaId: 1, cinemaName: 'Rạp A', startTime: '2026-11-08T18:00:00', auditoriumName: 'Phòng khác' },
  { id: 6, movieId: 10, movieTitle: 'Bộ phim B', cinemaId: 1, cinemaName: 'Rạp A', startTime: '2026-11-08T16:00:00' },
  { id: 11, movieId: 20, movieTitle: 'Bộ phim A', cinemaId: 2, cinemaName: 'Rạp B', startTime: '2026-11-08T20:00:00', posterUrl: '/a.jpg' },
];
const filters = { date: days[0].date, city: '', cinemaId: '', movieId: '' };
const ready = { canReset: true, hasCinemaData: true };

test('uses Vietnam time even before UTC has reached the same calendar date', () => {
  assert.deepEqual(getVietnamClock(new Date('2026-11-07T17:00:00Z')), {
    date: '2026-11-08', dateTime: '2026-11-08T00:00:00',
  });
  assert.equal(buildScheduleDays(new Date('2026-11-07T17:00:00Z'))[0].date, '2026-11-08');
});

test('builds seven consecutive days across year and leap-month boundaries', () => {
  assert.deepEqual(buildScheduleDays(new Date('2026-12-30T17:00:00Z')).map(day => day.date), [
    '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04', '2027-01-05', '2027-01-06',
  ]);
  const leapDays = buildScheduleDays(new Date('2028-02-27T17:00:00Z'));
  assert.equal(leapDays[1].date, '2028-02-29');
  assert.equal(leapDays[2].date, '2028-03-01');
  assert.equal(leapDays[0].label, 'Hôm nay');
  assert.equal(leapDays[1].label, 'Ngày mai');
});

test('normalizes malformed, out-of-window dates and non-internal IDs before API calls', () => {
  for (const date of ['2026-11-07', '2026-11-15', '2026-02-30', 'invalid']) {
    const params = new URLSearchParams({ date, cinemaId: '1011-226432', movieId: '9223372036854775808' });
    assert.deepEqual(readScheduleFilters(params, days), filters);
  }
  assert.deepEqual(readScheduleFilters(new URLSearchParams('date=2026-11-14&cinemaId=2&movieId=20&city=H%C3%A0+N%E1%BB%99i'), days), {
    date: '2026-11-14', cinemaId: '2', movieId: '20', city: 'Hà Nội',
  });
});

test('writes canonical URLs, removes empty filters and preserves unrelated query parameters', () => {
  const params = new URLSearchParams('date=bad&date=bad2&cinemaId=bad&movieId=20&city=old&ref=home');
  const next = writeScheduleFilters(params, filters);
  assert.equal(next.toString(), 'date=2026-11-08&ref=home');
  assert.equal(params.get('city'), 'old');
});

test('excludes started showtimes and other dates using Vietnam time', () => {
  const input = [...slots,
    { startTime: '2026-11-08T14:59:59' }, { startTime: '2026-11-08T15:00:00' },
    { startTime: '2026-11-09T19:00:00' }, { startTime: null },
  ];
  assert.deepEqual(getUpcomingShowtimes(input, filters.date, now), slots);
  assert.equal(getUpcomingShowtimes(slots, filters.date, new Date('2026-11-08T13:00:00Z')).length, 0);
});

test('groups movies then cinemas and sorts times without merging same-time rooms or changing input', () => {
  const input = structuredClone(slots);
  const groups = groupScheduleByMovie(input, cinemas);
  assert.deepEqual(groups.map(movie => movie.movieId), ['20', '10']);
  assert.deepEqual(groups[1].cinemas.map(cinema => cinema.cinemaId), ['1', '2']);
  assert.deepEqual(groups[1].cinemas[0].slots.map(slot => slot.id), [6, 7, 8]);
  assert.equal(groups[1].cinemas[0].city, 'Hà Nội');
  assert.equal(groups[1].showtimeCount, 4);
  assert.deepEqual(input, slots);
});

test('shows all films with open sessions, including advance-sale films, without requiring movie status', () => {
  const result = resolveScheduleFilters(slots, cinemas, filters, ready);
  assert.deepEqual(result.movies.map(movie => movie.id), ['20', '10']);
  assert.equal(result.showtimes.length, slots.length);
  assert.deepEqual(result.filters, filters);
});

test('filters by city, cinema and film and offers films matching the selected location', () => {
  const result = resolveScheduleFilters(slots, cinemas, { ...filters, city: 'TP. Hồ Chí Minh', cinemaId: '2', movieId: '20' }, ready);
  assert.deepEqual(result.cinemas.map(cinema => cinema.id), ['2']);
  assert.deepEqual(result.movies.map(movie => movie.id), ['20', '10']);
  assert.deepEqual(result.showtimes.map(slot => slot.id), [11]);
});

test('resets unavailable choices only after a successful response', () => {
  const selected = { ...filters, city: 'Hà Nội', cinemaId: '1', movieId: '10' };
  assert.deepEqual(resolveScheduleFilters([], cinemas, selected, { hasCinemaData: true }).filters, selected);
  assert.deepEqual(resolveScheduleFilters([slots[4]], cinemas, selected, ready).filters, filters);
  const returned = resolveScheduleFilters(slots, cinemas, filters, ready);
  assert.deepEqual(returned.filters, filters);
});

test('keeps a valid city but resets a cinema outside it and an unavailable film', () => {
  const selected = { ...filters, city: 'Hà Nội', cinemaId: '2', movieId: '20' };
  const result = resolveScheduleFilters(slots, cinemas, selected, ready);
  assert.deepEqual(result.filters, { ...filters, city: 'Hà Nội' });
  assert.deepEqual(result.movies.map(movie => movie.id), ['10']);
  assert.equal(result.showtimes.length, 3);
});

test('keeps city in the URL during cinema API failures while still allowing film/cinema filters', () => {
  const selected = { ...filters, city: 'Hà Nội', cinemaId: '2', movieId: '20' };
  const result = resolveScheduleFilters(slots, [], selected, { canReset: true });
  assert.deepEqual(result.filters, selected);
  assert.equal(result.cinemas.length, 2);
  assert.deepEqual(result.showtimes.map(slot => slot.id), [11]);
});

test('restores the city constraint when metadata arrives and supports cinemas with missing cities', () => {
  const result = resolveScheduleFilters(slots, cinemas, { ...filters, city: 'Hà Nội' }, ready);
  assert.deepEqual(result.showtimes.map(slot => slot.cinemaId), [1, 1, 1]);
  const missing = resolveScheduleFilters(slots, [], { ...filters, cinemaId: '2' }, ready);
  assert.equal(missing.showtimes.length, 2);
  assert.deepEqual(missing.cities, []);
});
