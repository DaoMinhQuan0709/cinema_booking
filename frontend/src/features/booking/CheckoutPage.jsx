import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Clock3, CreditCard, LoaderCircle, Minus, Plus, Popcorn, RefreshCw, ShieldCheck, Ticket, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../auth/authStore';
import { bookingService } from '../../services/bookingService';
import { paymentService } from '../../services/paymentService';
import { productService } from '../../services/productService';
import { formatCurrency } from '../../utils/formatCurrency';
import { checkoutKey, productKey, draftFromBooking, selectedProducts, priceChanged, safePaymentUrl, remainingSeconds, formatCountdown, formatCheckoutShowtime, checkoutStatusText } from './checkoutUtils';
import { seatMapKeys } from './hooks/useShowtimeSeats';

const primary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primaryHover disabled:cursor-not-allowed disabled:bg-surfaceBorder disabled:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary';
const secondary = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-surfaceBorder px-4 py-2 text-sm text-neutral-200 hover:border-neutral-500 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

function Notice({ title, children, retry }) {
  return <div className="mx-auto max-w-xl px-6 py-20 text-center"><Ticket className="mx-auto mb-5 h-12 w-12 text-primary" aria-hidden="true" /><h1 className="text-2xl font-bold text-white">{title}</h1><div className="mt-3 text-sm leading-relaxed text-muted">{children}</div><div className="mt-7 flex flex-wrap justify-center gap-3">{retry && <button className={secondary} onClick={retry}><RefreshCw className="h-4 w-4" />Thử lại</button>}<Link className={secondary} to="/">Về trang chủ</Link></div></div>;
}

function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose, busy }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="checkout-confirm-title" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-surfaceBorder bg-surface p-6 text-white backdrop:bg-black/80">
    <h2 id="checkout-confirm-title" className="text-xl font-bold">{title}</h2><div className="mt-4 text-sm leading-relaxed text-neutral-300">{children}</div>
    <div className="mt-6 flex flex-wrap justify-end gap-3"><button className={secondary} disabled={busy} onClick={onClose}>Quay lại</button><button className={primary} disabled={busy} onClick={onConfirm}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{confirmLabel}</button></div>
  </dialog>;
}

function ComboCard({ product, quantity, disabled, onChange }) {
  const [failed, setFailed] = useState(false);
  const available = product.isAvailable !== false;
  return <article className={`flex gap-4 rounded-xl border p-4 sm:gap-5 ${quantity ? 'border-primary/50 bg-primary/5' : 'border-surfaceBorder bg-surface/60'}`}>
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black/20 sm:h-28 sm:w-28">{product.imageUrl && !failed ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setFailed(true)} /> : <Popcorn className="h-10 w-10 text-muted" aria-hidden="true" />}</div>
    <div className="flex min-w-0 flex-1 flex-col"><h3 className="font-bold text-white">{product.name}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{available ? product.description : 'Combo đã ngừng bán. Vui lòng bỏ khỏi đơn.'}</p><div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3"><span className="text-sm font-bold text-white">{formatCurrency(product.price)}</span><div className="flex items-center rounded-lg border border-surfaceBorder bg-background"><button type="button" aria-label={`Giảm ${product.name}`} className="min-h-10 min-w-10 rounded-l-lg text-muted hover:text-white disabled:opacity-30" disabled={disabled || !quantity} onClick={() => onChange(quantity - 1)}><Minus className="mx-auto h-4 w-4" /></button><output aria-label={`Số lượng ${product.name}`} className="min-w-6 text-center text-sm tabular-nums text-white">{quantity}</output><button type="button" aria-label={`Tăng ${product.name}`} className="min-h-10 min-w-10 rounded-r-lg text-muted hover:text-white disabled:opacity-30" disabled={disabled || !available || quantity >= 2147483647} onClick={() => onChange(quantity + 1)}><Plus className="mx-auto h-4 w-4" /></button></div></div></div>
  </article>;
}

function CheckoutForm({ booking, query, userId, code }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const key = checkoutKey(userId, code);
  const catalog = useQuery({ queryKey: productKey, queryFn: ({ signal }) => productService.getProducts(signal), staleTime: 60_000, retry: 1 });
  const [draft, setDraft] = useState(() => draftFromBooking(booking));
  const [draftMetadata, setDraftMetadata] = useState({});
  const [baseRevision, setBaseRevision] = useState(booking.checkoutRevision);
  const [overrides, setOverrides] = useState({});
  const [method, setMethod] = useState('VNPAY');
  const [operation, setOperation] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [now, setNow] = useState(() => performance.now());
  const busy = useRef(false);
  const expiredChecked = useRef(false);
  const { isFetching, refetch } = query;
  const state = booking.checkout?.state;
  const seconds = remainingSeconds(booking._timing, now);
  const statusCopy = checkoutStatusText(booking, seconds);
  const editable = state === 'EDITABLE' && seconds > 0;
  const changedElsewhere = baseRevision !== booking.checkoutRevision;
  const activeSession = ['CREATING', 'READY', 'UNKNOWN'].includes(state);
  const isCurrentUser = () => useAuthStore.getState().user?.id === userId;

  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 250); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (seconds > 0) expiredChecked.current = false;
    if (seconds === 0 && booking.status === 'PENDING' && !expiredChecked.current && !isFetching) {
      expiredChecked.current = true;
      void refetch();
    }
  }, [seconds, booking.status, isFetching, refetch]);

  const products = useMemo(() => {
    const all = new Map((catalog.data ?? []).map(product => [String(product.id), product]));
    for (const item of booking.products ?? []) if (!all.has(String(item.productId))) all.set(String(item.productId), {
      id: item.productId, name: item.productName, price: item.unitPrice, isAvailable: catalog.isSuccess ? false : true,
    });
    for (const [id, product] of Object.entries(draftMetadata)) if (draft[id] > 0 && !all.has(id))
      all.set(id, { ...product, isAvailable: catalog.isSuccess ? false : product.isAvailable });
    return [...all.values()].map(product => ({ ...product, price: overrides[product.id] ?? product.price }));
  }, [catalog.data, catalog.isSuccess, booking.products, draftMetadata, draft, overrides]);
  const lines = products.filter(product => draft[product.id] > 0).map(product => ({ ...product, quantity: draft[product.id] }));
  const seatTotal = booking.seats.reduce((sum, seat) => sum + Number(seat.price), 0);
  const total = editable ? seatTotal + lines.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0) : Number(booking.totalAmount);
  const payable = editable && !changedElsewhere && !catalog.isPending && !catalog.isError && !query.isError && !query.isFetching
    && !lines.some(line => line.isAvailable === false) && Number.isSafeInteger(total) && total > 0;
  const resume = state === 'READY' && seconds > 0 && !query.isError && !query.isFetching;

  async function synchronize() { await query.refetch(); }

  async function beginPayment(saved, selectedMethod) {
    setOperation('payment');
    const response = await paymentService.createUrl({ bookingCode: code, paymentMethod: selectedMethod, expectedRevision: saved.checkoutRevision });
    if (!isCurrentUser()) return;
    if (response.state === 'READY' && response.paymentUrl) window.location.assign(safePaymentUrl(response.paymentUrl, response.paymentMethod));
    else { await synchronize(); toast.info('Chưa có đường dẫn thanh toán. Vui lòng kiểm tra trạng thái đơn.', { id: 'checkout-status' }); }
  }

  async function pay(confirmed) {
    if (busy.current || (!confirmed && !payable)) return;
    if (confirmed && (confirmed.booking.checkoutRevision !== booking.checkoutRevision || !editable || query.isError || query.isFetching)) {
      setDialog(null); toast.warning('Đơn đã thay đổi. Vui lòng kiểm tra lại.'); return;
    }
    busy.current = true;
    try {
      if (confirmed) { setDialog(null); await beginPayment(confirmed.booking, confirmed.method); return; }
      setOperation('products');
      const expected = lines.map(line => ({ productId: line.id, quantity: line.quantity, unitPrice: line.price }));
      const saved = await bookingService.updateProducts(code, { expectedRevision: baseRevision, products: selectedProducts(draft) });
      if (!isCurrentUser()) return;
      await client.cancelQueries({ queryKey: key });
      client.setQueryData(key, saved); setBaseRevision(saved.checkoutRevision); setDraft(draftFromBooking(saved));
      setOverrides(Object.fromEntries(saved.products.map(item => [item.productId, item.unitPrice])));
      if (priceChanged(expected, saved, total)) setDialog({ kind: 'price', booking: saved, method, previousProducts: expected, previousTotal: total });
      else await beginPayment(saved, method);
    } catch (error) {
      if (isCurrentUser()) {
        toast.error(error.response?.data?.message ?? error.message ?? 'Chưa thể thanh toán. Vui lòng thử lại.', { id: 'checkout-error' });
        await Promise.all([synchronize(), error.response?.status === 400 ? client.invalidateQueries({ queryKey: productKey }) : Promise.resolve()]);
      }
    } finally { busy.current = false; setOperation(null); }
  }

  async function cancel() {
    if (busy.current) return;
    busy.current = true; setOperation('cancel');
    try {
      await bookingService.cancelBooking(code);
      if (!isCurrentUser()) return;
      const storageKey = `cinema:hold:${userId}:${booking.showtime.showtimeId}`;
      try { if (sessionStorage.getItem(storageKey) === code) sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      await client.invalidateQueries({ queryKey: seatMapKeys.seats(booking.showtime.showtimeId) });
      client.removeQueries({ queryKey: key, exact: true });
      toast.success('Đã hủy giữ ghế.', { id: 'checkout-cancelled' });
      navigate(`/booking/${booking.showtime.showtimeId}`, { replace: true });
    } catch (error) {
      if (isCurrentUser()) { toast.error(error.response?.data?.message ?? 'Chưa hủy được giữ ghế.', { id: 'checkout-error' }); await synchronize(); }
    } finally { busy.current = false; setOperation(null); setDialog(null); }
  }

  function reloadDraft() {
    setDraft(draftFromBooking(booking)); setDraftMetadata({}); setBaseRevision(booking.checkoutRevision); setOverrides({}); setDialog(null);
  }

  const payLabel = operation === 'products' ? 'Đang cập nhật combo…' : operation === 'payment' ? 'Đang tạo thanh toán…' : resume ? 'Tiếp tục thanh toán' : 'Thanh toán ngay';
  const action = <button className={`${primary} w-full`} disabled={Boolean(operation) || !(payable || resume)} onClick={() => {
    if (resume) { try { window.location.assign(safePaymentUrl(booking.checkout.paymentUrl, booking.checkout.paymentMethod)); } catch (error) { toast.error(error.message); } }
    else void pay();
  }}>{operation && operation !== 'cancel' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{payLabel}<ArrowRight className="h-4 w-4" /></button>;

  return <div className="mx-auto w-full max-w-[1200px] px-4 pb-36 pt-8 sm:px-8 lg:pb-16">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">PremierCinema / Đặt vé</p><h1 className="text-3xl font-black text-white sm:text-4xl">Hoàn tất đặt vé<span className="text-primary">.</span></h1></div><ol aria-label="Tiến trình đặt vé" className="flex gap-4 text-xs sm:gap-6">{['Chọn ghế', 'Thanh toán', 'Kết quả'].map((label, i) => <li key={label} className={`flex items-center gap-2 ${i === 1 ? 'text-white' : 'text-muted'}`} aria-current={i === 1 ? 'step' : undefined}><span className={`flex h-6 w-6 items-center justify-center rounded-full border ${i === 1 ? 'border-primary bg-primary' : 'border-surfaceBorder'}`}>{i === 0 ? <Check className="h-3 w-3" /> : i + 1}</span>{label}</li>)}</ol></div>
    {query.isError && <div role="alert" className="mb-5 rounded-xl border border-primary/40 p-4 text-sm text-neutral-200">Chưa kiểm tra được trạng thái đơn. Thanh toán tạm khóa.<button className={`${secondary} ml-3`} onClick={synchronize}>Thử lại</button></div>}
    {changedElsewhere && editable && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 p-4 text-sm text-neutral-200"><span>Đơn đã thay đổi. Tải lại lựa chọn đã lưu trước khi tiếp tục.</span><button className={secondary} onClick={reloadDraft} disabled={Boolean(operation)}>Tải lại lựa chọn</button></div>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
      <aside className="order-first rounded-2xl border border-surfaceBorder bg-surface lg:sticky lg:top-24 lg:order-last">
        <div className={`flex items-center justify-between gap-3 border-b border-dashed border-surfaceBorder p-5 ${seconds !== null && seconds < 120 && booking.status === 'PENDING' ? 'text-primary' : 'text-white'}`}><div className="flex items-center gap-2"><Clock3 className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Thời gian giữ ghế</span></div><output aria-label="Thời gian giữ ghế còn lại" className="font-mono text-3xl font-bold tabular-nums">{formatCountdown(booking.status === 'PENDING' ? seconds : null)}</output></div>
        <div className="p-5"><p className="text-xs uppercase tracking-widest text-muted">Thông tin đặt vé</p><h2 className="mt-3 text-xl font-black leading-snug text-white">{booking.showtime.movieTitle}</h2><p className="mt-3 text-sm text-neutral-200">{booking.showtime.cinemaName}</p><p className="mt-1 text-xs text-muted">{booking.showtime.auditoriumName} · {formatCheckoutShowtime(booking.showtime.startTime)}</p><div className="mt-4 flex flex-wrap gap-2">{booking.seats.map(seat => <span key={seat.showtimeSeatId} className="rounded-md border border-surfaceBorder px-2.5 py-1 text-xs font-bold text-white">{seat.rowChar}{seat.seatNumber}</span>)}</div><p className="mt-3 break-all font-mono text-xs text-muted">{code}</p>
          <div className="my-5 border-t border-dashed border-surfaceBorder" /><div className="flex justify-between text-sm text-neutral-300"><span>Tiền vé ({booking.seats.length} chỗ)</span><span>{formatCurrency(seatTotal)}</span></div>
          <ul className="mt-3 space-y-2 text-xs text-muted">{(editable ? lines.map(line => ({ productId: line.id, productName: line.name, quantity: line.quantity, subtotal: Number(line.price) * line.quantity })) : booking.products).map(item => <li key={item.productId} className="flex justify-between gap-3"><span>{item.quantity} × {item.productName}</span><span className="shrink-0">{formatCurrency(item.subtotal)}</span></li>)}</ul>
          <div className="mt-5 flex items-end justify-between gap-3 border-t border-surfaceBorder pt-5"><span className="text-sm text-muted">{editable ? 'Tổng tạm tính' : 'Tổng tiền'}</span><strong className="text-2xl font-black text-primary">{formatCurrency(total)}</strong></div><div className="mt-5 hidden lg:block">{action}</div><p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5" />Thanh toán qua cổng Sandbox</p>
          {booking.status === 'PENDING' && <button className="mt-4 min-h-10 w-full text-xs text-muted underline underline-offset-4 hover:text-white disabled:opacity-50" disabled={Boolean(operation)} onClick={() => setDialog({ kind: 'cancel' })}>Hủy giữ ghế để chọn lại</button>}
        </div>
      </aside>
      <div className="space-y-6">
        {(!editable || seconds === 0) && <section role="status" className="rounded-2xl border border-surfaceBorder bg-surface p-6"><h2 className="text-xl font-bold text-white">{statusCopy.title}</h2><p className="mt-3 text-sm leading-relaxed text-muted">{statusCopy.message}</p>{state === 'UNKNOWN' && seconds > 0 && <p className="mt-2 text-sm text-neutral-300">Chưa xác định được kết quả kết nối. Vui lòng kiểm tra lại trạng thái.</p>}<div className="mt-5 flex flex-wrap gap-3"><button className={secondary} onClick={synchronize} disabled={query.isFetching || Boolean(operation)}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />Kiểm tra trạng thái</button>{!activeSession || seconds === 0 ? <Link className={secondary} to="/">Về trang chủ</Link> : null}</div></section>}
        {editable && <><section className="rounded-2xl border border-surfaceBorder bg-surface/40 p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><Popcorn className="h-6 w-6 text-primary" /><div><h2 className="text-xl font-bold text-white">Thêm chút vị cho buổi xem phim</h2><p className="mt-1 text-xs text-muted">Chọn combo yêu thích hoặc tiếp tục chỉ với vé.</p></div></div>
          {catalog.isPending ? <div aria-label="Đang tải combo" className="h-40 animate-pulse rounded-xl bg-surface" /> : catalog.isError ? <div role="alert" className="rounded-xl border border-primary/30 p-4 text-sm text-neutral-300">Chưa tải được danh mục combo. Các combo đã lưu vẫn được giữ nguyên.<button className={`${secondary} mt-3`} onClick={() => catalog.refetch()}>Thử lại danh mục</button></div> : products.length === 0 ? <p className="py-6 text-sm text-muted">Hiện chưa có combo bắp nước. Bạn có thể thanh toán tiền vé.</p> : null}
          <div className="space-y-3">{products.map(product => <ComboCard key={product.id} product={product} quantity={draft[product.id] ?? 0} disabled={Boolean(operation) || changedElsewhere || catalog.isError || catalog.isPending} onChange={quantity => { setDraft(previous => ({ ...previous, [product.id]: quantity })); setDraftMetadata(previous => ({ ...previous, [product.id]: product })); setDialog(null); }} />)}</div>
        </section><section className="rounded-2xl border border-surfaceBorder bg-surface/40 p-5 sm:p-6"><h2 className="text-xl font-bold text-white">Phương thức thanh toán</h2><fieldset disabled={Boolean(operation) || changedElsewhere} className="mt-5 grid gap-3 sm:grid-cols-2"><legend className="sr-only">Chọn cổng thanh toán Sandbox</legend>{[['VNPAY', 'VNPay', 'Thẻ ngân hàng / mã QR'], ['MOMO', 'MoMo', 'Ví điện tử']].map(([value, label, detail]) => <label key={value} className={`flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border p-4 ${method === value ? 'border-primary bg-primary/5' : 'border-surfaceBorder'}`}><input type="radio" name="paymentMethod" value={value} checked={method === value} onChange={() => setMethod(value)} className="h-4 w-4 accent-primary" /><span><strong className="text-lg text-white">{label}</strong><span className="mt-1 block text-xs text-muted">{detail} · Sandbox</span></span></label>)}</fieldset><p className="mt-4 text-xs leading-relaxed text-muted">Combo và phương thức được chốt khi bắt đầu tạo phiên thanh toán. Hạn giữ ghế vẫn tiếp tục chạy khi chuyển sang cổng.</p></section></>}
      </div>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surfaceBorder bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden"><div className="mx-auto flex max-w-xl items-center gap-4"><div className="shrink-0"><p className="text-[11px] text-muted">{editable ? 'Tổng tạm tính' : 'Tổng tiền'}</p><strong className="text-lg font-black text-primary">{formatCurrency(total)}</strong></div><div className="min-w-0 flex-1">{action}</div></div></div>
    {dialog?.kind === 'cancel' && <ConfirmDialog title="Hủy giữ ghế?" confirmLabel="Vẫn hủy giữ ghế" busy={Boolean(operation)} onConfirm={cancel} onClose={() => setDialog(null)}><p>Các ghế trong đơn sẽ được trả lại để người khác có thể chọn.</p>{activeSession && <p className="mt-3 flex gap-2 text-amber-300"><TriangleAlert className="h-5 w-5 shrink-0" />Hủy giữ ghế không hủy giao dịch tại cổng. Giao dịch có thể vẫn trả kết quả và cần được kiểm tra riêng.</p>}</ConfirmDialog>}
    {dialog?.kind === 'price' && <ConfirmDialog title="Giá combo đã thay đổi" confirmLabel="Đồng ý và thanh toán" busy={Boolean(operation)} onConfirm={() => pay(dialog)} onClose={() => setDialog(null)}><ul className="space-y-2">{dialog.booking.products.map(item => { const previous = dialog.previousProducts.find(old => String(old.productId) === String(item.productId)); return <li key={item.productId}>{item.productName}: <span className="text-muted line-through">{formatCurrency(previous?.unitPrice)}</span> → <strong className="text-white">{formatCurrency(item.unitPrice)}</strong> / combo</li>; })}</ul><p className="mt-4">Tổng trước: {formatCurrency(dialog.previousTotal)}. Tổng mới: <strong className="text-white">{formatCurrency(dialog.booking.totalAmount)}</strong>.</p><p className="mt-2">Bạn có thể quay lại để chỉnh combo. Thời gian giữ ghế vẫn tiếp tục chạy.</p></ConfirmDialog>}
  </div>;
}

function AuthenticatedCheckout({ code, userId }) {
  const query = useQuery({ queryKey: checkoutKey(userId, code), queryFn: ({ signal }) => bookingService.getCheckout(code, signal),
    retry: (count, error) => count < 1 && (!error.response || error.response.status >= 500), staleTime: 0, gcTime: 60_000,
    refetchOnWindowFocus: 'always', refetchInterval: query => ['CREATING', 'UNKNOWN'].includes(query.state.data?.checkout?.state) ? 5000 : 15000,
  });
  const status = query.error?.response?.status;
  if ([401, 403, 404].includes(status)) return <Notice title="Không thể truy cập đơn này">Đơn không tồn tại hoặc tài khoản hiện tại không có quyền truy cập.</Notice>;
  if (query.isPending) return <div className="mx-auto w-full max-w-[1200px] animate-pulse px-6 py-12"><div className="mb-8 h-12 w-2/3 rounded-xl bg-surface" /><div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="h-96 rounded-2xl bg-surface" /><div className="h-96 rounded-2xl bg-surface" /></div></div>;
  if (!query.data?.checkout || !Array.isArray(query.data?.seats) || !query.data?.showtime) return <Notice title="Chưa tải được thông tin Checkout" retry={() => query.refetch()}>Vui lòng kiểm tra kết nối và thử lại sau.</Notice>;
  return <CheckoutForm booking={query.data} query={query} code={code} userId={userId} />;
}

export default function CheckoutPage() {
  const { bookingCode = '' } = useParams();
  const user = useAuthStore(state => state.user);
  const authenticated = useAuthStore(state => state.isAuthenticated);
  const openAuth = useAuthStore(state => state.openAuthModal);
  if (!/^BK[a-zA-Z0-9]{18}$/.test(bookingCode)) return <Notice title="Liên kết đặt vé không hợp lệ">Vui lòng chọn suất chiếu và giữ ghế để mở Checkout.</Notice>;
  if (!authenticated || user?.id == null) return <Notice title="Đăng nhập để tiếp tục"><p>Vui lòng đăng nhập bằng tài khoản đã giữ ghế.</p><button className={`${primary} mt-5`} onClick={() => openAuth('login')}>Đăng nhập</button></Notice>;
  return <AuthenticatedCheckout key={`${user.id}:${bookingCode}`} code={bookingCode} userId={user.id} />;
}
