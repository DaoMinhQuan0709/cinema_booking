import { create } from 'zustand';
import { toast } from 'sonner';
import { tokenStorage } from '../../config/tokenStorage';
import { authService } from '../../services/authService';

/**
 * Zustand Store quan ly trang thai xac thuc (Authentication State).
 * Dong bo truc tiep voi tokenStorage va axiosInstance.
 */
export const useAuthStore = create((set) => ({
  // State khoi tao tu localStorage
  user: tokenStorage.getUser(),
  accessToken: tokenStorage.getAccessToken(),
  isAuthenticated: tokenStorage.isAuthenticated(),
  isLoading: false,

  // State quan ly Modal Dang nhap / Dang ky toan cuc
  isAuthModalOpen: false,
  authModalMode: 'login', // 'login' | 'register'

  /**
   * Mo modal xac thuc
   * @param {'login' | 'register'} mode
   */
  openAuthModal: (mode = 'login') => {
    set({ isAuthModalOpen: true, authModalMode: mode });
  },

  /**
   * Dong modal xac thuc
   */
  closeAuthModal: () => {
    set({ isAuthModalOpen: false });
  },

  /**
   * Chuyen doi qua lai giua man hinh Dang nhap va Dang ky
   * @param {'login' | 'register'} mode
   */
  switchAuthModalMode: (mode) => {
    set({ authModalMode: mode });
  },

  /**
   * Xu ly Dang nhap
   */
  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const response = await authService.login(credentials);
      const { accessToken, refreshToken, user } = response;

      // Luu session vao localStorage
      tokenStorage.setSession({ accessToken, refreshToken, user });

      // Cap nhat state store
      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
      });

      toast.success(`Chào mừng trở lại, ${user?.fullName || 'bạn'}!`);
      return response;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Xu ly Dang ky tai khoan moi
   */
  register: async (payload) => {
    set({ isLoading: true });
    try {
      const response = await authService.register(payload);
      const { accessToken, refreshToken, user } = response;

      tokenStorage.setSession({ accessToken, refreshToken, user });

      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
        isAuthModalOpen: false,
      });

      toast.success('Đăng ký tài khoản thành công!');
      return response;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Xu ly Dang xuat
   * @param {{ silent?: boolean }} options
   */
  logout: (options = {}) => {
    tokenStorage.clearSession();
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isAuthModalOpen: false,
    });

    if (!options.silent) {
      toast.info('Bạn đã đăng xuất thành công.');
    }
  },

  /**
   * Dong bo lai thong tin user profile moi nhat tu backend
   */
  fetchCurrentUser: async () => {
    if (!tokenStorage.isAuthenticated()) return null;

    try {
      const user = await authService.getCurrentUser();
      tokenStorage.setSession({ user });
      set({ user, isAuthenticated: true });
      return user;
    } catch {
      // Neu loi token thi axiosInstance da tu bat 401 de refresh / logout
      return null;
    }
  },
}));

// Lang nghe su kien phien het han tu axiosInstance (khi refresh token that bai)
if (typeof window !== 'undefined') {
  const handleAuthExpired = () => {
    useAuthStore.getState().logout({ silent: true });
  };
  window.addEventListener('premier_cinema:auth-expired', handleAuthExpired);
  import.meta.hot?.dispose(() => {
    window.removeEventListener('premier_cinema:auth-expired', handleAuthExpired);
  });
}

export default useAuthStore;
