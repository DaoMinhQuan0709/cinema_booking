import axiosInstance from '../config/axiosInstance';

export const bookingService = {
  createBooking: async (payload) => {
    const { data } = await axiosInstance.post('/bookings', payload, { skipErrorToast: true });
    return data;
  },

  getBooking: async (bookingCode, options = {}) => {
    const { data } = await axiosInstance.get(`/bookings/${encodeURIComponent(bookingCode)}`, { ...options, skipErrorToast: true });
    return data;
  },

  cancelBooking: async (bookingCode) => {
    const { data } = await axiosInstance.delete(`/bookings/${encodeURIComponent(bookingCode)}/cancel`, { skipErrorToast: true });
    return data;
  },
};
