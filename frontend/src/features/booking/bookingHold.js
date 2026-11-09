import { isInternalShowtimeId } from '../../utils/showtimeId.js';

export const SEAT_CONFLICT_MESSAGE = 'Ghế bạn chọn vừa có người giữ chỗ!';

/** Submit inventory IDs, including both positions of each couple seat. */
export function buildHoldRequest(showtimeId, units, limit = 8) {
  if (!isInternalShowtimeId(showtimeId)) throw new Error('Suất chiếu không hợp lệ. Vui lòng chọn lại suất.');
  if (!units.length) throw new Error('Bạn hãy chọn ít nhất một ghế.');
  if (units.some(unit => unit.incomplete || !unit.seats.length || (unit.seatType === 'COUPLE' && unit.seats.length !== 2)
    || unit.seats.some(seat => seat.status !== 'AVAILABLE'))) {
    throw new Error(SEAT_CONFLICT_MESSAGE);
  }
  const ids = units.flatMap(unit => unit.seats.map(seat => seat.showtimeSeatId));
  if (ids.length > limit) throw new Error(`Bạn chỉ được chọn tối đa ${limit} chỗ mỗi lần đặt.`);
  if (ids.some(id => !isInternalShowtimeId(id)) || new Set(ids.map(String)).size !== ids.length) {
    throw new Error('Danh sách ghế không hợp lệ. Vui lòng tải lại sơ đồ.');
  }
  return {
    showtimeId,
    showtimeSeatIds: ids.sort((a, b) => BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0),
    products: [],
  };
}

/** Backend LocalDateTime values describe Vietnam cinema time. */
export function getHoldExpiry(expiresAt) {
  if (typeof expiresAt !== 'string' || !expiresAt) return NaN;
  const zoned = /(?:Z|[+-]\d{2}:\d{2})$/i.test(expiresAt);
  return Date.parse(zoned ? expiresAt : `${expiresAt}+07:00`);
}

export function formatHoldExpiry(expiresAt) {
  const timestamp = getHoldExpiry(expiresAt);
  if (!Number.isFinite(timestamp)) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(timestamp);
}

export function getHoldErrorMessage(error) {
  if (error?.response?.status === 409) return SEAT_CONFLICT_MESSAGE;
  return error?.response?.data?.message || error?.message || 'Không thể giữ ghế. Vui lòng thử lại.';
}
