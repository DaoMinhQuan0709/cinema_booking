export const MOVIE_STATUSES = [
  { key: 'NOW_SHOWING', label: 'Phim đang chiếu' },
  { key: 'COMING_SOON', label: 'Phim sắp chiếu' },
];

export const MOVIE_SORTS = [
  { key: 'default', label: 'Ngày khởi chiếu' },
  { key: 'title', label: 'Tên phim A – Z' },
  { key: 'newest', label: 'Khởi chiếu mới nhất' },
];

function normalizeTitle(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

export function filterCatalogMovies(movies, keyword, sort) {
  const search = normalizeTitle(keyword.trim());
  const result = movies.filter(movie => normalizeTitle(movie.title).includes(search));
  if (sort === 'title') {
    result.sort((a, b) => a.title.localeCompare(b.title, 'vi', { sensitivity: 'base', numeric: true }));
  } else if (sort === 'newest') {
    result.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
  }
  return result;
}
