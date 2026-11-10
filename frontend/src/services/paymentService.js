import axiosInstance from '../config/axiosInstance';

export const paymentService = {
  verifyVNPayReturn: async (params, signal) => {
    const { data } = await axiosInstance.post('/payments/vnpay-return', params, { signal, skipErrorToast: true });
    return data;
  },
  createUrl: async (payload) => {
    const { data } = await axiosInstance.post('/payments/create-url', payload, { skipErrorToast: true });
    return data;
  },
};
