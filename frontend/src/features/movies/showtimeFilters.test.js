import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveShowtimeFilters } from './showtimeFilters.js';

const groups = [
  { cinemaId: 1, city: 'Hà Nội' },
  { cinemaId: 2, city: 'TP. Hồ Chí Minh' },
  { cinemaId: 3, city: 'Hà Nội' },
];

test('retains a valid city and normalizes a cinema ID from the dropdown', () => {
  const result = resolveShowtimeFilters(groups, 'Hà Nội', '1');
  assert.equal(result.effectiveCity, 'Hà Nội');
  assert.equal(result.effectiveCinemaId, '1');
  assert.deepEqual(result.cinemasInCity.map((group) => group.cinemaId), [1, 3]);
});

test('resets a cinema outside the selected city', () => {
  const result = resolveShowtimeFilters(groups, 'Hà Nội', '2');
  assert.equal(result.effectiveCity, 'Hà Nội');
  assert.equal(result.effectiveCinemaId, 'ALL');
});

test('a reset selection stays reset when the original city returns on a later date', () => {
  const nextDay = resolveShowtimeFilters([groups[1]], 'Hà Nội', '1');
  assert.equal(nextDay.effectiveCity, 'ALL');
  assert.equal(nextDay.effectiveCinemaId, 'ALL');
  const laterDay = resolveShowtimeFilters(groups, nextDay.effectiveCity, nextDay.effectiveCinemaId);
  assert.equal(laterDay.effectiveCity, 'ALL');
  assert.equal(laterDay.effectiveCinemaId, 'ALL');
  assert.equal(laterDay.cinemasInCity.length, 3);
});

test('a date without showtimes resets both filters', () => {
  const result = resolveShowtimeFilters([], 'Hà Nội', '1');
  assert.equal(result.effectiveCity, 'ALL');
  assert.equal(result.effectiveCinemaId, 'ALL');
  assert.deepEqual(result.cinemasInCity, []);
});

test('missing city metadata still allows selecting a cinema', () => {
  const result = resolveShowtimeFilters([{ cinemaId: 2, city: null }], 'ALL', '2');
  assert.equal(result.effectiveCity, 'ALL');
  assert.equal(result.effectiveCinemaId, '2');
  assert.equal(result.cinemasInCity.length, 1);
});
