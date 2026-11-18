import { Fragment, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { useAuthStore } from '../features/auth/authStore';

const FOCUS_CLASS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
const BUTTON_CLASS = `inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primaryHover ${FOCUS_CLASS}`;

const Notice = ({ title, children, action }) => (
  <section aria-labelledby="my-tickets-access-title" className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
    <Ticket aria-hidden="true" strokeWidth={1.5} className="h-10 w-10 text-muted" />
    <h1 id="my-tickets-access-title" className="text-2xl font-bold text-white">{title}</h1>
    <p className="text-sm leading-relaxed text-muted">{children}</p>
    {action}
  </section>
);

/**
 * Chặn các trang /profile/bookings/** cho tới khi backend xác minh phiên (GET /users/me).
 * Người dùng đã có token trong localStorage chưa được coi là đã đăng nhập: Outlet (và mọi truy vấn
 * dữ liệu vé bên trong) chỉ được mount khi sessionStatus = 'authenticated'. Khách thấy lời mời
 * đăng nhập và modal mở ngay trên URL hiện tại, không điều hướng đi nơi khác.
 */
export default function MyTicketsRoute() {
  const status = useAuthStore(state => state.sessionStatus);
  const user = useAuthStore(state => state.user);
  const sessionId = useAuthStore(state => state.sessionId);
  const error = useAuthStore(state => state.sessionError);
  const verify = useAuthStore(state => state.fetchCurrentUser);
  const openAuthModal = useAuthStore(state => state.openAuthModal);
  // Admin 403 giữ user trong store; nó không chứng minh người dùng mất quyền xem vé.
  // /users/me 403 xóa user, nên không tự thử lại và tạo vòng lặp khi phiên thật sự bị từ chối.
  const needsVerification = status === 'idle' || (status === 'forbidden' && user?.id != null);

  useEffect(() => {
    if (needsVerification) void verify();
  }, [needsVerification, verify]);

  if (needsVerification || status === 'checking') {
    return <p role="status" className="px-6 py-16 text-center text-sm text-muted">Đang xác minh phiên đăng nhập…</p>;
  }

  if (status === 'authenticated' && user?.id != null) {
    // Đổi tài khoản hoặc đăng nhập lại tạo sessionId mới -> toàn bộ trang con được dựng lại từ đầu.
    return <Fragment key={`${user.id}:${sessionId}`}><Outlet /></Fragment>;
  }

  if (status === 'error') {
    return (
      <Notice
        title="Chưa xác minh được phiên"
        action={(
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button type="button" className={BUTTON_CLASS} onClick={() => void verify()}>Thử lại xác minh</button>
            <button type="button" className={`rounded text-sm text-white underline ${FOCUS_CLASS}`} onClick={() => openAuthModal('login')}>Đổi tài khoản</button>
          </div>
        )}
      >
        {error || 'Không thể xác minh phiên. Vui lòng thử lại.'}
      </Notice>
    );
  }

  const forbidden = status === 'forbidden';
  return (
    <Notice
      title={forbidden ? 'Tài khoản không xem được vé' : 'Đăng nhập để xem vé'}
      action={<button type="button" className={BUTTON_CLASS} onClick={() => openAuthModal('login')}>Đăng nhập</button>}
    >
      {forbidden
        ? 'Phiên hiện tại không có quyền truy cập. Vui lòng đăng nhập lại bằng tài khoản đã đặt vé.'
        : 'Vui lòng đăng nhập bằng tài khoản đã đặt vé để xem danh sách và chi tiết vé của bạn.'}
    </Notice>
  );
}
