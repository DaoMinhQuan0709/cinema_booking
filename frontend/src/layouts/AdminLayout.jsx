import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Clapperboard, Film, LayoutDashboard, LogOut, Menu, RefreshCw, X } from 'lucide-react';
import { useAuthStore } from '../features/auth/authStore';

const NAV_ITEMS = [
  { to: '/admin/reports', label: 'Báo cáo', icon: LayoutDashboard },
  { to: '/admin/movies', label: 'Quản lý phim', icon: Clapperboard },
  { to: '/admin/showtimes', label: 'Suất chiếu', icon: CalendarDays },
  { to: '/admin/sync', label: 'Nhập dữ liệu', icon: RefreshCw },
];

const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const Brand = () => (
  <Link to="/admin/reports" className={`flex items-center gap-3 rounded-lg ${FOCUS_RING}`}>
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
      <Film aria-hidden="true" className="h-5 w-5" />
    </div>
    <div className="flex flex-col">
      <span className="text-base font-black leading-tight tracking-wider text-white">
        PREMIER<span className="text-primary">CINEMA</span>
      </span>
      <span className="text-[10px] font-medium uppercase tracking-widest text-muted">Quản trị</span>
    </div>
  </Link>
);

const AdminNav = ({ onNavigate }) => (
  <nav aria-label="Điều hướng quản trị" className="flex flex-col gap-1">
    {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${FOCUS_RING} ${
            isActive ? 'bg-primary/15 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon aria-hidden="true" className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
            {label}
          </>
        )}
      </NavLink>
    ))}
  </nav>
);

const AccountPanel = ({ onNavigate }) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="space-y-3 border-t border-surfaceBorder pt-4">
      <div className="flex items-center gap-3 px-1">
        <div aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
          {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'A'}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{user?.fullName || 'Quản trị viên'}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
      </div>
      <Link
        to="/"
        onClick={onNavigate}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-neutral-300 transition-colors hover:bg-white/5 hover:text-white ${FOCUS_RING}`}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Về website
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 ${FOCUS_RING}`}
      >
        <LogOut aria-hidden="true" className="h-4 w-4" />
        Đăng xuất
      </button>
    </div>
  );
};

/**
 * Menu dang ngan keo cho man hinh nho. Dung <dialog> showModal de co san
 * khoa focus trong menu, phim Escape va lop nen; dong khi bam ra ngoai.
 */
const MobileDrawer = ({ onClose, returnFocusRef }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [returnFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Menu quản trị"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 text-white backdrop:bg-black/70 open:flex"
    >
      <div className="flex h-full w-72 max-w-[85vw] flex-col gap-6 overflow-y-auto border-r border-surfaceBorder bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu quản trị"
            className={`rounded-lg p-2 text-muted hover:bg-white/5 hover:text-white ${FOCUS_RING}`}
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1">
          <AdminNav onNavigate={onClose} />
        </div>
        <AccountPanel onNavigate={onClose} />
      </div>
    </dialog>
  );
};

/**
 * Khung Admin Portal: sidebar co dinh tren desktop, thanh tren + menu ngan keo
 * tren dien thoai. Noi dung tung man hinh Admin (lazy-load) hien trong <Outlet />,
 * duoc boc Suspense rieng de sidebar khong bi mat khi dang tai module.
 */
export default function AdminLayout() {
  const { pathname } = useLocation();
  const menuButtonRef = useRef(null);
  // Luu duong dan luc mo menu: doi trang thi menu tu dong dong, khong can effect.
  const [drawerPath, setDrawerPath] = useState(null);
  const drawerOpen = drawerPath === pathname;
  const closeDrawer = () => setDrawerPath(null);

  const current = NAV_ITEMS.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));

  return (
    <div className="min-h-screen bg-background text-white">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Bỏ qua điều hướng
      </a>

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 border-r border-surfaceBorder bg-surface/40 p-5 lg:flex">
        <Brand />
        <div className="flex-1">
          <AdminNav />
        </div>
        <AccountPanel />
      </aside>

      {/* Thanh tren dien thoai */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-surfaceBorder bg-background/95 px-4 backdrop-blur-md lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setDrawerPath(pathname)}
          aria-label="Mở menu quản trị"
          aria-expanded={drawerOpen}
          className={`-ml-2 rounded-lg p-2 text-neutral-300 hover:bg-white/5 hover:text-white ${FOCUS_RING}`}
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{current?.label ?? 'Quản trị'}</span>
        <Link to="/" className={`rounded-lg px-2 py-1.5 text-xs text-muted hover:text-white ${FOCUS_RING}`}>
          Về website
        </Link>
      </header>

      {drawerOpen && <MobileDrawer onClose={closeDrawer} returnFocusRef={menuButtonRef} />}

      <div className="lg:pl-64">
        <main id="admin-main" tabIndex={-1} className="mx-auto w-full max-w-[1280px] px-4 py-6 outline-none sm:px-8 lg:py-10">
          <Suspense fallback={<p role="status" className="py-16 text-center text-sm text-muted">Đang tải…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
