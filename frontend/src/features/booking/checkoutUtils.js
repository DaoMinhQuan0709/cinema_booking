export const checkoutKey = (userId, code) => ['bookings', userId, code];
export const productKey = ['products'];
export const draftFromBooking = (booking) => Object.fromEntries((booking.products ?? []).map(item => [item.productId, item.quantity]));

export function selectedProducts(draft) {
  for (const [id, quantity] of Object.entries(draft)) {
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0 || !Number.isSafeInteger(quantity) || quantity < 0 || quantity > 2147483647)
      throw new Error('Số lượng hoặc mã combo không hợp lệ.');
  }
  return Object.entries(draft).filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => {
      return { productId: Number(id), quantity };
    }).sort((a, b) => a.productId - b.productId);
}

export function priceChanged(expected, actual, expectedTotal) {
  return Number(actual.totalAmount) !== expectedTotal || actual.products.length !== expected.length
    || expected.some(item => !actual.products.some(saved => String(saved.productId) === String(item.productId)
      && saved.quantity === item.quantity && Number(saved.unitPrice) === Number(item.unitPrice)));
}

export function safePaymentUrl(value, method) {
  const url = new URL(value);
  const host = { VNPAY: 'sandbox.vnpayment.vn', MOMO: 'test-payment.momo.vn' }[method];
  if (!host || url.protocol !== 'https:' || url.hostname !== host || url.username || url.password || url.hash || (url.port && url.port !== '443'))
    throw new Error('Không nhận được đường dẫn thanh toán Sandbox hợp lệ.');
  return url.href;
}

export function remainingSeconds(timing, monotonicNow) {
  if (!timing || !Number.isFinite(timing.remaining) || !Number.isFinite(timing.receivedAt)) return null;
  return Math.max(0, Math.ceil((timing.remaining - Math.max(0, monotonicNow - timing.receivedAt)) / 1000));
}

export function formatCountdown(seconds) {
  if (seconds === null) return '--:--';
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatCheckoutShowtime(value) {
  const parts = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
  return parts ? `${parts[4]} · ${parts[3]}/${parts[2]}/${parts[1]}` : 'Đang cập nhật giờ chiếu';
}

export function checkoutStatusText(booking, seconds) {
  if (booking.status === 'CONFIRMED') return { title: 'Đơn đã được thanh toán', message: 'Đơn của bạn đã được xác nhận. Bạn không cần thanh toán lại.' };
  if (booking.status === 'CANCELLED') return { title: 'Đơn đã bị hủy', message: 'Lượt giữ ghế này đã được hủy. Bạn có thể chọn suất chiếu để đặt vé lại.' };
  if (booking.checkout?.state === 'CLOSED') return { title: 'Hết thời gian giữ vé', message: 'Bạn không thể bắt đầu thanh toán mới cho lượt giữ ghế này.' };
  if (seconds === null || seconds === 0) return { title: 'Đang kiểm tra thời gian giữ ghế', message: 'Vui lòng chờ xác nhận thời hạn trước khi tiếp tục thanh toán.' };
  return { title: booking.checkout?.state === 'READY' ? 'Phiên thanh toán đã sẵn sàng' : 'Đang kiểm tra phiên thanh toán', message: 'Đơn đã bắt đầu thanh toán. Combo và phương thức đang được giữ nguyên để tránh tạo giao dịch trùng.' };
}
