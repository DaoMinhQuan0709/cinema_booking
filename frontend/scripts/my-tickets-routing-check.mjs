// Mục 1–6: bản production với API mô phỏng; không đọc/ghi backend thật.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { delay, startEdgeBrowser } from './lib/edge-browser.mjs';
import { ticketHistory, ticketDetail } from './fixtures/tickets.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const origin = 'http://127.0.0.1:4210';
const artifacts = await mkdtemp(path.join(tmpdir(), 'cinema-tickets-routing-'));
const code = 'BK20261109130000ABCD';
const list = '/profile/bookings';
const detail = `${list}/${code}?ref=direct#ticket`;
const customer = { id: 100, role: 'USER', fullName: 'Khách A', email: 'a@example.invalid' };
const otherCustomer = { ...customer, id: 101, fullName: 'Khách B', email: 'b@example.invalid' };
const passed = [], exceptions = [], requests = [];
let browser, cdp, sequence = 0, scenario;

const includes = text => `document.querySelector('main')?.textContent.includes(${JSON.stringify(text)})`;
const heading = text => `document.querySelector('main h1')?.textContent === ${JSON.stringify(text)}`;
const listReady = `${heading('Vé của tôi.')} && Boolean(document.querySelector('main article'))`;
const detailReady = `${heading('Đơn đặt vé')} && Boolean(document.querySelector('#ticket-showtime'))`;
const guestReady = heading('Đăng nhập để xem vé');
const qrReady = `Boolean(document.querySelector('[aria-labelledby="ticket-qr"] img')?.naturalWidth)`;
const fixturePng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function sessionSource(user, sessionId) {
  return `localStorage.clear(); ${user ? `
    localStorage.setItem('premier_cinema_access_token', ${JSON.stringify(sessionId)});
    localStorage.setItem('premier_cinema_refresh_token', 'mock-refresh');
    localStorage.setItem('premier_cinema_session_id', ${JSON.stringify(sessionId)});
    localStorage.setItem('premier_cinema_user', ${JSON.stringify(JSON.stringify(user))});
  ` : ''}`;
}

async function reply(requestId, status, data) {
  await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
    ], body: Buffer.from(JSON.stringify({ code: status, message: 'Mock response', data })).toString('base64'),
  });
}

async function intercept({ request, requestId }) {
  if (request.method === 'OPTIONS') return reply(requestId, 200, null);
  const route = new URL(request.url).pathname.replace('/api/v1', '');
  requests.push({ route, method: request.method, bearer: request.headers.Authorization });
  if (route === '/users/me') {
    scenario.me++;
    if (scenario.holdMe) {
      scenario.held.push({ requestId, status: scenario.status, user: scenario.user, bearer: request.headers.Authorization });
      return;
    }
    if (scenario.status === 200) scenario.verified.add(request.headers.Authorization);
    return reply(requestId, scenario.status, scenario.user);
  }
  if (route === '/users/me/bookings' || /^\/bookings\/BK[a-zA-Z0-9]{18}$/.test(route)) {
    assert.equal(request.method, 'GET', 'Trang vé chỉ đọc dữ liệu');
    assert.ok(scenario.verified.has(request.headers.Authorization), 'Phải xác minh phiên trước khi đọc vé');
    if (scenario.holdTickets) {
      scenario.heldTickets.push({ requestId, route, data: route === '/users/me/bookings' ? scenario.history : { ...ticketDetail(route.split('/').at(-1)), ...scenario.detailOverrides } });
      return;
    }
    if (route === '/users/me/bookings') return reply(requestId, scenario.historyStatus || 200, scenario.history);
    return reply(requestId, scenario.detailStatus || 200, { ...ticketDetail(route.split('/').at(-1)), ...scenario.detailOverrides });
  }
  if (/^\/bookings\/BK[a-zA-Z0-9]{18}\/qr$/.test(route)) {
    assert.equal(request.method, 'GET', 'Mã QR chỉ được đọc qua GET');
    assert.ok(scenario.verified.has(request.headers.Authorization), 'Phải xác minh phiên trước khi đọc mã QR');
    if (scenario.holdQr) { scenario.heldQr.push(requestId); return; }
    const qrStatus = scenario.qrStatus || 200;
    if (qrStatus === 200) {
      await cdp.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'Content-Type', value: 'image/png' },
          { name: 'Cache-Control', value: 'no-store' },
          { name: 'Access-Control-Allow-Origin', value: origin },
          { name: 'Access-Control-Allow-Credentials', value: 'true' },
          { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept' },
          { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
        ],
        body: scenario.invalidPng ? Buffer.from('not a png').toString('base64') : fixturePng,
      });
      return;
    }
    return reply(requestId, qrStatus, null);
  }
  if (route === '/products' && scenario.allowCheckout) return reply(requestId, 200, []);
  if (route === '/payments/vnpay-return' && scenario.paymentFlow) {
    assert.equal(request.method, 'POST');
    scenario.paymentReads++;
    const paid = scenario.paymentConfirmed;
    return reply(requestId, 200, { booking: { ...ticketDetail(ticketHistory[1].bookingCode), status: paid ? 'CONFIRMED' : 'PENDING' },
      paymentStatus: paid ? 'SUCCESS' : 'PENDING', attemptStatus: paid ? 'SUCCESS' : 'PENDING', gatewayResponseCode: '00', gatewayTransactionStatus: '00' });
  }
  if (route === '/auth/login') return reply(requestId, 200, {
    accessToken: 'login-token', refreshToken: 'login-refresh', user: scenario.user,
  });
  if (route === '/auth/refresh') return reply(requestId, 401, null);
  throw new Error(`API ngoài phạm vi kiểm tra vé: ${route}`);
}

async function boot({ user = customer, route = list, width = 1440, ...options } = {}) {
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await cdp.wait('location.href === "about:blank"');
  scenario = { user, status: 200, holdMe: false, holdTickets: false, me: 0, held: [], heldTickets: [], heldQr: [], paymentReads: 0, history: ticketHistory, verified: new Set(), ...options };
  const marker = ++sequence;
  const script = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (location.origin === ${JSON.stringify(origin)}) {
      ${sessionSource(user, `boot-${marker}`)} window.__ticketsBoot = ${marker};
      window.__urlsCreated = []; window.__urlsRevoked = [];
      const createUrl = URL.createObjectURL.bind(URL), revokeUrl = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => { const url = createUrl(blob); window.__urlsCreated.push(url); return url; };
      URL.revokeObjectURL = url => { window.__urlsRevoked.push(url); revokeUrl(url); };
      ${options.fastPolling ? `const interval = window.setInterval.bind(window);
        window.setInterval = (callback, ms, ...args) => interval(callback, ms === 30000 ? 300 : ms, ...args);` : ''}
    }`,
  });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp.send('Page.navigate', { url: origin + route });
  await cdp.wait(`window.__ticketsBoot === ${marker} && Boolean(document.querySelector('main'))`);
  await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.identifier });
}

async function waitHeld() {
  const deadline = Date.now() + 10000;
  while (!scenario.held.length) {
    assert.ok(Date.now() < deadline, 'GET /users/me must be held');
    await delay(50);
  }
}

async function release() {
  const held = scenario.held.shift();
  assert.ok(held);
  if (held.status === 200) scenario.verified.add(held.bearer);
  await reply(held.requestId, held.status, held.user);
}

async function waitHeldTickets(count = 1) {
  const deadline = Date.now() + 10000;
  while (scenario.heldTickets.length < count) {
    assert.ok(Date.now() < deadline, 'GET /users/me/bookings must be held');
    await delay(50);
  }
}

async function releaseHeldTicket(overrideData) {
  const held = scenario.heldTickets.shift();
  assert.ok(held);
  const data = overrideData !== undefined ? overrideData : held.data;
  await reply(held.requestId, 200, data);
}

async function releaseLateTicket() {
  const held = scenario.heldTickets.shift();
  try { await reply(held.requestId, 200, held.data); }
  catch (error) {
    // An aborted Fetch interception cannot be fulfilled in Chromium.
    if (!error.message.includes('Invalid InterceptionId')) throw error;
  }
}

async function reload(ready) {
  // Wait for a new document, not the previous DOM after Page.reload returns.
  await cdp.evaluate('window.__beforeTicketsReload = true');
  await cdp.send('Page.reload');
  await cdp.wait(`!window.__beforeTicketsReload && (${ready})`);
}

async function assertShell() {
  assert.deepEqual(await cdp.evaluate(`[
    document.querySelectorAll('#root > div > header').length,
    document.querySelectorAll('main').length,
    document.querySelectorAll('footer').length,
    document.querySelectorAll('main h1').length
  ]`), [1, 1, 1, 1]);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await cdp.evaluate(`document.querySelector('header nav a[href="${list}"]')?.getAttribute('aria-current')`), 'page');
}

async function switchSession(user) {
  scenario.user = user;
  await cdp.evaluate(`(() => { ${sessionSource(user, `switched-${++sequence}`)}
    dispatchEvent(new StorageEvent('storage', { key: 'premier_cinema_session_id', storageArea: localStorage }));
  })()`);
}

async function login() {
  await cdp.wait(`Boolean(document.querySelector('form input[name="email"]'))`);
  for (const [name, value] of [['email', scenario.user.email], ['password', 'mock-password']]) {
    await cdp.evaluate(`(() => {
      const input = document.querySelector('form input[name="${name}"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
  }
  await cdp.evaluate(`document.querySelector('form button[type="submit"]').click()`);
}

async function chooseFilter(label) {
  await cdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('main [role="group"] button')].find(item => item.textContent.startsWith(${JSON.stringify(label)}));
    button.focus(); button.click();
  })()`);
}

async function screenshot(name) {
  await writeFile(path.join(artifacts, name), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).data, 'base64'));
}

async function checkTicketData() {
  const start = requests.length;
  await boot({ route: `${list}?ref=history#tickets` }); await cdp.wait(listReady);
  assert.deepEqual(await cdp.evaluate(`[...document.querySelectorAll('main article h2')].map(item => item.textContent)`), ticketHistory.map(item => item.movieTitle));
  assert.deepEqual(await cdp.evaluate(`[...document.querySelectorAll('main [role="group"] button span')].map(item => item.textContent)`), ['4', '1', '1', '1', '1']);
  assert.equal(requests.slice(start).filter(item => item.route.startsWith('/bookings/')).length, 0);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('main img, main a[href^="/checkout/"]').length`), 1, 'Chỉ một đơn pending có CTA, không có poster/QR');
  assert.equal(await cdp.evaluate(`document.querySelector('main').textContent.includes('Ghế đã đặt')`), false);
  for (const [index, label] of ['Đã xác nhận', 'Chờ thanh toán', 'Đã hủy', 'Hết hạn'].entries()) {
    await chooseFilter(label);
    await cdp.wait(`document.querySelectorAll('main article').length === 1 && document.querySelector('main article h2').textContent === ${JSON.stringify(ticketHistory[index].movieTitle)}`);
    assert.equal(await cdp.evaluate(`document.querySelector('main [aria-pressed="true"]').textContent`), `${label}1`);
  }
  assert.equal(requests.slice(start).filter(item => item.route === '/users/me/bookings').length, 1, 'Lọc không gọi lại API');
  await cdp.evaluate('history.back()'); await cdp.wait(`location.search.includes('CANCELLED')`);
  await cdp.evaluate('history.forward()'); await cdp.wait(`location.search.includes('EXPIRED')`);
  passed.push('Bốn trạng thái/đếm/lọc giữ thứ tự API, không poster/ghế hay N+1, Back/Forward đúng bộ lọc');

  await chooseFilter('Chờ thanh toán');
  await cdp.wait(`location.search.includes('PENDING')`);
  const filteredUrl = await cdp.evaluate('location.pathname + location.search + location.hash');
  await cdp.evaluate(`document.querySelector('main article a[href^="/profile/bookings/"]').click()`); await cdp.wait(detailReady);
  assert.equal(await cdp.evaluate(`document.querySelector('#ticket-showtime').textContent`), 'Interstellar');
  assert.equal(await cdp.evaluate(includes('Đơn này không có bắp nước hoặc combo.')), true);
  assert.equal(await cdp.evaluate(includes('Hạn giữ chỗ')), true);
  await reload(detailReady);
  await cdp.evaluate(`document.querySelector('main a[href^="/profile/bookings?"]').click()`); await cdp.wait(listReady);
  assert.equal(await cdp.evaluate('location.pathname + location.search + location.hash'), filteredUrl);
  await reload(listReady);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('main article').length`), 1);
  passed.push('Chi tiết không combo; reload chi tiết và về danh sách giữ status/ref/hash; reload bộ lọc');

  for (const width of [390, 768, 1440]) {
    await boot({ width }); await cdp.wait(listReady); await assertShell(); await screenshot(`tickets-list-${width}.png`);
    await cdp.evaluate(`document.querySelector('main article a[href^="/profile/bookings/"]').click()`); await cdp.wait(detailReady); await assertShell();
    assert.equal(await cdp.evaluate(includes('D7')), true);
    assert.equal(await cdp.evaluate(includes('Combo đôi')), true);
    assert.equal(await cdp.evaluate(includes('60.000')), true);
    assert.equal(await cdp.evaluate(`document.querySelectorAll('main a[href^="/checkout/"]').length`), 0);
    await screenshot(`tickets-detail-${width}.png`);
    passed.push(`Danh sách/chi tiết ghế, combo, tiền và bố cục không tràn ngang ${width}px`);
  }

  await boot({ route: `${list}?status=invalid&ref=keep` }); await cdp.wait(listReady);
  await cdp.wait(`location.search === '?ref=keep'`);
  await chooseFilter('Đã xác nhận'); await cdp.evaluate('history.back()');
  await cdp.wait(`location.search === '?ref=keep'`);
  await boot({ route: `${list}?status=PENDING&status=EXPIRED` }); await cdp.wait(listReady);
  await cdp.wait(`location.search === '?status=PENDING'`);
  passed.push('URL status sai được replace; trùng lấy giá trị đầu, giữ query khác');

  await boot({ history: [] }); await cdp.wait(includes('Bạn chưa có đơn đặt vé nào'));
  assert.equal(await cdp.evaluate(`document.querySelector('main a[href="/movies"]').textContent`), 'Khám phá phim');
  await boot({ history: [ticketHistory[0]], route: `${list}?status=EXPIRED` }); await cdp.wait(includes('Chưa có vé ở trạng thái này'));
  await cdp.click('Xem tất cả vé'); await cdp.wait(listReady);
  passed.push('Phân biệt danh sách rỗng với bộ lọc không có kết quả');

  await boot({ history: [{ bookingCode: code, status: 'UNKNOWN' }] }); await cdp.wait(listReady);
  assert.equal(await cdp.evaluate(includes('Chưa cập nhật')), true);
  assert.equal(await cdp.evaluate(includes('Chưa xác định')), true);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('main a[href^="/checkout/"]').length`), 0);
  await boot({ route: detail, detailOverrides: { status: 'UNKNOWN', showtime: null, seats: null, products: null, totalAmount: null, createdAt: null } });
  await cdp.wait(detailReady); assert.equal(await cdp.evaluate(includes('Chưa có thông tin ghế')), true);
  assert.equal(await cdp.evaluate(includes('Chưa có thông tin bắp nước')), true);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('main a[href^="/checkout/"]').length`), 0);
  passed.push('Dữ liệu thiếu có fallback, không bịa giá/ghế/combo; trạng thái lạ không cho thanh toán');

  await boot({ history: {} }); await cdp.wait(includes('Không thể tải thông tin vé'));
  scenario.history = ticketHistory; await cdp.click('Thử lại'); await cdp.wait(listReady);
  for (const detailStatus of [403, 404]) {
    await boot({ route: detail, detailStatus });
    await cdp.wait(includes(detailStatus === 403 ? 'Bạn không có quyền xem' : 'Không tìm thấy đơn'));
    assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main a[href="${list}"]'))`), true);
  }
  passed.push('Payload danh sách sai không giả làm rỗng; retry và lỗi chi tiết 403/404 có lối về');

  // Mục 4: Skeleton khi loading và lỗi làm mới giữ dữ liệu cũ kèm cảnh báo
  await boot({ holdTickets: true });
  await cdp.wait('Boolean(document.querySelector(\'main [role="status"][aria-label*="Đang tải"]\'))');
  assert.equal(await cdp.evaluate('Boolean(document.querySelector("main .animate-pulse"))'), true);
  await releaseHeldTicket();
  scenario.holdTickets = false;
  await cdp.wait(listReady);
  scenario.historyStatus = 500;
  await cdp.click('Làm mới');
  await cdp.wait(includes('Chưa làm mới được dữ liệu'));
  assert.equal(await cdp.evaluate('document.querySelectorAll("main article").length'), ticketHistory.length);
  scenario.historyStatus = 200;
  await cdp.click('Thử lại');
  await cdp.wait(`!document.querySelector('main').textContent.includes('Chưa làm mới được dữ liệu')`);
  assert.equal(await cdp.evaluate('document.querySelectorAll("main article").length'), ticketHistory.length);
  passed.push('Skeleton hiển thị khi loading; lỗi làm mới giữ dữ liệu cũ kèm cảnh báo, Thử lại xóa cảnh báo');

  await boot({ allowCheckout: true }); await cdp.wait(listReady);
  await cdp.evaluate(`document.querySelector('main a[href^="/checkout/"]').click()`);
  await cdp.wait(`location.pathname === '/checkout/${ticketHistory[1].bookingCode}' && document.querySelector('main').textContent.includes('Interstellar')`);
  assert.ok(requests.slice(start).every(item => item.method === 'GET'));
  assert.equal(await cdp.evaluate(`document.querySelectorAll('main a[href*="/qr"]').length`), 0);
  passed.push('Tiếp tục đơn mở checkout hiện có; trang vé chỉ GET, không tự tạo giao dịch');
}

/**
 * Mục 3: kiểm chứng cách ly dữ liệu giữa các phiên.
 * Các ca: đổi tài khoản khi request vé đang chờ, phản hồi đến muộn, logout và đăng nhập lại.
 */
async function checkSessionIsolation() {
  const historyA = ticketHistory.map(item => ({ ...item, movieTitle: `[A] ${item.movieTitle}` }));
  const historyB = ticketHistory.map(item => ({ ...item, movieTitle: `[B] ${item.movieTitle}` }));

  // --- Ca 1: đổi tài khoản trong khi request danh sách vé đang chờ phản hồi ---
  // Mô phỏng: A đã xác minh, request /users/me/bookings đang bị giữ,
  // sau đó B đăng nhập từ tab khác (storage event). Guard kích hoạt xác minh B (cũng bị giữ).
  // Ta nhả ticket-A (abort), xác minh B xong, nhả ticket-B → chỉ dữ liệu B được hiển thị.
  await boot({ history: historyA, holdTickets: true });
  await cdp.wait(heading('Vé của tôi.')); // header h1 đã render, vé chưa về vì holdTickets
  await waitHeldTickets(1); // request danh sách của A đang bị giữ
  // Bật holdMe TRƯỚC khi đổi phiên để /users/me của B cũng bị giữ
  scenario.holdMe = true;
  scenario.history = historyB;
  await switchSession(otherCustomer);
  await waitHeld(); // chờ /users/me của B bị giữ
  // Nhả (abort) response ticket của A — đến muộn sau khi phiên đã đổi
  if (scenario.heldTickets.length) await releaseLateTicket();
  // Xác minh B xong; B sẽ gửi request danh sách mới
  await release();
  await waitHeldTickets(1); // request danh sách của B đang bị giữ
  scenario.holdTickets = false;
  await releaseHeldTicket(historyB); // trả dữ liệu B
  await cdp.wait(listReady);
  // Dữ liệu hiển thị phải là của B, không phải A
  const titlesShown = await cdp.evaluate(`[...document.querySelectorAll('main article h2')].map(e => e.textContent)`);
  assert.ok(titlesShown.every(t => t.startsWith('[B]')), `Phải hiển thị vé của B, không phải A: ${JSON.stringify(titlesShown)}`);
  assert.ok(!titlesShown.some(t => t.startsWith('[A]')), 'Dữ liệu A không được lọt vào trang B');
  passed.push('Đổi tài khoản khi request vé đang chờ: dữ liệu A bị bỏ, hiển thị đúng dữ liệu B');

  // --- Ca 2: phản hồi vé đến muộn sau khi đăng xuất → không hiển thị ---
  // Đăng xuất qua storage event không cần xác minh lại → không cần holdMe.
  await boot({ history: historyA, holdTickets: true });
  await cdp.wait(heading('Vé của tôi.'));
  await waitHeldTickets(1); // request đang bay
  // Đăng xuất (mô phỏng qua storage event xóa localStorage)
  await switchSession(null);
  await cdp.wait(guestReady); // guard chuyển về màn guest
  // Fail/abort response danh sách cũ của A về sau khi đã logout
  if (scenario.heldTickets.length) await releaseLateTicket();
  // Chờ để đảm bảo không có state update nào từ response muộn
  await delay(300);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main article'))`), false, 'Không hiển thị vé sau logout');
  assert.equal(await cdp.evaluate(heading('Đăng nhập để xem vé')), true, 'Phải ở màn guest sau logout');
  passed.push('Phản hồi vé đến muộn sau logout không làm lộ dữ liệu cũ');

  // --- Ca 3: đăng xuất và đăng nhập lại cùng tài khoản → tải dữ liệu mới (không cache cũ) ---
  const historyV1 = ticketHistory.slice(0, 2);
  const historyV2 = ticketHistory.slice(0, 3); // Lần 2 có 3 đơn → nếu dùng cache cũ sẽ chỉ thấy 2
  await boot({ history: historyV1 });
  await cdp.wait(listReady);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('main article').length`), 2, 'Lần đầu: 2 vé');
  // Logout qua storage event
  await switchSession(null);
  await cdp.wait(guestReady);
  // Đăng nhập lại cùng tài khoản; bật holdMe để kiểm soát thời điểm xác minh
  scenario.history = historyV2;
  scenario.holdMe = true;
  await switchSession(customer);
  await waitHeld();
  await release(); // xác minh xong → query sẽ chạy với sessionId mới
  await cdp.wait(listReady);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('main article').length`), 3, 'Đăng nhập lại: phải tải mới, 3 vé từ API mới');
  passed.push('Đăng xuất và đăng nhập lại cùng tài khoản: cache bị xóa, tải dữ liệu mới từ API');
}

/**
 * Mục 5: kiểm tra bảo vệ API QR và hiển thị giao diện mã vé.
 * Các ca:
 * 1. Đơn CONFIRMED: tải và hiển thị mã QR blob, có nút tải file PNG.
 * 2. Đơn PENDING: không gọi API QR, hiển thị văn bản hướng dẫn.
 * 3. Lỗi 403 Forbidden: thông báo không có quyền, nút Thử lại tải lại thành công.
 * 4. Lỗi 409 Conflict: thông báo đơn chưa xác nhận, mã QR chưa khả dụng.
 * 5. Điều hướng rời trang chi tiết: tự động thu hồi (revokeObjectURL) blob URL mã QR.
 */
async function checkTicketQr() {
  const start = requests.length;

  // Ca QR-1: Đơn CONFIRMED tải và hiển thị mã QR, có nút tải PNG
  await boot({ route: detail });
  await cdp.wait(detailReady);
  await cdp.wait('Boolean(document.querySelector("section[aria-labelledby=\\"ticket-qr\\"] img"))');
  const qrImgSrc = await cdp.evaluate('document.querySelector("section[aria-labelledby=\\"ticket-qr\\"] img")?.src');
  assert.ok(qrImgSrc?.startsWith('blob:'), 'Mã QR phải là blob URL');
  assert.equal(await cdp.evaluate('Boolean(document.querySelector("section[aria-labelledby=\\"ticket-qr\\"] a[download]"))'), true);
  assert.equal(requests.slice(start).some(item => item.route.endsWith('/qr')), true, 'Đơn CONFIRMED phải gọi API QR');
  passed.push('Đơn CONFIRMED: tải và hiển thị mã QR blob an toàn, có nút tải file PNG');

  // Ca QR-2: Đơn PENDING không gọi API QR, hiển thị văn bản hướng dẫn
  const pendingCode = ticketHistory[1].bookingCode;
  const qrStartPending = requests.length;
  await boot({ route: `${list}/${pendingCode}` });
  await cdp.wait(detailReady);
  assert.equal(await cdp.evaluate('Boolean(document.querySelector("section[aria-labelledby=\\"ticket-qr\\"] img"))'), false);
  assert.equal(await cdp.evaluate(includes('Đơn đang chờ thanh toán. Mã vé chỉ dành cho đơn đã xác nhận.')), true);
  assert.equal(requests.slice(qrStartPending).some(item => item.route.endsWith('/qr')), false, 'Đơn PENDING tuyệt đối không gọi API QR');
  passed.push('Đơn PENDING: không gọi API QR, hiển thị thông báo chờ thanh toán');

  // Ca QR-3: Lỗi 403 Forbidden khi tải QR và Thử lại thành công
  await boot({ route: detail, qrStatus: 403 });
  await cdp.wait(detailReady);
  await cdp.wait(includes('Bạn không có quyền xem mã QR này.'));
  assert.equal(await cdp.evaluate('Boolean(document.querySelector("section[aria-labelledby=\\"ticket-qr\\"] img"))'), false);
  scenario.qrStatus = 200;
  await cdp.evaluate(`(() => {
    const btn = [...document.querySelectorAll('section[aria-labelledby="ticket-qr"] button')].find(b => b.textContent.includes('Thử lại'));
    btn?.click();
  })()`);
  await cdp.wait('Boolean(document.querySelector("section[aria-labelledby=\\"ticket-qr\\"] img"))');
  passed.push('Lỗi 403: thông báo không có quyền xem mã QR, nút Thử lại tải lại thành công');

  // Ca QR-4: Lỗi 409 Conflict khi tải QR
  await boot({ route: detail, qrStatus: 409 });
  await cdp.wait(detailReady);
  await cdp.wait(includes('Đơn chưa được xác nhận. Mã QR chưa khả dụng.'));
  passed.push('Lỗi 409: thông báo đơn chưa được xác nhận, mã QR chưa khả dụng');

  // Ca QR-5: Thu hồi (revoke) blob URL khi rời trang để chống rò rỉ bộ nhớ
  await boot({ route: detail });
  await cdp.wait('Boolean(document.querySelector("section[aria-labelledby=\\"ticket-qr\\"] img"))');
  await cdp.evaluate(`(() => {
    window.__revoked = [];
    const origRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = function(url) {
      window.__revoked.push(url);
      origRevoke.call(URL, url);
    };
  })()`);
  await cdp.evaluate(`document.querySelector('main a[href^="/profile/bookings"]').click()`);
  await cdp.wait(listReady);
  const revokedCount = await cdp.evaluate('window.__revoked?.length || 0');
  assert.ok(revokedCount > 0, 'Object URL phải được revoke khi rời trang chi tiết');
  passed.push('Rời trang chi tiết vé: tự động thu hồi (revokeObjectURL) blob URL mã QR');
}

async function assertUrlsReleased() {
  await cdp.wait('window.__urlsCreated.every(url => window.__urlsRevoked.includes(url))');
  assert.equal(await cdp.evaluate('window.__urlsCreated.length === window.__urlsRevoked.length'), true);
}

async function checkFinalAcceptance() {
  // Actual PNG decode + download via the browser, rather than only checking an <a> attribute.
  await boot({ route: detail }); await cdp.wait(qrReady);
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: artifacts });
  await cdp.evaluate(`document.querySelector('[aria-labelledby="ticket-qr"] a[download]').click()`);
  const filename = `ticket-${code}.png`;
  const deadline = Date.now() + 10000;
  while (!(await readdir(artifacts)).includes(filename)) {
    assert.ok(Date.now() < deadline, 'PNG download must finish'); await delay(60);
  }
  assert.deepEqual(await readFile(path.join(artifacts, filename)), Buffer.from(fixturePng, 'base64'));
  await cdp.evaluate(`document.querySelector('main a[href="${list}"]').click()`); await cdp.wait(listReady);
  await assertUrlsReleased();
  passed.push('PNG thực sự giải mã được trên trình duyệt và tải đúng byte/tên file; mọi object URL được thu hồi');

  for (const status of ['CANCELLED', 'EXPIRED', 'UNKNOWN']) {
    const start = requests.length;
    await boot({ route: detail, detailOverrides: { status } }); await cdp.wait(detailReady);
    assert.equal(requests.slice(start).some(request => request.route.endsWith('/qr')), false);
    assert.equal(await cdp.evaluate(`document.querySelectorAll('main [download], main a[href^="/checkout/"]').length`), 0);
  }
  await boot({ route: detail, invalidPng: true }); await cdp.wait(includes('Không tải được mã QR'));
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main [download]'))`), false);
  scenario.invalidPng = false; await cdp.click('Thử lại', '[aria-labelledby="ticket-qr"]'); await cdp.wait(qrReady);
  for (const qrStatus of [404, 503]) {
    await boot({ route: detail, qrStatus }); await cdp.wait(includes('Không tải được mã QR'));
    assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main [download]'))`), false);
  }
  passed.push('CANCELLED/EXPIRED/trạng thái lạ không tải QR; PNG sai, lỗi 404/503 có xử lý và thử lại');

  // A live URL must be revoked immediately on an account switch or logout.
  for (const nextUser of [otherCustomer, null]) {
    await boot({ route: detail }); await cdp.wait(qrReady);
    scenario.holdMe = true;
    await switchSession(nextUser);
    await cdp.wait(nextUser ? includes('Đang xác minh phiên') : guestReady);
    await assertUrlsReleased();
    assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main img, main [download]'))`), false);
  }
  passed.push('Đổi tài khoản/đăng xuất thu hồi tất cả URL QR và gỡ ảnh/link tải trước khi xác minh phiên mới');

  await boot({ route: detail, holdQr: true }); await cdp.wait(detailReady);
  const qrDeadline = Date.now() + 10000;
  while (!scenario.heldQr.length) {
    assert.ok(Date.now() < qrDeadline, 'QR request must be held'); await delay(40);
  }
  const heldQr = scenario.heldQr.shift();
  await switchSession(null); await cdp.wait(guestReady);
  try {
    await cdp.send('Fetch.fulfillRequest', { requestId: heldQr, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'image/png' }, { name: 'Access-Control-Allow-Origin', value: origin }], body: fixturePng });
  } catch (error) { if (!error.message.includes('Invalid InterceptionId')) throw error; }
  await delay(200);
  assert.equal(await cdp.evaluate(`window.__urlsCreated.length`), 0);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main img, main [download]'))`), false);

  await boot({ route: detail, holdTickets: true }); await waitHeldTickets();
  scenario.holdMe = true; scenario.detailOverrides = { showtime: { movieTitle: 'Vé riêng của B' } };
  await switchSession(otherCustomer); await waitHeld(); await releaseLateTicket();
  scenario.holdTickets = false; await release(); await cdp.wait(detailReady);
  assert.equal(await cdp.evaluate(`document.querySelector('#ticket-showtime').textContent`), 'Vé riêng của B');
  passed.push('Phản hồi QR sau logout và chi tiết sau đổi tài khoản không khôi phục dữ liệu phiên cũ');

  // Accelerate only the 30s polling timer to 300ms in this test, leave product code unchanged.
  await boot({ fastPolling: true }); await cdp.wait(listReady);
  const listReads = () => requests.filter(request => request.route === '/users/me/bookings').length;
  let count = listReads();
  scenario.history = ticketHistory.map(ticket => ({ ...ticket, movieTitle: `${ticket.movieTitle} cập nhật` }));
  await cdp.wait(`document.querySelector('main article h2').textContent.endsWith('cập nhật')`);
  assert.ok(listReads() > count);
  await cdp.evaluate(`Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));`);
  await delay(150); count = listReads(); await delay(700); assert.equal(listReads(), count, 'No polling in background');
  scenario.history = ticketHistory.map(ticket => ({ ...ticket, status: 'CONFIRMED' }));
  await cdp.evaluate(`Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange'));`);
  await cdp.wait(`document.querySelectorAll('main a[href^="/checkout/"]').length === 0`);
  count = listReads(); await delay(700); assert.equal(listReads(), count, 'Stop polling without pending bookings');
  // With no pending orders, stale data still refreshes on focus after 30s.
  scenario.history = [{ ...ticketHistory[0], movieTitle: 'Làm mới khi quay lại tab' }];
  await cdp.evaluate(`(() => { const now = Date.now.bind(Date); Date.now = () => now() + 31000;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));
  })()`);
  await delay(50);
  await cdp.evaluate(`Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); window.dispatchEvent(new Event('visibilitychange'));`);
  await cdp.wait(`document.querySelector('main article h2').textContent === 'Làm mới khi quay lại tab'`);
  passed.push('Danh sách PENDING poll, tab ẩn dừng, hết PENDING dừng; dữ liệu stale làm mới khi focus (timer kiểm tra rút ngắn)');

  const pendingCode = ticketHistory[1].bookingCode;
  await boot({ route: `${list}/${pendingCode}`, fastPolling: true }); await cdp.wait(detailReady);
  scenario.detailOverrides = { status: 'CONFIRMED' };
  await cdp.wait(qrReady);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main a[href^="/checkout/"]'))`), false);
  scenario.detailStatus = 503; await cdp.click('Làm mới'); await cdp.wait(includes('Chưa làm mới được dữ liệu'));
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('#ticket-showtime'))`), true);
  scenario.detailStatus = 200; await cdp.click('Thử lại'); await cdp.wait(`!document.querySelector('main [role="alert"]')`);
  passed.push('Chi tiết PENDING poll tới CONFIRMED mới tải QR; lỗi làm mới giữ chi tiết và thử lại phục hồi');

  // Journey: tickets -> backend-verified payment result -> tickets, including a reload.
  await boot({ history: [ticketHistory[1]], paymentFlow: true }); await cdp.wait(listReady);
  const start = requests.length;
  const params = new URLSearchParams({ vnp_TxnRef: 'TEST123', vnp_SecureHash: 'a'.repeat(128), vnp_Amount: '18000000', vnp_TmnCode: 'TEST', vnp_ResponseCode: '00', vnp_TransactionStatus: '00' });
  await cdp.evaluate(`history.pushState(null, '', ${JSON.stringify(`/payment/vnpay-callback?${params}`)}); dispatchEvent(new PopStateEvent('popstate'))`);
  await cdp.wait(includes('VNPay đã ghi nhận thanh toán'));
  scenario.paymentConfirmed = true;
  scenario.history = [{ ...ticketHistory[1], status: 'CONFIRMED' }];
  scenario.detailOverrides = { status: 'CONFIRMED' };
  await cdp.click('Kiểm tra trạng thái'); await cdp.wait(heading('Đặt vé thành công'));
  await cdp.evaluate(`document.querySelector('footer a[href="${list}"]').click()`); await cdp.wait(listReady);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main a[href^="/checkout/"]'))`), false);
  assert.equal(await cdp.evaluate(`document.querySelector('main article').textContent.includes('Đã xác nhận')`), true);
  await reload(listReady);
  await cdp.evaluate(`document.querySelector('main article a').click()`); await cdp.wait(qrReady);
  assert.ok(requests.slice(start).every(request => request.method === 'GET' || request.route === '/payments/vnpay-return'));
  passed.push('Sau backend xác nhận thanh toán, quay về/reload vé thấy CONFIRMED và mở QR; không gọi API tạo thanh toán');

  for (const width of [390, 768, 1440]) {
    await boot({ width }); await cdp.wait(listReady);
    await cdp.evaluate(`document.querySelector('main [role="group"] button').focus()`);
    await cdp.key('Tab');
    assert.equal(await cdp.evaluate(`document.activeElement.textContent.startsWith('Đã xác nhận')`), true);
    assert.equal(await cdp.evaluate(`getComputedStyle(document.activeElement).outlineStyle !== 'none'`), true);
    await cdp.key('Enter'); await cdp.wait(`location.search === '?status=CONFIRMED'`);
    assert.equal(await cdp.evaluate(`document.activeElement.getAttribute('aria-pressed')`), 'true');
    await cdp.evaluate(`document.querySelector('main article a').focus()`); await cdp.key('Enter'); await cdp.wait(qrReady); await assertShell();
    assert.ok((await cdp.evaluate(`document.querySelector('main img').alt`)).includes(code));
    assert.equal(await cdp.evaluate(`getComputedStyle(document.querySelector('main img').parentElement).backgroundColor`), 'rgb(255, 255, 255)');
    await screenshot(`tickets-qr-${width}.png`);
  }
  passed.push('Tab/focus/Enter lọc và mở chi tiết; nhãn trạng thái, alt QR/nền trắng, một layout tại 390/768/1440px');
  const storage = await cdp.evaluate(`Object.fromEntries(Object.entries(localStorage))`);
  assert.ok(Object.keys(storage).every(key => ['premier_cinema_access_token', 'premier_cinema_refresh_token', 'premier_cinema_session_id', 'premier_cinema_user'].includes(key)), 'No private ticket data persisted');
}

try {
  browser = await startEdgeBrowser({ root, port: 4210, debugPort: 9243, artifacts, executable: process.env.ADMIN_EDGE_PATH });
  cdp = browser.cdp;
  cdp.on('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
  cdp.on('Fetch.requestPaused', event => { void intercept(event).catch(async error => {
    exceptions.push(error.stack);
    await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
  }); });

  for (const width of [390, 768, 1440]) {
    for (const route of [list, detail]) {
      for (const user of [null, customer]) {
        const ready = !user ? guestReady : route === list ? listReady : detailReady;
        await boot({ user, route, width }); await cdp.wait(ready); await assertShell();
        await reload(ready); await assertShell();
        assert.equal(await cdp.evaluate('location.pathname + location.search + location.hash'), route);
        if (!user) {
          assert.equal(scenario.me, 0, 'Guest must not verify or load bookings');
          await cdp.evaluate(`document.querySelector('main button').focus()`);
          await cdp.key('Enter');
          await cdp.wait(`Boolean(document.querySelector('input[name="email"]'))`);
          assert.equal(await cdp.evaluate('location.pathname + location.search + location.hash'), route);
          await cdp.key('Escape');
          await cdp.wait(`!document.querySelector('input[name="email"]')`);
        }
        passed.push(`${user ? 'Xác thực' : 'Khách'}: mở trực tiếp/reload ${route}, layout và modal ${width}px`);
      }
    }
  }

  await boot({ user: null, route: detail }); await cdp.wait(guestReady);
  scenario.user = customer; scenario.holdMe = true;
  await cdp.click('Đăng nhập'); await login(); await waitHeld();
  await cdp.wait(includes('Đang xác minh phiên'));
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main nav'))`), false);
  await release(); await cdp.wait(detailReady);
  assert.equal(await cdp.evaluate('location.pathname + location.search + location.hash'), detail);
  passed.push('Đăng nhập bằng modal giữ URL; chờ /users/me trước khi dựng trang con');

  await boot({ status: 503 }); await cdp.wait(heading('Chưa xác minh được phiên'));
  scenario.status = 200; await cdp.click('Thử lại xác minh'); await cdp.wait(listReady);
  passed.push('Lỗi xác minh 503 và thử lại thành công');

  await boot({ status: 503, route: detail }); await cdp.wait(heading('Chưa xác minh được phiên'));
  scenario.status = 200; scenario.user = otherCustomer;
  await cdp.click('Đổi tài khoản'); await login(); await cdp.wait(detailReady);
  assert.equal(await cdp.evaluate('JSON.parse(localStorage.getItem("premier_cinema_user")).id'), otherCustomer.id);
  passed.push('Đổi tài khoản từ lỗi xác minh');

  for (const status of [401, 403]) {
    await boot({ status });
    await cdp.wait(status === 401 ? guestReady : heading('Tài khoản không xem được vé'));
    assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main nav'))`), false);
    assert.equal(scenario.me, 1, 'No verification loop after rejection');
    passed.push(`/users/me ${status}: chặn trang con`);
  }

  await boot({ route: `${list}/invalid` }); await cdp.wait(heading('Không tìm thấy vé'));
  await cdp.evaluate(`document.querySelector('main a[href="${list}"]').click()`); await cdp.wait(listReady);
  passed.push('Mã đơn sai định dạng có lối về danh sách');

  await boot({ holdMe: true }); await waitHeld();
  await switchSession(otherCustomer); await cdp.wait(includes('Đang xác minh phiên'));
  await release(); // Response A arrives after B has started verification.
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main nav'))`), false);
  await waitHeld(); await release(); await cdp.wait(listReady);
  assert.equal(await cdp.evaluate('JSON.parse(localStorage.getItem("premier_cinema_user")).id'), otherCustomer.id);
  await cdp.evaluate(`void (window.__previousTicketsHeading = document.querySelector('main h1'))`);
  await switchSession(otherCustomer); await waitHeld(); await release(); await cdp.wait(listReady);
  assert.equal(await cdp.evaluate(`window.__previousTicketsHeading === document.querySelector('main h1')`), false);
  await switchSession(null); await cdp.wait(guestReady);
  passed.push('Đổi phiên khi đang xác minh, bỏ response cũ, remount khi đăng nhập lại, đăng xuất qua storage');

  await boot(); await cdp.wait(listReady);
  // The interceptor emits this when any /admin/** API returns 403, including in another mounted flow.
  scenario.holdMe = true;
  await cdp.evaluate(`dispatchEvent(new CustomEvent('premier_cinema:admin-forbidden'))`);
  await waitHeld(); await cdp.wait(includes('Đang xác minh phiên'));
  await release(); await cdp.wait(listReady);
  passed.push('403 của Admin không tước quyền xem vé; xác minh lại /users/me trước khi cho vào');

  await checkTicketData();
  await checkSessionIsolation();
  await checkTicketQr();
  await checkFinalAcceptance();
  assert.deepEqual(exceptions, []);
  const report = { mode: 'Edge production / API mô phỏng; PNG download thật; timer polling rút ngắn 30s thành 300ms ở các ca ghi rõ — Mục 1–6', passed,
    requests, runtimeExceptions: exceptions.length, artifacts };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, requests: requests.length }, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ passed, requests, exceptions,
    body: await cdp?.evaluate('document.body.innerText').catch(() => '') }, null, 2));
  console.error(`Kiểm tra mục 1–6 thất bại: ${artifacts}`);
  throw error;
} finally { await browser?.close(); }
