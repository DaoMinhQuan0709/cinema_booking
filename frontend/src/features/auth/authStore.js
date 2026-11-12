import { create } from 'zustand';
import { toast } from 'sonner';
import { tokenStorage } from '../../config/tokenStorage';
import { STORAGE_KEYS } from '../../config/constants';
import { clearAdminCache } from '../../config/queryClient';
import { authService } from '../../services/authService';

let pendingVerification = null;
let authOperation = 0;

export const useAuthStore = create((set, get) => {
  const acceptSession = ({ accessToken, refreshToken, user }) => {
    pendingVerification = null;
    clearAdminCache();
    tokenStorage.startSession({ accessToken, refreshToken, user });
    set({
      user, accessToken, sessionId: tokenStorage.getSessionId(),
      isAuthenticated: true, sessionStatus: 'idle', sessionError: null,
      isLoading: false, isAuthModalOpen: false,
    });
  };

  return {
    user: tokenStorage.getUser(),
    accessToken: tokenStorage.getAccessToken(),
    sessionId: tokenStorage.getSessionId(),
    isAuthenticated: tokenStorage.isAuthenticated(),
    // A cached user is never proof of Admin access. Only /users/me verifies it.
    sessionStatus: tokenStorage.isAuthenticated() ? 'idle' : 'anonymous',
    sessionError: null,
    isLoading: false,
    isAuthModalOpen: false,
    authModalMode: 'login',

    openAuthModal: (mode = 'login') => set({ isAuthModalOpen: true, authModalMode: mode }),
    closeAuthModal: () => set({ isAuthModalOpen: false }),
    switchAuthModalMode: (mode) => set({ authModalMode: mode }),

    login: async (credentials) => {
      const operation = ++authOperation;
      set({ isLoading: true });
      try {
        const response = await authService.login(credentials);
        if (operation !== authOperation) return null;
        acceptSession(response);
        toast.success(`Chào mừng trở lại, ${response.user?.fullName || 'bạn'}!`);
        return response;
      } catch (error) {
        if (operation === authOperation) set({ isLoading: false });
        throw error;
      }
    },

    register: async (payload) => {
      const operation = ++authOperation;
      set({ isLoading: true });
      try {
        const response = await authService.register(payload);
        if (operation !== authOperation) return null;
        acceptSession(response);
        toast.success('Đăng ký tài khoản thành công!');
        return response;
      } catch (error) {
        if (operation === authOperation) set({ isLoading: false });
        throw error;
      }
    },

    logout: (options = {}) => {
      authOperation++;
      pendingVerification = null;
      tokenStorage.clearSession();
      clearAdminCache();
      set({
        user: null, accessToken: null, sessionId: null,
        isAuthenticated: false, sessionStatus: 'anonymous', sessionError: null,
        isLoading: false, isAuthModalOpen: false,
      });
      if (!options.silent) toast.info('Bạn đã đăng xuất thành công.');
    },

    denyAdminAccess: () => {
      pendingVerification = null;
      clearAdminCache();
      set({ sessionStatus: 'forbidden', sessionError: null });
    },

    syncSessionFromStorage: () => {
      const accessToken = tokenStorage.getAccessToken();
      const sessionId = tokenStorage.getSessionId();
      if (sessionId === get().sessionId && accessToken === get().accessToken) return;
      authOperation++;
      pendingVerification = null;
      clearAdminCache();
      set({
        user: tokenStorage.getUser(), accessToken, sessionId,
        isAuthenticated: Boolean(accessToken),
        sessionStatus: accessToken ? 'idle' : 'anonymous', sessionError: null,
        isLoading: false, isAuthModalOpen: false,
      });
    },

    fetchCurrentUser: () => {
      const sessionId = tokenStorage.getSessionId();
      if (!sessionId) return Promise.resolve(null);
      // App bootstrap and AdminRoute can both request verification in StrictMode.
      if (pendingVerification?.sessionId === sessionId) return pendingVerification.promise;

      const verification = { sessionId, promise: null };
      pendingVerification = verification;
      set({ sessionStatus: 'checking', sessionError: null });
      const isCurrent = () => tokenStorage.getSessionId() === sessionId && pendingVerification === verification;

      verification.promise = (async () => {
        try {
          const user = await authService.getCurrentUser();
          if (!isCurrent()) return null;
          if (!user?.id || !user.role) throw new Error('Phản hồi xác minh phiên không hợp lệ.');
          if (user.id !== get().user?.id || user.role !== get().user?.role) clearAdminCache();
          tokenStorage.setSession({ user });
          set({
            user, accessToken: tokenStorage.getAccessToken(), sessionId,
            isAuthenticated: true, sessionStatus: 'authenticated', sessionError: null,
          });
          return user;
        } catch (error) {
          if (!isCurrent()) return null;
          const status = error.response?.status;
          if (status === 401) {
            get().logout({ silent: true });
          } else if (status === 403) {
            set({ user: null });
            get().denyAdminAccess();
          } else {
            clearAdminCache();
            set({ sessionStatus: 'error', sessionError: 'Không thể xác minh phiên. Vui lòng thử lại.' });
          }
          return null;
        } finally {
          if (pendingVerification === verification) pendingVerification = null;
        }
      })();
      return verification.promise;
    },
  };
});

if (typeof window !== 'undefined') {
  const handleAuthExpired = () => useAuthStore.getState().logout({ silent: true });
  const handleAuthRefreshed = () => useAuthStore.setState({ accessToken: tokenStorage.getAccessToken() });
  const handleAdminForbidden = () => useAuthStore.getState().denyAdminAccess();
  const handleStorage = (event) => {
    if (event.storageArea === localStorage && (event.key === null || Object.values(STORAGE_KEYS).includes(event.key))) {
      useAuthStore.getState().syncSessionFromStorage();
    }
  };
  window.addEventListener('premier_cinema:auth-expired', handleAuthExpired);
  window.addEventListener('premier_cinema:auth-refreshed', handleAuthRefreshed);
  window.addEventListener('premier_cinema:admin-forbidden', handleAdminForbidden);
  window.addEventListener('storage', handleStorage);
  import.meta.hot?.dispose(() => {
    window.removeEventListener('premier_cinema:auth-expired', handleAuthExpired);
    window.removeEventListener('premier_cinema:auth-refreshed', handleAuthRefreshed);
    window.removeEventListener('premier_cinema:admin-forbidden', handleAdminForbidden);
    window.removeEventListener('storage', handleStorage);
  });
}

export default useAuthStore;
