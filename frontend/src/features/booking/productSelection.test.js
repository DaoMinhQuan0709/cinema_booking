import test from 'node:test';
import assert from 'node:assert/strict';
import { productChoices } from './productSelection.js';

test('keeps saved and unsaved withdrawn products visible for explicit removal', () => {
  const saved = [{ productId: 1, productName: 'Saved', unitPrice: 30000 }];
  const metadata = { 2: { id: 2, name: 'Unsaved', price: 20000 } };
  const products = productChoices([], saved, metadata, { 1: 2, 2: 1 }, true);
  assert.deepEqual(products.map(item => [item.id, item.isAvailable]), [[1, false], [2, false]]);
  assert.equal(products.reduce((total, item) => total + item.price * ({ 1: 2, 2: 1 }[item.id]), 0), 80000);
  assert.equal(productChoices([], saved, metadata, { 1: 0, 2: 0 }, true).length, 1);
});

test('catalog failure preserves saved prices and live catalog data takes precedence', () => {
  const saved = [{ productId: 1, productName: 'Saved', unitPrice: 30000 }];
  assert.equal(productChoices([], saved, {}, { 1: 2 }, false)[0].price, 30000);
  const catalog = [{ id: 1, name: 'Current', price: 35000, isAvailable: true }];
  assert.deepEqual(productChoices(catalog, saved, {}, { 1: 2 }, true), catalog);
  assert.equal(saved[0].unitPrice, 30000);
});
