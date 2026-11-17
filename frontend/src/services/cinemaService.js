import axiosInstance from '../config/axiosInstance';

/**
 * Service goi API cum rap. Khop CinemaController.java:
 * GET /cinemas?city= , GET /cinemas/{id}
 * CinemaResponse gồm thông tin cơ bản, ảnh/điện thoại/tọa độ, metadata Galaxy
 * và auditoriums. Không gọi Galaxy khi khách đọc danh sách.
 */
export const cinemaService = {
  /**
   * @param {Object} [params]
   * @param {string} [params.city]
   * @param {Object} [options] Axios options (signal, skipErrorToast)
   * @returns {Promise<object[]>}
   */
  getCinemas: async (params = {}, options = {}) => {
    const { data } = await axiosInstance.get('/cinemas', { ...options, params });
    if (!Array.isArray(data)) throw new Error('Dữ liệu danh sách rạp không hợp lệ.');
    return data;
  },

  /**
   * @param {number|string} id
   * @param {Object} [options] Axios options (signal, skipErrorToast)
   * @returns {Promise<object>}
   */
  getCinemaById: async (id, options = {}) => {
    const { data } = await axiosInstance.get(`/cinemas/${id}`, options);
    return data;
  },
};

export default cinemaService;
