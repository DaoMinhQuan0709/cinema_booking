import { useEffect } from 'react';
import { X, Film } from 'lucide-react';
import { useAuthStore } from './authStore';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

/**
 * Component AuthModal (Container chính của hộp thoại Đăng nhập / Đăng ký).
 * Quản lý lớp phủ mờ (Backdrop), phím ESC, khóa cuộn trang và thanh Tabs điều hướng.
 */
export const AuthModal = () => {
  const isAuthModalOpen = useAuthStore(state => state.isAuthModalOpen);
  const closeAuthModal = useAuthStore(state => state.closeAuthModal);
  const authModalMode = useAuthStore(state => state.authModalMode);
  const switchAuthModalMode = useAuthStore(state => state.switchAuthModalMode);

  // Khóa cuộn trang khi modal đang mở
  useEffect(() => {
    if (isAuthModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAuthModalOpen]);

  // Lắng nghe phím ESC để đóng modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Lớp nền bắt sự kiện click outside */}
      <div
        className="fixed inset-0 cursor-pointer"
        onClick={closeAuthModal}
        aria-hidden="true"
      />

      {/* Hộp thoại chính (Dialog Box) */}
      <div className="relative w-full max-w-md bg-surface border border-surfaceBorder rounded-2xl shadow-2xl shadow-black/80 p-6 sm:p-8 z-10 max-h-[90vh] overflow-y-auto">
        {/* Nút X đóng modal */}
        <button
          type="button"
          onClick={closeAuthModal}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo thương hiệu thu nhỏ */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <Film className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xl font-black tracking-wider text-white">
            PREMIER<span className="text-primary">CINEMA</span>
          </span>
        </div>

        {/* Thanh Tabs chuyển đổi Đăng Nhập / Đăng Ký */}
        <div className="flex rounded-xl bg-background p-1 border border-surfaceBorder mb-6">
          <button
            type="button"
            onClick={() => switchAuthModalMode('login')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              authModalMode === 'login'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Đăng Nhập
          </button>
          <button
            type="button"
            onClick={() => switchAuthModalMode('register')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              authModalMode === 'register'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Đăng Ký
          </button>
        </div>

        {/* Nội dung form tương ứng */}
        <div className="mt-2">
          {authModalMode === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;

