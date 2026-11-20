import test from 'node:test';
import assert from 'node:assert/strict';
import { productImageUrl } from './productImageUrl.js';

test('product paths use backend origin, preserving filename case and absolute remote URLs', () => {
  assert.equal(productImageUrl('/images/Bap_rang_bo_vua.png', 'http://localhost:8080/api/v1'), 'http://localhost:8080/images/Bap_rang_bo_vua.png');
  assert.equal(productImageUrl('/images/combo_solo.png', 'https://cinema.example/api/v1'), 'https://cinema.example/images/combo_solo.png');
  assert.equal(productImageUrl('https://cdn.example/a.png', 'http://localhost:8080/api/v1'), 'https://cdn.example/a.png');
  assert.equal(productImageUrl('/images/a.png', '/api/v1'), 'http://localhost/images/a.png');
});

test('missing, malformed and non-image relative sources use the fallback', () => {
  for (const value of [null, undefined, '', '/api/v1/bookings', '//other.example/a.png', 'javascript:alert(1)', 'data:image/png;base64,abc', '/images/../api/v1/auth', '/images/\\other.example/a.png']) {
    assert.equal(productImageUrl(value, 'http://localhost:8080/api/v1'), null);
  }
});
