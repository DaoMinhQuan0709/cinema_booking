// Windows/Edge regression check. REST and gateway requests are intercepted; no real booking/payment.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = await mkdtemp(path.join(tmpdir(), 'cinema-checkout-browser-'));
const port = 4196, debugPort = 9229;
const origin = `http://127.0.0.1:${port}`;
const code = 'BK20261109130000ABCD';
const user = { id: 7, email: 'checkout@example.invalid', fullName: 'Khách kiểm thử', role: 'CUSTOMER' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const exceptions = [], results = [], requests = [];
let scenario, socket, server, edge, bootScript, cdp;
let bootSequence = 0;

class CDP {
  constructor(ws) {
    this.ws = ws; this.sequence = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = this.pending.get(message.id); if (!entry) return;
        this.pending.delete(message.id); message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
      } else this.handlers.get(message.method)?.forEach(fn => fn(message.params));
    });
  }
  on(method, callback) { if (!this.handlers.has(method)) this.handlers.set(method, []); this.handlers.get(method).push(callback); }
  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text + ': ' + response.exceptionDetails.exception?.description);
    return response.result.value;
  }
  async wait(expression, timeout = 8000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await this.evaluate(expression)) return; await delay(70); }
    throw new Error(`Timed out waiting for ${expression}`);
  }
  async click(text) {
    const matched = await this.evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes(${JSON.stringify(text)}) && b.offsetWidth && b.offsetHeight && !b.disabled); if (!button) return false; button.click(); return true; })()`);
    assert.equal(matched, true, `Visible enabled button: ${text}`);
  }
}

function reset(options = {}) {
  scenario = { deadline: Date.now() + 600000, status: 'PENDING', phase: 'EDITABLE', cart: [], price: 30000,
    revision: '0'.repeat(64), sequence: 0, payMode: 'ready', put: 0, pay: 0, cancel: 0, get: 0, ...options };
}

function booking() {
  const closed = scenario.status !== 'PENDING' || scenario.deadline <= Date.now();
  const state = closed ? 'CLOSED' : scenario.phase;
  return { id: 99, bookingCode: code, status: scenario.status, expiresAt: new Date(scenario.deadline).toISOString(),
    serverTime: new Date().toISOString(), checkoutRevision: scenario.revision,
    totalAmount: 80000 + scenario.cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    showtime: { showtimeId: 5950, movieTitle: 'Buổi Chiếu Mùa Thu', cinemaName: 'Galaxy Nguyễn Du', auditoriumName: 'Rạp 3', startTime: '2026-11-10T19:30:00' },
    seats: [{ showtimeSeatId: 101, rowChar: 'A', seatNumber: 1, seatType: 'STANDARD', price: 80000 }], products: scenario.cart,
    checkout: { state, canEditProducts: state === 'EDITABLE', expiresAt: new Date(scenario.deadline).toISOString(),
      paymentMethod: state === 'EDITABLE' ? null : 'VNPAY', paymentUrl: state === 'READY' ? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?stub=checkout' : null },
  };
}

async function intercept(cdp, event) {
  const { request, requestId } = event;
  const url = new URL(request.url);
  const method = request.method;
  const fulfill = (status, body, html = false) => cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: html ? 'text/html' : 'application/json; charset=utf-8' },
      { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' }],
    body: Buffer.from(html ? body : JSON.stringify(body)).toString('base64'),
  });
  if (url.hostname === 'sandbox.vnpayment.vn') return fulfill(200, '<!doctype html><h1>Sandbox redirect intercepted</h1>', true);
  if (method === 'OPTIONS') return fulfill(200, {});
  let body;
  try { body = request.postData ? JSON.parse(request.postData) : null; } catch { body = null; }
  requests.push({ method, pathname: url.pathname, body, authenticated: Boolean(request.headers.Authorization ?? request.headers.authorization) });
  const ok = data => fulfill(200, { code: 200, data });
  if (url.pathname.endsWith('/users/me')) return ok(user);
  if (url.pathname === '/api/v1/products' && method === 'GET') {
    if (scenario.catalogError) return fulfill(500, { code: 500, message: 'Catalog unavailable' });
    if (scenario.catalogUnavailable) return ok([]);
    return ok([{ id: 1, name: 'Combo Một', description: 'Một bắp rang và một nước ngọt', price: scenario.price, isAvailable: true }]);
  }
  if (url.pathname.endsWith('/payments/create-url')) {
    scenario.pay++;
    assert.equal(body.expectedRevision, scenario.revision); assert.equal(body.bookingCode, code);
    scenario.phase = scenario.payMode === 'unknown' ? 'UNKNOWN' : 'READY';
    if (scenario.payMode === 'lost-response') return cdp.send('Fetch.failRequest', { requestId, errorReason: 'ConnectionReset' });
    return fulfill(scenario.phase === 'READY' ? 200 : 202, { code: 200, data: { state: scenario.phase, paymentMethod: body.paymentMethod,
      paymentUrl: scenario.phase === 'READY' ? booking().checkout.paymentUrl : null } });
  }
  if (url.pathname.endsWith('/payments/vnpay-return')) {
    scenario.resultChecks = (scenario.resultChecks ?? 0) + 1;
    if (scenario.resultError) return fulfill(scenario.resultError, { code: scenario.resultError, message: 'Không xác minh được kết quả thanh toán.' });
    assert.equal(body.vnp_TxnRef, 'a'.repeat(32));
    assert.equal(body.vnp_OrderInfo, 'Thanh toan ve BKTEST');
    return ok({ booking: booking(), paymentStatus: scenario.paymentStatus ?? 'PENDING', attemptStatus: scenario.paymentStatus ?? 'PENDING',
      gatewayResponseCode: scenario.returnCode ?? '00', gatewayTransactionStatus: scenario.returnCode === '24' ? '02' : '00' });
  }
  if (url.pathname.endsWith(`/bookings/${code}/products`)) {
    scenario.put++;
    if (body.expectedRevision !== scenario.revision) return fulfill(409, { code: 409, message: 'Đơn đã thay đổi. Vui lòng kiểm tra lại.' });
    if (scenario.unavailableOnPut && body.products.length) {
      scenario.catalogUnavailable = true;
      return fulfill(400, { code: 400, message: 'Combo đã ngừng bán. Vui lòng bỏ combo này.' });
    }
    if (scenario.reprice) { scenario.price = 35000; scenario.reprice = false; }
    scenario.cart = body.products.map(item => ({ ...item, productName: 'Combo Một', unitPrice: scenario.price, subtotal: scenario.price * item.quantity }));
    scenario.revision = (++scenario.sequence).toString(16).padStart(64, '0');
    return ok(booking());
  }
  if (url.pathname.endsWith(`/bookings/${code}/cancel`)) {
    scenario.cancel++;
    if (scenario.cancelError) return fulfill(500, { code: 500, message: 'Chưa hủy được giữ ghế' });
    scenario.status = 'CANCELLED'; return ok(booking());
  }
  if (url.pathname.endsWith(`/bookings/${code}`)) {
    scenario.get++;
    if (scenario.forbidden) return fulfill(403, { code: 403, message: 'Forbidden' });
    return ok(booking());
  }
  if (url.pathname.endsWith('/bookings') && method === 'POST') { scenario.status = 'PENDING'; return fulfill(201, { code: 201, data: booking() }); }
  if (url.pathname.endsWith('/showtimes/5950/seats')) return ok({ showtimeId: 5950, auditoriumId: 1, auditoriumName: 'Rạp 3', totalRows: 1, totalCols: 1,
    seats: [{ showtimeSeatId: 101, seatId: 1, rowChar: 'A', seatNumber: 1, seatType: 'STANDARD', status: 'AVAILABLE', price: 80000, version: 0 }] });
  if (url.pathname.endsWith('/showtimes/5950')) return ok({ id: 5950, movieTitle: 'Buổi Chiếu Mùa Thu', cinemaName: 'Galaxy Nguyễn Du', auditoriumName: 'Rạp 3', startTime: '2026-11-10T19:30:00' });
  if (url.pathname.endsWith('/movies')) return ok({ content: [], totalElements: 0, totalPages: 0, last: true });
  return fulfill(404, { code: 404 });
}

async function boot(cdp, { authenticated = true, route = `/checkout/${code}`, width = 1440 } = {}) {
  if (bootScript) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: bootScript });
  const setup = `
    window.__checkoutBoot = ${++bootSequence};
    try { localStorage.clear(); sessionStorage.clear(); ${authenticated ? `localStorage.setItem('premier_cinema_access_token','mock-token'); localStorage.setItem('premier_cinema_user',${JSON.stringify(JSON.stringify(user))});` : ''} } catch {}
    Date.now = () => new Date().getTime() + 86400000;
    window.WebSocket = class extends EventTarget {
      constructor(url) { super(); this.url=url; this.readyState=0; this.bufferedAmount=0; setTimeout(()=>{this.readyState=1; const e=new Event('open'); this.onopen?.(e); this.dispatchEvent(e);},10); }
      send(frame) { if(String(frame).startsWith('CONNECT') || String(frame).startsWith('STOMP')) setTimeout(()=>{ const e=new MessageEvent('message',{data:'CONNECTED\\nversion:1.2\\nheart-beat:0,0\\n\\n\\0'.replaceAll('\\\\n','\\n').replaceAll('\\\\0','\\0')}); this.onmessage?.(e); this.dispatchEvent(e); },5); }
      close() { this.readyState=3; const e=new Event('close'); this.onclose?.(e); this.dispatchEvent(e); }
    };
  `;
  bootScript = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: setup })).identifier;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: width < 600 ? 844 : 1000, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp.send('Page.navigate', { url: origin + route });
  await cdp.wait(`window.__checkoutBoot === ${bootSequence}`);
  await cdp.wait('Boolean(document.querySelector("h1"))');
}

try {
  server = await preview({ root, configFile: path.join(root, 'vite.config.js'), preview: { host: '127.0.0.1', port, strictPort: true } });
  const executable = process.env.CHECKOUT_EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  edge = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(artifacts, 'profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let pages;
  for (let attempt = 0; attempt < 80; attempt++) { try { pages = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); if (pages.some(page => page.type === 'page')) break; } catch { /* Browser starting. */ } await delay(100); }
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  cdp = new CDP(socket);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: 'http://localhost:8080/*' }, { urlPattern: 'https://sandbox.vnpayment.vn/*' }] });
  cdp.on('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.exception?.description ?? event.exceptionDetails.text));
  cdp.on('Fetch.requestPaused', event => { void intercept(cdp, event).catch(error => { exceptions.push(error.stack); }); });

  reset(); await boot(cdp, { authenticated: false });
  await cdp.wait(`document.body.textContent.includes('Đăng nhập để tiếp tục')`);
  assert.equal(scenario.get, 0); results.push('guest gate: no private booking request');

  reset(); await boot(cdp);
  await cdp.wait(`Boolean(document.querySelector('button[aria-label="Tăng Combo Một"]'))`);
  const countdown = await cdp.evaluate(`document.querySelector('output[aria-label="Thời gian giữ ghế còn lại"]').textContent`);
  assert.match(countdown, /^(10:00|09:5\d)$/); // Page clock is deliberately +24 hours.
  await cdp.click('Thanh toán ngay'); await cdp.wait(`location.hostname === 'sandbox.vnpayment.vn'`);
  assert.equal(scenario.put, 1); assert.equal(scenario.pay, 1); results.push('desktop: server countdown despite clock skew, empty combo, PUT then redirect');

  reset({ reprice: true }); await boot(cdp, { width: 390 });
  await cdp.wait(`Boolean(document.querySelector('button[aria-label="Tăng Combo Một"]'))`);
  await cdp.evaluate(`document.querySelector('button[aria-label="Tăng Combo Một"]').click()`);
  await cdp.click('Thanh toán ngay'); await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`);
  assert.equal(scenario.pay, 0); assert.equal(scenario.cart[0].quantity, 1);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await writeFile(path.join(artifacts, 'checkout-mobile.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'));
  await cdp.click('Quay lại'); assert.equal(scenario.pay, 0);
  await cdp.click('Thanh toán ngay'); await cdp.wait(`location.hostname === 'sandbox.vnpayment.vn'`);
  assert.equal(scenario.pay, 1); results.push('mobile: quantity, changed-price confirmation, decline/edit, no overflow, redirect');

  reset({ catalogError: true }); await boot(cdp);
  await cdp.wait(`document.body.textContent.includes('Chưa tải được danh mục combo')`);
  assert.equal(await cdp.evaluate(`[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('Thanh toán ngay')).every(b=>b.disabled)`), true);
  assert.equal(scenario.put, 0); scenario.catalogError = false; await cdp.click('Thử lại danh mục');
  await cdp.wait(`Boolean(document.querySelector('button[aria-label="Tăng Combo Một"]'))`); results.push('catalog error blocks new payment and retry restores catalog');

  reset(); await boot(cdp);
  await cdp.wait(`Boolean(document.querySelector('button[aria-label="Tăng Combo Một"]'))`);
  await cdp.evaluate(`document.querySelector('button[aria-label="Tăng Combo Một"]').click()`);
  scenario.revision = 'f'.repeat(64);
  scenario.cart = [{ productId: 1, productName: 'Combo Một', quantity: 2, unitPrice: 30000, subtotal: 60000 }];
  await cdp.click('Thanh toán ngay'); await cdp.wait(`document.body.textContent.includes('Tải lại lựa chọn đã lưu')`);
  assert.equal(scenario.pay, 0); await cdp.click('Tải lại lựa chọn');
  await cdp.click('Thanh toán ngay'); await cdp.wait(`location.hostname === 'sandbox.vnpayment.vn'`);
  assert.equal(scenario.pay, 1); assert.equal(scenario.cart[0].quantity, 2); results.push('409 from another tab requires explicit reload before payment');

  reset({ unavailableOnPut: true }); await boot(cdp);
  await cdp.wait(`Boolean(document.querySelector('button[aria-label="Tăng Combo Một"]'))`);
  await cdp.evaluate(`document.querySelector('button[aria-label="Tăng Combo Một"]').click()`);
  await cdp.click('Thanh toán ngay'); await cdp.wait(`document.body.textContent.includes('Combo đã ngừng bán. Vui lòng bỏ khỏi đơn.')`);
  assert.equal(scenario.pay, 0);
  await cdp.evaluate(`document.querySelector('button[aria-label="Giảm Combo Một"]').click()`);
  await cdp.click('Thanh toán ngay'); await cdp.wait(`location.hostname === 'sandbox.vnpayment.vn'`);
  assert.equal(scenario.pay, 1); assert.equal(scenario.cart.length, 0); results.push('combo withdrawn after selection remains visible for removal, never silently dropped');

  reset({ payMode: 'unknown' }); await boot(cdp);
  await cdp.wait(`Boolean(document.querySelector('button[aria-label="Tăng Combo Một"]'))`);
  await cdp.click('Thanh toán ngay'); await cdp.wait(`document.body.textContent.includes('Chưa xác định được kết quả kết nối')`);
  await cdp.click('Kiểm tra trạng thái'); assert.equal(scenario.pay, 1);
  await cdp.click('Hủy giữ ghế để chọn lại'); await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog').textContent.includes('không hủy giao dịch tại cổng')`), true);
  await cdp.click('Quay lại'); results.push('UNKNOWN: one POST, status check only, state-aware cancellation warning');

  reset({ payMode: 'lost-response' }); await boot(cdp);
  await cdp.wait(`Boolean(document.querySelector('button[aria-label="Tăng Combo Một"]'))`);
  await cdp.click('Thanh toán ngay'); await cdp.wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Tiếp tục thanh toán')&&!b.disabled)`);
  assert.equal(scenario.pay, 1); const oldPut = scenario.put;
  await cdp.click('Tiếp tục thanh toán'); await cdp.wait(`location.hostname === 'sandbox.vnpayment.vn'`);
  assert.equal(scenario.pay, 1); assert.equal(scenario.put, oldPut); results.push('lost creation response: GET recovers READY, resume without another PUT/POST');

  reset({ cancelError: true }); await boot(cdp);
  await cdp.wait(`Boolean(document.querySelector('button[aria-label="Tăng Combo Một"]'))`);
  await cdp.click('Hủy giữ ghế để chọn lại'); await cdp.click('Vẫn hủy giữ ghế');
  await cdp.wait(`!document.querySelector('dialog[open]')`); assert.equal(await cdp.evaluate('location.pathname'), `/checkout/${code}`);
  scenario.cancelError = false; await cdp.click('Hủy giữ ghế để chọn lại'); await cdp.click('Vẫn hủy giữ ghế');
  await cdp.wait(`location.pathname === '/booking/5950'`); assert.equal(scenario.cancel, 2); results.push('cancel failure stays on checkout, successful retry returns to seats');

  reset({ deadline: Date.now() + 1800 }); await boot(cdp);
  await cdp.wait(`document.body.textContent.includes('Hết thời gian giữ vé')`);
  assert.equal(scenario.pay, 0); assert.ok(scenario.get >= 2); results.push('expiry rechecks server and disables new payment');

  reset({ forbidden: true }); await boot(cdp);
  await cdp.wait(`document.body.textContent.includes('Không thể truy cập đơn này')`);
  assert.equal(await cdp.evaluate(`document.body.textContent.includes('Buổi Chiếu Mùa Thu')`), false); results.push('403 never exposes booking details');

  reset(); await boot(cdp, { route: '/booking/5950' });
  await cdp.wait(`Boolean(document.querySelector('button[aria-label^="A1 -"]'))`);
  await cdp.evaluate(`document.querySelector('button[aria-label^="A1 -"]').click()`); await cdp.click('Tiếp tục');
  await cdp.wait(`location.pathname === '/checkout/${code}'`); results.push('seat Continue creates hold and navigates using returned bookingCode');

  reset(); await boot(cdp);
  await cdp.wait(`Boolean(document.querySelector('button[aria-label="Tăng Combo Một"]'))`);
  await writeFile(path.join(artifacts, 'checkout-desktop.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'));

  const callback = '/payment/vnpay-callback?' + new URLSearchParams({ vnp_TxnRef: 'a'.repeat(32), vnp_SecureHash: 'b'.repeat(128),
    vnp_TmnCode: 'TEST0001', vnp_Amount: '8000000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_OrderInfo: 'Thanh toan ve BKTEST' });
  reset(); await boot(cdp, { route: callback, authenticated: false });
  await cdp.wait(`document.body.textContent.includes('Đăng nhập để xem kết quả thanh toán')`);
  assert.equal(scenario.resultChecks ?? 0, 0); results.push('VNPay return: guest gate avoids private requests');

  reset(); await boot(cdp, { route: callback, width: 390 });
  await cdp.wait(`document.body.textContent.includes('VNPay đã ghi nhận thanh toán')`);
  assert.equal(await cdp.evaluate(`document.body.textContent.includes('Đặt vé thành công')`), false);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await writeFile(path.join(artifacts, 'vnpay-return-pending-mobile.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'));
  scenario.status = 'CONFIRMED'; scenario.paymentStatus = 'SUCCESS';
  await cdp.wait(`document.body.textContent.includes('Đặt vé thành công')`);
  const checks = scenario.resultChecks; await delay(3400); assert.equal(scenario.resultChecks, checks);
  assert.equal(scenario.pay, 0); assert.equal(scenario.cancel, 0);
  results.push('VNPay return: verified success waits for IPN, polling confirms then stops, no payment mutation');

  reset({ status: 'CONFIRMED', paymentStatus: 'SUCCESS' }); await boot(cdp, { route: callback });
  await cdp.wait(`document.body.textContent.includes('Đặt vé thành công')`);
  await writeFile(path.join(artifacts, 'vnpay-return-success-desktop.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'));
  results.push('VNPay return: direct reload restores confirmed receipt without sessionStorage');

  reset({ returnCode: '24' }); await boot(cdp, { route: callback });
  await cdp.wait(`document.body.textContent.includes('Bạn đã hủy thanh toán tại VNPay')`);
  assert.equal(scenario.cancel, 0); results.push('VNPay return: cancellation is distinct from cancelling seat hold');

  for (const resultError of [400, 403]) {
    reset({ resultError }); await boot(cdp, { route: callback });
    await cdp.wait(`document.body.textContent.includes('${resultError === 403 ? 'Không thể xem giao dịch này' : 'Chưa xác minh được kết quả thanh toán'}')`);
    assert.equal(await cdp.evaluate(`document.body.textContent.includes('Buổi Chiếu Mùa Thu')`), false);
  }
  results.push('VNPay return: invalid signature or wrong account never exposes receipt or success');

  reset(); await boot(cdp, { route: '/payment/vnpay-callback?vnp_ResponseCode=00' });
  await cdp.wait(`document.body.textContent.includes('Đường dẫn kết quả không hợp lệ')`);
  assert.equal(scenario.resultChecks ?? 0, 0); results.push('VNPay return: incomplete URL renders an error rather than a blank route');
  assert.deepEqual(exceptions, []);
  console.log(JSON.stringify({ passed: results, runtimeExceptions: exceptions.length, artifacts, mockRequests: requests.length }, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ results, scenario, requests, exceptions,
    location: await cdp?.evaluate('location.href'), body: await cdp?.evaluate('document.body.innerText') }, null, 2));
  console.error(`Browser check failed; diagnostics: ${path.join(artifacts, 'failure.json')}`);
  throw error;
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  edge?.kill();
  await server?.close();
}
