import test from 'node:test';
import assert from 'node:assert/strict';
import { applySeatStatusUpdate } from './seatRealtime.js';

const map = () => ({
  showtimeId: 1,
  seats: [
    { showtimeSeatId: 1, status: 'AVAILABLE' },
    { showtimeSeatId: 2, status: 'AVAILABLE' },
    { showtimeSeatId: 3, status: 'BOOKED' },
  ],
});

test('HOLD doi dung cac ghe trong message sang LOCKED va khong sua object cu', () => {
  const before = map();
  const after = applySeatStatusUpdate(before, { seatIds: [1], status: 'LOCKED' });
  assert.deepEqual(after.seats.map(s => s.status), ['LOCKED', 'AVAILABLE', 'BOOKED']);
  assert.equal(before.seats[0].status, 'AVAILABLE');
  assert.equal(after.seats[1], before.seats[1]);
});

test('RELEASE tra ghe LOCKED ve AVAILABLE', () => {
  const locked = applySeatStatusUpdate(map(), { seatIds: [1, 2], status: 'LOCKED' });
  const released = applySeatStatusUpdate(locked, { seatIds: [1, 2], status: 'AVAILABLE' });
  assert.deepEqual(released.seats.map(s => s.status), ['AVAILABLE', 'AVAILABLE', 'BOOKED']);
});

test('ghe BOOKED khong bi message cu/tre ghi de', () => {
  const after = applySeatStatusUpdate(map(), { seatIds: [3], status: 'AVAILABLE' });
  assert.equal(after.seats[2].status, 'BOOKED');
});

test('khong thay doi gi thi tra ve cung tham chieu; chua co du lieu thi bo qua', () => {
  const before = map();
  assert.equal(applySeatStatusUpdate(before, { seatIds: [1], status: 'AVAILABLE' }), before);
  assert.equal(applySeatStatusUpdate(before, { seatIds: [99], status: 'LOCKED' }), before);
  assert.equal(applySeatStatusUpdate(undefined, { seatIds: [1], status: 'LOCKED' }), undefined);
  assert.equal(applySeatStatusUpdate(before, null), before);
});
