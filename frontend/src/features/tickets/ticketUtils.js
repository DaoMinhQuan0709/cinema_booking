export const MY_TICKETS_PATH = '/profile/bookings';

// Khớp định dạng mã đơn mà CheckoutPage đang chấp nhận: "BK" + 18 ký tự chữ/số.
const BOOKING_CODE_PATTERN = /^BK[a-zA-Z0-9]{18}$/;

export const isBookingCode = value => typeof value === 'string' && BOOKING_CODE_PATTERN.test(value);

/** Đường dẫn trang chi tiết vé; trả null nếu mã đơn sai định dạng để không tạo liên kết hỏng. */
export const getTicketDetailHref = bookingCode => isBookingCode(bookingCode)
  ? `${MY_TICKETS_PATH}/${encodeURIComponent(bookingCode)}`
  : null;

export const TICKET_FILTERS = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'PENDING', label: 'Chờ thanh toán' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'EXPIRED', label: 'Hết hạn' },
];

export const ticketStatusLabel = status => TICKET_FILTERS.find(item => item.value !== 'ALL' && item.value === status)?.label || 'Chưa xác định';
export const readTicketStatus = search => {
  const status = new URLSearchParams(search).get('status');
  return TICKET_FILTERS.some(item => item.value === status) ? status : 'ALL';
};

export function ticketListSearch(search, status = readTicketStatus(search)) {
  const params = new URLSearchParams(search);
  params.delete('status');
  if (status !== 'ALL' && TICKET_FILTERS.some(item => item.value === status)) params.set('status', status);
  const result = params.toString();
  return result ? `?${result}` : '';
}

export function ticketListHref(state) {
  return { pathname: MY_TICKETS_PATH,
    search: ticketListSearch(typeof state?.ticketsSearch === 'string' ? state.ticketsSearch : ''),
    hash: typeof state?.ticketsHash === 'string' ? state.ticketsHash : '',
  };
}

export function countTickets(tickets) {
  const counts = Object.fromEntries(TICKET_FILTERS.map(({ value }) => [value, 0]));
  counts.ALL = tickets.length;
  for (const ticket of tickets) {
    if (Object.hasOwn(counts, ticket.status) && ticket.status !== 'ALL') counts[ticket.status]++;
  }
  return counts;
}

export const filterTickets = (tickets, status) => status === 'ALL' ? tickets : tickets.filter(ticket => ticket.status === status);
export const ticketText = value => typeof value === 'string' && value.trim() ? value.trim() : 'Chưa cập nhật';
export const getTicketCheckoutHref = ticket => ticket?.status === 'PENDING' && isBookingCode(ticket.bookingCode)
  ? `/checkout/${encodeURIComponent(ticket.bookingCode)}` : null;

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 2 });
export function formatTicketMoney(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(?:\.\d+)?$/.test(String(value)) || !Number.isFinite(Number(value))) return 'Chưa cập nhật';
  return money.format(Number(value));
}

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function formatTicketDateTime(value) {
  if (typeof value !== 'string') return 'Chưa cập nhật';
  const parts = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!parts || parts[1].startsWith('0000') || +parts[2] > 23 || +parts[3] > 59 || +(parts[4] || 0) > 59) return 'Chưa cập nhật';
  const day = new Date(`${parts[1]}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== parts[1]) return 'Chưa cập nhật';
  // Backend trả LocalDateTime theo giờ Việt Nam; không dùng múi giờ của trình duyệt.
  const instant = new Date(parts[5] ? value : `${value}+07:00`);
  if (!Number.isFinite(instant.getTime())) return 'Chưa cập nhật';
  const formatted = Object.fromEntries(dateTime.formatToParts(instant).map(part => [part.type, part.value]));
  return `${formatted.hour}:${formatted.minute} · ${formatted.day}/${formatted.month}/${formatted.year}`;
}

export function ticketSeatLabel(seat) {
  return typeof seat?.rowChar === 'string' && seat.rowChar.trim() && Number.isInteger(seat.seatNumber) && seat.seatNumber > 0
    ? `${seat.rowChar.trim()}${seat.seatNumber}` : 'Chưa cập nhật';
}

const seatTypes = { STANDARD: 'Thường', VIP: 'VIP', COUPLE: 'Ghế đôi' };
export const ticketSeatType = type => Object.hasOwn(seatTypes, type) ? seatTypes[type] : 'Chưa cập nhật';
