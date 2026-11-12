import axios from 'axios';
import { toast } from 'sonner';
import { API_BASE_URL } from './constants';
import { tokenStorage } from './tokenStorage';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// =====================================================================
// REQUEST INTERCEPTOR: tu dong dinh kem "Authorization: Bearer <token>"
// =====================================================================
axiosInstance.interceptors.request.use(
  (config) => {
    const sessionId = tokenStorage.getSessionId();
    if (Object.hasOwn(config, '_sessionId') && config._sessionId !== sessionId) {
      throw new axios.CanceledError('Phiên đăng nhập đã thay đổi.');
    }
    config._sessionId = sessionId;
    const accessToken = tokenStorage.getAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// =====================================================================
// XU LY REFRESH TOKEN KHI GAP 401
// Share one refresh per session. A late refresh must never restore an old login.
// =====================================================================
let refreshRequest = null;

async function refreshAccessToken(sessionId) {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('Khong co refresh token de lam moi phien dang nhap');
  }

  // Dung axios goc (KHONG qua axiosInstance) de tranh vong lap interceptor vo han
  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 15000 });
  if (sessionId !== tokenStorage.getSessionId()) throw new axios.CanceledError('Phiên đăng nhập đã thay đổi.');
  const { accessToken, refreshToken: newRefreshToken, user } = response.data.data;
  if (!accessToken) throw new Error('Phản hồi làm mới phiên không hợp lệ.');

  tokenStorage.setSession({ accessToken, refreshToken: newRefreshToken, user });
  window.dispatchEvent(new CustomEvent('premier_cinema:auth-refreshed'));
  return accessToken;
}

function forceLogout(sessionId) {
  if (sessionId !== tokenStorage.getSessionId()) return;
  tokenStorage.clearSession();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('premier_cinema:auth-expired'));
  }
  toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
}

// =====================================================================
// RESPONSE INTERCEPTOR
// Thanh cong: boc tach ApiResponse<T> { code, message, data } -> tra ve
// truc tiep phan "data", dong thoi van giu "message"/"code" tren response
// de service nao can toast thanh cong (vd: "Giu ghe thanh cong!") van dung duoc.
// That bai: tu dong thu refresh token (401), toast loi chung cho cac ma loi
// con lai, tru khi request duoc danh dau { skipErrorToast: true }.
// =====================================================================
axiosInstance.interceptors.response.use(
  (response) => {
    if (response.config._sessionId !== tokenStorage.getSessionId()) {
      return Promise.reject(new axios.CanceledError('Phản hồi thuộc phiên đăng nhập cũ.'));
    }
    const apiResponse = response.data;
    return {
      ...response,
      data: apiResponse?.data,
      message: apiResponse?.message,
      code: apiResponse?.code,
    };
  },
  async (error) => {
    const originalRequest = error.config || {};
    if (axios.isCancel(error)) return Promise.reject(error);
    const sessionId = originalRequest._sessionId;
    if (Object.hasOwn(originalRequest, '_sessionId') && sessionId !== tokenStorage.getSessionId()) {
      return Promise.reject(new axios.CanceledError('Phản hồi thuộc phiên đăng nhập cũ.'));
    }
    const status = error.response?.status;
    const isAuthEndpoint = originalRequest.url?.includes('/auth/');
    const skipErrorToast = originalRequest.skipErrorToast || isAuthEndpoint;

    // --- 401 ngoai cac endpoint /auth/** -> thu refresh token 1 lan ---
    if (status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      originalRequest._retry = true;
      if (!refreshRequest || refreshRequest.sessionId !== sessionId) {
        const pending = { sessionId, promise: null };
        pending.promise = refreshAccessToken(sessionId).finally(() => {
          if (refreshRequest === pending) refreshRequest = null;
        });
        refreshRequest = pending;
      }

      try {
        const newAccessToken = await refreshRequest.promise;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        if (sessionId === tokenStorage.getSessionId()) forceLogout(sessionId);
        return Promise.reject(refreshError);
      }
    }

    if (status === 401 && !isAuthEndpoint) {
      forceLogout(sessionId);
      return Promise.reject(error);
    }

    if (status === 403 && /^\/admin(?:\/|$)/.test(originalRequest.url)) {
      window.dispatchEvent(new CustomEvent('premier_cinema:admin-forbidden'));
    }

    // --- Toast loi chung (co the tat tung request bang { skipErrorToast: true }) ---
    if (!skipErrorToast) {
      const backendMessage = error.response?.data?.message;

      if (status === 403) {
        toast.error(backendMessage || 'Bạn không có quyền thực hiện thao tác này');
      } else if (status === 409) {
        // 409 (vd: ghe da co nguoi giu truoc) thuong duoc man hinh Booking tu bat
        // rieng de hien Toast dung ngu canh; van hien mac dinh phong khi noi goi khong tu xu ly.
        toast.error(backendMessage || 'Dữ liệu vừa bị thay đổi, vui lòng thử lại');
      } else if (status === 400) {
        toast.error(backendMessage || 'Yêu cầu không hợp lệ');
      } else if (status === 404) {
        toast.error(backendMessage || 'Không tìm thấy dữ liệu');
      } else if (status >= 500) {
        toast.error(backendMessage || 'Lỗi hệ thống, vui lòng thử lại sau');
      } else if (!status) {
        toast.error('Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng.');
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
