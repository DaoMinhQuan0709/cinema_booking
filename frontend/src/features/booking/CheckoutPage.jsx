import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CreditCard, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { bookingService } from '../../services/bookingService';
import { paymentService } from '../../services/paymentService';
import { formatCurrency } from '../../utils/formatCurrency';
import { productSelectionHref, selectedProducts, draftFromBooking, priceChanged, safePaymentUrl, checkoutStatusText } from './checkoutUtils';
import BookingPageAccess from './BookingPageAccess';
import { BookingProgress, BookingSummary, ConfirmDialog } from './BookingUI';
import { useApplySavedProducts, useBookingCountdown, useBookingCancellation, useBookingSession } from './hooks/useCheckoutBooking';
import { primary, secondary } from './bookingStyles';

function CheckoutForm({ booking, query, userId, code, sessionId }) {
  const [baseRevision, setBaseRevision] = useState(booking.checkoutRevision);
  const [productError, setProductError] = useState(null);
  const [operation, setOperation] = useState(null);
  const [dialog, setDialog] = useState(null);
  const busy = useRef(false);
  const state = booking.checkout?.state;
  const seconds = useBookingCountdown(booking, query);
  const statusCopy = checkoutStatusText(booking, seconds);
  const editable = state === 'EDITABLE' && seconds > 0;
  const changedElsewhere = baseRevision !== booking.checkoutRevision;
  const activeSession = ['CREATING', 'READY', 'UNKNOWN'].includes(state);
  const isCurrentUser = useBookingSession(userId, sessionId);
  const applySavedProducts = useApplySavedProducts(userId, code, sessionId, isCurrentUser);

  const total = Number(booking.totalAmount);
  const payable = editable && !changedElsewhere && !productError && !query.isError && !query.isFetching && Number.isSafeInteger(total) && total > 0;
  const resume = state === 'READY' && seconds > 0 && !query.isError && !query.isFetching;

  async function synchronize() { await query.refetch(); }

  async function beginPayment(saved) {
    if (!isCurrentUser()) return;
    setOperation('payment');
    const response = await paymentService.createUrl({ bookingCode: code, paymentMethod: 'VNPAY', expectedRevision: saved.checkoutRevision });
    if (!isCurrentUser()) return;
    if (response.state === 'READY' && response.paymentUrl) window.location.assign(safePaymentUrl(response.paymentUrl, response.paymentMethod));
    else { await synchronize(); toast.info('Chưa có đường dẫn thanh toán. Vui lòng kiểm tra trạng thái đơn.', { id: 'checkout-status' }); }
  }

  async function pay(confirmed) {
    if (busy.current || !isCurrentUser() || (!confirmed && !payable)) return;
    if (confirmed && (confirmed.booking.checkoutRevision !== booking.checkoutRevision || !editable || query.isError || query.isFetching)) {
      setDialog(null); toast.warning('Đơn đã thay đổi. Vui lòng kiểm tra lại.'); return;
    }
    busy.current = true;
    let savingProducts = !confirmed;
    try {
      if (confirmed) { setDialog(null); await beginPayment(confirmed.booking); return; }
      setOperation('products');
      const expected = booking.products;
      const saved = await bookingService.updateProducts(code, { expectedRevision: baseRevision, products: selectedProducts(draftFromBooking(booking)) });
      savingProducts = false;
      const applied = await applySavedProducts(saved, () => setBaseRevision(saved.checkoutRevision));
      if (!applied || !isCurrentUser()) return;
      if (priceChanged(expected, saved, total)) setDialog({ kind: 'price', booking: saved, previousProducts: expected, previousTotal: total });
      else await beginPayment(saved);
    } catch (error) {
      if (isCurrentUser()) {
        toast.error(error.response?.data?.message ?? error.message ?? 'Chưa thể thanh toán. Vui lòng thử lại.', { id: 'checkout-error' });
        if (savingProducts && error.response?.status === 400) setProductError(error.response.data?.message ?? 'Sản phẩm cần được kiểm tra lại.');
        await synchronize();
      }
    } finally { busy.current = false; setOperation(null); }
  }

  const cancel = useBookingCancellation({ booking, code, userId, sessionId, busy, setOperation, setDialog, synchronize });

  function reloadDraft() {
    setBaseRevision(booking.checkoutRevision); setProductError(null); setDialog(null);
  }

  const payLabel = operation === 'products' ? 'Đang cập nhật combo…' : operation === 'payment' ? 'Đang tạo thanh toán…' : resume ? 'Tiếp tục thanh toán' : 'Thanh toán ngay';
  const action = <button className={`${primary} w-full`} disabled={Boolean(operation) || !(payable || resume)} onClick={() => {
    if (resume) { try { window.location.assign(safePaymentUrl(booking.checkout.paymentUrl, booking.checkout.paymentMethod)); } catch (error) { toast.error(error.message); } }
    else void pay();
  }}>{operation && operation !== 'cancel' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}{payLabel}<ArrowRight className="h-4 w-4" /></button>;

  return <div className="mx-auto w-full max-w-[1200px] px-4 pb-36 pt-8 sm:px-8 lg:pb-16">
    <BookingProgress step={2} title="Hoàn tất đặt vé" />
    {query.isError && <div role="alert" className="mb-5 rounded-xl border border-primary/40 p-4 text-sm text-neutral-200">Chưa kiểm tra được trạng thái đơn. Thanh toán tạm khóa.<button className={`${secondary} ml-3`} onClick={synchronize}>Thử lại</button></div>}
    {changedElsewhere && editable && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 p-4 text-sm text-neutral-200"><span>Đơn đã thay đổi. Tải lại lựa chọn đã lưu trước khi tiếp tục.</span><button className={secondary} onClick={reloadDraft} disabled={Boolean(operation)}>Tải lại lựa chọn</button></div>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
      <BookingSummary booking={booking} code={code} seconds={seconds} products={booking.products} total={total} editable={editable} operation={operation} action={action} onCancel={() => setDialog({ kind: 'cancel' })} />
      <div className="space-y-6">
        {(!editable || seconds === 0) && <section role="status" className="rounded-2xl border border-surfaceBorder bg-surface p-6"><h2 className="text-xl font-bold text-white">{statusCopy.title}</h2><p className="mt-3 text-sm leading-relaxed text-muted">{statusCopy.message}</p>{state === 'UNKNOWN' && seconds > 0 && <p className="mt-2 text-sm text-neutral-300">Chưa xác định được kết quả kết nối. Vui lòng kiểm tra lại trạng thái.</p>}<div className="mt-5 flex flex-wrap gap-3"><button className={secondary} onClick={synchronize} disabled={query.isFetching || Boolean(operation)}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />Kiểm tra trạng thái</button>{!activeSession || seconds === 0 ? <Link className={secondary} to="/">Về trang chủ</Link> : null}</div></section>}
        {editable && <><section className="rounded-2xl border border-surfaceBorder bg-surface/40 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold text-white">Sản phẩm đã chọn</h2><Link className={secondary} to={productSelectionHref(code)} aria-disabled={Boolean(operation)} onClick={event => { if (busy.current) event.preventDefault(); }}>Chỉnh sửa sản phẩm</Link></div>
          {booking.products.length ? <ul className="mt-5 divide-y divide-surfaceBorder">{booking.products.map(item => <li key={item.productId} className="flex justify-between gap-4 py-3 text-sm"><span className="text-neutral-200">{item.quantity} × {item.productName}</span><strong className="shrink-0 text-white">{formatCurrency(item.subtotal)}</strong></li>)}</ul> : <p className="mt-4 text-sm text-muted">Bạn chỉ đặt vé, không kèm sản phẩm.</p>}
          {productError && <p role="alert" className="mt-4 text-sm text-amber-300">{productError} Vui lòng chọn “Chỉnh sửa sản phẩm” để cập nhật đơn.</p>}
        </section><section className="rounded-2xl border border-surfaceBorder bg-surface/40 p-5 sm:p-6">
          <h2 className="text-xl font-bold text-white">Phương thức thanh toán</h2>
          <div className="mt-5 flex min-h-24 items-center gap-3 rounded-xl border border-primary bg-primary/5 p-4">
            <CreditCard className="h-5 w-5 text-primary" aria-hidden="true" />
            <span><strong className="text-lg text-white">VNPay</strong><span className="mt-1 block text-xs text-muted">Thẻ ngân hàng / mã QR · Sandbox</span></span>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">Combo được chốt khi bắt đầu tạo phiên thanh toán. Hạn giữ ghế vẫn tiếp tục chạy khi chuyển sang VNPay.</p>
        </section></>}
      </div>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surfaceBorder bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden"><div className="mx-auto flex max-w-xl items-center gap-4"><div className="shrink-0"><p className="text-[11px] text-muted">{editable ? 'Tổng tạm tính' : 'Tổng tiền'}</p><strong className="text-lg font-black text-primary">{formatCurrency(total)}</strong></div><div className="min-w-0 flex-1">{action}</div></div></div>
    {dialog?.kind === 'cancel' && <ConfirmDialog title="Hủy giữ ghế?" confirmLabel="Vẫn hủy giữ ghế" busy={Boolean(operation)} onConfirm={cancel} onClose={() => setDialog(null)}><p>Các ghế trong đơn sẽ được trả lại để người khác có thể chọn.</p>{activeSession && <p className="mt-3 flex gap-2 text-amber-300"><TriangleAlert className="h-5 w-5 shrink-0" />Hủy giữ ghế không hủy giao dịch tại cổng. Giao dịch có thể vẫn trả kết quả và cần được kiểm tra riêng.</p>}</ConfirmDialog>}
    {dialog?.kind === 'price' && <ConfirmDialog title="Giá combo đã thay đổi" confirmLabel="Đồng ý và thanh toán" busy={Boolean(operation)} onConfirm={() => pay(dialog)} onClose={() => setDialog(null)}><ul className="space-y-2">{dialog.booking.products.map(item => { const previous = dialog.previousProducts.find(old => String(old.productId) === String(item.productId)); return <li key={item.productId}>{item.productName}: <span className="text-muted line-through">{formatCurrency(previous?.unitPrice)}</span> → <strong className="text-white">{formatCurrency(item.unitPrice)}</strong> / combo</li>; })}</ul><p className="mt-4">Tổng trước: {formatCurrency(dialog.previousTotal)}. Tổng mới: <strong className="text-white">{formatCurrency(dialog.booking.totalAmount)}</strong>.</p><p className="mt-2">Bạn có thể quay lại để chỉnh combo. Thời gian giữ ghế vẫn tiếp tục chạy.</p></ConfirmDialog>}
  </div>;
}

export default function CheckoutPage() {
  return <BookingPageAccess Form={CheckoutForm} />;
}
