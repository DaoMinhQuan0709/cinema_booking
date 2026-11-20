import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../../services/productService';
import { bookingService } from '../../services/bookingService';
import { invalidateTicketCache } from '../../config/queryClient';
import { formatCurrency } from '../../utils/formatCurrency';
import BookingPageAccess from './BookingPageAccess';
import ProductCard from './ProductCard';
import { BookingProgress, BookingSummary, ConfirmDialog } from './BookingUI';
import { useBookingCancellation, useBookingCountdown, useBookingSession } from './hooks/useCheckoutBooking';
import { primary, secondary } from './bookingStyles';
import { checkoutKey, draftFromBooking, priceChanged, productKey, remainingSeconds, selectedProducts } from './checkoutUtils';
import { productChoices } from './productSelection';

function ProductSelectionForm({ booking, query, code, userId, sessionId }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const isCurrentUser = useBookingSession(userId, sessionId);
  const catalog = useQuery({ queryKey: productKey, queryFn: ({ signal }) => productService.getProducts(signal),
    staleTime: 60_000, retry: 1, refetchOnWindowFocus: true, enabled: booking.checkout.state === 'EDITABLE' });
  const [draft, setDraft] = useState(() => draftFromBooking(booking));
  const [metadata, setMetadata] = useState({});
  const [baseRevision, setBaseRevision] = useState(booking.checkoutRevision);
  const [operation, setOperation] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [quote, setQuote] = useState(null);
  const busy = useRef(false);
  const seconds = useBookingCountdown(booking, query);
  const changedElsewhere = baseRevision !== booking.checkoutRevision;
  const editable = booking.checkout.state === 'EDITABLE' && seconds > 0;
  const products = useMemo(() => productChoices(catalog.data ?? [], booking.products, metadata, draft, catalog.isSuccess)
    .map(product => ({ ...product, price: quote && quote.catalog === catalog.data ? quote.prices[product.id] ?? product.price : product.price })),
    [catalog.data, catalog.isSuccess, booking.products, metadata, draft, quote]);
  const lines = products.filter(product => draft[product.id] > 0).map(product => ({ productId: product.id, productName: product.name, quantity: draft[product.id], unitPrice: product.price, subtotal: Number(product.price) * draft[product.id], isAvailable: product.isAvailable }));
  const seatTotal = booking.seats.reduce((sum, seat) => sum + Number(seat.price), 0);
  const total = seatTotal + lines.reduce((sum, item) => sum + item.subtotal, 0);
  const disabled = !editable || Boolean(operation) || changedElsewhere || catalog.isPending || catalog.isError || query.isError || query.isFetching;
  const canContinue = !disabled && !lines.some(item => item.isAvailable === false) && Number.isSafeInteger(total) && total > 0;
  const cancel = useBookingCancellation({ booking, code, userId, sessionId, busy, setOperation, setDialog, synchronize: query.refetch });

  function reloadDraft() {
    setDraft(draftFromBooking(booking)); setMetadata({}); setBaseRevision(booking.checkoutRevision); setDialog(null); setQuote(null);
  }

  async function saveProducts() {
    if (busy.current || !canContinue || !isCurrentUser()) return;
    busy.current = true; setOperation('products');
    try {
      const saved = await bookingService.updateProducts(code, { expectedRevision: baseRevision, products: selectedProducts(draft) });
      if (!isCurrentUser()) return;
      await client.cancelQueries({ queryKey: checkoutKey(userId, code, sessionId) });
      if (!isCurrentUser()) return;
      client.setQueryData(checkoutKey(userId, code, sessionId), saved);
      setBaseRevision(saved.checkoutRevision); setDraft(draftFromBooking(saved));
      setQuote({ catalog: catalog.data, prices: Object.fromEntries(saved.products.map(item => [item.productId, item.unitPrice])) });
      void invalidateTicketCache(sessionId);
      if (priceChanged(lines, saved, total)) setDialog({ kind: 'price', booking: saved, previousProducts: lines, previousTotal: total });
      else navigate(`/checkout/${encodeURIComponent(code)}`);
    } catch (error) {
      if (!isCurrentUser()) return;
      toast.error(error.response?.data?.message ?? error.message ?? 'Chưa lưu được sản phẩm. Vui lòng thử lại.', { id: 'products-error' });
      await Promise.all([query.refetch(), error.response?.status === 400 ? client.invalidateQueries({ queryKey: productKey }) : Promise.resolve()]);
    } finally {
      busy.current = false;
      if (isCurrentUser()) setOperation(null);
    }
  }

  function confirmPrice() {
    if (busy.current || !isCurrentUser() || !editable || query.isError || query.isFetching || changedElsewhere
      || dialog.booking.checkoutRevision !== booking.checkoutRevision || !(remainingSeconds(dialog.booking._timing, performance.now()) > 0)) return;
    navigate(`/checkout/${encodeURIComponent(code)}`);
  }

  const action = <button type="button" className={`${primary} w-full`} disabled={!canContinue} aria-busy={operation === 'products'} onClick={saveProducts}>
    {operation === 'products' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}{operation === 'products' ? 'Đang lưu sản phẩm…' : 'Tiếp tục thanh toán'}
  </button>;

  if (booking.checkout.state !== 'EDITABLE') return <Navigate to={`/checkout/${encodeURIComponent(code)}`} replace />;

  return <div className="mx-auto w-full max-w-[1200px] px-4 pb-36 pt-8 sm:px-8 lg:pb-16">
    <BookingProgress step={1} title="Chọn sản phẩm" />
    {query.isError && <div role="alert" className="mb-5 rounded-xl border border-primary/40 p-4 text-sm text-neutral-200">Chưa kiểm tra được trạng thái đơn. Tiếp tục tạm khóa.<button className={`${secondary} ml-3`} onClick={() => query.refetch()}>Thử lại</button></div>}
    {changedElsewhere && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 p-4 text-sm text-neutral-200"><span>Đơn đã thay đổi. Tải lại lựa chọn đã lưu trước khi tiếp tục.</span><button className={secondary} onClick={reloadDraft} disabled={Boolean(operation)}>Tải lại lựa chọn</button></div>}
    {seconds === 0 && <p role="status" className="mb-5 rounded-xl border border-primary/40 p-4 text-sm text-neutral-200">Đang kiểm tra thời gian giữ ghế. Bạn chưa thể tiếp tục.</p>}
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
      <BookingSummary booking={booking} code={code} seconds={seconds} products={lines} total={total} editable operation={operation} action={action} onCancel={() => setDialog({ kind: 'cancel' })} />
      <section aria-labelledby="product-catalog-title" className="min-w-0">
        <h2 id="product-catalog-title" className="text-xl font-bold text-white">Thêm chút vị cho buổi xem phim</h2><p className="mb-5 mt-2 text-sm text-muted">Chọn bắp, nước hoặc combo yêu thích. Bạn có thể tiếp tục chỉ với vé.</p>
        {catalog.isPending ? <div aria-label="Đang tải sản phẩm" className="grid animate-pulse gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map(id => <div key={id} className="h-80 rounded-2xl bg-surface" />)}</div>
          : catalog.isError ? <div role="alert" className="mb-5 rounded-xl border border-primary/30 bg-surface p-5 text-sm text-neutral-300"><p>Chưa tải được danh mục sản phẩm. Các sản phẩm đã lưu vẫn được giữ nguyên.</p><button className={`${secondary} mt-3`} onClick={() => catalog.refetch()}>Thử lại danh mục</button></div>
            : products.length === 0 ? <p className="rounded-2xl border border-surfaceBorder bg-surface p-6 text-sm text-muted">Hiện chưa có sản phẩm đang bán. Bạn có thể tiếp tục chỉ với vé.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">{products.map(product => <ProductCard key={product.id} product={product} quantity={draft[product.id] ?? 0} disabled={disabled} onChange={quantity => {
          setDraft(previous => ({ ...previous, [product.id]: quantity })); setMetadata(previous => ({ ...previous, [product.id]: product })); setDialog(null);
        }} />)}</div>
        <p className="mt-5 text-xs leading-relaxed text-muted">Lựa chọn được lưu khi bấm “Tiếp tục thanh toán”. Tải lại trang sẽ khôi phục lựa chọn đã lưu gần nhất. Thời gian giữ ghế vẫn tiếp tục chạy.</p>
      </section>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-surfaceBorder bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden"><div className="mx-auto flex max-w-xl items-center gap-3"><div className="shrink-0"><p className="text-[11px] text-muted">Tổng tạm tính</p><strong className="text-lg font-black text-primary">{formatCurrency(total)}</strong></div><div className="min-w-0 flex-1">{action}</div></div></div>
    {dialog?.kind === 'cancel' && <ConfirmDialog title="Hủy giữ ghế?" confirmLabel="Vẫn hủy giữ ghế" busy={Boolean(operation)} onConfirm={cancel} onClose={() => setDialog(null)}><p>Các ghế trong đơn sẽ được trả lại để người khác có thể chọn.</p></ConfirmDialog>}
    {dialog?.kind === 'price' && <ConfirmDialog title="Giá sản phẩm đã thay đổi" confirmLabel="Đồng ý và tiếp tục" busy={Boolean(operation)} confirmDisabled={query.isFetching || query.isError || !editable || changedElsewhere} onConfirm={confirmPrice} onClose={() => setDialog(null)}>
      <ul className="space-y-2">{dialog.booking.products.map(item => <li key={item.productId}>{item.productName}: <span className="text-muted line-through">{formatCurrency(dialog.previousProducts.find(old => String(old.productId) === String(item.productId))?.unitPrice)}</span> → <strong className="text-white">{formatCurrency(item.unitPrice)}</strong></li>)}</ul>
      <p className="mt-4">Tổng trước: {formatCurrency(dialog.previousTotal)}. Tổng mới: <strong className="text-white">{formatCurrency(dialog.booking.totalAmount)}</strong>.</p><p className="mt-2">Giá mới đã được lưu trong đơn. Bạn có thể quay lại để chỉnh sản phẩm; thời gian giữ ghế vẫn tiếp tục chạy.</p>
    </ConfirmDialog>}
  </div>;
}

export default function ProductSelectionPage() {
  return <BookingPageAccess Form={ProductSelectionForm} />;
}
