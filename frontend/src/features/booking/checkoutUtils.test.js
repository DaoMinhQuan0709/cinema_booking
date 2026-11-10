import test from 'node:test';
import assert from 'node:assert/strict';
import { selectedProducts, priceChanged, safePaymentUrl, remainingSeconds, formatCountdown, checkoutStatusText, formatCheckoutShowtime } from './checkoutUtils.js';

test('replaces combo choices and excludes zero quantities without mutating the draft', () => {
  const draft = { 9: 2, 3: 0, 5: 1 };
  assert.deepEqual(selectedProducts(draft), [{ productId: 5, quantity: 1 }, { productId: 9, quantity: 2 }]);
  assert.equal(draft[3], 0);
  assert.throws(() => selectedProducts({ 1: 1.5 }));
  assert.throws(() => selectedProducts({ nope: 2 }));
});

test('reconfirms per-item price changes even if the total is unchanged', () => {
  const expected = [{ productId: 1, quantity: 1, unitPrice: 20000 }, { productId: 2, quantity: 1, unitPrice: 30000 }];
  const actual = { totalAmount: 150000, products: [{ productId: 1, quantity: 1, unitPrice: 25000 }, { productId: 2, quantity: 1, unitPrice: 25000 }] };
  assert.equal(priceChanged(expected, actual, 150000), true);
  assert.equal(priceChanged(expected, { ...actual, products: [...expected].reverse() }, 150000), false);
});

test('redirects only to the selected HTTPS Sandbox and rejects deceptive URLs', () => {
  assert.equal(safePaymentUrl('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?a=1', 'VNPAY'), 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?a=1');
  assert.equal(safePaymentUrl('https://test-payment.momo.vn/v2/gateway/pay?t=example', 'MOMO'), 'https://test-payment.momo.vn/v2/gateway/pay?t=example');
  for (const url of ['javascript:alert(1)', 'http://sandbox.vnpayment.vn/pay', 'https://sandbox.vnpayment.vn.evil.invalid/pay', 'https://user@sandbox.vnpayment.vn/pay', 'https://test-payment.momo.vn/pay', 'https://sandbox.vnpayment.vn:444/pay']) {
    assert.throws(() => safePaymentUrl(url, 'VNPAY'));
  }
});

test('countdown uses a monotonic server baseline and never resets to ten minutes', () => {
  const timing = { remaining: 123400, receivedAt: 1000 };
  assert.equal(remainingSeconds(timing, 11000), 114);
  assert.equal(remainingSeconds(timing, 500), 124);
  assert.equal(remainingSeconds(timing, 999999), 0);
  assert.equal(remainingSeconds({ remaining: NaN, receivedAt: 1000 }, 2000), null);
  assert.equal(formatCountdown(114), '01:54');
  assert.equal(formatCountdown(0), '00:00');
});

test('does not declare expiry from the local countdown before the server confirms it', () => {
  assert.match(checkoutStatusText({ status: 'PENDING', checkout: { state: 'EDITABLE' } }, 0).title, /kiểm tra/);
  assert.match(checkoutStatusText({ status: 'CONFIRMED', checkout: { state: 'CLOSED' } }, 0).title, /đã được thanh toán/);
  assert.match(checkoutStatusText({ status: 'PENDING', checkout: { state: 'CLOSED' } }, 0).title, /Hết/);
  assert.equal(formatCheckoutShowtime('2026-11-10T19:30:00'), '19:30 · 10/11/2026');
});
