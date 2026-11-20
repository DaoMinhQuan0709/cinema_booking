import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../auth/authStore';
import { useCheckoutBooking } from './hooks/useCheckoutBooking';
import { Notice } from './BookingUI';
import { primary } from './bookingStyles';

function AuthenticatedBooking({ code, userId, sessionId, Form }) {
  const query = useCheckoutBooking(userId, code, sessionId);
  const status = query.error?.response?.status;
  if ([401, 403, 404].includes(status)) return <Notice title="Không thể truy cập đơn này">Đơn không tồn tại hoặc tài khoản hiện tại không có quyền truy cập.</Notice>;
  if (query.isPending) return <div className="mx-auto w-full max-w-[1200px] animate-pulse px-6 py-12"><div className="mb-8 h-12 w-2/3 rounded-xl bg-surface" /><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="h-96 rounded-2xl bg-surface" /><div className="h-96 rounded-2xl bg-surface" /></div></div>;
  if (!query.data?.checkout || !Array.isArray(query.data?.products) || !Array.isArray(query.data?.seats) || !query.data?.showtime) return <Notice title="Chưa tải được thông tin Checkout" retry={() => query.refetch()}>Vui lòng kiểm tra kết nối và thử lại sau.</Notice>;
  return <Form booking={query.data} query={query} code={code} userId={userId} sessionId={sessionId} />;
}

export default function BookingPageAccess({ Form }) {
  const { bookingCode = '' } = useParams();
  const user = useAuthStore(state => state.user);
  const authenticated = useAuthStore(state => state.isAuthenticated);
  const sessionId = useAuthStore(state => state.sessionId);
  const sessionStatus = useAuthStore(state => state.sessionStatus);
  const verify = useAuthStore(state => state.fetchCurrentUser);
  const openAuth = useAuthStore(state => state.openAuthModal);
  useEffect(() => {
    if (authenticated && sessionId && sessionStatus === 'idle') void verify();
  }, [authenticated, sessionId, sessionStatus, verify]);
  if (!/^BK[a-zA-Z0-9]{18}$/.test(bookingCode)) return <Notice title="Liên kết đặt vé không hợp lệ">Vui lòng chọn suất chiếu và giữ ghế để mở Checkout.</Notice>;
  if (!authenticated || user?.id == null) return <Notice title="Đăng nhập để tiếp tục"><p>Vui lòng đăng nhập bằng tài khoản đã giữ ghế.</p><button className={`${primary} mt-5`} onClick={() => openAuth('login')}>Đăng nhập</button></Notice>;
  if (sessionStatus === 'idle' || sessionStatus === 'checking') return <Notice title="Đang xác minh phiên đăng nhập">Vui lòng chờ trong giây lát.</Notice>;
  if (sessionStatus !== 'authenticated') return <Notice title="Chưa xác minh được phiên" retry={verify}>Vui lòng kiểm tra kết nối và thử lại.</Notice>;
  return <AuthenticatedBooking key={`${sessionId}:${user.id}:${bookingCode}`} code={bookingCode} userId={user.id} sessionId={sessionId} Form={Form} />;
}
