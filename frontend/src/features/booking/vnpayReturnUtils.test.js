import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVNPayReturn, paymentResultView, resultIsFinal } from './vnpayReturnUtils.js';

const params = { vnp_TxnRef: 'a'.repeat(32), vnp_SecureHash: 'b'.repeat(128), vnp_TmnCode: 'TEST0001',
  vnp_Amount: '8000000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_OrderInfo: 'Thanh toan ve BKTEST' };
const pending = { booking: { status: 'PENDING' }, paymentStatus: 'PENDING', attemptStatus: 'PENDING', gatewayResponseCode: '00', gatewayTransactionStatus: '00' };

test('decodes VNPay form encoding without altering the signed values', () => {
  assert.deepEqual(parseVNPayReturn(`?${new URLSearchParams(params)}`), params);
});

test('rejects incomplete or duplicate callback parameters', () => {
  assert.throws(() => parseVNPayReturn('?vnp_ResponseCode=00'));
  assert.throws(() => parseVNPayReturn(`?${new URLSearchParams(params)}&vnp_ResponseCode=24`));
  assert.throws(() => parseVNPayReturn(`?${new URLSearchParams({ ...params, vnp_Amount: '-8000' })}`));
});

test('verified gateway success alone never confirms a ticket', () => {
  assert.equal(paymentResultView(pending).kind, 'pending');
  assert.equal(resultIsFinal(pending), false);
  assert.equal(paymentResultView({ ...pending, booking: { status: 'EXPIRED' } }).kind, 'pending');
  assert.equal(paymentResultView({ ...pending, paymentStatus: 'SUCCESS' }).kind, 'pending');
});

test('confirmed server booking wins over an older failed return', () => {
  const result = { ...pending, booking: { status: 'CONFIRMED' }, paymentStatus: 'SUCCESS', gatewayResponseCode: '24', gatewayTransactionStatus: '02' };
  assert.equal(paymentResultView(result).kind, 'success');
  assert.equal(resultIsFinal(result), true);
});

test('distinguishes cancellation, failed payment, uncertain outcome and refund', () => {
  assert.equal(paymentResultView({ ...pending, gatewayResponseCode: '24', gatewayTransactionStatus: '02' }).kind, 'cancelled');
  assert.equal(paymentResultView({ ...pending, gatewayResponseCode: '51', gatewayTransactionStatus: '02' }).kind, 'failed');
  assert.equal(paymentResultView({ ...pending, gatewayResponseCode: '07', gatewayTransactionStatus: '07' }).kind, 'pending');
  assert.equal(paymentResultView({ ...pending, paymentStatus: 'REFUND_REQUIRED' }).kind, 'review');
  assert.equal(resultIsFinal({ ...pending, attemptStatus: 'REFUND_REQUIRED' }), true);
});
