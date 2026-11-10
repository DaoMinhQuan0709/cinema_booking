import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, Home, LoaderCircle, RefreshCw, Ticket, TriangleAlert } from 'lucide-react';
import { useAuthStore } from '../auth/authStore';
import { paymentService } from '../../services/paymentService';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatCheckoutShowtime } from './checkoutUtils';
import { parseVNPayReturn, paymentResultView, resultIsFinal } from './vnpayReturnUtils';
import { seatMapKeys } from './hooks/useShowtimeSeats';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-surfaceBorder px-5 py-3 text-sm font-semibold text-white transition-colors hover:border-neutral-500 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
const primary = `${button} border-primary bg-primary hover:border-primaryHover hover:bg-primaryHover`;

function ResultNotice({ title, children, action }) {
  return <section className="mx-auto max-w-xl px-5 py-20 text-center">
    <Ticket className="mx-auto mb-5 h-12 w-12 text-primary" aria-hidden="true" />
    <h1 className="text-2xl font-bold text-white">{title}</h1>
    <div className="mt-4 text-sm leading-relaxed text-muted">{children}</div>
    <div className="mt-7 flex flex-wrap justify-center gap-3">{action}<Link to="/" className={button}><Home className="h-4 w-4" />Về trang chủ</Link></div>
  </section>;
}

export default function VNPayReturnPage() {
  const { search } = useLocation();
  const user = useAuthStore(state => state.user);
  const authenticated = useAuthStore(state => state.isAuthenticated);
  const openAuthModal = useAuthStore(state => state.openAuthModal);
  const parsed = useMemo(() => {
    try { return { params: parseVNPayReturn(search) }; }
    catch (error) { return { error: error.message }; }
  }, [search]);

  if (parsed.error) return <ResultNotice title="Đường dẫn kết quả không hợp lệ">{parsed.error}</ResultNotice>;
  if (!authenticated || !user?.id) return <ResultNotice title="Đăng nhập để xem kết quả thanh toán"
    action={<button className={primary} onClick={() => openAuthModal('login')}>Đăng nhập</button>}>
    Vui lòng đăng nhập bằng tài khoản đã đặt vé. Kết quả vẫn được lưu khi bạn đăng nhập lại.
  </ResultNotice>;
  return <VerifiedResult key={`${user.id}:${search}`} userId={user.id} params={parsed.params} />;
}

function VerifiedResult({ userId, params }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['payments', 'vnpay-return', userId, params],
    queryFn: ({ signal }) => paymentService.verifyVNPayReturn(params, signal),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: true,
    // A returned browser page cannot replace a missing server-to-server notification.
    // Poll for about a minute, then leave an explicit manual status check available.
    refetchInterval: current => !current.state.error && current.state.dataUpdateCount < 20
      && !resultIsFinal(current.state.data) ? 3000 : false,
    refetchIntervalInBackground: false,
  });
  const booking = query.data?.booking;
  const confirmed = booking?.status === 'CONFIRMED' && query.data?.paymentStatus === 'SUCCESS';

  useEffect(() => {
    if (!confirmed || useAuthStore.getState().user?.id !== userId) return;
    const key = `cinema:hold:${userId}:${booking.showtime.showtimeId}`;
    try { if (sessionStorage.getItem(key) === booking.bookingCode) sessionStorage.removeItem(key); } catch { /* Storage is optional. */ }
    void client.invalidateQueries({ queryKey: seatMapKeys.seats(booking.showtime.showtimeId) });
    void client.invalidateQueries({ queryKey: ['bookings', userId, booking.bookingCode] });
  }, [confirmed, userId, booking?.bookingCode, booking?.showtime?.showtimeId, client]);

  if (query.isPending) return <ResultNotice title="Đang kiểm tra kết quả thanh toán"><LoaderCircle className="mx-auto h-6 w-6 animate-spin" aria-label="Đang tải" /></ResultNotice>;
  if (query.isError) {
    const status = query.error.response?.status;
    const denied = status === 403 || status === 404;
    return <ResultNotice title={denied ? 'Không thể xem giao dịch này' : 'Chưa xác minh được kết quả thanh toán'}
      action={!denied && <button className={button} onClick={() => query.refetch()} disabled={query.isFetching}><RefreshCw className="h-4 w-4" />Thử lại</button>}>
      {denied ? 'Hãy kiểm tra bạn đang đăng nhập đúng tài khoản đã đặt vé và đường dẫn giao dịch còn chính xác.'
        : query.error.response?.data?.message ?? 'Không kết nối được máy chủ. Vui lòng kiểm tra lại sau, tránh thanh toán lần nữa khi chưa rõ kết quả.'}
    </ResultNotice>;
  }

  const view = paymentResultView(query.data);
  const success = view.kind === 'success';
  const Icon = success ? Check : view.kind === 'pending' ? Clock3 : TriangleAlert;

  return <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-8 sm:py-16">
    <p className="mb-7 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted">PremierCinema / Kết quả thanh toán</p>
    <section className="overflow-hidden rounded-2xl border border-surfaceBorder bg-surface">
      <div role="status" aria-live="polite" className="px-6 py-8 text-center sm:px-10">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}><Icon className="h-8 w-8" aria-hidden="true" /></div>
        <h1 className="text-2xl font-black text-white sm:text-3xl">{view.title}</h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted">{view.message}</p>
      </div>
      <div className="border-t border-dashed border-surfaceBorder px-6 py-7 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-widest text-muted">Mã đơn đặt vé</p><p className="mt-2 break-all font-mono text-sm font-semibold text-white">{booking.bookingCode}</p></div><span className="rounded-lg border border-surfaceBorder px-3 py-1.5 text-xs text-neutral-300">VNPay Sandbox</span></div>
        <h2 className="mt-6 text-xl font-bold text-white">{booking.showtime.movieTitle}</h2>
        <p className="mt-2 text-sm text-neutral-300">{booking.showtime.cinemaName} · {booking.showtime.auditoriumName}</p>
        <p className="mt-2 text-sm text-muted">{formatCheckoutShowtime(booking.showtime.startTime)}</p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Ghế trong đơn">{booking.seats.map(seat => <span key={seat.showtimeSeatId} className="rounded-md border border-surfaceBorder px-3 py-1.5 text-sm font-semibold text-white">{seat.rowChar}{seat.seatNumber}</span>)}</div>
        {booking.products.length > 0 && <ul className="mt-5 space-y-2 text-sm text-muted">{booking.products.map(product => <li key={product.productId} className="flex justify-between gap-4"><span>{product.quantity} × {product.productName}</span><span className="shrink-0">{formatCurrency(product.subtotal)}</span></li>)}</ul>}
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-surfaceBorder pt-5"><span className="text-sm text-muted">Tổng tiền đơn</span><strong className="text-2xl font-black text-primary">{formatCurrency(booking.totalAmount)}</strong></div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 border-t border-surfaceBorder px-6 py-6">
        {!resultIsFinal(query.data) && <button className={button} disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />Kiểm tra trạng thái</button>}
        <Link to={`/checkout/${booking.bookingCode}`} className={button}><Ticket className="h-4 w-4" />Xem đơn đặt vé</Link>
        <Link to="/" className={primary}><Home className="h-4 w-4" />Về trang chủ</Link>
      </div>
    </section>
  </div>;
}
