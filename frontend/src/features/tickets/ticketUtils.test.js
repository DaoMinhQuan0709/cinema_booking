import test from 'node:test';
import assert from 'node:assert/strict';
import { getTicketDetailHref, isBookingCode, MY_TICKETS_PATH } from './ticketUtils.js';
import { countTickets, filterTickets, formatTicketDateTime, formatTicketMoney, getTicketCheckoutHref, readTicketStatus, ticketListHref, ticketListSearch, ticketSeatLabel, ticketSeatType, ticketStatusLabel } from './ticketUtils.js';

const VALID_CODE = 'BK20261109130000ABCD';

test('mã đơn hợp lệ gồm BK và đúng 18 ký tự chữ/số', () => {
  assert.equal(isBookingCode(VALID_CODE), true);
  assert.equal(isBookingCode('BKabcdefghijklmnopqr'), true);
});

test('mã đơn sai định dạng, sai độ dài hoặc không phải chuỗi đều bị từ chối', () => {
  for (const value of [
    '', 'BK', 'bk20261109130000ABCD', `${VALID_CODE}X`, VALID_CODE.slice(0, -1),
    'BK2026110913000-ABCD', 'BK2026110913000 ABCD', ` ${VALID_CODE}`, `${VALID_CODE}\n`,
    '../BK20261109130000ABCD', 'BK20261109130000AB/D', null, undefined, 123, {},
  ]) {
    assert.equal(isBookingCode(value), false, String(value));
  }
});

test('liên kết chi tiết vé chỉ được tạo cho mã đơn hợp lệ', () => {
  assert.equal(MY_TICKETS_PATH, '/profile/bookings');
  assert.equal(getTicketDetailHref(VALID_CODE), `/profile/bookings/${VALID_CODE}`);
  for (const value of ['', 'abc', null, undefined, '../admin']) assert.equal(getTicketDetailHref(value), null);
});

test('bộ lọc URL chuẩn hóa giá trị sai, bỏ trùng, giữ tham số khác và không sửa đầu vào', () => {
  const search = new URLSearchParams('status=PENDING&ref=a&status=EXPIRED');
  assert.equal(readTicketStatus(search), 'PENDING');
  assert.equal(ticketListSearch(search), '?ref=a&status=PENDING');
  assert.equal(search.getAll('status').length, 2);
  for (const value of ['', 'ALL', 'pending', 'UNKNOWN', 'toString']) {
    assert.equal(readTicketStatus(`status=${value}`), 'ALL');
    assert.equal(ticketListSearch(`status=${value}&ref=a`), '?ref=a');
  }
  assert.equal(ticketListSearch('?status=PENDING&ref=a', 'CONFIRMED'), '?ref=a&status=CONFIRMED');
  assert.deepEqual(ticketListHref({ ticketsSearch: '?ref=a&status=PENDING', ticketsHash: '#tickets' }), { pathname: MY_TICKETS_PATH, search: '?ref=a&status=PENDING', hash: '#tickets' });
  assert.deepEqual(ticketListHref(null), { pathname: MY_TICKETS_PATH, search: '', hash: '' });
});

test('đếm và lọc bốn trạng thái giữ nguyên thứ tự API; trạng thái lạ chỉ thuộc tất cả', () => {
  const tickets = ['PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'PENDING', 'OTHER', undefined, '__proto__'].map((status, id) => Object.freeze({ id, status }));
  Object.freeze(tickets);
  assert.deepEqual(countTickets(tickets), { ALL: 8, CONFIRMED: 1, PENDING: 2, CANCELLED: 1, EXPIRED: 1 });
  assert.deepEqual(filterTickets(tickets, 'PENDING').map(ticket => ticket.id), [0, 4]);
  assert.equal(filterTickets(tickets, 'ALL'), tickets);
  assert.deepEqual(countTickets([]), { ALL: 0, CONFIRMED: 0, PENDING: 0, CANCELLED: 0, EXPIRED: 0 });
});

test('chỉ đơn PENDING có mã hợp lệ được tiếp tục, không tự suy diễn hạn giữ hoặc hoàn tiền', () => {
  assert.equal(getTicketCheckoutHref({ bookingCode: VALID_CODE, status: 'PENDING', expiresAt: '2000-01-01T00:00:00' }), `/checkout/${VALID_CODE}`);
  for (const status of ['CONFIRMED', 'CANCELLED', 'EXPIRED', 'OTHER', undefined]) assert.equal(getTicketCheckoutHref({ bookingCode: VALID_CODE, status }), null);
  assert.equal(getTicketCheckoutHref({ bookingCode: '../bad', status: 'PENDING' }), null);
  assert.equal(ticketStatusLabel('REFUNDED'), 'Chưa xác định');
  assert.equal(ticketStatusLabel('CONFIRMED'), 'Đã xác nhận');
});

test('tiền VND giữ giá 0 và phần lẻ thực; dữ liệu thiếu không thành 0đ', () => {
  assert.match(formatTicketMoney(240000), /240\.000/);
  assert.match(formatTicketMoney('90000.50'), /90\.000,5/);
  assert.match(formatTicketMoney(0), /^0/);
  for (const value of [null, undefined, '', ' ', false, -1, Infinity, 'abc', {}]) assert.equal(formatTicketMoney(value), 'Chưa cập nhật');
});

test('ngày LocalDateTime và Instant đều hiển thị giờ Việt Nam, kiểm tra ngày không tồn tại', () => {
  assert.equal(formatTicketDateTime('2026-11-18T00:30:00'), '00:30 · 18/11/2026');
  assert.equal(formatTicketDateTime('2026-11-17T17:30:00Z'), '00:30 · 18/11/2026');
  assert.equal(formatTicketDateTime('2026-11-18T01:30:00+08:00'), '00:30 · 18/11/2026');
  assert.equal(formatTicketDateTime('2024-02-29T09:30:00.123456'), '09:30 · 29/02/2024');
  for (const value of [null, '', '2026-02-29T10:00:00', '2026-11-18T24:00:00', '2026-11-18', '2026-13-01T00:00:00']) assert.equal(formatTicketDateTime(value), 'Chưa cập nhật');
});

test('nhãn ghế và loại ghế có fallback cho dữ liệu thiếu hoặc không nhận diện', () => {
  assert.equal(ticketSeatLabel({ rowChar: 'A', seatNumber: 2 }), 'A2');
  assert.equal(ticketSeatType('COUPLE'), 'Ghế đôi');
  for (const seat of [null, {}, { rowChar: 'A' }]) assert.equal(ticketSeatLabel(seat), 'Chưa cập nhật');
  for (const type of ['UNKNOWN', 'toString', undefined]) assert.equal(ticketSeatType(type), 'Chưa cập nhật');
});
