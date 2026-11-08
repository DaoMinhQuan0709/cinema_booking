import axiosInstance from '../config/axiosInstance';

/**
 * Service goi API cum rap. Khop CinemaController.java:
 * GET /cinemas?city= , GET /cinemas/{id}
 * CinemaResponse: { id, name, address, city, auditoriums: [...] }
 */
export const cinemaService = {
  /**
   * @param {Object} [params]
   * @param {string} [params.city]
   * @param {Object} [options] Axios options (skipErrorToast)
   * @returns {Promise<object[]>}
   */
  getCinemas: async (params = {}, options = {}) => {
    const { data } = await axiosInstance.get('/cinemas', { ...options, params });
    return data;
  },

  /**
   * @param {number|string} id
   */
  getCinemaById: async (id) => {
    const { data } = await axiosInstance.get(`/cinemas/${id}`);
    return data;
  },
};

export default cinemaService;
