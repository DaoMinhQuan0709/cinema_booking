import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SYNC_LIMIT, formatSyncCount, formatSyncLimit, formatSyncTime, prepareSyncLimit, SYNC_COUNTERS, syncStatusPollInterval } from './syncUtils.js';

test('giới hạn mặc định 100, 0 là tất cả; chuẩn hóa thành đúng một tham số Integer', () => {
  assert.equal(DEFAULT_SYNC_LIMIT, '100');
  assert.deepEqual(prepareSyncLimit(' 00100 '), { payload: { limitShowtimes: 100 } });
  assert.deepEqual(prepareSyncLimit('0'), { payload: { limitShowtimes: 0 } });
  assert.deepEqual(prepareSyncLimit('2147483647'), { payload: { limitShowtimes: 2147483647 } });
  assert.equal(formatSyncLimit(0), 'Tất cả suất tương lai'); assert.equal(formatSyncLimit(100), '100 suất');
});

test('chặn giới hạn trống, âm, thập phân, số mũ và vượt phạm vi backend trước POST', () => {
  for (const value of ['', ' ', null, undefined, '-1', '1.5', '1e3', '+100', '2147483648', 'Infinity']) {
    const result = prepareSyncLimit(value); assert.ok(result.error, String(value)); assert.equal(result.payload, undefined);
  }
});

test('bộ đếm giữ số 0 thực, không biến dữ liệu thiếu hoặc không hợp lệ thành 0', () => {
  assert.equal(SYNC_COUNTERS.length, 9); assert.equal(new Set(SYNC_COUNTERS.map(item => item.key)).size, 9);
  assert.equal(formatSyncCount(0), '0'); assert.equal(formatSyncCount('1234'), '1.234');
  for (const value of [null, undefined, '', ' ', -1, 1.5, NaN, Infinity, 'bad']) assert.equal(formatSyncCount(value), '—');
});

test('thời gian Instant hiển thị Việt Nam và không đoán mốc thiếu múi giờ', () => {
  assert.equal(formatSyncTime('2026-11-12T18:15:30Z'), '01:15:30 13/11/2026');
  assert.equal(formatSyncTime('2026-11-13T01:15:30+07:00'), '01:15:30 13/11/2026');
  assert.equal(formatSyncTime(null), 'Chưa có mốc được ghi nhận');
  for (const value of ['bad', '2026-11-12T10:00:00', '2026-13-12T10:00:00Z', 0]) assert.equal(formatSyncTime(value), 'Không xác định');
});

test('chỉ đọc trạng thái theo chu kỳ khi có tác vụ, dừng khi rảnh hoặc lỗi đã biết', () => {
  assert.equal(syncStatusPollInterval({ state: { status: 'success', data: { running: true } } }), 2000);
  assert.equal(syncStatusPollInterval({ state: { status: 'success', data: { running: false } } }), false);
  assert.equal(syncStatusPollInterval({ state: { status: 'error', data: { running: true } } }), false);
  assert.equal(syncStatusPollInterval({ state: { status: 'pending' } }, true), 2000);
});
