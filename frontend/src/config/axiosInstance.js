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
// Gom cac request dang cho vao 1 hang doi de tranh goi /auth/refresh
// nhieu lan cung luc khi co nhieu request fail 401 dong thoi.
// =====================================================================
let isRefreshing = false;
let pendingQueue = [];

function resolveQueue(error, newAccessToken) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(newAccessToken);
  });
  pendingQueue = [];
}

async function refreshAccessToken() {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('Khong co refresh token de lam moi phien dang nhap');
  }

  // Dung axios goc (KHONG qua axiosInstance) de tranh vong lap interceptor vo han
  const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
  const { accessToken, refreshToken: newRefreshToken, user } = response.data.data;

  tokenStorage.setSession({ accessToken, refreshToken: newRefreshToken, user });
  return accessToken;
}

function forceLogout() {
  tokenStorage.clearSession();
  if (typeof window !== 'undefined') {
    // authStore (Buoc 2) se lang nghe su kien nay de reset state va dieu huong ve /login
    window.dispatchEvent(new CustomEvent('premier_cinema:auth-expired'));
  }
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
    const status = error.response?.status;
    const isAuthEndpoint = originalRequest.url?.includes('/auth/');
    const skipErrorToast = originalRequest.skipErrorToast || isAuthEndpoint;

    // --- 401 ngoai cac endpoint /auth/** -> thu refresh token 1 lan ---
    if (status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((newAccessToken) => {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axiosInstance(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newAccessToken = await refreshAccessToken();
        resolveQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        resolveQueue(refreshError, null);
        forceLogout();
        toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
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
