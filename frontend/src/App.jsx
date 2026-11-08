import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Film, Sparkles, Ticket } from 'lucide-react';
import MainLayout from './layouts/MainLayout';
import { useAuthStore } from './features/auth/authStore';
import { MovieShowcase } from './features/movies/MovieShowcase';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Trang chu: Hero gioi thieu thuong hieu + MovieShowcase (Tabs Dang chieu /
 * Sap chieu, du lieu that tu GET /movies).
 */
const HomePage = () => {
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold mb-6 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          Hệ Thống Đặt Vé Xem Phim High-Concurrency
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-3xl leading-tight">
          Trải Nghiệm Điện Ảnh Đỉnh Cao Tại{' '}
          <span className="text-white">PREMIER</span><span className="text-primary">CINEMA</span>
        </h1>

        <p className="mt-4 text-base sm:text-lg text-muted max-w-xl">
          Đặt vé nhanh chóng, chọn ghế trực quan thời gian thực, giữ chỗ 10 phút chống trùng và
          tích hợp trợ lý ảo CineBot thông minh.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/movies"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primaryHover text-white font-semibold text-sm transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-95"
          >
            <Film className="w-4 h-4" />
            Khám Phá Phim Ngay
          </Link>

          {!isAuthenticated ? (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-surface hover:bg-surface/80 border border-surfaceBorder text-white font-semibold text-sm transition-all cursor-pointer"
            >
              Đăng nhập / Đăng ký
            </button>
          ) : (
            <div className="text-sm text-neutral-300">
              Xin chào, <strong className="text-primary">{user?.fullName}</strong>!
            </div>
          )}
        </div>
      </div>

      <MovieShowcase />
    </div>
  );
};

const PlaceholderPage = ({ title }) => (
  <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
    <Ticket className="w-12 h-12 text-primary/40 mb-3" />
    <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
    <p className="text-sm text-muted">Trang đang trong lộ trình hoàn thiện ở các bước tiếp theo.</p>
  </div>
);

export const App = () => {
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);

  // Dong bo lai thong tin user tu backend neu da co token luu trong localStorage
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* MainLayout boc toan bo route khach hang */}
          <Route path="/" element={<MainLayout />}>
            <Route index element={<HomePage />} />
            <Route path="movies" element={<PlaceholderPage title="Danh sách Phim Đang Chiếu & Sắp Chiếu" />} />
            <Route path="showtimes" element={<PlaceholderPage title="Lịch Chiếu Toàn Quốc" />} />
            <Route path="cinemas" element={<PlaceholderPage title="Hệ Thống Cụm Rạp & Bảng Giá Vé" />} />
            <Route path="profile/bookings" element={<PlaceholderPage title="Lịch Sử Vé Đã Đặt Của Bạn" />} />
          </Route>
        </Routes>
      </BrowserRouter>

      {/* Toast thong bao toan cuc */}
      <Toaster position="top-right" theme="dark" richColors />
    </QueryClientProvider>
  );
};

export default App;
