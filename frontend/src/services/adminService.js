import axiosInstance from '../config/axiosInstance';
import { movieService } from './movieService';
import { cinemaService } from './cinemaService';
import { showtimeService } from './showtimeService';

const requestOptions = (options) => ({ ...options, skipErrorToast: true });

// Match MovieCreateRequest; form state, IDs and derived fields never go into the body.
const movieBody = ({ title, description, durationMinutes, releaseDate, posterUrl, trailerUrl, genre, ageRating, status }) =>
  ({ title, description, durationMinutes, releaseDate, posterUrl, trailerUrl, genre, ageRating, status });
const showtimeBody = ({ movieId, auditoriumId, startTime, endTime, basePrice }) =>
  ({ movieId, auditoriumId, startTime, endTime, basePrice });

export const adminService = {
  getMovies: (params = {}, options) => movieService.getMovies(params, requestOptions(options)),
  getMovieOptions: (params = {}, options) => movieService.getAllMovies(params, requestOptions(options)),
  getCinemas: (params = {}, options) => cinemaService.getCinemas(params, requestOptions(options)),
  getShowtimes: (params = {}, options) => showtimeService.getShowtimes(params, requestOptions(options)),

  createMovie: async (payload, options) => {
    const { data } = await axiosInstance.post('/admin/movies', movieBody(payload), requestOptions(options));
    return data;
  },
  updateMovie: async (id, payload, options) => {
    const { data } = await axiosInstance.put(`/admin/movies/${encodeURIComponent(id)}`, movieBody(payload), requestOptions(options));
    return data;
  },
  createShowtime: async (payload, options) => {
    const { data } = await axiosInstance.post('/admin/showtimes', showtimeBody(payload), requestOptions(options));
    return data;
  },
  getRevenue: async (params = {}, options) => {
    const { data } = await axiosInstance.get('/admin/reports/revenue', { ...requestOptions(options), params });
    return data;
  },
  getOccupancy: async (params = {}, options) => {
    const { data } = await axiosInstance.get('/admin/reports/occupancy', { ...requestOptions(options), params });
    return data;
  },
  getSyncStatus: async (options) => {
    const { data } = await axiosInstance.get('/admin/sync/galaxy/status', requestOptions(options));
    return data;
  },
  syncLocalFile: async ({ limitShowtimes = 100 } = {}, options) => {
    const { data } = await axiosInstance.post('/admin/sync/galaxy/local-file', null, {
      timeout: 60_000, ...requestOptions(options), params: { limitShowtimes },
    });
    return data;
  },
};

export default adminService;
