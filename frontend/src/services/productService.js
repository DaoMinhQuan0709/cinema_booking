import axiosInstance from '../config/axiosInstance';

export const productService = {
  getProducts: async (signal) => {
    const { data } = await axiosInstance.get('/products', { signal, skipErrorToast: true });
    if (!Array.isArray(data)) throw new Error('Không nhận được danh mục combo hợp lệ.');
    return data;
  },
};
