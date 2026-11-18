// Mục 1–2: bản production với API xác thực/vé mô phỏng; không đọc/ghi backend thật.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
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
  requests.push({ route, method: request.method });
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
    if (route === '/users/me/bookings') return reply(requestId, scenario.historyStatus || 200, scenario.history);
    return reply(requestId, scenario.detailStatus || 200, { ...ticketDetail(route.split('/').at(-1)), ...scenario.detailOverrides });
  }
  if (route === '/products' && scenario.allowCheckout) return reply(requestId, 200, []);
  if (route === '/auth/login') return reply(requestId, 200, {
    accessToken: 'login-token', refreshToken: 'login-refresh', user: scenario.user,
  });
  if (route === '/auth/refresh') return reply(requestId, 401, null);
  throw new Error(`API ngoài phạm vi kiểm tra vé: ${route}`);
}

async function boot({ user = customer, route = list, width = 1440, ...options } = {}) {
  scenario = { user, status: 200, holdMe: false, me: 0, held: [], history: ticketHistory, verified: new Set(), ...options };
  await cdp.send('Page.navigate', { url: 'about:blank' });
  const marker = ++sequence;
  const script = await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (location.origin === ${JSON.stringify(origin)}) {
      ${sessionSource(user, `boot-${marker}`)} window.__ticketsBoot = ${marker};
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

  await boot({ allowCheckout: true }); await cdp.wait(listReady);
  await cdp.evaluate(`document.querySelector('main a[href^="/checkout/"]').click()`);
  await cdp.wait(`location.pathname === '/checkout/${ticketHistory[1].bookingCode}' && document.querySelector('main').textContent.includes('Interstellar')`);
  assert.ok(requests.slice(start).every(item => item.method === 'GET'));
  assert.equal(await cdp.evaluate(`document.querySelectorAll('main a[href*="/qr"]').length`), 0);
  passed.push('Tiếp tục đơn mở checkout hiện có; mọi request trong luồng trang vé đều GET, không lấy QR');
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
  assert.deepEqual(exceptions, []);
  const report = { mode: 'Edge production / API xác thực và vé mô phỏng, chưa kiểm tra backend thật', passed,
    requests, runtimeExceptions: exceptions.length, artifacts };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, requests: requests.length }, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ passed, requests, exceptions,
    body: await cdp?.evaluate('document.body.innerText').catch(() => '') }, null, 2));
  console.error(`Kiểm tra mục 1 thất bại: ${artifacts}`);
  throw error;
} finally { await browser?.close(); }
