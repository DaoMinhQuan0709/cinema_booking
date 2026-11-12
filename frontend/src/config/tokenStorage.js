import { STORAGE_KEYS } from './constants';

/**
 * Tien ich doc/ghi accessToken, refreshToken, user vao localStorage.
 *
 * Duoc tach rieng khoi Zustand authStore (se tao o Buoc 2) de axiosInstance
 * co the doc/ghi token ma khong tao import vong (circular dependency) voi
 * store. authStore se goi lai cac ham o day de dong bo state <-> localStorage.
 */
export const tokenStorage = {
  // Stable across token refreshes, different for every login (including the same account).
  getSessionId() {
    if (!this.getAccessToken()) return null;
    let sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
    }
    return sessionId;
  },

  startSession(session) {
    this.clearSession();
    this.setSession(session);
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, crypto.randomUUID());
  },

  getAccessToken() {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  getRefreshToken() {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  getUser() {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Luu toan bo phien dang nhap (goi sau khi login/register/refresh thanh cong).
   * @param {{accessToken?: string, refreshToken?: string, user?: object}} session
   */
  setSession({ accessToken, refreshToken, user } = {}) {
    if (accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  },

  setAccessToken(accessToken) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  },

  clearSession() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
  },

  isAuthenticated() {
    return Boolean(this.getAccessToken());
  },
};
