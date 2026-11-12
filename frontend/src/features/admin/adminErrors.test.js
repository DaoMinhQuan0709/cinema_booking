import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdminError, retryAdminQuery } from './adminErrors.js';

test('maps backend field validation without treating arbitrary payloads as form errors', () => {
  const detail = getAdminError({ response: { status: 400, data: { message: 'Validation', data: { title: 'Nhập tên phim', durationMinutes: 'Lớn hơn 0', ignored: {}, empty: '' } } } });
  assert.deepEqual(detail.fieldErrors, { title: 'Nhập tên phim', durationMinutes: 'Lớn hơn 0' });
  assert.equal(detail.message, 'Validation');
  for (const data of [null, ['message'], 'invalid']) {
    assert.deepEqual(getAdminError({ response: { status: 400, data: { data } } }).fieldErrors, {});
  }
});

test('a lost write response is uncertain; read errors and cancellations are distinct', () => {
  for (const code of ['ECONNABORTED', 'ERR_NETWORK']) {
    assert.equal(getAdminError({ code }, { forMutation: true }).uncertain, true);
    assert.match(getAdminError({ code }, { forMutation: true }).message, /kiểm tra dữ liệu/);
    assert.equal(getAdminError({ code }).uncertain, false);
  }
  assert.equal(getAdminError({ code: 'ERR_CANCELED' }, { forMutation: true }).cancelled, true);
  assert.equal(getAdminError({ code: 'ERR_CANCELED' }, { forMutation: true }).uncertain, false);
  assert.equal(getAdminError({ response: { status: 409 } }, { forMutation: true }).uncertain, false);
});

test('Admin reads never retry client/auth/conflict errors and allow only one transient retry', () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429]) assert.equal(retryAdminQuery(0, { response: { status } }), false);
  assert.equal(retryAdminQuery(0, { code: 'ERR_CANCELED' }), false);
  assert.equal(retryAdminQuery(0, {}), true);
  assert.equal(retryAdminQuery(0, { response: { status: 503 } }), true);
  assert.equal(retryAdminQuery(1, { response: { status: 503 } }), false);
});
