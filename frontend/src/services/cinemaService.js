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
   * @returns {Promise<object[]>}
   */
  getCinemas: async (params = {}) => {
    const { data } = await axiosInstance.get('/cinemas', { params });
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
