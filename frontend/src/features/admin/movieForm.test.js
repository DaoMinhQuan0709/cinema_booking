import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMovie, toMovieForm, readMovieFilters, writeMovieFilters, formatMovieDate } from './movieForm.js';

const valid = { title: '  Phim mới  ', durationMinutes: '120', releaseDate: '2024-02-29', status: 'NOW_SHOWING', posterUrl: ' https://example.invalid/p.jpg ', trailerUrl: '', description: '  Mô tả  ', genre: '', ageRating: 'T13' };

test('movie DTO trims text, preserves local calendar dates, converts duration and clears optional fields with null', () => {
  const { errors, payload } = prepareMovie({ ...valid, id: 9, country: 'ignored' });
  assert.deepEqual(errors, {});
  assert.deepEqual(payload, { title: 'Phim mới', durationMinutes: 120, releaseDate: '2024-02-29', status: 'NOW_SHOWING', posterUrl: 'https://example.invalid/p.jpg', trailerUrl: null, description: 'Mô tả', genre: null, ageRating: 'T13' });
});

test('movie dates reject rollover/zero years and allow past releases and valid leap years', () => {
  for (const releaseDate of ['', '2025-02-29', '2024-04-31', '0000-01-01', '2024-13-01', '2024-01-01T00:00:00Z']) {
    assert.ok(prepareMovie({ ...valid, releaseDate }).errors.releaseDate, releaseDate);
  }
  for (const releaseDate of ['0001-01-01', '2000-02-29', '1900-02-28', '9999-12-31']) assert.equal(prepareMovie({ ...valid, releaseDate }).errors.releaseDate, undefined);
  assert.equal(formatMovieDate('2024-02-29'), '29/02/2024');
});

test('required values, integral duration and database text limits are enforced before writes', () => {
  for (const durationMinutes of ['', '0', '-2', '1.5', '1e3', 'NaN', '2147483648']) assert.ok(prepareMovie({ ...valid, durationMinutes }).errors.durationMinutes);
  assert.ok(prepareMovie({ ...valid, title: '  ' }).errors.title);
  for (const [name, limit] of [['title', 255], ['genre', 500], ['ageRating', 10]]) assert.ok(prepareMovie({ ...valid, [name]: 'x'.repeat(limit + 1) }).errors[name]);
  assert.ok(prepareMovie({ ...valid, status: 'ARCHIVED' }).errors.status);
});

test('poster/trailer accept optional HTTP(S) URLs and reject unsafe or ambiguous inputs', () => {
  for (const name of ['posterUrl', 'trailerUrl']) {
    for (const value of ['javascript:alert(1)', 'data:image/png;base64,x', 'file:///a', '//host/path', 'https:/host', 'https://user:pass@host/path', 'https://host/a b', 'not a url']) {
      assert.ok(prepareMovie({ ...valid, [name]: value }).errors[name], value);
    }
    for (const value of ['', 'http://localhost:8080/poster.jpg', 'https://youtu.be/abcdef12345']) assert.equal(prepareMovie({ ...valid, [name]: value }).errors[name], undefined);
    assert.ok(prepareMovie({ ...valid, [name]: 'https://host/' + 'x'.repeat(500) }).errors[name]);
  }
});

test('editing snapshots every writable field without mutating cached data or introducing unsupported fields', () => {
  const movie = { ...valid, durationMinutes: 120, posterUrl: null, id: 4, directors: ['Name'] };
  const form = toMovieForm(movie); form.title = 'Changed';
  assert.equal(movie.title, valid.title);
  assert.equal(form.posterUrl, ''); assert.equal(form.durationMinutes, '120'); assert.equal(form.id, undefined);
  assert.equal(toMovieForm(null).status, 'COMING_SOON');
});

test('movie filter URLs normalize invalid values, keep server pagination zero-based and preserve unrelated parameters', () => {
  const params = new URLSearchParams('q=%20Phim%20&status=ENDED&page=3&size=20&source=bookmark');
  const filters = readMovieFilters(params);
  assert.deepEqual(filters, { keyword: 'Phim', status: 'ENDED', page: 2, size: 20 });
  const next = writeMovieFilters(params, { ...filters, keyword: '', status: '', page: 0, size: 10 });
  assert.equal(next.toString(), 'source=bookmark');
  for (const page of ['0', '-1', 'NaN', '2.1', '2147483648']) assert.equal(readMovieFilters(new URLSearchParams({ page, status: 'INVALID', size: '100' })).page, 0);
  assert.equal(readMovieFilters(new URLSearchParams('status=INVALID&size=100')).status, '');
  assert.equal(readMovieFilters(new URLSearchParams('size=100')).size, 10);
});
