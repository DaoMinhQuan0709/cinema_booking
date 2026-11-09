import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHoldRequest, formatHoldExpiry, getHoldErrorMessage, getHoldExpiry, SEAT_CONFLICT_MESSAGE } from './bookingHold.js';

const seat = (id, status = 'AVAILABLE') => ({ showtimeSeatId: id, seatId: id + 1000, status });
const unit = (...seats) => ({ seats });

test('submits sorted inventory IDs, both couple positions, and an empty products list', () => {
  const units = [unit(seat(12), seat(13)), unit(seat(2))];
  assert.deepEqual(buildHoldRequest(3242, units), { showtimeId: 3242, showtimeSeatIds: [2, 12, 13], products: [] });
  assert.equal(units[0].seats[0].showtimeSeatId, 12);
});

test('requires a valid internal showtime and at least one seat', () => {
  assert.throws(() => buildHoldRequest('1011-226432', [unit(seat(1))]), /Suất chiếu không hợp lệ/);
  assert.throws(() => buildHoldRequest(3242, []), /ít nhất một ghế/);
});

test('rejects unavailable, incomplete, duplicate or invalid inventory positions', () => {
  for (const status of ['LOCKED', 'BOOKED', 'INCOMPLETE']) {
    assert.throws(() => buildHoldRequest(3242, [unit(seat(1, status))]), { message: SEAT_CONFLICT_MESSAGE });
  }
  assert.throws(() => buildHoldRequest(3242, [{ ...unit(seat(1)), incomplete: true }]), { message: SEAT_CONFLICT_MESSAGE });
  assert.throws(() => buildHoldRequest(3242, [{ ...unit(seat(1)), seatType: 'COUPLE' }]), { message: SEAT_CONFLICT_MESSAGE });
  assert.throws(() => buildHoldRequest(3242, [unit(seat(1)), unit(seat(1))]), /không hợp lệ/);
  assert.throws(() => buildHoldRequest(3242, [unit(seat(0))]), /không hợp lệ/);
});

test('counts the two positions of a couple against the eight-place limit', () => {
  const eight = Array.from({ length: 4 }, (_, i) => unit(seat(i * 2 + 1), seat(i * 2 + 2)));
  assert.equal(buildHoldRequest(3242, eight).showtimeSeatIds.length, 8);
  assert.throws(() => buildHoldRequest(3242, [...eight, unit(seat(9))]), /tối đa 8 chỗ/);
});

test('uses Vietnam time for an unzoned expiry and respects explicit offsets', () => {
  assert.equal(getHoldExpiry('2026-11-09T00:05:00'), Date.parse('2026-11-08T17:05:00Z'));
  assert.equal(getHoldExpiry('2026-11-09T00:05:00+07:00'), Date.parse('2026-11-08T17:05:00Z'));
  assert.equal(getHoldExpiry('2026-11-08T17:05:00Z'), Date.parse('2026-11-08T17:05:00Z'));
  assert.ok(formatHoldExpiry('2026-11-08T17:05:00Z').includes('00:05:00'));
  assert.ok(Number.isNaN(getHoldExpiry(null)));
  assert.equal(formatHoldExpiry('invalid'), '');
});

test('409 always uses the requested toast text and other errors retain backend context', () => {
  assert.equal(getHoldErrorMessage({ response: { status: 409, data: { message: 'NOWAIT failure' } } }), SEAT_CONFLICT_MESSAGE);
  assert.equal(getHoldErrorMessage({ response: { status: 400, data: { message: 'Bạn đã có đơn chờ thanh toán' } } }), 'Bạn đã có đơn chờ thanh toán');
  assert.equal(getHoldErrorMessage({}), 'Không thể giữ ghế. Vui lòng thử lại.');
});
