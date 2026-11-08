import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Film,
  User,
  LogOut,
  Ticket,
  LayoutDashboard,
  Menu,
  X,
  ChevronDown,
  ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '../../features/auth/authStore';
import { USER_ROLE } from '../../config/constants';

/**
 * Component Header chung toan ung dung PremierCinema.
 * Phong cach Cinematic Dark Mode, co responsive menu cho dien thoai.
 */
export const Header = () => {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const logout = useAuthStore(state => state.logout);
  const openAuthModal = useAuthStore(state => state.openAuthModal);

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Dong dropdown khi click ra ngoai
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const navLinks = [
    { name: 'Trang chủ', path: '/' },
    { name: 'Phim', path: '/movies' },
    { name: 'Lịch chiếu', path: '/showtimes' },
    { name: 'Rạp & Giá vé', path: '/cinemas' },
  ];

  const getNavLinkClass = ({ isActive }) =>
    `relative py-2 text-sm font-medium tracking-wide transition-all duration-200 hover:text-white ${
      isActive ? 'text-white font-semibold' : 'text-neutral-400'
    } after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-primary after:transition-all after:duration-300 ${
      isActive ? 'after:scale-x-100 after:opacity-100' : 'after:scale-x-0 after:opacity-0 hover:after:scale-x-100 hover:after:opacity-70'
    }`;

  const isAdmin = user?.role === USER_ROLE.ADMIN;

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-md border-b border-surfaceBorder transition-all">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between h-20">
          {/* Logo thuong hieu */}
          <Link
            to="/"
            className="flex items-center gap-3 mr-8 lg:mr-14 group text-white focus:outline-none shrink-0"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shadow-lg shadow-primary/10">
              <Film className="w-6 h-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-wider bg-gradient-to-r from-white via-white to-neutral-300 bg-clip-text text-transparent">
                PREMIER<span className="text-primary">CINEMA</span>
              </span>
              <span className="text-[10px] tracking-widest text-muted uppercase -mt-0.5 font-medium">
                Cinematic Booking
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 lg:gap-11">
            {navLinks.map((link) => (
              <NavLink key={link.path} to={link.path} className={getNavLinkClass}>
                {link.name}
              </NavLink>
            ))}
          </nav>

          {/* User Actions (Desktop) */}
          <div className="hidden md:flex items-center gap-6 ml-auto pl-6">
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primaryHover text-white text-sm font-semibold tracking-wide transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-95 cursor-pointer"
              >
                Đăng nhập
              </button>
            ) : (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-3 p-1.5 pr-3 rounded-full bg-surface hover:bg-surface/80 border border-surfaceBorder transition-all cursor-pointer focus:outline-none"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                    {user?.fullName ? user.fullName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-semibold text-white leading-tight line-clamp-1 max-w-[120px]">
                      {user?.fullName || 'Người dùng'}
                    </p>
                    <p className="text-[10px] text-muted leading-tight">
                      {isAdmin ? 'Quản trị viên' : 'Khách hàng'}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-muted transition-transform duration-200 ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu User */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-surface border border-surfaceBorder shadow-2xl py-2 z-50 animate-fade-in">
                    <div className="px-4 py-2 border-b border-surfaceBorder/60">
                      <p className="text-xs text-muted">Đăng nhập với</p>
                      <p className="text-sm font-semibold text-white truncate">
                        {user?.email}
                      </p>
                      {isAdmin && (
                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-primary/20 text-primary border border-primary/30">
                          <ShieldAlert className="w-3 h-3" /> ADMIN
                        </span>
                      )}
                    </div>

                    <div className="py-1">
                      <Link
                        to="/profile/bookings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <Ticket className="w-4 h-4 text-muted" />
                        Vé của tôi
                      </Link>

                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-primary hover:bg-primary/10 transition-colors font-medium"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          Trang Quản trị
                        </Link>
                      )}
                    </div>

                    <div className="pt-1 border-t border-surfaceBorder/60">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-lg bg-surface border border-surfaceBorder text-muted hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-surfaceBorder bg-background/98 px-4 pt-3 pb-6 space-y-4 animate-fade-in">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-base font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/15 text-primary font-semibold'
                      : 'text-neutral-300 hover:bg-surface'
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
          </nav>

          <div className="pt-4 border-t border-surfaceBorder">
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openAuthModal('login');
                }}
                className="w-full py-3 rounded-lg bg-primary hover:bg-primaryHover text-white text-center font-semibold text-sm transition-all"
              >
                Đăng nhập / Đăng ký
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                    {user?.fullName ? user.fullName.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{user?.fullName}</p>
                    <p className="text-xs text-muted">{user?.email}</p>
                  </div>
                </div>

                <div className="flex flex-col space-y-1">
                  <Link
                    to="/profile/bookings"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-surface"
                  >
                    <Ticket className="w-4 h-4 text-muted" />
                    Vé của tôi
                  </Link>

                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary font-medium hover:bg-primary/10"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Trang Quản trị
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

