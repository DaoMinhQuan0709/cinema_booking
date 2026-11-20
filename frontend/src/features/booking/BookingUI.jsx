import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Check, Clock3, LoaderCircle, RefreshCw, ShieldCheck, Ticket } from 'lucide-react';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatCountdown, formatCheckoutShowtime } from './checkoutUtils';
import { primary, secondary } from './bookingStyles';

export function BookingProgress({ step, title }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
    <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">PremierCinema / Đặt vé</p><h1 className="text-3xl font-black text-white sm:text-4xl">{title}<span className="text-primary">.</span></h1></div>
    <ol aria-label="Tiến trình đặt vé" className="flex flex-wrap gap-3 text-xs sm:gap-5">
      {['Chọn ghế', 'Sản phẩm', 'Thanh toán', 'Kết quả'].map((label, index) => <li key={label} className={`flex items-center gap-2 ${index === step ? 'text-white' : 'text-muted'}`} aria-current={index === step ? 'step' : undefined}>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${index === step ? 'border-primary bg-primary' : 'border-surfaceBorder'}`}>{index < step ? <Check className="h-3 w-3" aria-hidden="true" /> : index + 1}</span>{label}
      </li>)}
    </ol>
  </div>;
}

export function Notice({ title, children, retry }) {
  return <div className="mx-auto max-w-xl px-6 py-20 text-center"><Ticket className="mx-auto mb-5 h-12 w-12 text-primary" aria-hidden="true" /><h1 className="text-2xl font-bold text-white">{title}</h1><div className="mt-3 text-sm leading-relaxed text-muted">{children}</div><div className="mt-7 flex flex-wrap justify-center gap-3">{retry && <button className={secondary} onClick={retry}><RefreshCw className="h-4 w-4" />Thử lại</button>}<Link className={secondary} to="/">Về trang chủ</Link></div></div>;
}

export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onClose, busy, confirmDisabled = false }) {
  const ref = useRef(null);
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="checkout-confirm-title" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-surfaceBorder bg-surface p-6 text-white backdrop:bg-black/80">
    <h2 id="checkout-confirm-title" className="text-xl font-bold">{title}</h2><div className="mt-4 text-sm leading-relaxed text-neutral-300">{children}</div>
    <div className="mt-6 flex flex-wrap justify-end gap-3"><button className={secondary} disabled={busy} onClick={onClose}>Quay lại</button><button className={primary} disabled={busy || confirmDisabled} onClick={onConfirm}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{confirmLabel}</button></div>
  </dialog>;
}

export function BookingSummary({ booking, code, seconds, products = booking.products, total = Number(booking.totalAmount), editable, operation, action, onCancel }) {
  const seatTotal = booking.seats.reduce((sum, seat) => sum + Number(seat.price), 0);
  return (
      <aside className="order-first rounded-2xl border border-surfaceBorder bg-surface lg:sticky lg:top-24 lg:order-last">
        <div className={`flex items-center justify-between gap-3 border-b border-dashed border-surfaceBorder p-5 ${seconds !== null && seconds < 120 && booking.status === 'PENDING' ? 'text-primary' : 'text-white'}`}><div className="flex items-center gap-2"><Clock3 className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-wider">Thời gian giữ ghế</span></div><output aria-label="Thời gian giữ ghế còn lại" className="font-mono text-3xl font-bold tabular-nums">{formatCountdown(booking.status === 'PENDING' ? seconds : null)}</output></div>
        <div className="p-5"><p className="text-xs uppercase tracking-widest text-muted">Thông tin đặt vé</p><h2 className="mt-3 text-xl font-black leading-snug text-white">{booking.showtime.movieTitle}</h2><p className="mt-3 text-sm text-neutral-200">{booking.showtime.cinemaName}</p><p className="mt-1 text-xs text-muted">{booking.showtime.auditoriumName} · {formatCheckoutShowtime(booking.showtime.startTime)}</p><div className="mt-4 flex flex-wrap gap-2">{booking.seats.map(seat => <span key={seat.showtimeSeatId} className="rounded-md border border-surfaceBorder px-2.5 py-1 text-xs font-bold text-white">{seat.rowChar}{seat.seatNumber}</span>)}</div><p className="mt-3 break-all font-mono text-xs text-muted">{code}</p>
          <div className="my-5 border-t border-dashed border-surfaceBorder" /><div className="flex justify-between text-sm text-neutral-300"><span>Tiền vé ({booking.seats.length} chỗ)</span><span>{formatCurrency(seatTotal)}</span></div>
          <ul className="mt-3 space-y-2 text-xs text-muted">{products.map(item => <li key={item.productId} className="flex justify-between gap-3"><span>{item.quantity} × {item.productName}</span><span className="shrink-0">{formatCurrency(item.subtotal)}</span></li>)}</ul>
          <div className="mt-3 flex justify-between text-sm text-neutral-300"><span>Tiền sản phẩm</span><span>{formatCurrency(products.reduce((sum, item) => sum + Number(item.subtotal), 0))}</span></div>
          <div className="mt-5 flex items-end justify-between gap-3 border-t border-surfaceBorder pt-5"><span className="text-sm text-muted">{editable ? 'Tổng tạm tính' : 'Tổng tiền'}</span><strong className="text-2xl font-black text-primary">{formatCurrency(total)}</strong></div><div className="mt-5 hidden lg:block">{action}</div><p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5" />Thanh toán qua cổng Sandbox</p>
          {booking.status === 'PENDING' && <button className="mt-4 min-h-10 w-full text-xs text-muted underline underline-offset-4 hover:text-white disabled:opacity-50" disabled={Boolean(operation)} onClick={onCancel}>Hủy giữ ghế để chọn lại</button>}
        </div>
      </aside>
  );
}
