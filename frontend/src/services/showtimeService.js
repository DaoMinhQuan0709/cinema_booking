import axiosInstance from '../config/axiosInstance';

/**
 * Service goi API lich chieu. Khop ShowtimeController.java:
 * GET /showtimes?movieId=&cinemaId=&date=YYYY-MM-DD
 * Moi phan tu khop ShowtimeResponse: { id, movieId, movieTitle, posterUrl,
 * cinemaId, cinemaName, auditoriumId, auditoriumName, startTime, endTime, basePrice }
 *
 * Luu y: backend tu loai bo cac suat da bat dau (chi tra suat con mo ban).
 */
export const showtimeService = {
  /**
   * @param {Object} [params]
   * @param {number|string} [params.movieId]
   * @param {number|string} [params.cinemaId]
   * @param {string} [params.date] dinh dang YYYY-MM-DD (gio dia phuong)
   * @param {Object} [options] Axios options (signal, skipErrorToast)
   * @returns {Promise<object[]>}
   */
  getShowtimes: async (params = {}, options = {}) => {
    const { data } = await axiosInstance.get('/showtimes', { ...options, params });
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

  /**
   * So do ghe + trang thai ghe cua 1 suat chieu (da gop trang thai giu cho tu Redis).
   * Khop ShowtimeSeatsMapResponse: { showtimeId, auditoriumId, auditoriumName,
   * totalRows, totalCols, seats: [{ showtimeSeatId, seatId, rowChar, seatNumber,
   * seatType, price, status }] }
   * @param {number|string} id
   */
  getShowtimeSeats: async (id) => {
    const { data } = await axiosInstance.get(`/showtimes/${id}/seats`);
    return data;
  },
};

export default showtimeService;
