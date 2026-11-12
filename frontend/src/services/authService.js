import axiosInstance from '../config/axiosInstance';

/**
 * Service xu ly goi API xac thuc nguoi dung va lay thong tin tai khoan.
 * Toan bo request deu di qua axiosInstance de tu dong dinh kem token
 * va boc tach ApiResponse<T> -> chi can lay { data }.
 */
export const authService = {
  /**
   * Dang nhap tai khoan
   * @param {{ email: string, password: string }} credentials
   * @returns {Promise<{ accessToken: string, refreshToken: string, tokenType: string, user: object }>}
   */
  login: async (credentials) => {
    const { data } = await axiosInstance.post('/auth/login', credentials);
    return data;
  },

  /**
   * Dang ky tai khoan moi
   * @param {{ email: string, password: string, fullName: string, phone: string }} payload
   * @returns {Promise<{ accessToken: string, refreshToken: string, tokenType: string, user: object }>}
   */
  register: async (payload) => {
    const { data } = await axiosInstance.post('/auth/register', payload);
    return data;
  },

  /**
   * Lay thong tin nguoi dung hien tai tu backend
   * @returns {Promise<{ id: number, email: string, fullName: string, phone: string, role: string }>}
   */
  getCurrentUser: async () => {
    const { data } = await axiosInstance.get('/users/me', { skipErrorToast: true });
    return data;
  },
};

export default authService;

