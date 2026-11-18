export const MY_TICKETS_PATH = '/profile/bookings';

// Khớp định dạng mã đơn mà CheckoutPage đang chấp nhận: "BK" + 18 ký tự chữ/số.
const BOOKING_CODE_PATTERN = /^BK[a-zA-Z0-9]{18}$/;

export const isBookingCode = value => typeof value === 'string' && BOOKING_CODE_PATTERN.test(value);

/** Đường dẫn trang chi tiết vé; trả null nếu mã đơn sai định dạng để không tạo liên kết hỏng. */
export const getTicketDetailHref = bookingCode => isBookingCode(bookingCode)
  ? `${MY_TICKETS_PATH}/${encodeURIComponent(bookingCode)}`
  : null;
