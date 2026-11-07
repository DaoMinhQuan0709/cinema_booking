import { useState } from 'react';
import { User, Phone, Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from './authStore';

/**
 * Biểu mẫu Đăng ký tài khoản mới (RegisterForm).
 * Hỗ trợ validation client (khớp mật khẩu, định dạng SĐT), Inline Alert báo lỗi server và loading spinner.
 */
export const RegisterForm = () => {
  const { register, isLoading, switchAuthModalMode } = useAuthStore();

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const fullName = formData.fullName.trim();
    const phone = formData.phone.trim();
    const email = formData.email.trim();
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;

    // Validation phía Client
    if (!fullName || !phone || !email || !password || !confirmPassword) {
      setErrorMessage('Vui lòng điền đầy đủ tất cả các trường thông tin');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không trùng khớp');
      return;
    }

    // Kiểm tra định dạng số điện thoại Việt Nam cơ bản (10 chữ số)
    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
    if (!phoneRegex.test(phone)) {
      setErrorMessage('Số điện thoại không hợp lệ (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09)');
      return;
    }

    try {
      await register({
        fullName,
        phone,
        email,
        password,
      });
    } catch (error) {
      const backendMessage =
        error.response?.data?.message || 'Đăng ký không thành công. Email hoặc số điện thoại có thể đã được sử dụng.';
      setErrorMessage(backendMessage);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {/* Khung Inline Alert hiển thị lỗi */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Họ và tên */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-300">
          Họ và tên <span className="text-primary">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
            <User className="w-4 h-4" />
          </div>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="Nguyễn Văn A"
            disabled={isLoading}
            required
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-background border border-surfaceBorder focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-white text-sm placeholder:text-neutral-500 transition-all disabled:opacity-50"
          />
        </div>
      </div>

      {/* Số điện thoại */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-300">
          Số điện thoại <span className="text-primary">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
            <Phone className="w-4 h-4" />
          </div>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="0912345678"
            disabled={isLoading}
            required
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-background border border-surfaceBorder focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-white text-sm placeholder:text-neutral-500 transition-all disabled:opacity-50"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1">
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
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-background border border-surfaceBorder focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-white text-sm placeholder:text-neutral-500 transition-all disabled:opacity-50"
          />
        </div>
      </div>

      {/* Mật khẩu */}
      <div className="space-y-1">
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
            placeholder="Tối thiểu 6 ký tự"
            disabled={isLoading}
            required
            className="w-full pl-10 pr-10 py-2 rounded-xl bg-background border border-surfaceBorder focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-white text-sm placeholder:text-neutral-500 transition-all disabled:opacity-50"
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

      {/* Xác nhận mật khẩu */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-neutral-300">
          Xác nhận mật khẩu <span className="text-primary">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Nhập lại mật khẩu vừa nhập"
            disabled={isLoading}
            required
            className="w-full pl-10 pr-10 py-2 rounded-xl bg-background border border-surfaceBorder focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none text-white text-sm placeholder:text-neutral-500 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted hover:text-white transition-colors cursor-pointer"
            tabIndex={-1}
          >
            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Nút Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full mt-3 py-3 rounded-xl bg-primary hover:bg-primaryHover text-white font-semibold text-sm tracking-wide transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Đang tạo tài khoản...</span>
          </>
        ) : (
          <span>Tạo Tài Khoản</span>
        )}
      </button>

      {/* Điều hướng chuyển sang Đăng nhập */}
      <p className="text-center text-xs text-muted pt-1">
        Đã có tài khoản?{' '}
        <button
          type="button"
          onClick={() => switchAuthModalMode('login')}
          className="text-primary hover:underline font-semibold cursor-pointer"
        >
          Đăng nhập ngay
        </button>
      </p>
    </form>
  );
};

export default RegisterForm;

