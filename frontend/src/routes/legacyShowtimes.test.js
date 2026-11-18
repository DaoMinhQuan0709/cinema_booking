import test from 'node:test';
import assert from 'node:assert/strict';
import { getLegacyShowtimesHref } from './legacyShowtimes.js';

const redirect = search => getLegacyShowtimesHref(new URLSearchParams(search));

test('legacy schedule goes to cinema detail, preserving valid date and internal movie ID', () => {
  assert.equal(redirect('cinemaId=12'), '/cinemas/12');
  assert.equal(redirect('cinemaId=9223372036854775807&date=2028-02-29&movieId=9223372036854775807&city=old&ref=old'),
    '/cinemas/9223372036854775807?date=2028-02-29&movieId=9223372036854775807');
});

test('missing, malformed and overflowing cinema IDs fall back to the city-filtered catalog', () => {
  for (const id of ['', '0', '-1', '01', '1.5', '1e2', ' 12 ', 'galaxy-12', '1/2', '1?movieId=2', '9223372036854775808']) {
    assert.equal(redirect(new URLSearchParams({ cinemaId: id, city: ' Hà Nội ', date: '2026-11-18', movieId: '10' })),
      '/cinemas?city=H%C3%A0+N%E1%BB%99i');
  }
  assert.equal(redirect('date=2026-11-18&movieId=10'), '/cinemas');
  assert.equal(redirect('city=+'), '/cinemas');
});

test('invalid calendar dates and movie IDs are dropped independently', () => {
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-11-00', '18/11/2026', '2026-1-1', '']) {
    assert.equal(redirect(new URLSearchParams({ cinemaId: '2', date, movieId: '10' })), '/cinemas/2?movieId=10');
  }
  for (const movieId of ['0', '-1', '01', 'galaxy-10', '9223372036854775808', '']) {
    assert.equal(redirect(new URLSearchParams({ cinemaId: '2', date: '2026-11-18', movieId })), '/cinemas/2?date=2026-11-18');
  }
});

test('duplicate parameters use the first value and never mutate the source', () => {
  const params = new URLSearchParams('cinemaId=2&cinemaId=3&date=2026-11-18&date=invalid&movieId=10&movieId=11');
  const original = params.toString();
  assert.equal(getLegacyShowtimesHref(params), '/cinemas/2?date=2026-11-18&movieId=10');
  assert.equal(params.toString(), original);
  assert.equal(redirect('cinemaId=bad&cinemaId=2&city=Hu%E1%BA%BF&city=other'), '/cinemas?city=Hu%E1%BA%BF');
});
