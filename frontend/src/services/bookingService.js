import axiosInstance from '../config/axiosInstance';

async function timedBooking(request) {
  const started = performance.now();
  const { data } = await request();
  const receivedAt = performance.now();
  return { ...data, _timing: {
    receivedAt,
    remaining: Math.max(0, Date.parse(data.checkout?.expiresAt) - Date.parse(data.serverTime) - (receivedAt - started) / 2),
  } };
}

export const bookingService = {
  createBooking: async (payload) => {
    const { data } = await axiosInstance.post('/bookings', payload, { skipErrorToast: true });
    return data;
  },

  getBooking: async (bookingCode, options = {}) => {
    const { data } = await axiosInstance.get(`/bookings/${encodeURIComponent(bookingCode)}`, { ...options, skipErrorToast: true });
    return data;
  },

  getCheckout: (code, signal) => timedBooking(() => axiosInstance.get(`/bookings/${encodeURIComponent(code)}`, { signal, skipErrorToast: true })),

  updateProducts: (code, payload) => timedBooking(() => axiosInstance.put(`/bookings/${encodeURIComponent(code)}/products`, payload, { skipErrorToast: true })),

  cancelBooking: async (bookingCode) => {
    const { data } = await axiosInstance.delete(`/bookings/${encodeURIComponent(bookingCode)}/cancel`, { skipErrorToast: true });
    return data;
  },
};
