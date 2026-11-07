import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from './authStore';

/**
 * Biểu mẫu Đăng nhập (LoginForm).
 * Hỗ trợ ẩn/hiện mật khẩu, Inline Alert báo lỗi và nút Submit có trạng thái Loading.
 */
export const LoginForm = () => {
  const { login, isLoading, switchAuthModalMode } = useAuthStore();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Xóa cảnh báo lỗi khi người dùng chỉnh sửa
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const email = formData.email.trim();
    const password = formData.password;

    if (!email || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ Email và Mật khẩu');
      return;
    }

    try {
      await login({ email, password });
    } catch (error) {
      const backendMessage =
        error.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu.';
      setErrorMessage(backendMessage);
    }
  };

  const handleForgotPassword = () => {
    toast.info('Vui lòng liên hệ Hotline 1900 1234 hoặc email support@premiercinema.vn để đặt lại mật khẩu.');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Khung Inline Alert hiển thị lỗi */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Trường Email */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-neutral-300">
          Email <span className="text-primary">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
            <Mail className="w-4 h-4" />
          </div>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="name@example.com"
            disabled={isLoading}
            required
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-surfaceBorder focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-white text-sm placeholder:text-neutral-500 transition-all disabled:opacity-50"
          />
        </div>
      </div>

      {/* Trường Mật khẩu */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-neutral-300">
          Mật khẩu <span className="text-primary">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            disabled={isLoading}
            required
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-background border border-surfaceBorder focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-white text-sm placeholder:text-neutral-500 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted hover:text-white transition-colors cursor-pointer"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Tiện ích: Nhớ mật khẩu & Quên mật khẩu */}
      <div className="flex items-center justify-between text-xs pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none text-neutral-400 hover:text-neutral-300">
          <input
            type="checkbox"
            name="rememberMe"
            checked={formData.rememberMe}
            onChange={handleChange}
            className="w-3.5 h-3.5 rounded bg-background border-surfaceBorder text-primary focus:ring-primary focus:ring-offset-background"
          />
          <span>Ghi nhớ đăng nhập</span>
        </label>
        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-primary hover:text-primaryHover transition-colors cursor-pointer"
        >
          Quên mật khẩu?
        </button>
      </div>

      {/* Nút Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-2 py-3 rounded-xl bg-primary hover:bg-primaryHover text-white font-semibold text-sm tracking-wide transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang đăng nhập...</span>
          </>
        ) : (
          <span>Đăng Nhập</span>
        )}
      </button>

      {/* Chuyển sang form Đăng ký */}
      <p className="text-center text-xs text-muted pt-2">
        Chưa có tài khoản?{' '}
        <button
          type="button"
          onClick={() => switchAuthModalMode('register')}
          className="text-primary hover:underline font-semibold cursor-pointer"
        >
          Đăng ký ngay
        </button>
      </p>
    </form>
  );
};

export default LoginForm;

