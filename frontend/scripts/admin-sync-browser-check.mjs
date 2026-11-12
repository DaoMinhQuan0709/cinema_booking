// DataSync production + REST mô phỏng; không nhập vào DB ứng dụng hoặc gọi Galaxy online.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVietnamClock } from '../src/features/showtimes/scheduleUtils.js';
import { delay, startEdgeBrowser } from './lib/edge-browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = await mkdtemp(path.join(tmpdir(), 'cinema-admin-sync-'));
const origin = 'http://127.0.0.1:4202';
const tomorrow = getVietnamClock(new Date(Date.now() + 86_400_000)).date;
const admin = { id: 1, fullName: 'Admin mô phỏng', email: 'admin@example.invalid', role: 'ADMIN' };
const requests = [], exceptions = [], passed = [], modules = [];
let browser, cdp, scenario, bootScript, sequence = 0, revision;

function reset(options = {}) {
  revision = 0;
  scenario = { user: admin, statusCode: 200, writeCode: 200, movieCode: 200, writes: 0, held: [], enabled: true, running: false,
    lastAttemptAt: '2026-11-11T10:00:00Z', lastSuccessAt: '2026-11-10T10:00:00Z', lastError: 'Lỗi online riêng từ lượt trước', ...options };
}
function onlineStatus() {
  return { enabled: scenario.enabled, intervalMs: 300000, running: scenario.running, lastAttemptAt: scenario.lastAttemptAt, lastSuccessAt: scenario.lastSuccessAt, lastError: scenario.lastError };
}
function importResult() {
  return { source: 'LOCAL_FILE', syncedAt: '2026-11-12T18:00:00Z', message: 'Đã xử lý dữ liệu mẫu.', totalMoviesSynced: 3,
    totalCinemasSynced: 2, totalAuditoriumsSynced: 2, totalShowtimesSynced: 4, totalShowtimesSkipped: 1,
    totalShowtimesDeactivated: 0, totalMoviesEnded: 0, totalSeatsSynced: 0, totalShowtimeSeatsSynced: 0, ...scenario.result };
}
function commit() { revision++; return importResult(); }
function movies() {
  return [{ id: 7, title: revision ? 'Phim Galaxy mẫu đã nhập' : 'Phim trước khi nhập', status: 'NOW_SHOWING', durationMinutes: 120,
    releaseDate: '2026-11-01', description: 'Dữ liệu thử', posterUrl: null, trailerUrl: null, genre: 'Phiêu lưu', ageRating: 'P' }];
}
function cinemas() { return [{ id: 2, name: revision ? 'Rạp sau nhập mẫu' : 'Rạp trước nhập', city: 'Hồ Chí Minh', auditoriums: [{ id: 3, name: 'Phòng 1', totalRows: 10, totalCols: 12 }] }]; }
function showtimes() {
  return Array.from({ length: revision ? 2 : 1 }, (_, index) => ({ id: 10 + index, movieId: 7, movieTitle: movies()[0].title, posterUrl: null,
    cinemaId: 2, cinemaName: cinemas()[0].name, auditoriumId: 3, auditoriumName: 'Phòng 1', startTime: `${tomorrow}T${index ? '20' : '17'}:00:00`, endTime: `${tomorrow}T${index ? '22' : '19'}:15:00`, basePrice: 90000 }));
}
async function reply(requestId, status, data, message = 'OK') {
  await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
    { name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: origin },
    { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept' },
    { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
  ], body: Buffer.from(JSON.stringify({ code: status, message, data })).toString('base64') });
}
async function intercept({ requestId, request }) {
  if (request.method === 'OPTIONS') return reply(requestId, 200);
  const url = new URL(request.url), route = url.pathname.replace('/api/v1', '');
  requests.push({ route, method: request.method, search: url.search, body: request.postData || null, bearer: request.headers.Authorization });
  if (route === '/users/me') return reply(requestId, 200, scenario.user);
  if (route === '/admin/sync/galaxy/status') {
    if (scenario.holdStatus) { scenario.held.push({ kind: 'status', requestId, data: onlineStatus() }); return; }
    return reply(requestId, scenario.statusCode, onlineStatus(), scenario.statusCode === 200 ? 'OK' : 'Chưa tải được trạng thái');
  }
  if (route === '/admin/sync/galaxy/local-file') {
    scenario.writes++;
    assert.equal(request.method, 'POST');
    if (scenario.writeCode === 400) return reply(requestId, 400, { limitShowtimes: 'Giới hạn không được chấp nhận' }, 'Kiểm tra giới hạn nhập mẫu');
    if (scenario.writeCode >= 400) {
      if (scenario.writeCode === 409) scenario.running = true;
      return reply(requestId, scenario.writeCode, null, scenario.writeCode === 409 ? 'Đang đồng bộ Galaxy. Vui lòng thử lại sau.' : 'Không thể nhập mẫu lúc này');
    }
    if (scenario.holdWrite) { scenario.held.push({ kind: 'write', requestId, data: scenario.commitBeforeTimeout ? commit() : null }); return; }
    return reply(requestId, 200, commit());
  }
  if (route === '/movies') {
    const params = url.searchParams;
    const filtered = movies().filter(item => (!params.get('status') || item.status === params.get('status')) && (!params.get('keyword') || item.title.includes(params.get('keyword'))));
    const pageNo = Number(params.get('page') || 0), pageSize = Number(params.get('size') || 10);
    return reply(requestId, scenario.movieCode, { content: filtered.slice(pageNo * pageSize, (pageNo + 1) * pageSize), pageNo, pageSize, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / pageSize), last: true }, 'Catalog phim');
  }
  if (route === '/cinemas') return reply(requestId, 200, cinemas());
  if (route === '/showtimes') return reply(requestId, 200, showtimes().filter(item => !url.searchParams.get('date') || item.startTime.startsWith(url.searchParams.get('date'))));
  if (route === '/admin/reports/revenue') return reply(requestId, 200, { totalRevenue: revision ? 200000 : 100000, totalSuccessfulBookings: revision ? 2 : 1, totalTicketsSold: revision ? 2 : 1,
    breakdown: [{ id: 7, label: movies()[0].title, revenue: revision ? 200000 : 100000, bookingCount: revision ? 2 : 1, ticketCount: revision ? 2 : 1 }] });
  if (route === '/admin/reports/occupancy') return reply(requestId, 200, { totalSeatsAvailable: revision ? 20 : 10, totalSeatsBooked: revision ? 4 : 1, overallOccupancyRate: revision ? 20 : 10, showtimesMissingCapacity: 0,
    breakdown: [{ showtimeId: 10, movieId: 7, cinemaId: 2, auditoriumId: 3, startTime: `${tomorrow}T17:00:00`, active: true, capacitySource: 'INVENTORY', label: 'Suất thử', totalSeats: revision ? 20 : 10, bookedSeats: revision ? 4 : 1, occupancyRate: revision ? 20 : 10 }] });
  throw new Error(`API ngoài dự kiến: ${route}`);
}
async function boot({ width = 1440, timezone = 'Asia/Ho_Chi_Minh', route = '/admin/sync' } = {}) {
  if (bootScript) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: bootScript });
  await cdp.send('Page.navigate', { url: 'about:blank' }); sequence++;
  bootScript = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.clear(); localStorage.setItem('premier_cinema_access_token', 'sync-token');
    localStorage.setItem('premier_cinema_refresh_token', 'sync-refresh'); localStorage.setItem('premier_cinema_session_id', 'sync-session-${sequence}');
    localStorage.setItem('premier_cinema_user', ${JSON.stringify(JSON.stringify(scenario.user))}); window.__syncBoot = ${sequence};
  ` })).identifier;
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: timezone });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, mobile: width < 600, deviceScaleFactor: 1 });
  await cdp.send('Page.navigate', { url: origin + route });
  await cdp.wait(`window.__syncBoot === ${sequence} && Boolean(document.querySelector('#admin-page-title, #admin-access-title'))`);
}
async function ready() { await cdp.wait(`Boolean(document.querySelector('#admin-sync-form')) && Boolean(document.querySelector('#admin-sync-last-success'))`); }
async function field(value) {
  assert.equal(await cdp.evaluate(`(() => { const input = document.querySelector('[name=limitShowtimes]'); if (!input) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`), true);
}
async function submit(times = 1) { await cdp.evaluate(`(() => { const form = document.querySelector('#admin-sync-form'); for (let index = 0; index < ${times}; index++) form.requestSubmit(); })()`); }
async function result() { await cdp.wait(`Boolean(document.querySelector('#admin-sync-result-source')) && !document.querySelector('#admin-sync-form button[type=submit]').disabled`); }
async function spa(route) { await cdp.evaluate(`history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate'))`); }
async function waitHeld(kind) {
  const deadline = Date.now() + 10000;
  while (!scenario.held.some(item => item.kind === kind)) { if (Date.now() > deadline) throw new Error(`Thiếu ${kind}`); await delay(50); }
}
async function release(kind, allowAborted = false) {
  const index = scenario.held.findIndex(item => item.kind === kind); assert.ok(index >= 0);
  const [held] = scenario.held.splice(index, 1);
  try { await reply(held.requestId, 200, held.data || commit()); }
  catch (error) { if (!allowAborted || !error.message.includes('Invalid InterceptionId')) throw error; }
}
async function textOf(selector) { return cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent`); }
async function capture(name) { await writeFile(path.join(artifacts, name), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }

try {
  browser = await startEdgeBrowser({ root, port: 4202, debugPort: 9235, artifacts, executable: process.env.ADMIN_EDGE_PATH }); cdp = browser.cdp;
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', event => { if (event.request.url.includes('/assets/')) modules.push(event.request.url); });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
  cdp.on('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  cdp.on('Fetch.requestPaused', event => { void intercept(event).catch(error => exceptions.push(error.stack)); });

  reset(); await boot(); await ready();
  assert.equal(await cdp.evaluate('document.querySelector("[name=limitShowtimes]").value'), '100'); assert.equal(scenario.writes, 0);
  assert.equal(await cdp.evaluate(`document.querySelector('main').textContent.includes('Galaxy mẫu · Offline')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('main').textContent.includes('data/galaxy_sessions.json')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('input[type=file]') === null`), true);
  assert.equal(await textOf('#admin-sync-last-success'), '17:00:00 10/11/2026'); await capture('sync-desktop.png');
  passed.push('màn hình production tách file offline/trạng thái online, mặc định 100, không upload hoặc tự POST');

  for (const value of ['', '-1', '1.5', '1e3', '2147483648']) {
    await field(value); await submit(); await cdp.wait(`document.querySelector('[name=limitShowtimes]').getAttribute('aria-invalid') === 'true'`);
  }
  assert.equal(scenario.writes, 0);
  passed.push('validation chặn trống/âm/thập phân/số mũ/vượt Integer trước khi gửi');

  reset({ holdWrite: true }); await boot({ timezone: 'America/Los_Angeles' }); await ready(); await submit(2); await waitHeld('write');
  assert.equal(scenario.writes, 1); assert.equal(await cdp.evaluate(`document.querySelector('#admin-sync-form fieldset').disabled`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-sync-form button[type=submit]').disabled`), true);
  const posted = requests.filter(item => item.route.endsWith('/local-file')).at(-1);
  assert.deepEqual(Object.fromEntries(new URLSearchParams(posted.search)), { limitShowtimes: '100' });
  assert.equal(posted.body == null ? null : JSON.parse(posted.body), null); assert.equal(posted.bearer, 'Bearer sync-token');
  await cdp.key('Enter'); assert.equal(scenario.writes, 1);
  scenario.holdWrite = false; await release('write'); await result();
  for (const [key, value] of Object.entries({ totalMoviesSynced: '3', totalCinemasSynced: '2', totalAuditoriumsSynced: '2', totalShowtimesSynced: '4', totalShowtimesSkipped: '1', totalShowtimesDeactivated: '0', totalMoviesEnded: '0', totalSeatsSynced: '0', totalShowtimeSeatsSynced: '0' })) {
    assert.equal(await textOf(`#admin-sync-count-${key}`), value);
  }
  assert.equal(await textOf('#admin-sync-result-source'), 'File mẫu offline (LOCAL_FILE)');
  assert.equal(await textOf('#admin-sync-result-time'), '01:00:00 13/11/2026');
  assert.equal(await textOf('#admin-sync-last-success'), '17:00:00 10/11/2026');
  assert.equal(await textOf('#admin-sync-online-error'), 'Lỗi online riêng từ lượt trước');
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast][data-type=success]').length`), 1);
  passed.push('hai submit/Enter chỉ một POST null body/query/Bearer; khóa form, đủ 9 bộ đếm và giờ Việt Nam trên browser Los Angeles; offline không đổi mốc/lỗi online');

  const beforeReload = scenario.writes;
  await cdp.evaluate('window.__reload = true'); await cdp.send('Page.reload');
  await cdp.wait(`!window.__reload && Boolean(document.querySelector('#admin-sync-last-success'))`);
  assert.equal(scenario.writes, beforeReload); assert.equal(await cdp.evaluate(`Boolean(document.querySelector('#admin-sync-result'))`), false);
  passed.push('F5 không tự nhập lại và không bịa lịch sử kết quả offline từ trạng thái online');

  reset({ enabled: false, lastAttemptAt: null, lastSuccessAt: null, lastError: null, result: { totalShowtimesSynced: 0, totalShowtimesSkipped: 0, message: 'File cũ không có suất tương lai.' } });
  await boot(); await ready(); await field('0'); await submit(); await result();
  assert.equal(new URLSearchParams(requests.filter(item => item.route.endsWith('/local-file')).at(-1).search).get('limitShowtimes'), '0');
  assert.equal(await textOf('#admin-sync-result-limit'), 'Tất cả suất tương lai'); assert.equal(await textOf('#admin-sync-count-totalShowtimesSynced'), '0');
  assert.equal(await textOf('#admin-sync-last-success'), 'Chưa có mốc được ghi nhận');
  assert.equal(await textOf('#admin-sync-schedule'), 'Đang tắt lịch online');
  passed.push('0 gửi tất cả, lịch online tắt vẫn nhập mẫu được; 0 suất do ngày file cũ là kết quả hợp lệ, không gán online thành công');

  reset({ running: true }); await boot(); await ready();
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-sync-form button[type=submit]').disabled`), true);
  const readsBefore = requests.filter(item => item.route.endsWith('/status')).length;
  scenario.running = false; await cdp.wait(`!document.querySelector('#admin-sync-form button[type=submit]').disabled`);
  assert.ok(requests.filter(item => item.route.endsWith('/status')).length > readsBefore); assert.equal(scenario.writes, 0);
  passed.push('running dùng chung khóa nhập và tự đọc lại đến khi backend rảnh, không phát POST theo polling');

  reset({ writeCode: 409 }); await boot(); await ready(); await field('25'); await submit();
  await cdp.wait(`document.querySelector('#admin-sync-form-title').closest('section').textContent.includes('Đang đồng bộ Galaxy') && document.querySelector('#admin-sync-form button[type=submit]').disabled`);
  assert.equal(scenario.writes, 1); assert.equal(await cdp.evaluate(`document.querySelector('[name=limitShowtimes]').value`), '25');
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast][data-type=error]').length`), 1);
  scenario.running = false; scenario.writeCode = 200; await cdp.wait(`!document.querySelector('#admin-sync-form button[type=submit]').disabled`);
  assert.equal(scenario.writes, 1); await submit(); await result(); assert.equal(scenario.writes, 2);
  passed.push('409 giữ giới hạn, một toast, chỉ GET trạng thái và chờ thao tác thử lại rõ ràng');

  reset(); await boot(); await ready(); await submit(); await result();
  scenario.writeCode = 400; await field('50'); await submit();
  await cdp.wait(`document.querySelector('[name=limitShowtimes]').getAttribute('aria-invalid') === 'true'`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast][data-type=error]').length`), 0);
  scenario.writeCode = 500; await field('60'); await submit(); await cdp.wait(`document.querySelector('main').textContent.includes('Không thể nhập mẫu lúc này')`);
  assert.equal(await cdp.evaluate(`document.querySelector('[name=limitShowtimes]').value`), '60');
  assert.equal(await textOf('#admin-sync-count-totalMoviesSynced'), '3');
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast][data-type=error]').length`), 1);
  scenario.writeCode = 200; await submit(); await result(); assert.equal(await textOf('#admin-sync-result-limit'), '60 suất');
  passed.push('400 hiện theo trường không toast lỗi lặp; 500 giữ giới hạn/kết quả trước và chỉ một toast, có thể chủ động gửi lại');

  reset({ holdWrite: true, commitBeforeTimeout: true }); await boot(); await ready(); await field('30'); await submit(); await waitHeld('write');
  const held = scenario.held.find(item => item.kind === 'write');
  await cdp.send('Fetch.failRequest', { requestId: held.requestId, errorReason: 'TimedOut' }); scenario.held = [];
  await cdp.wait(`document.querySelector('main').textContent.includes('Chưa xác định được kết quả nhập')`); await delay(1200);
  assert.equal(scenario.writes, 1); const checkBefore = requests.length;
  await cdp.click('Đọc catalog để đối chiếu'); await cdp.wait(`Boolean(document.querySelector('#admin-sync-catalog-check'))`);
  assert.equal(requests.slice(checkBefore).every(item => item.method === 'GET'), true); assert.equal(scenario.writes, 1);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-sync-catalog-check').textContent.includes('1 phim · 1 rạp · 2 suất')`), true);
  assert.equal(await textOf('#admin-sync-last-success'), '17:00:00 10/11/2026');
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-sync-result') === null`), true);
  passed.push('mất phản hồi sau khi phía mô phỏng ghi: không retry POST, giữ lần gửi và đối chiếu catalog chỉ GET, không suy ra hoàn tất từ online');

  reset({ holdWrite: true }); await boot(); await ready(); await submit(); await waitHeld('write');
  await spa('/admin/reports'); await cdp.wait(`Boolean(document.querySelector('#admin-kpi-revenue'))`);
  await spa('/admin/sync'); await ready();
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-sync-form button[type=submit]').disabled`), true);
  await submit(); assert.equal(scenario.writes, 1);
  scenario.holdWrite = false; await release('write'); await cdp.wait(`!document.querySelector('#admin-sync-form button[type=submit]').disabled`);
  passed.push('chuyển trang rồi quay lại vẫn thấy yêu cầu pending toàn tab và không gửi trùng');

  reset(); await boot(); await ready();
  await spa('/movies'); await cdp.wait(`document.querySelector('main').textContent.includes('Phim trước khi nhập')`);
  await spa(`/showtimes?date=${tomorrow}`); await cdp.wait(`Boolean(document.querySelector('a[href="/booking/10"]'))`);
  await spa('/admin/movies'); await cdp.wait(`document.querySelector('main tbody')?.textContent.includes('Phim trước khi nhập')`);
  await spa(`/admin/showtimes?date=${tomorrow}`); await cdp.wait(`document.querySelectorAll('main tbody tr').length === 1`);
  await spa('/admin/reports'); await cdp.wait(`document.querySelector('#admin-kpi-revenue')?.textContent === '100.000đ'`);
  await spa('/admin/sync'); await ready(); await submit(); await result();
  await spa('/movies'); await cdp.wait(`document.querySelector('main').textContent.includes('Phim Galaxy mẫu đã nhập')`);
  await spa(`/showtimes?date=${tomorrow}`); await cdp.wait(`Boolean(document.querySelector('a[href="/booking/11"]'))`);
  await spa('/admin/movies'); await cdp.wait(`document.querySelector('main tbody')?.textContent.includes('Phim Galaxy mẫu đã nhập')`);
  await spa(`/admin/showtimes?date=${tomorrow}`); await cdp.wait(`document.querySelectorAll('main tbody tr').length === 2`);
  await spa('/admin/reports'); await cdp.wait(`document.querySelector('#admin-kpi-revenue')?.textContent === '200.000đ'`);
  assert.equal(await textOf('#admin-kpi-capacity'), '20');
  passed.push('nhập thành công invalidate cache đang ấm: catalog/lịch khách, phim/suất Admin và cả hai báo cáo đều đọc dữ liệu mới qua SPA');

  reset({ statusCode: 500 }); await boot(); await cdp.wait(`document.querySelector('main').textContent.includes('Chưa đọc được trạng thái')`);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-sync-form button[type=submit]').disabled`), false);
  scenario.statusCode = 200; await cdp.click('Thử lại'); await ready();
  scenario.statusCode = 500; await cdp.click('Đọc lại', 'main aside'); await cdp.wait(`document.querySelector('main aside').textContent.includes('Đang hiển thị trạng thái đã đọc trước đó')`);
  assert.equal(await textOf('#admin-sync-last-success'), '17:00:00 10/11/2026');
  scenario.statusCode = 200; await cdp.click('Thử lại', 'main aside'); await ready();
  passed.push('lỗi GET trạng thái có retry riêng và giữ dữ liệu cũ, không trở thành lỗi nhập offline hay tự gửi POST');

  reset({ result: { source: 'GALAXY_ONLINE', totalMoviesSynced: undefined } }); await boot(); await ready(); await submit(); await result();
  assert.equal(await textOf('#admin-sync-result-source'), 'Chưa xác nhận nguồn file mẫu');
  assert.equal(await textOf('#admin-sync-count-totalMoviesSynced'), '—');
  assert.equal(await textOf('#admin-sync-last-success'), '17:00:00 10/11/2026');
  passed.push('nguồn phản hồi bất thường và bộ đếm thiếu được hiển thị rõ, không giả số 0 hay thay mốc online');

  reset({ lastError: 'Lỗi online ' + 'mẫu'.repeat(100) }); await boot({ width: 390 }); await ready(); await submit(); await result();
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await capture('sync-390.png'); await cdp.evaluate(`document.querySelector('#admin-sync-result').scrollIntoView({ block: 'start' }); window.scrollBy(0, -65)`); await capture('sync-result-390.png');
  await cdp.evaluate(`document.querySelector('main aside').scrollIntoView({ block: 'start' }); window.scrollBy(0, -65)`); await capture('sync-online-390.png');
  await cdp.evaluate(`document.querySelector('[name=limitShowtimes]').focus()`); await cdp.key('Tab');
  assert.equal(await cdp.evaluate(`document.activeElement === document.querySelector('#admin-sync-form button[type=submit]')`), true);
  passed.push('390px: form/kết quả/lỗi dài không tràn trang, Tab đi tới nút nhập và focus nhìn thấy');

  reset({ writeCode: 403 }); await boot(); await ready(); await submit(); await cdp.wait(`document.body.textContent.includes('403 — Không có quyền quản trị')`);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-sync-result') === null`), true);
  reset({ user: { ...admin, role: 'CUSTOMER' } }); const requestBefore = requests.length, moduleBefore = modules.length;
  await boot(); await cdp.wait(`document.body.textContent.includes('403 — Không có quyền quản trị')`);
  assert.deepEqual(requests.slice(requestBefore).map(item => item.route), ['/users/me']);
  assert.equal(modules.slice(moduleBefore).some(url => url.includes('DataSync')), false);
  passed.push('403 khi nhập đóng nội dung; CUSTOMER không tải module, GET trạng thái hay POST nhập mẫu');

  assert.equal(requests.filter(item => item.method === 'POST').every(item => item.route === '/admin/sync/galaxy/local-file'), true);
  assert.deepEqual(exceptions, []);
  const report = { mode: 'Edge production, REST/catalog/status mô phỏng; không có Galaxy online/DB thật', passed, runtimeExceptions: exceptions.length, mockRequests: requests.length };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, artifacts }, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ passed, requests, exceptions, scenario, revision, location: await cdp?.evaluate('location.href'), body: await cdp?.evaluate('document.body.innerText') }, null, 2));
  console.error(`Kiểm thử nhập Galaxy mẫu không đạt: ${path.join(artifacts, 'failure.json')}`); throw error;
} finally { await browser?.close(); }
