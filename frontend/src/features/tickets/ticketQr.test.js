import test from 'node:test';
import assert from 'node:assert/strict';
import { requireTicketPng } from './ticketQr.js';

test('giữ nguyên Blob PNG để hiển thị và tải, từ chối JSON/HTML/ảnh trống hoặc sai chữ ký', async () => {
  const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0])], { type: 'image/png' });
  assert.equal(await requireTicketPng(png), png);
  for (const value of [null, {}, new Blob([], { type: 'image/png' }), new Blob(['{"data":null}'], { type: 'application/json' }),
    new Blob(['<html>error</html>'], { type: 'image/png' })]) {
    await assert.rejects(requireTicketPng(value), /PNG/);
  }
});
