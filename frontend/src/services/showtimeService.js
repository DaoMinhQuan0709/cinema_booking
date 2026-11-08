import axiosInstance from '../config/axiosInstance';

/**
 * Service goi API lich chieu. Khop ShowtimeController.java:
 * GET /showtimes?movieId=&cinemaId=&date=YYYY-MM-DD
 * Moi phan tu khop ShowtimeResponse: { id, movieId, movieTitle, posterUrl,
 * cinemaId, cinemaName, auditoriumId, auditoriumName, startTime, endTime, basePrice }
 *
 * Luu y: backend tu loai bo cac suat da bat dau (chi tra suat con mo ban).
 * Ham getShowtimeSeats (GET /showtimes/{id}/seats) se them o buoc Man hinh chon ghe.
 */
export const showtimeService = {
  /**
   * @param {Object} [params]
   * @param {number|string} [params.movieId]
   * @param {number|string} [params.cinemaId]
   * @param {string} [params.date] dinh dang YYYY-MM-DD (gio dia phuong)
   * @returns {Promise<object[]>}
   */
  getShowtimes: async (params = {}) => {
    const { data } = await axiosInstance.get('/showtimes', { params });
    return data;
  },

  /**
   * @param {number|string} id
   * @returns {Promise<object>}
   */
  getShowtimeById: async (id) => {
    const { data } = await axiosInstance.get(`/showtimes/${id}`);
    return data;
  },
};

export default showtimeService;
