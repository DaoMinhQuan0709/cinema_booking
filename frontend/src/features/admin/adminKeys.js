export const adminKeys = {
  all: ['admin'],
  movies: ['admin', 'movies'],
  movieList: (params = {}) => ['admin', 'movies', params],
  movieOptions: ['admin', 'movie-options'],
  movieOptionList: (params = {}) => ['admin', 'movie-options', params],
  cinemas: ['admin', 'cinemas'],
  cinemaList: (params = {}) => ['admin', 'cinemas', params],
  showtimes: ['admin', 'showtimes'],
  showtimeList: (params = {}) => ['admin', 'showtimes', params],
  reports: ['admin', 'reports'],
  revenue: (params = {}) => ['admin', 'reports', 'revenue', params],
  occupancy: (params = {}) => ['admin', 'reports', 'occupancy', params],
  syncStatus: ['admin', 'sync', 'status'],
};

export const adminInvalidationKeys = {
  movie: [adminKeys.movies, adminKeys.movieOptions, adminKeys.showtimes, adminKeys.reports, ['movies'], ['showtimes']],
  showtime: [adminKeys.showtimes, adminKeys.reports, ['showtimes'], ['movies']],
  sync: [adminKeys.all, ['movies'], ['showtimes'], ['cinemas']],
};
