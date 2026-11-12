export const ADMIN_MOVIE_STATUSES = [
  { value: 'NOW_SHOWING', label: 'Đang chiếu', className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' },
  { value: 'COMING_SOON', label: 'Sắp chiếu', className: 'border-amber-400/20 bg-amber-400/10 text-amber-300' },
  { value: 'ENDED', label: 'Ngừng chiếu', className: 'border-surfaceBorder bg-white/5 text-muted' },
];
export const MOVIE_PAGE_SIZES = [10, 20, 50];
const MOVIE_FIELDS = ['title', 'description', 'durationMinutes', 'releaseDate', 'posterUrl', 'trailerUrl', 'genre', 'ageRating', 'status'];

export function toMovieForm(movie) {
  return Object.fromEntries(MOVIE_FIELDS.map(name => [name, movie?.[name] == null
    ? name === 'status' && !movie ? 'COMING_SOON' : '' : String(movie[name])]));
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function isHttpUrl(value) {
  if (!/^https?:\/\/\S+$/i.test(value)) return false;
  try {
    const url = new URL(value);
    return Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

export function prepareMovie(values) {
  const clean = Object.fromEntries(MOVIE_FIELDS.map(name => [name, String(values[name] ?? '').trim()]));
  const errors = {};
  if (!clean.title) errors.title = 'Vui lòng nhập tên phim.';
  else if (clean.title.length > 255) errors.title = 'Tên phim tối đa 255 ký tự.';
  if (!/^\d+$/.test(clean.durationMinutes) || Number(clean.durationMinutes) < 1 || Number(clean.durationMinutes) > 2_147_483_647) {
    errors.durationMinutes = 'Thời lượng phải là số nguyên dương.';
  }
  if (!isCalendarDate(clean.releaseDate)) errors.releaseDate = 'Vui lòng chọn ngày phát hành hợp lệ.';
  if (!ADMIN_MOVIE_STATUSES.some(option => option.value === clean.status)) errors.status = 'Vui lòng chọn trạng thái phim.';
  for (const name of ['posterUrl', 'trailerUrl']) {
    if (clean[name].length > 500) errors[name] = 'URL tối đa 500 ký tự.';
    else if (clean[name] && !isHttpUrl(clean[name])) errors[name] = 'Nhập URL HTTP(S) hợp lệ, không chứa tài khoản hoặc khoảng trắng.';
  }
  if (clean.genre.length > 500) errors.genre = 'Thể loại tối đa 500 ký tự.';
  if (clean.ageRating.length > 10) errors.ageRating = 'Phân loại độ tuổi tối đa 10 ký tự.';
  const payload = { ...clean, durationMinutes: Number(clean.durationMinutes) };
  for (const name of ['description', 'posterUrl', 'trailerUrl', 'genre', 'ageRating']) {
    if (!payload[name]) payload[name] = null;
  }
  return { errors, payload };
}

export function readMovieFilters(params) {
  const page = params.get('page') || '1';
  const size = Number(params.get('size'));
  return {
    keyword: (params.get('q') || '').trim().slice(0, 255),
    status: ADMIN_MOVIE_STATUSES.some(option => option.value === params.get('status')) ? params.get('status') : '',
    page: /^[1-9]\d*$/.test(page) && Number(page) <= 2_147_483_647 ? Number(page) - 1 : 0,
    size: MOVIE_PAGE_SIZES.includes(size) ? size : 10,
  };
}

export function writeMovieFilters(params, filters) {
  const next = new URLSearchParams(params);
  for (const [name, value] of Object.entries({ q: filters.keyword, status: filters.status, page: filters.page > 0 ? filters.page + 1 : '', size: filters.size === 10 ? '' : filters.size })) {
    if (value) next.set(name, String(value));
    else next.delete(name);
  }
  return next;
}

export function formatMovieDate(value) {
  return isCalendarDate(value || '') ? value.split('-').reverse().join('/') : '—';
}
