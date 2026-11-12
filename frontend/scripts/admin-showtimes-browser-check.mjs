// Production Admin + customer schedule, mocked REST and an in-memory committed catalog.
// No backend, DB, real login or transaction. Reloads retain mock server records only.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVietnamClock } from '../src/features/showtimes/scheduleUtils.js';
import { delay, startEdgeBrowser } from './lib/edge-browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = await mkdtemp(path.join(tmpdir(), 'cinema-admin-showtimes-'));
const origin = 'http://127.0.0.1:4200';
const admin = { id: 1, fullName: 'Admin mô phỏng', email: 'admin@example.invalid', role: 'ADMIN' };
const today = getVietnamClock().date;
const day1 = getVietnamClock(new Date(Date.parse(`${today}T12:00:00+07:00`) + 86_400_000)).date;
const day2 = getVietnamClock(new Date(Date.parse(`${day1}T12:00:00+07:00`) + 86_400_000)).date;
const requests = [], exceptions = [], passed = [];
let browser, cdp, bootScript, sequence = 0, scenario, slots;
const movies = Array.from({ length: 105 }, (_, index) => ({ id: index + 1, title: `Phim ${String(index + 1).padStart(3, '0')}`,
  durationMinutes: index === 1 ? 90 : 120, status: index % 2 ? 'COMING_SOON' : 'NOW_SHOWING', posterUrl: null, releaseDate: today }));
const cinemas = [
  { id: 1, name: 'Rạp Trung Tâm', city: 'Hồ Chí Minh', auditoriums: [{ id: 11, name: 'Phòng 1' }, { id: 12, name: 'Phòng 2' }] },
  { id: 2, name: 'Rạp Bờ Sông', city: 'Hà Nội', auditoriums: [{ id: 21, name: 'Phòng Sông' }] },
  { id: 3, name: 'Rạp chưa có phòng', city: 'Hà Nội', auditoriums: [] },
];
function slot(id, movieId, cinemaId, auditoriumId, startTime, endTime) {
  const cinema = cinemas.find(item => item.id === cinemaId), movie = movies.find(item => item.id === movieId);
  return { id, movieId, movieTitle: movie.title, posterUrl: null, cinemaId, cinemaName: cinema.name, auditoriumId,
    auditoriumName: cinema.auditoriums.find(item => item.id === auditoriumId).name, startTime, endTime, basePrice: 90000, active: true };
}
function reset(options = {}) {
  slots = [slot(1, 1, 1, 11, `${day1}T12:00:00`, `${day1}T14:15:00`),
    slot(2, 2, 2, 21, `${day1}T15:00:00`, `${day1}T16:45:00`),
    slot(3, 1, 1, 12, `${day2}T18:00:00`, `${day2}T20:15:00`)];
  scenario = { user: admin, readStatus: 200, movieStatus: 200, cinemaStatus: 200, writeStatus: 201, writes: 0, held: [], ...options };
}
async function reply(requestId, status, data, message = 'OK') {
  await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
    { name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: origin },
    { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept' },
    { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
  ], body: Buffer.from(JSON.stringify({ code: status, message, data })).toString('base64') });
}
function commit(body) {
  const created = slot(Math.max(...slots.map(item => item.id), 0) + 1, body.movieId,
    cinemas.find(cinema => cinema.auditoriums.some(room => room.id === body.auditoriumId)).id,
    body.auditoriumId, body.startTime, body.endTime);
  created.basePrice = body.basePrice; slots.push(created); return created;
}
async function intercept({ requestId, request }) {
  if (request.method === 'OPTIONS') return reply(requestId, 200);
  const url = new URL(request.url), route = url.pathname.replace('/api/v1', '');
  const body = request.postData ? JSON.parse(request.postData) : null;
  requests.push({ route, method: request.method, search: url.search, bearer: request.headers.Authorization, body });
  if (route === '/users/me') return reply(requestId, 200, scenario.user);
  if (route === '/auth/refresh') return reply(requestId, 401, null, 'Hết phiên');
  if (route === '/movies') {
    const pageNo = Number(url.searchParams.get('page') || 0), pageSize = Number(url.searchParams.get('size') || 10);
    return reply(requestId, scenario.movieStatus, { content: movies.slice(pageNo * pageSize, (pageNo + 1) * pageSize), pageNo, pageSize,
      totalElements: movies.length, totalPages: Math.ceil(movies.length / pageSize), last: (pageNo + 1) * pageSize >= movies.length }, 'Danh sách phim');
  }
  if (route === '/cinemas') return reply(requestId, scenario.cinemaStatus, cinemas, 'Danh sách rạp');
  if (route === '/showtimes') {
    const params = url.searchParams;
    const data = slots.filter(item => item.active && item.startTime > getVietnamClock().dateTime
      && (!params.get('date') || item.startTime.slice(0, 10) === params.get('date'))
      && (!params.get('cinemaId') || String(item.cinemaId) === params.get('cinemaId'))
      && (!params.get('movieId') || String(item.movieId) === params.get('movieId'))).sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (scenario.holdRead) { scenario.held.push({ kind: 'read', requestId, data }); return; }
    return reply(requestId, scenario.readStatus, data, scenario.readStatus === 200 ? 'OK' : 'Không tải được lịch chiếu');
  }
  if (route === '/admin/showtimes') {
    scenario.writes++;
    if (scenario.user.role !== 'ADMIN') return reply(requestId, 403, null, 'Không có quyền');
    if (scenario.writeStatus === 400) return reply(requestId, 400, { basePrice: 'Giá vé không được chấp nhận', endTime: 'Kiểm tra giờ kết thúc' }, 'Kiểm tra dữ liệu');
    if (scenario.writeStatus >= 400) return reply(requestId, scenario.writeStatus, null, scenario.writeStatus === 409 ? 'Xung đột lịch chiếu: phòng đã có suất khác.' : 'Không thể lưu suất lúc này');
    if (slots.some(item => item.active && item.auditoriumId === body.auditoriumId && item.startTime < body.endTime && item.endTime > body.startTime)) {
      return reply(requestId, 409, null, 'Xung đột lịch chiếu: phòng đã có suất khác.');
    }
    if (scenario.holdWrite) { scenario.held.push({ kind: 'write', requestId, body, data: scenario.commitBeforeTimeout ? commit(body) : null }); return; }
    return reply(requestId, 201, commit(body));
  }
  throw new Error(`Unexpected API ${route}`);
}
async function boot({ route = `/admin/showtimes?date=${day1}`, width = 1280, timezone = 'Asia/Ho_Chi_Minh' } = {}) {
  if (bootScript) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: bootScript });
  await cdp.send('Page.navigate', { url: 'about:blank' }); sequence++;
  bootScript = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.clear();
    localStorage.setItem('premier_cinema_access_token', 'showtime-token');
    localStorage.setItem('premier_cinema_refresh_token', 'showtime-refresh');
    localStorage.setItem('premier_cinema_session_id', 'showtime-session-${sequence}');
    localStorage.setItem('premier_cinema_user', ${JSON.stringify(JSON.stringify(scenario.user))});
    window.__showtimeBoot = ${sequence};
  ` })).identifier;
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: timezone });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, mobile: width < 600, deviceScaleFactor: 1 });
  await cdp.send('Page.navigate', { url: origin + route });
  await cdp.wait(`window.__showtimeBoot === ${sequence} && Boolean(document.querySelector('#admin-page-title, #admin-access-title'))`);
}
async function field(name, value, scope = 'dialog') {
  assert.equal(await cdp.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(`${scope} [name="${name}"]`)}); if (!input) return false;
    const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); return true;
  })()`), true, `Field ${name}`);
}
async function waitTable(count = 2) {
  await cdp.wait(`document.querySelectorAll('main tbody tr').length === ${count} && document.querySelector('[aria-label="Danh sách suất chiếu quản trị"]')?.parentElement.getAttribute('aria-busy') === 'false'`);
}
async function openCreate() {
  await cdp.wait(`[...document.querySelectorAll('main button')].some(b => b.textContent.includes('Thêm suất chiếu') && !b.disabled)`);
  await cdp.click('Thêm suất chiếu'); await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`);
}
async function fill(values = {}) {
  for (const [name, value] of Object.entries({ movieId: '1', cinemaId: '1', auditoriumId: '12', startTime: `${day1}T23:30`, basePrice: '90000.50', ...values })) await field(name, value);
}
async function submit(times = 1) { await cdp.evaluate(`(() => { const form = document.querySelector('dialog form'); for (let index = 0; index < ${times}; index++) form.requestSubmit(); })()`); }
async function spa(route) { await cdp.evaluate(`history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate'))`); }
async function reload(count = 2) {
  await cdp.evaluate('window.__reload = true'); await cdp.send('Page.reload');
  await cdp.wait(`!window.__reload && Boolean(document.querySelector('#admin-showtime-filters'))`); await waitTable(count);
}
async function waitHeld(kind) {
  const deadline = Date.now() + 10000;
  while (!scenario.held.some(item => item.kind === kind)) { if (Date.now() > deadline) throw new Error(`Missing ${kind}`); await delay(50); }
}
async function release(kind) {
  const index = scenario.held.findIndex(item => item.kind === kind); assert.ok(index >= 0);
  const [held] = scenario.held.splice(index, 1);
  await reply(held.requestId, kind === 'write' ? 201 : 200, held.data || commit(held.body));
}

try {
  browser = await startEdgeBrowser({ root, port: 4200, debugPort: 9233, artifacts, executable: process.env.ADMIN_EDGE_PATH }); cdp = browser.cdp;
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
  cdp.on('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  cdp.on('Fetch.requestPaused', event => { void intercept(event).catch(error => exceptions.push(error.stack)); });

  reset(); await boot(); await waitTable();
  assert.equal(await cdp.evaluate(`document.querySelector('main tbody').textContent.includes('90.000đ')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('main tbody time').textContent.startsWith('12:00')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('main tbody button') === null`), true);
  await writeFile(path.join(artifacts, 'showtimes-desktop.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  passed.push('real production table shows movie, cinema/room, local start/end and VND; only open-sale list and create actions');

  await field('cinemaId', '1', '#admin-showtime-filters'); await waitTable(1);
  await field('movieId', '1', '#admin-showtime-filters'); await waitTable(1);
  const filterRequest = new URLSearchParams(requests.filter(r => r.route === '/showtimes').at(-1).search);
  assert.deepEqual(Object.fromEntries(filterRequest), { date: day1, cinemaId: '1', movieId: '1' });
  await reload(1);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-showtime-cinemaId').value`), '1');
  await field('date', day2, '#admin-showtime-filters'); await cdp.wait(`document.querySelector('main tbody')?.textContent.includes('18:00')`);
  await cdp.evaluate('history.back()'); await cdp.wait(`document.querySelector('main tbody')?.textContent.includes('12:00')`);
  await cdp.click('Xóa bộ lọc'); await waitTable(2);
  assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).get('date'), day1);
  passed.push('date/cinema/movie filter REST requests, F5 and Back keep URL context; clearing keeps the date');

  reset(); await boot({ route: '/admin/showtimes?date=2026-02-30&movieId=bad&cinemaId=-1&source=test' });
  await cdp.wait(`document.querySelector('main').textContent.includes('Không có suất chiếu phù hợp')`);
  assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).get('date'), today);
  assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).has('movieId'), false);
  assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).get('source'), 'test');
  passed.push('invalid calendar dates and IDs canonicalize before REST while unrelated query params survive');

  reset({ holdRead: true }); await boot(); await waitHeld('read');
  assert.equal(await cdp.evaluate(`document.querySelector('main').textContent.includes('Đang tải dữ liệu')`), true);
  scenario.holdRead = false; await release('read'); await waitTable();
  scenario.readStatus = 500; await cdp.click('Làm mới');
  await cdp.wait(`document.querySelector('main [role=alert]')?.textContent.includes('Không tải được lịch chiếu')`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('main tbody tr').length`), 2);
  scenario.readStatus = 200; await cdp.click('Thử lại'); await waitTable();
  await field('date', '2000-01-01', '#admin-showtime-filters'); await cdp.wait(`document.querySelector('main').textContent.includes('Không có suất chiếu phù hợp')`);
  passed.push('loading, past-day empty, transient retry and failed refetch keep old rows with a recoverable error');

  reset({ movieStatus: 500, cinemaStatus: 500 }); await boot(); await waitTable();
  await cdp.wait(`document.querySelectorAll('main [role=alert]').length === 2`);
  assert.equal(await cdp.evaluate(`[...document.querySelectorAll('main button')].find(b => b.textContent.includes('Thêm suất chiếu')).disabled`), true);
  scenario.movieStatus = 200; scenario.cinemaStatus = 200;
  for (let index = 0; index < 2; index++) await cdp.click('Thử lại');
  await openCreate();
  assert.equal(await cdp.evaluate(`document.querySelectorAll('dialog [name=movieId] option').length`), 106);
  assert.equal(requests.some(r => r.route === '/movies' && new URLSearchParams(r.search).get('page') === '1'), true);
  await cdp.key('Escape');
  passed.push('failed catalog queries leave schedule readable and block create until retry; movie options collect every server page');

  reset(); await boot(); await waitTable(); await openCreate();
  await field('cinemaId', '1'); await field('auditoriumId', '11'); await field('cinemaId', '2');
  assert.equal(await cdp.evaluate(`document.querySelector('dialog [name=auditoriumId]').value`), '');
  assert.deepEqual(await cdp.evaluate(`[...document.querySelectorAll('dialog [name=auditoriumId] option')].map(o => o.value)`), ['', '21']);
  await field('cinemaId', '3'); assert.equal(await cdp.evaluate(`document.querySelector('dialog [name=auditoriumId]').disabled`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog').textContent.includes('chưa có phòng chiếu')`), true);
  await cdp.key('Escape');
  passed.push('changing cinema clears prior room, offers only owned rooms and explains cinemas without rooms');

  await openCreate(); await fill();
  assert.equal(await cdp.evaluate(`document.querySelector('dialog [name=endTime]').value`), `${day2}T01:45`);
  await field('movieId', '2'); assert.equal(await cdp.evaluate(`document.querySelector('dialog [name=endTime]').value`), `${day2}T01:15`);
  await field('endTime', `${day2}T02:30`); await field('startTime', `${day1}T22:00`); await field('movieId', '1');
  assert.equal(await cdp.evaluate(`document.querySelector('dialog [name=endTime]').value`), `${day2}T02:30`);
  await cdp.click('Dùng giờ gợi ý', 'dialog'); assert.equal(await cdp.evaluate(`document.querySelector('dialog [name=endTime]').value`), `${day2}T00:15`);
  await cdp.key('Escape');
  passed.push('duration plus 15-minute suggestion crosses midnight, follows movie/start edits and respects manual end until explicitly restored');

  await openCreate(); await submit();
  await cdp.wait(`document.querySelector('dialog [name=movieId]').getAttribute('aria-invalid') === 'true'`);
  assert.equal(scenario.writes, 0);
  await fill({ startTime: `${today}T00:00`, basePrice: '0' }); await submit();
  await cdp.wait(`document.querySelector('dialog [name=startTime]').getAttribute('aria-invalid') === 'true'`);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog [name=basePrice]').getAttribute('aria-invalid')`), 'true');
  await fill(); await field('endTime', `${day1}T23:30`); await submit();
  await cdp.wait(`document.querySelector('dialog [name=endTime]').getAttribute('aria-invalid') === 'true'`);
  assert.equal(scenario.writes, 0); await cdp.key('Escape');
  passed.push('required fields, positive price, Vietnam future and strict end order reject invalid form without POST');

  reset({ holdWrite: true }); await boot({ timezone: 'America/Los_Angeles' }); await waitTable(); await openCreate(); await fill({ movieId: '105' }); await submit(2); await waitHeld('write');
  assert.equal(scenario.writes, 1);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog fieldset').disabled`), true);
  await cdp.key('Escape'); assert.equal(await cdp.evaluate(`Boolean(document.querySelector('dialog[open]'))`), true);
  const posted = requests.filter(r => r.route === '/admin/showtimes').at(-1);
  assert.equal(posted.bearer, 'Bearer showtime-token');
  assert.deepEqual(posted.body, { movieId: 105, auditoriumId: 12, startTime: `${day1}T23:30:00`, endTime: `${day2}T01:45:00`, basePrice: 90000.5 });
  scenario.holdWrite = false; await release('write'); await cdp.wait(`!document.querySelector('dialog[open]')`); await waitTable(1);
  assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).get('movieId'), '105');
  assert.equal(await cdp.evaluate(`document.querySelector('main tbody').textContent.includes('Phim 105')`), true);
  await reload(1);
  passed.push('Los Angeles browser sends both exact Vietnam timestamps and DTO/Bearer; duplicate submits create once, busy blocks Escape and save is visible after F5');

  reset(); await boot(); await waitTable(); await openCreate(); await fill({ auditoriumId: '11', startTime: `${day1}T13:00` }); await submit();
  await cdp.wait(`document.querySelector('dialog').textContent.includes('Xung đột lịch chiếu')`);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog [name=startTime]').value`), `${day1}T13:00`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast][data-type=error]').length`), 1);
  assert.equal(scenario.writes, 1); await field('auditoriumId', '12'); await submit(); await cdp.wait(`!document.querySelector('dialog[open]')`); await waitTable(2);
  passed.push('overlapping same-room interval returns 409, preserves the complete draft and permits explicit correction to another room');

  reset({ writeStatus: 400 }); await boot(); await waitTable(); await openCreate(); await fill(); await submit();
  await cdp.wait(`document.querySelector('dialog [name=basePrice]').getAttribute('aria-invalid') === 'true'`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast]').length`), 0);
  scenario.writeStatus = 500; await field('basePrice', '85000'); await field('endTime', `${day2}T02:00`); await submit();
  await cdp.wait(`document.querySelector('dialog').textContent.includes('Không thể lưu suất lúc này')`);
  assert.equal(await cdp.evaluate(`document.querySelector('dialog [name=basePrice]').value`), '85000');
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast][data-type=error]').length`), 1);
  scenario.writeStatus = 201; await submit(); await cdp.wait(`!document.querySelector('dialog[open]')`);
  passed.push('400 field errors avoid duplicate toast; 500 retains manual values and one toast, then explicit resubmit succeeds');

  reset(); await boot(); await waitTable(); await spa(`/showtimes?date=${day1}`);
  await cdp.wait(`Boolean(document.querySelector('main a[href="/booking/1"]'))`);
  await spa(`/admin/showtimes?date=${day1}&cinemaId=1&movieId=1`); await waitTable(1);
  await openCreate(); await fill({ startTime: `${day1}T21:30` }); await submit(); await cdp.wait(`!document.querySelector('dialog[open]')`); await waitTable(2);
  const created = slots.at(-1); await spa(`/showtimes?date=${day1}`);
  await cdp.wait(`Boolean(document.querySelector('main a[href="/booking/${created.id}"]'))`);
  assert.equal(await cdp.evaluate(`document.querySelector('main a[href="/booking/${created.id}"]').textContent.includes('21:30')`), true);
  passed.push('creating invalidates an already warm customer schedule; the real public page shows the new slot and internal booking link');

  reset({ holdWrite: true, commitBeforeTimeout: true }); await boot(); await waitTable(); await openCreate(); await fill(); await submit(); await waitHeld('write');
  const held = scenario.held.find(item => item.kind === 'write');
  await cdp.send('Fetch.failRequest', { requestId: held.requestId, errorReason: 'TimedOut' }); scenario.held = [];
  await cdp.wait(`document.querySelector('dialog').textContent.includes('Chưa xác định được kết quả lưu')`); await delay(1200);
  assert.equal(scenario.writes, 1); await cdp.click('Kiểm tra lại danh sách', 'dialog');
  await cdp.wait(`document.querySelector('dialog').textContent.includes('Danh sách đã được làm mới')`);
  assert.equal(scenario.writes, 1); await cdp.key('Escape'); await waitTable(3);
  passed.push('lost response after mock commit never retries POST, keeps draft and offers GET-only reconciliation');

  reset(); await boot({ width: 390 }); await waitTable();
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await writeFile(path.join(artifacts, 'showtimes-390.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await openCreate(); await fill();
  for (let index = 0; index < 24; index++) { await cdp.key('Tab', index < 12 ? 0 : 8); assert.equal(await cdp.evaluate(`document.querySelector('dialog').contains(document.activeElement)`), true); }
  assert.equal(await cdp.evaluate(`document.querySelector('dialog').scrollWidth <= document.querySelector('dialog').clientWidth`), true);
  await cdp.evaluate(`document.querySelector('dialog').scrollTop = 0`);
  await writeFile(path.join(artifacts, 'showtime-form-390.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await cdp.key('Escape'); await cdp.wait(`!document.querySelector('dialog[open]')`);
  assert.equal(await cdp.evaluate(`document.activeElement.textContent.includes('Thêm suất chiếu')`), true);
  passed.push('390px table and datetime form fit the viewport; keyboard focus loops both ways and Escape restores opener');

  reset({ user: { ...admin, role: 'CUSTOMER' } }); const before = requests.length;
  await boot(); await cdp.wait(`document.body.textContent.includes('403 — Không có quyền quản trị')`);
  assert.deepEqual(requests.slice(before).map(item => item.route), ['/users/me']);
  passed.push('CUSTOMER is denied before catalog/showtime queries or create form mount');

  assert.deepEqual(exceptions, []);
  const report = { mode: 'Edge production build, mocked REST/in-memory schedule; no live API/DB', passed, runtimeExceptions: exceptions.length, mockRequests: requests.length };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, artifacts }, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ passed, requests, exceptions, scenario, slots,
    location: await cdp?.evaluate('location.href'), body: await cdp?.evaluate('document.body.innerText') }, null, 2));
  console.error(`Showtime browser check failed: ${path.join(artifacts, 'failure.json')}`); throw error;
} finally { await browser?.close(); }
