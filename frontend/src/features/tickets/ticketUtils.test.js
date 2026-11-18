import test from 'node:test';
import assert from 'node:assert/strict';
import { getTicketDetailHref, isBookingCode, MY_TICKETS_PATH } from './ticketUtils.js';

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
