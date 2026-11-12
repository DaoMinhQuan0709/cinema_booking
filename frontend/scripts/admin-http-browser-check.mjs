import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startEdgeBrowser } from './lib/edge-browser.mjs';

// Helper backend truyền credential fixture qua stdin, không qua CLI/log hay file kết quả.
let input = '';
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
assert.equal(process.env.CINEMA_TEST_HTTP, 'true', 'Chỉ chạy từ môi trường nghiệm thu độc lập');
assert.match(config.apiBase, /^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/);
assert.notEqual(new URL(config.apiBase).port, '8080', 'Không ghi vào backend ứng dụng');
const root = fileURLToPath(new URL('..', import.meta.url));
const artifacts = path.join(process.env.CINEMA_TEST_ARTIFACTS, 'edge-http');
await mkdir(artifacts, { recursive: true });
const origin = 'http://127.0.0.1:4203';
const requests = [], exceptions = [], passed = [];
let browser, cdp, auth;

async function field(name, value, scope = 'dialog') {
  assert.equal(await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(`${scope} [name="${name}"]`)}); if (!node) return false;
    const prototype = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, ${JSON.stringify(String(value))});
    node.dispatchEvent(new Event(node instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); return true;
  })()`), true, `Trường ${name}`);
}
async function spa(route) {
  await cdp.evaluate(`history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate'))`);
}
async function submit(scope = 'dialog') {
  await cdp.evaluate(`document.querySelector(${JSON.stringify(scope + ' form')}).requestSubmit()`);
}
async function login(email) {
  await cdp.wait(`Boolean(document.querySelector('#admin-access-title'))`);
  await cdp.click('Đăng nhập', 'section[aria-labelledby=admin-access-title]');
  await cdp.wait(`Boolean(document.querySelector('input[name=password]'))`);
  await field('email', email, 'body'); await field('password', config.password, 'body');
  await cdp.evaluate(`document.querySelector('input[name=password]').form.requestSubmit()`);
}
async function actual(pathname) {
  const response = await fetch(config.apiBase + pathname, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  assert.equal(response.status, 200, pathname); return (await response.json()).data;
}
async function capture(name) {
  await writeFile(path.join(artifacts, name), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
}
async function mobile() {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1000, mobile: true, deviceScaleFactor: 1 });
  await cdp.wait('document.documentElement.scrollWidth <= 390');
}
async function openShowtime() {
  await cdp.click('Thêm suất chiếu'); await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`);
  await field('movieId', config.movieId); await field('cinemaId', config.cinemaId); await field('auditoriumId', config.roomId);
  await field('startTime', `${config.day}T10:00`); await field('endTime', `${config.day}T12:00`); await field('basePrice', '100000');
}

try {
  browser = await startEdgeBrowser({ root, port: 4203, debugPort: 9236, artifacts, executable: process.env.ADMIN_EDGE_PATH }); cdp = browser.cdp;
  await cdp.send('Network.enable');
  cdp.on('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  cdp.on('Network.responseReceived', event => {
    if (event.response.url.includes('/api/v1/')) requests.push({ path: new URL(event.response.url).pathname, status: event.response.status });
  });
  // Chỉ đổi đích sang cổng Tomcat thử ngẫu nhiên. Không fulfill response hoặc thay body/header/DTO.
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*', requestStage: 'Request' }] });
  cdp.on('Fetch.requestPaused', event => {
    const url = new URL(event.request.url);
    const pathname = url.pathname.slice(url.pathname.indexOf('/api/v1') + '/api/v1'.length);
    void cdp.send('Fetch.continueRequest', { requestId: event.requestId, url: config.apiBase + pathname + url.search })
      .catch(error => exceptions.push(error.message));
  });
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'America/Los_Angeles' });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, mobile: false, deviceScaleFactor: 1 });
  await cdp.send('Page.navigate', { url: origin + '/admin/movies?q=' + encodeURIComponent(config.movieTitle.split(' ').at(-1)) + '#http' });
  await login(config.adminEmail);
  await cdp.wait(`Boolean(document.querySelector('#admin-page-title')) && Boolean(document.querySelector('main table'))`);
  auth = JSON.parse(await cdp.evaluate(`JSON.stringify({ accessToken: localStorage.getItem('premier_cinema_access_token') })`));
  assert.equal((await actual('/users/me')).role, 'ADMIN');
  assert.equal(await cdp.evaluate('location.hash'), '#http');
  passed.push('Đăng nhập UI ADMIN qua HTTP/JWT thật, giữ URL/hash và xác minh /users/me');

  await cdp.click('Thêm phim'); await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`);
  await field('title', config.movieTitle); await field('durationMinutes', '100'); await field('releaseDate', config.day);
  await field('status', 'NOW_SHOWING'); await submit();
  await cdp.wait(`!document.querySelector('dialog[open]') && document.querySelector('main').textContent.includes(${JSON.stringify(config.movieTitle)})`);
  let saved = (await actual('/movies?keyword=' + encodeURIComponent(config.movieTitle))).content;
  assert.equal(saved.length, 1); const savedId = saved[0].id;
  await cdp.evaluate('window.__beforeReload = true'); await cdp.send('Page.reload');
  await cdp.wait(`!window.__beforeReload && Boolean(document.querySelector('main table')) && document.querySelector('main').textContent.includes(${JSON.stringify(config.movieTitle)})`);
  await cdp.evaluate(`document.querySelector(${JSON.stringify(`button[aria-label="Sửa phim ${config.movieTitle}"]`)}).click()`);
  await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`);
  await field('title', config.movieTitle + ' đã sửa'); await field('status', 'COMING_SOON'); await submit();
  await cdp.wait(`!document.querySelector('dialog[open]') && document.querySelector('main').textContent.includes(${JSON.stringify(config.movieTitle + ' đã sửa')})`);
  saved = await actual('/movies/' + savedId); assert.equal(saved.status, 'COMING_SOON'); assert.equal(saved.title, config.movieTitle + ' đã sửa');
  passed.push('UI thêm/sửa phim, F5 đọc lại DB thật và catalog công khai nhận trạng thái mới');

  await spa(`/admin/showtimes?date=${config.day}&cinemaId=${config.cinemaId}&movieId=${config.movieId}`);
  await cdp.wait(`document.querySelector('#admin-page-title')?.textContent === 'Quản lý suất chiếu' && ![...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Thêm suất chiếu')?.disabled`);
  await openShowtime(); await submit();
  await cdp.wait(`!document.querySelector('dialog[open]') && Boolean(document.querySelector('main table'))`);
  const schedule = await actual(`/showtimes?date=${config.day}&cinemaId=${config.cinemaId}&movieId=${config.movieId}`);
  assert.equal(schedule.length, 1); assert.equal(schedule[0].startTime, config.day + 'T10:00:00');
  await openShowtime(); await submit();
  await cdp.wait(`document.querySelector('dialog [role=alert]')?.textContent.includes('Xung dot')`);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog [name=startTime]').value`), config.day + 'T10:00');
  assert.equal((await actual(`/showtimes?date=${config.day}&cinemaId=${config.cinemaId}&movieId=${config.movieId}`)).length, 1);
  await cdp.click('Hủy', 'dialog');
  await spa(`/showtimes?date=${config.day}&cinemaId=${config.cinemaId}&movieId=${config.movieId}`);
  await cdp.wait(`!document.querySelector('#admin-main') && Boolean(document.querySelector('a[href="/booking/${schedule[0].id}"]'))`);
  passed.push('UI xếp lịch giờ Việt Nam từ browser Los Angeles; PostgreSQL trả 409 giữ form, lịch khách có suất thật');

  const reportRoute = `/admin/reports?startDate=${config.reportDay}&endDate=${config.reportDay}&occupancyDate=${config.reportDay}&groupBy=movie`;
  await spa(reportRoute);
  await cdp.wait(`document.querySelector('#admin-kpi-revenue')?.textContent.includes('340.000') && document.querySelector('#admin-kpi-capacity')?.textContent === '10'`);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-kpi-bookings').textContent`), '2');
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-kpi-tickets').textContent`), '3');
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-kpi-occupancy').textContent`), '30%');
  await capture('reports-http-desktop.png'); await mobile(); await capture('reports-http-390.png');
  await cdp.evaluate(`document.querySelector('[aria-label="Mở menu quản trị"]').click()`);
  await cdp.wait(`Boolean(document.querySelector('[aria-label="Menu quản trị"]'))`);
  await cdp.key('Escape');
  passed.push('Dashboard production khớp DB: 340.000 VND, 2 đơn, 3 vé; lấp đầy 3/10 = 30%; desktop/390px và Escape drawer');

  await spa('/admin/sync');
  await cdp.wait(`Boolean(document.querySelector('#admin-sync-last-success')) && !document.querySelector('#admin-sync-form button[type=submit]').disabled`);
  await cdp.evaluate(`document.querySelector('#admin-sync-form').requestSubmit()`);
  await cdp.wait(`document.querySelector('#admin-sync-result-source')?.textContent.includes('LOCAL_FILE') && !document.querySelector('#admin-sync-form button[type=submit]').disabled`);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-sync-count-totalMoviesSynced').textContent`), String(config.expectedSyncedMovies));
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-sync-last-success').textContent`), 'Chưa có mốc được ghi nhận');
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= 390'), true);
  await capture('sync-http-390.png');
  assert.equal((await actual('/admin/sync/galaxy/status')).running, false);
  passed.push('UI nhập file offline thật vào PostgreSQL, đủ kết quả và không gán lastSuccessAt online; 390px');

  await cdp.evaluate(`document.querySelector('[aria-label="Mở menu quản trị"]').click()`);
  await cdp.click('Đăng xuất', 'body'); await cdp.wait(`location.pathname === '/'`);
  await spa('/admin/sync');
  const boundary = requests.length;
  await login(config.customerEmail);
  await cdp.wait(`document.querySelector('#admin-access-title')?.textContent.includes('403')`);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('#admin-main'))`), false);
  assert.equal(requests.slice(boundary).filter(request => request.path.includes('/admin/')).length, 0);
  await capture('customer-http-403-390.png');
  passed.push('Đăng xuất UI rồi đăng nhập CUSTOMER thật: guard 403, không mount Admin hoặc phát query Admin');

  assert.deepEqual(exceptions, []);
  const summary = { passed, httpResponses: requests.length, runtimeExceptions: exceptions, apiMode: 'HTTP thật tới Spring Boot + PostgreSQL/Redis thử, không mock response' };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, artifacts }, null, 2));
} catch (error) {
  if (cdp) { await capture('failure.png').catch(() => {}); await writeFile(path.join(artifacts, 'failure.txt'), String(error.stack)); }
  throw error;
} finally { await browser?.close(); }
