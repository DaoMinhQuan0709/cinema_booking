// Edge với bản production và REST mô phỏng; không xác nhận DB hoặc gateway thật.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startEdgeBrowser, delay } from './lib/edge-browser.mjs';
import { getVietnamClock } from '../src/features/showtimes/scheduleUtils.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = await mkdtemp(path.join(tmpdir(), 'cinema-admin-deletion-'));
const origin = 'http://127.0.0.1:4204';
const day = getVietnamClock(new Date(Date.now() + 86400000)).date;
const admin = { id: 1, role: 'ADMIN', fullName: 'Admin mô phỏng', email: 'deletion@example.invalid' };
const requests = [], exceptions = [], passed = [];
let browser, cdp, bootScript, sequence = 0, scenario;
function reset(options = {}) { scenario = { user: admin, deleted: false, token: '"v1"', blockers: [], mode: 'ok', deletes: 0, ...options }; }
const slots = [1, 2].map(id => ({ id, movieId: 1, movieTitle: 'Phim xóa thử', cinemaId: 1, cinemaName: 'Rạp thử', auditoriumId: 1,
  auditoriumName: `Phòng ${id}`, startTime: `${day}T10:00:00`, endTime: `${day}T12:00:00`, basePrice: 89000 }));
async function reply(id, status, data, message = 'OK') {
  await cdp.send('Fetch.fulfillRequest', { requestId: id, responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept, If-Match' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, DELETE, OPTIONS' }],
    body: Buffer.from(JSON.stringify({ code: status, message, data })).toString('base64') });
}
async function intercept({ requestId, request }) {
  if (request.method === 'OPTIONS') return reply(requestId, 200);
  const url = new URL(request.url), route = url.pathname.replace('/api/v1', '');
  requests.push({ method: request.method, route, headers: request.headers });
  if (route === '/users/me') return reply(requestId, 200, scenario.user);
  if (route.endsWith('/deletion-preview')) return reply(requestId, scenario.readError ? 500 : 200, {
    id: 1, kind: route.includes('/movies/') ? 'movies' : 'showtimes', title: 'Phim xóa thử', deleted: scenario.deleted,
    showtimeCount: 2, showtimes: slots, blockers: scenario.blockers, canDelete: !scenario.deleted && !scenario.blockers.length, scopeToken: scenario.token,
  });
  if (request.method === 'DELETE') {
    scenario.deletes++;
    assert.equal(request.headers['If-Match'] || request.headers['if-match'], scenario.token);
    if (scenario.mode === 'changed' || scenario.mode === 'precondition') {
      const status = scenario.mode === 'changed' ? 412 : 428;
      scenario.token = '"v2"'; scenario.mode = 'ok'; return reply(requestId, status, null, 'Phạm vi xóa cần được kiểm tra và xác nhận lại.');
    }
    if (scenario.mode === 'busy') return reply(requestId, 409, null, 'Dữ liệu đang được xử lý. Vui lòng kiểm tra lại.');
    if (scenario.mode === 'held') { scenario.held = requestId; return; }
    scenario.deleted = true;
    if (scenario.mode === 'lost') return cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
    return reply(requestId, 200, { deleted: true });
  }
  if (route === '/movies') return reply(requestId, 200, { content: scenario.deleted ? [] : [{ id: 1, title: 'Phim xóa thử', durationMinutes: 100, releaseDate: day, status: 'NOW_SHOWING' }], pageNo: 0, pageSize: 20, totalPages: 1, totalElements: scenario.deleted ? 0 : 1 });
  if (route === '/showtimes') return reply(requestId, 200, scenario.deleted ? [] : slots);
  if (route === '/cinemas') return reply(requestId, 200, [{ id: 1, name: 'Rạp thử', auditoriums: [{ id: 1, name: 'Phòng 1' }] }]);
  throw new Error(`API chưa được khai báo ${request.method} ${route}`);
}
async function boot(kind = 'movies', width = 1280) {
  if (bootScript) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: bootScript });
  await cdp.send('Page.navigate', { url: 'about:blank' });
  bootScript = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.clear();
    localStorage.setItem('premier_cinema_access_token','delete-test'); localStorage.setItem('premier_cinema_refresh_token','delete-refresh');
    localStorage.setItem('premier_cinema_session_id','delete-${++sequence}'); localStorage.setItem('premier_cinema_user',${JSON.stringify(JSON.stringify(scenario.user))});` })).identifier;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: `${origin}/admin/${kind}?date=${day}` });
  await cdp.wait(`Boolean(document.querySelector('main tbody button[aria-label^="Xóa"]')) || document.body.textContent.includes('403 — Không có quyền quản trị')`);
}
async function open() {
  await cdp.wait(`Boolean(document.querySelector('main tbody button[aria-label^="Xóa"]:not(:disabled)'))`);
  await cdp.evaluate(`document.querySelector('main tbody button[aria-label^="Xóa"]').click()`);
  await cdp.wait(`document.querySelector('dialog[open]')?.textContent.includes('Phim xóa thử')`);
}
const canConfirm = `![...document.querySelectorAll('dialog button')].find(b=>b.textContent.trim()==='Xác nhận xóa')?.disabled`;
try {
  browser = await startEdgeBrowser({ root, port: 4204, debugPort: 9237, artifacts, executable: process.env.ADMIN_EDGE_PATH }); cdp = browser.cdp;
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
  cdp.on('Runtime.exceptionThrown', e => exceptions.push(e.exceptionDetails.exception?.description || e.exceptionDetails.text));
  cdp.on('Fetch.requestPaused', e => { void intercept(e).catch(error => exceptions.push(error.stack)); });

  reset(); await boot(); await open(); await cdp.wait(canConfirm);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog').textContent.includes('2 suất chiếu')`), true);
  await cdp.click('Xác nhận xóa', 'dialog'); await cdp.wait(`!document.querySelector('dialog[open]')`);
  assert.equal(scenario.deletes, 1); await cdp.wait(`document.querySelector('main').textContent.includes('Không có phim phù hợp')`);
  passed.push('Xóa phim xác nhận toàn bộ suất và cập nhật danh sách sau thành công; If-Match đúng');

  for (const [reason, message] of [['CONFIRMED', 'Có vé đã xác nhận; không được xóa.'], ['PENDING', 'Có đơn chờ thanh toán.'], ['PAYMENT', 'Có tiền cần đối soát.']]) {
    reset({ blockers: [{ reason, message, count: 1 }] }); await boot(); await open();
    assert.equal(await cdp.evaluate(canConfirm), false); assert.equal(await cdp.evaluate(`document.querySelector('dialog').textContent.includes(${JSON.stringify(message)})`), true);
    assert.equal(scenario.deletes, 0);
  }
  passed.push('Ba nhóm blocker có lý do riêng, không cho gửi DELETE');

  for (const mode of ['changed', 'precondition']) {
    reset({ mode }); await boot(); await open(); await cdp.wait(canConfirm); await cdp.click('Xác nhận xóa', 'dialog');
    await cdp.wait(`document.querySelector('dialog [role="alert"]')?.textContent.includes('Phạm vi')`);
    assert.equal(await cdp.evaluate(canConfirm), false); assert.equal(scenario.deletes, 1);
    await cdp.click('Kiểm tra lại', 'dialog'); await cdp.wait(canConfirm); assert.equal(scenario.deletes, 1);
    await cdp.click('Xác nhận xóa', 'dialog'); await cdp.wait(`!document.querySelector('dialog[open]')`); assert.equal(scenario.deletes, 2);
    passed.push(`${mode === 'changed' ? 412 : 428} yêu cầu preview mới và xác nhận thủ công, không tự gửi lại`);
  }

  reset({ mode: 'lost' }); await boot(); await open(); await cdp.wait(canConfirm); await cdp.click('Xác nhận xóa', 'dialog');
  await cdp.wait(`document.querySelector('dialog [role="alert"]')?.textContent.includes('Chưa xác định')`);
  assert.equal(scenario.deletes, 1); assert.equal(await cdp.evaluate(canConfirm), false);
  await cdp.click('Kiểm tra lại', 'dialog'); await cdp.wait(`!document.querySelector('dialog[open]')`); assert.equal(scenario.deletes, 1);
  passed.push('Mất phản hồi sau commit mô phỏng chỉ đối chiếu GET, không retry DELETE');

  reset({ mode: 'held' }); await boot('showtimes', 390); await open(); await cdp.wait(canConfirm);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog').textContent.includes('Chỉ xóa suất chiếu này')`), true);
  await cdp.evaluate(`(() => {const b=[...document.querySelectorAll('dialog button')].find(b=>b.textContent.trim()==='Xác nhận xóa'); b.click(); b.click();})()`);
  for (let n = 0; !scenario.held && n < 100; n++) await delay(50);
  assert.ok(scenario.held); await cdp.key('Escape'); assert.equal(await cdp.evaluate(`Boolean(document.querySelector('dialog[open]'))`), true);
  assert.equal(scenario.deletes, 1);
  for (let n = 0; n < 8; n++) { await cdp.key('Tab'); assert.equal(await cdp.evaluate(`document.querySelector('dialog').contains(document.activeElement)`), true); }
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await writeFile(path.join(artifacts, 'delete-showtime-390.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  scenario.deleted = true; await reply(scenario.held, 200, { deleted: true }); await cdp.wait(`!document.querySelector('dialog[open]')`);
  passed.push('Xóa riêng suất ở 390px; chống click lặp, giữ modal/focus và chặn Escape trong request');

  reset({ mode: 'busy' }); await boot(); await open(); await cdp.wait(canConfirm); await cdp.click('Xác nhận xóa', 'dialog');
  await cdp.wait(`document.querySelector('dialog [role="alert"]')?.textContent.includes('đang được xử lý')`);
  assert.equal(scenario.deletes, 1); assert.equal(await cdp.evaluate(canConfirm), false);
  passed.push('409 giữ nội dung và yêu cầu kiểm tra lại, không xóa hàng trước phản hồi');

  reset({ user: { ...admin, role: 'CUSTOMER' } }); const mark = requests.length; await boot();
  assert.deepEqual(requests.slice(mark).map(r => r.route), ['/users/me']);
  passed.push('CUSTOMER bị chặn trước tải danh sách và preview');
  assert.deepEqual(exceptions, []);
  const report = { mode: 'Edge production/REST mô phỏng; không có DB hoặc API thật', passed, mockRequests: requests.length, runtimeExceptions: exceptions.length, artifacts };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ passed, requests, exceptions, scenario, body: await cdp?.evaluate('document.body.innerText') }, null, 2));
  console.error(`Kiểm tra xóa thất bại: ${artifacts}`); throw error;
} finally { await browser?.close(); }
