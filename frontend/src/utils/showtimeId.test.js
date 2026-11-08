import test from 'node:test';
import assert from 'node:assert/strict';
import { isInternalShowtimeId, retryShowtimeRequest } from './showtimeId.js';

test('accepts only positive internal bigint IDs, including the database upper boundary', () => {
  for (const id of [1, '2871', '9223372036854775807']) assert.equal(isInternalShowtimeId(id), true);
  for (const id of ['1011-226432', '0', '-1', '1.5', '1e3', '9223372036854775808', '1/2', undefined, '', ' 1']) {
    assert.equal(isInternalShowtimeId(id), false);
  }
});

test('does not retry invalid, missing or unavailable showtimes, but permits one transient retry', () => {
  for (const status of [400, 401, 403, 404, 409]) assert.equal(retryShowtimeRequest(0, { response: { status } }), false);
  assert.equal(retryShowtimeRequest(0, { response: { status: 500 } }), true);
  assert.equal(retryShowtimeRequest(1, { response: { status: 500 } }), false);
  assert.equal(retryShowtimeRequest(0, new Error('network')), true);
});
