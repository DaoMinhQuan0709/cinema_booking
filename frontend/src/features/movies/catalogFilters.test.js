import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCatalogMovies } from './catalogFilters.js';

const movies = [
  { id: 1, title: 'Đường về nhà', releaseDate: '2026-11-09' },
  { id: 2, title: 'Bầu trời xanh', releaseDate: '2026-11-12' },
  { id: 3, title: 'Chuyến đi cuối', releaseDate: null },
];

test('finds Vietnamese names with unaccented search and trimmed whitespace', () => {
  assert.deepEqual(filterCatalogMovies(movies, '  DUONG VE  ', 'default').map(movie => movie.id), [1]);
  assert.deepEqual(filterCatalogMovies(movies, 'BẦU TRỜI', 'default').map(movie => movie.id), [2]);
});

test('default order preserves the source catalog and never changes the cached list', () => {
  const frozenMovies = Object.freeze([...movies]);
  assert.deepEqual(filterCatalogMovies(frozenMovies, '', 'default').map(movie => movie.id), [1, 2, 3]);
  assert.deepEqual(filterCatalogMovies(frozenMovies, '', 'title').map(movie => movie.id), [2, 3, 1]);
  assert.deepEqual(frozenMovies.map(movie => movie.id), [1, 2, 3]);
});

test('orders newest dates first and leaves undated movies at the end', () => {
  assert.deepEqual(filterCatalogMovies(movies, '', 'newest').map(movie => movie.id), [2, 1, 3]);
});

test('supports empty catalogs and searches with no matches', () => {
  assert.deepEqual(filterCatalogMovies([], '', 'default'), []);
  assert.deepEqual(filterCatalogMovies(movies, 'không có phim này', 'title'), []);
});
