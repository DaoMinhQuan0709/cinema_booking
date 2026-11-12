import test from 'node:test';
import assert from 'node:assert/strict';
import process from 'node:process';
import { normalizeShowtimeTime, suggestShowtimeEnd, prepareShowtime, readShowtimeFilters, writeShowtimeFilters, toShowtimeForm, formatShowtimeTime } from './showtimeForm.js';

const now = new Date('2026-11-12T03:00:00Z'); // 10:00 in Vietnam.
const movies = [{ id: 1, title: 'Phim', durationMinutes: 120 }];
const cinemas = [{ id: 2, auditoriums: [{ id: 3 }] }, { id: 4, auditoriums: [{ id: 5 }] }];
const options = { movies, cinemas, now };
const valid = { movieId: '1', cinemaId: '2', auditoriumId: '3', startTime: '2026-11-12T23:30', endTime: '2026-11-13T01:45', basePrice: ' 90000.50 ' };

test('showtime sends exactly the DTO with both Vietnam local timestamps, numeric IDs and decimal price', () => {
  const { errors, payload } = prepareShowtime({ ...valid, id: 99, cinemaName: 'ignored' }, options);
  assert.deepEqual(errors, {});
  assert.deepEqual(payload, { movieId: 1, auditoriumId: 3, startTime: '2026-11-12T23:30:00', endTime: '2026-11-13T01:45:00', basePrice: 90000.5 });
});

test('suggested end adds duration plus 15 minutes across midnight, leap day and year boundaries', () => {
  assert.equal(suggestShowtimeEnd(valid.startTime, 120), valid.endTime);
  assert.equal(suggestShowtimeEnd('2028-02-28T23:00', 90), '2028-02-29T00:45');
  assert.equal(suggestShowtimeEnd('2026-12-31T23:30', 90), '2027-01-01T01:15');
  for (const start of ['', '2026-02-29T10:00', '9999-12-31T23:59']) assert.equal(suggestShowtimeEnd(start, 90), '');
  for (const duration of [0, -1, 1.5, undefined, '120']) assert.equal(suggestShowtimeEnd(valid.startTime, duration), '');
});

test('calendar time validation rejects rollover, timezone suffixes and invalid clock components', () => {
  for (const value of ['', '0000-01-01T10:00', '2026-02-29T10:00', '2026-04-31T10:00', '2026-11-12T24:00', '2026-11-12T12:60', '2026-11-12T12:00:60', '2026-11-12T12:00Z', '2026-11-12T12:00+07:00']) assert.equal(normalizeShowtimeTime(value), '', value);
  assert.equal(normalizeShowtimeTime('2028-02-29T10:15'), '2028-02-29T10:15:00');
  assert.equal(formatShowtimeTime(valid.endTime), '01:45 · 13/11/2026');
});

test('future and end ordering use Vietnam time even when the runtime timezone is elsewhere', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = zone;
      for (const startTime of ['2026-11-12T09:59:59', '2026-11-12T10:00:00']) assert.ok(prepareShowtime({ ...valid, startTime }, options).errors.startTime);
      assert.equal(prepareShowtime({ ...valid, startTime: '2026-11-12T10:00:01' }, options).errors.startTime, undefined);
      assert.equal(suggestShowtimeEnd(valid.startTime, 120), valid.endTime);
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
  for (const endTime of [valid.startTime, '2026-11-12T22:00']) assert.ok(prepareShowtime({ ...valid, endTime }, options).errors.endTime);
});

test('form checks catalog membership, safe numeric IDs and auditorium ownership before POST', () => {
  assert.ok(prepareShowtime({ ...valid, movieId: '9' }, options).errors.movieId);
  assert.ok(prepareShowtime({ ...valid, cinemaId: '' }, options).errors.cinemaId);
  assert.ok(prepareShowtime({ ...valid, cinemaId: '4' }, options).errors.auditoriumId);
  assert.ok(prepareShowtime({ ...valid, auditoriumId: '5' }, options).errors.auditoriumId);
  assert.ok(prepareShowtime(valid).errors.movieId);
  assert.ok(prepareShowtime({ ...valid, movieId: '9007199254740992' }, { ...options, movies: [{ id: '9007199254740992' }] }).errors.movieId);
});

test('price matches positive DECIMAL(10,2) without exponents or implicit rounding', () => {
  for (const basePrice of ['', '0', '-1', '0.001', '90000.999', '100000000', '1e3', 'Infinity', '90,000']) assert.ok(prepareShowtime({ ...valid, basePrice }, options).errors.basePrice, basePrice);
  for (const basePrice of ['0.01', '90000', '99999999.99']) assert.equal(prepareShowtime({ ...valid, basePrice }, options).errors.basePrice, undefined);
});

test('filter URL defaults to Vietnam today, preserves unrelated params and accepts any valid calendar day', () => {
  const midnight = new Date('2026-11-12T18:00:00Z');
  assert.deepEqual(readShowtimeFilters(new URLSearchParams('date=2026-02-29&movieId=1e3&cinemaId=-1'), midnight), { date: '2026-11-13', movieId: '', cinemaId: '' });
  const params = new URLSearchParams('date=2026-11-12&movieId=1&cinemaId=2&source=test');
  assert.deepEqual(readShowtimeFilters(params, now), { date: '2026-11-12', movieId: '1', cinemaId: '2' });
  assert.equal(writeShowtimeFilters(params, { date: '2026-11-13', movieId: '', cinemaId: '' }).toString(), 'date=2026-11-13&source=test');
  assert.equal(readShowtimeFilters(new URLSearchParams('date=2000-02-29'), now).date, '2000-02-29');
});

test('new draft inherits selected movie/cinema and starts at a future half hour or selected future day', () => {
  const filters = { date: '2026-11-12', movieId: '1', cinemaId: '2' };
  assert.deepEqual(toShowtimeForm(filters, now), { movieId: '1', cinemaId: '2', auditoriumId: '', startTime: '2026-11-12T10:30', endTime: '', basePrice: '' });
  assert.equal(toShowtimeForm({ ...filters, date: '2026-11-13' }, now).startTime, '2026-11-13T10:00');
  assert.equal(toShowtimeForm(filters, new Date('2026-11-12T16:55:00Z')).startTime, '2026-11-13T00:00');
});
