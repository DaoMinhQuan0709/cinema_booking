// REST/đăng nhập thật trên backend thử; CDP chỉ chuyển URL tới cổng Tomcat thử.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startEdgeBrowser } from './lib/edge-browser.mjs';
let input = '';
for await (const part of process.stdin) input += part;
const config = JSON.parse(input);
assert.equal(process.env.CINEMA_TEST_HTTP, 'true');
assert.match(config.apiBase, /^http:\/\/127\.0\.0\.1:\d+\/api\/v1$/);
assert.notEqual(new URL(config.apiBase).port, '8080');
const root = fileURLToPath(new URL('..', import.meta.url));
const artifacts = path.join(process.env.CINEMA_TEST_ARTIFACTS, 'edge-deletion-http');
await mkdir(artifacts, { recursive: true });
const origin = 'http://127.0.0.1:4205';
const requests = [], exceptions = [], passed = [];
let browser, cdp, bootScript;
async function api(route, token, expected = 200) {
  const r = await fetch(config.apiBase + route, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(r.status, expected, route); return (await r.json()).data;
}
async function boot(email, route, width = 1280) {
  const response = await fetch(config.apiBase + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: config.password }) });
  assert.equal(response.status, 200); const tokens = (await response.json()).data;
  const user = await api('/users/me', tokens.accessToken);
  if (bootScript) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: bootScript });
  await cdp.send('Page.navigate', { url: 'about:blank' });
  bootScript = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.clear();
    localStorage.setItem('premier_cinema_access_token',${JSON.stringify(tokens.accessToken)});
    localStorage.setItem('premier_cinema_refresh_token',${JSON.stringify(tokens.refreshToken)});
    localStorage.setItem('premier_cinema_session_id',${JSON.stringify('live-delete-' + Date.now())});
    localStorage.setItem('premier_cinema_user',${JSON.stringify(JSON.stringify(user))});` })).identifier;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: origin + route });
  return tokens.accessToken;
}
async function open(label) {
  const selector = `button[aria-label=${JSON.stringify(label)}]`;
  await cdp.wait(`Boolean(document.querySelector(${JSON.stringify(selector)} + ':not(:disabled)'))`);
  await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await cdp.wait(`Boolean(document.querySelector('dialog[open]')) && document.querySelector('dialog').textContent.includes('Xóa')`);
}
const confirmEnabled = `![...document.querySelectorAll('dialog button')].find(b=>b.textContent.trim()==='Xác nhận xóa')?.disabled`;
try {
  browser = await startEdgeBrowser({ root, port: 4205, debugPort: 9238, artifacts, executable: process.env.ADMIN_EDGE_PATH }); cdp = browser.cdp;
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*', requestStage: 'Request' }] });
  cdp.on('Fetch.requestPaused', e => {
    const url = new URL(e.request.url), route = url.pathname.slice(url.pathname.indexOf('/api/v1') + 7);
    requests.push({ method: e.request.method, route });
    void cdp.send('Fetch.continueRequest', { requestId: e.requestId, url: config.apiBase + route + url.search }).catch(error => exceptions.push(error.message));
  });
  cdp.on('Runtime.exceptionThrown', e => exceptions.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text));
  const token = await boot(config.adminEmail, '/admin/movies?q=' + encodeURIComponent(config.movieTitle));
  await open('Xóa phim ' + config.movieTitle); await cdp.wait(confirmEnabled);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog').textContent.includes('2 suất chiếu')`), true);
  await cdp.click('Xác nhận xóa', 'dialog'); await cdp.wait(`!document.querySelector('dialog[open]')`);
  await api('/movies/' + config.movieId, token, 404);
  await cdp.wait(`document.querySelector('main').textContent.includes('Không có phim phù hợp')`);
  passed.push('UI xóa phim kèm hai suất, DELETE/If-Match/CORS thật và catalog cập nhật từ DB');
  await writeFile(path.join(artifacts, 'deleted-movie.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));

  await boot(config.adminEmail, `/admin/showtimes?date=${config.day}&movieId=${config.slotMovieId}`, 390);
  await open('Xóa suất chiếu ' + config.showtimeId); await cdp.wait(confirmEnabled);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog').textContent.includes('Chỉ xóa suất chiếu này')`), true);
  for (let i = 0; i < 8; i++) { await cdp.key('Tab'); assert.equal(await cdp.evaluate(`document.querySelector('dialog').contains(document.activeElement)`), true); }
  await writeFile(path.join(artifacts, 'delete-slot-390.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await cdp.click('Xác nhận xóa', 'dialog'); await cdp.wait(`!document.querySelector('dialog[open]')`);
  await api('/showtimes/' + config.showtimeId, token, 404); await api('/showtimes/' + config.otherShowtimeId, token); await api('/movies/' + config.slotMovieId, token);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  passed.push('UI xóa riêng suất ở 390px; phim/suất khác giữ nguyên, bàn phím nằm trong modal');

  await boot(config.adminEmail, '/admin/movies?q=' + encodeURIComponent(config.blockedTitle));
  const before = requests.filter(r => r.method === 'DELETE').length;
  await open('Xóa phim ' + config.blockedTitle);
  await cdp.wait(`document.querySelector('dialog [role="alert"]')?.textContent.includes('vé đã xác nhận')`);
  assert.equal(await cdp.evaluate(confirmEnabled), false); assert.equal(requests.filter(r => r.method === 'DELETE').length, before);
  passed.push('Preview DB thật chặn phim có CONFIRMED, UI không gửi DELETE');

  const mark = requests.length; await boot(config.customerEmail, '/admin/movies');
  await cdp.wait(`document.body.textContent.includes('403 — Không có quyền quản trị')`);
  assert.equal(requests.slice(mark).some(r => r.route.startsWith('/admin/')), false);
  passed.push('CUSTOMER thực tế bị chặn trước dữ liệu quản trị');
  assert.deepEqual(exceptions, []);
  const report = { mode: 'HTTP/Edge/PostgreSQL/Redis thử thật; không mock REST', passed, httpRequests: requests.length, runtimeExceptions: exceptions.length };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ passed, requests, exceptions, body: await cdp?.evaluate('document.body.innerText') }, null, 2)); throw error;
} finally { await browser?.close(); }
