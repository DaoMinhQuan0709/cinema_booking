import { useEffect } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../features/auth/authStore';
import { USER_ROLE } from '../config/constants';

const buttonClass = 'rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primaryHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';

export function AdminIndexRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: 'reports', search, hash }} replace />;
}

export default function AdminRoute() {
  const status = useAuthStore(state => state.sessionStatus);
  const user = useAuthStore(state => state.user);
  const error = useAuthStore(state => state.sessionError);
  const verify = useAuthStore(state => state.fetchCurrentUser);
  const openAuthModal = useAuthStore(state => state.openAuthModal);

  useEffect(() => {
    if (status === 'idle') void verify();
  }, [status, verify]);

  if (status === 'idle' || status === 'checking') {
    return <p role="status" className="px-6 py-16 text-center text-muted">Đang xác minh phiên quản trị…</p>;
  }

  if (status === 'authenticated' && user?.role === USER_ROLE.ADMIN) return <Outlet />;

  const anonymous = status === 'anonymous';
  const failed = status === 'error';
  return (
    <section className="mx-auto w-full max-w-xl px-6 py-16 text-center" aria-labelledby="admin-access-title">
      <h1 id="admin-access-title" className="mb-4 text-2xl font-bold text-white">
        {anonymous ? 'Đăng nhập để vào quản trị' : failed ? 'Chưa xác minh được phiên' : '403 — Không có quyền quản trị'}
      </h1>
      <p className="mb-6 text-muted">
        {anonymous ? 'Vui lòng đăng nhập bằng tài khoản ADMIN để tiếp tục.' : failed ? error : 'Tài khoản hiện tại không có quyền truy cập trang này.'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {anonymous ? (
          // Keep pathname, search and hash in place while reusing the existing modal.
          <button className={buttonClass} onClick={() => openAuthModal('login')}>Đăng nhập</button>
        ) : (
          <>
            <button className={buttonClass} onClick={() => void verify()}>Thử lại xác minh</button>
            <button className="text-sm text-white underline" onClick={() => openAuthModal('login')}>Đổi tài khoản</button>
          </>
        )}
        <Link className="text-sm text-muted underline hover:text-white" to="/">Về trang chủ</Link>
      </div>
    </section>
  );
}
