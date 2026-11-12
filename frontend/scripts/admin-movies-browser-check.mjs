// Production MovieManager + intercepted REST with a persistent in-memory server catalog.
// No real backend, database, login or writes. F5 retains the mock server's committed records.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { delay, startEdgeBrowser } from './lib/edge-browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = await mkdtemp(path.join(tmpdir(), 'cinema-admin-movies-'));
const origin = 'http://127.0.0.1:4199';
const user = { id: 1, fullName: 'Admin mô phỏng', email: 'admin@example.invalid', role: 'ADMIN' };
const requests = [], exceptions = [], passed = [];
let browser, cdp, bootScript, sequence = 0, movies, nextId, scenario;

function reset({ count = 25, status, ...options } = {}) {
  movies = Array.from({ length: count }, (_, index) => ({ id: index + 1, title: `Phim ${String(index + 1).padStart(2, '0')}`,
    description: `Mô tả ${index + 1}`, durationMinutes: 90 + index, releaseDate: '2026-11-01', posterUrl: null, trailerUrl: null,
    genre: 'Chính kịch', ageRating: 'T13', status: status || ['NOW_SHOWING', 'COMING_SOON', 'ENDED'][index % 3],
    country: 'Việt Nam', directors: ['Đạo diễn mẫu'], landscapeUrl: null, createdAt: '2026-11-01T10:00:00' }));
  nextId = count + 1;
  scenario = { user, readStatus: 200, writeStatus: 200, held: [], writes: 0, ...options };
}

async function reply(requestId, status, data, message = 'OK') {
  await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
    { name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: origin },
    { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept' },
    { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, OPTIONS' },
  ], body: Buffer.from(JSON.stringify({ code: status, message, data })).toString('base64') });
}

function commit(request) {
  const body = JSON.parse(request.postData);
  if (request.method === 'POST') {
    const movie = { ...body, id: nextId++, country: null, directors: [], actors: [], createdAt: '2027-01-02T10:00:00' };
    movies.push(movie); return movie;
  }
  const movie = movies.find(item => item.id === Number(new URL(request.url).pathname.split('/').at(-1)));
  Object.assign(movie, body); return movie;
}

async function intercept({ requestId, request }) {
  const url = new URL(request.url);
  if (url.hostname === 'images.example.invalid') return cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' });
  if (request.method === 'OPTIONS') return reply(requestId, 200);
  const route = url.pathname.replace('/api/v1', '');
  requests.push({ route, method: request.method, search: url.search, bearer: request.headers.Authorization, body: request.postData ? JSON.parse(request.postData) : null });
  if (route === '/users/me') return reply(requestId, 200, scenario.user);
  if (route === '/auth/refresh') return reply(requestId, 401, null, 'Hết phiên');
  if (route === '/movies') {
    const params = url.searchParams;
    const filtered = movies.filter(movie => (!params.get('status') || movie.status === params.get('status'))
      && (!params.get('keyword') || movie.title.toLocaleLowerCase('vi').includes(params.get('keyword').toLocaleLowerCase('vi')))).sort((a, b) => b.id - a.id);
    const pageNo = Number(params.get('page') || 0), pageSize = Number(params.get('size') || 10);
    const data = { content: filtered.slice(pageNo * pageSize, (pageNo + 1) * pageSize), pageNo, pageSize,
      totalElements: filtered.length, totalPages: Math.ceil(filtered.length / pageSize), last: (pageNo + 1) * pageSize >= filtered.length };
    if (scenario.holdRead) { scenario.held.push({ kind: 'read', requestId, data }); return; }
    return reply(requestId, scenario.readStatus, data, scenario.readStatus === 200 ? 'OK' : 'Không tải được phim');
  }
  if (route === '/admin/movies' || /^\/admin\/movies\/\d+$/.test(route)) {
    scenario.writes++;
    if (scenario.user.role !== 'ADMIN') return reply(requestId, 403, null, 'Không có quyền');
    if (scenario.expired) return reply(requestId, 401, null, 'Hết phiên');
    if (scenario.holdWrite) {
      const data = scenario.commitBeforeTimeout ? commit(request) : null;
      scenario.held.push({ kind: 'write', requestId, request, data }); return;
    }
    if (scenario.writeStatus === 400) return reply(requestId, 400, { title: 'Tên phim bị trùng', durationMinutes: 'Thời lượng không được chấp nhận' }, 'Kiểm tra dữ liệu phim');
    if (scenario.writeStatus >= 400) return reply(requestId, scenario.writeStatus, null, 'Không thể lưu phim lúc này');
    return reply(requestId, request.method === 'POST' ? 201 : 200, commit(request));
  }
  throw new Error(`Unexpected API: ${route}`);
}

async function boot({ route = '/admin/movies', width = 1280, account = user } = {}) {
  if (bootScript) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: bootScript });
  await cdp.send('Page.navigate', { url: 'about:blank' });
  sequence++;
  bootScript = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.clear();
    ${account ? `localStorage.setItem('premier_cinema_access_token', 'movie-token');
      localStorage.setItem('premier_cinema_refresh_token', 'movie-refresh');
      localStorage.setItem('premier_cinema_session_id', 'movie-session-${sequence}');
      localStorage.setItem('premier_cinema_user', ${JSON.stringify(JSON.stringify(account))});` : ''}
    window.__movieBoot = ${sequence};
  ` })).identifier;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, mobile: width < 600, deviceScaleFactor: 1 });
  await cdp.send('Page.navigate', { url: origin + route });
  await cdp.wait(`window.__movieBoot === ${sequence} && Boolean(document.querySelector('#admin-page-title, #admin-access-title'))`);
}

async function field(name, value, scope = 'dialog') {
  assert.equal(await cdp.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(scope + ' [name="' + name + '"]')}); if (!input) return false;
    const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); return true;
  })()`), true, `Field ${name}`);
}
async function openCreate() { await cdp.click('Thêm phim'); await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`); }
async function fillMovie(values = {}) {
  for (const [name, value] of Object.entries({ title: 'Phim mới thử nghiệm', durationMinutes: '105', releaseDate: '2027-01-02', status: 'COMING_SOON', description: 'Mô tả mới', genre: 'Phiêu lưu', ageRating: 'K', posterUrl: '', trailerUrl: '', ...values })) await field(name, value);
}
async function submit(times = 1) {
  await cdp.evaluate(`(() => { const form = document.querySelector('dialog form'); for (let index = 0; index < ${times}; index++) form.requestSubmit(); })()`);
}
async function waitTable() { await cdp.wait(`Boolean(document.querySelector('main table tbody tr')) && document.querySelector('[aria-label="Danh sách phim quản trị"]').parentElement.getAttribute('aria-busy') === 'false'`); }
async function reload() {
  await cdp.evaluate('window.__reload = true'); await cdp.send('Page.reload');
  await cdp.wait(`!window.__reload && Boolean(document.querySelector('main table'))`); await waitTable();
}
async function spa(route) {
  await cdp.evaluate(`history.pushState({}, '', ${JSON.stringify(route)}); window.dispatchEvent(new PopStateEvent('popstate'))`);
}
async function waitHeld(kind) {
  const deadline = Date.now() + 10000;
  while (!scenario.held.some(item => item.kind === kind)) { if (Date.now() > deadline) throw new Error(`Missing ${kind}`); await delay(50); }
}
async function release(kind, aborted = false) {
  const index = scenario.held.findIndex(item => item.kind === kind); assert.ok(index >= 0);
  const [held] = scenario.held.splice(index, 1);
  try { await reply(held.requestId, 200, held.data || commit(held.request)); }
  catch (error) { if (!aborted || !error.message.includes('Invalid InterceptionId')) throw error; }
}

try {
  browser = await startEdgeBrowser({ root, port: 4199, debugPort: 9232, artifacts, executable: process.env.ADMIN_EDGE_PATH });
  cdp = browser.cdp;
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }, { urlPattern: 'https://images.example.invalid/*' }] });
  cdp.on('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  cdp.on('Fetch.requestPaused', event => { void intercept(event).catch(error => exceptions.push(error.stack)); });

  reset(); await boot(); await waitTable();
  assert.equal(await cdp.evaluate('document.querySelectorAll("main tbody tr").length'), 10);
  assert.equal(await cdp.evaluate('document.querySelector("main tbody tr").textContent.includes("Phim 25")'), true);
  await writeFile(path.join(artifacts, 'movies-desktop.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await cdp.click('Trang sau'); await cdp.wait(`location.search.includes('page=2')`); await waitTable();
  assert.equal(await cdp.evaluate('document.querySelector("main tbody tr").textContent.includes("Phim 15")'), true);
  assert.equal(new URLSearchParams(requests.filter(r => r.route === '/movies').at(-1).search).get('page'), '1');
  await reload(); assert.equal(await cdp.evaluate('document.querySelector("main tbody tr").textContent.includes("Phim 15")'), true);
  await cdp.evaluate('history.back()'); await cdp.wait(`!location.search.includes('page=')`); await waitTable();
  passed.push('server pagination requests one page, uses stable id order and survives F5/Back');

  await field('keyword', '  Phim 02  ', '#admin-movie-filters'); await cdp.click('Áp dụng');
  await cdp.wait(`document.querySelectorAll('main tbody tr').length === 1 && document.querySelector('main tbody').textContent.includes('Phim 02')`);
  assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).get('q'), 'Phim 02');
  await field('status', 'COMING_SOON', '#admin-movie-filters'); await waitTable();
  assert.equal(await cdp.evaluate(`document.querySelector('main tbody').textContent.includes('Sắp chiếu')`), true);
  await reload(); assert.equal(await cdp.evaluate(`document.querySelector('#admin-movie-keyword').value`), 'Phim 02');
  await cdp.click('Xóa bộ lọc'); await waitTable();
  for (const [status, label] of [['NOW_SHOWING', 'Đang chiếu'], ['COMING_SOON', 'Sắp chiếu'], ['ENDED', 'Ngừng chiếu']]) {
    await field('status', status, '#admin-movie-filters'); await cdp.wait(`document.querySelector('main tbody')?.textContent.includes(${JSON.stringify(label)})`);
    const record = requests.filter(r => r.route === '/movies').at(-1);
    assert.equal(new URLSearchParams(record.search).get('status'), status);
  }
  await field('keyword', 'Phim 03', '#admin-movie-filters'); await field('size', '20', '#admin-movie-filters');
  await cdp.wait(`document.querySelectorAll('main tbody tr').length === 1 && document.querySelector('main tbody').textContent.includes('Phim 03')`);
  assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).get('q'), 'Phim 03');
  assert.equal(new URLSearchParams(requests.filter(r => r.route === '/movies').at(-1).search).get('size'), '20');
  passed.push('trimmed title search, all three status filters, reset and F5 retain correct URL/API filters');

  reset(); await boot({ route: '/admin/movies?page=999&size=20&status=INVALID&source=test' });
  await cdp.wait(`new URLSearchParams(location.search).get('page') === '2'`); await waitTable();
  assert.equal(await cdp.evaluate('document.querySelectorAll("main tbody tr").length'), 5);
  assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).get('source'), 'test');
  assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).has('status'), false);
  passed.push('invalid filters normalize and out-of-range pages clamp only after a successful server response');

  reset({ holdRead: true }); await boot(); await waitHeld('read');
  assert.equal(await cdp.evaluate(`document.querySelector('main [role="status"]').textContent.includes('Đang tải')`), true);
  scenario.holdRead = false; await release('read'); await waitTable();
  await field('keyword', 'Không tồn tại', '#admin-movie-filters'); await cdp.click('Áp dụng');
  await cdp.wait(`document.querySelector('main').textContent.includes('Không có phim phù hợp')`);
  reset({ readStatus: 404 }); await boot(); await cdp.wait(`Boolean(document.querySelector('main [role="alert"]'))`);
  assert.equal(await cdp.evaluate('document.querySelectorAll("[data-sonner-toast]").length'), 0);
  scenario.readStatus = 200; await cdp.click('Thử lại'); await waitTable();
  passed.push('real list loading/empty/error/retry states work without duplicate query toasts');

  reset(); await boot(); await waitTable(); await openCreate();
  await fillMovie({ title: '   ', durationMinutes: '-2', releaseDate: '', posterUrl: 'javascript:alert(1)', trailerUrl: 'file:///trailer' }); await submit();
  await cdp.wait(`document.querySelector('dialog [name="title"]').getAttribute('aria-invalid') === 'true'`);
  for (const name of ['title', 'durationMinutes', 'releaseDate', 'posterUrl', 'trailerUrl']) assert.equal(await cdp.evaluate(`document.querySelector('dialog [name="${name}"]').getAttribute('aria-invalid')`), 'true');
  assert.equal(scenario.writes, 0);
  passed.push('client validation blocks blank title, nonpositive duration, missing date and unsafe URLs before any write');

  reset({ holdWrite: true }); await boot(); await waitTable(); await openCreate();
  await fillMovie({ title: '  Phim mới thử nghiệm  ', posterUrl: 'https://images.example.invalid/poster.jpg', trailerUrl: 'https://youtu.be/abcdef12345' });
  await submit(2); await waitHeld('write'); await cdp.wait(`document.querySelector('dialog').getAttribute('aria-busy') === 'true'`);
  await cdp.key('Escape'); assert.equal(await cdp.evaluate('Boolean(document.querySelector("dialog[open]"))'), true);
  assert.equal(scenario.writes, 1); await release('write');
  await cdp.wait(`!document.querySelector('dialog[open]') && document.querySelector('main tbody').textContent.includes('Phim mới thử nghiệm')`);
  const created = requests.filter(r => r.route === '/admin/movies' && r.method === 'POST').at(-1);
  assert.equal(created.bearer, 'Bearer movie-token'); assert.equal(created.body.durationMinutes, 105);
  assert.equal(created.body.title, 'Phim mới thử nghiệm'); assert.equal(created.body.releaseDate, '2027-01-02');
  assert.deepEqual(Object.keys(created.body).sort(), ['title', 'description', 'durationMinutes', 'releaseDate', 'posterUrl', 'trailerUrl', 'genre', 'ageRating', 'status'].sort());
  assert.equal(await cdp.evaluate('document.querySelectorAll("[data-sonner-toast][data-type=success]").length'), 1);
  await reload(); assert.equal(await cdp.evaluate('document.querySelector("main tbody").textContent.includes("Phim mới thử nghiệm")'), true);
  passed.push('create sends exact typed DTO/Bearer once despite two submits, locks Escape and survives F5; broken poster falls back');

  scenario.holdWrite = false;
  await cdp.evaluate(`document.querySelector('button[aria-label="Sửa phim Phim mới thử nghiệm"]').click()`); await cdp.wait('Boolean(document.querySelector("dialog[open]"))');
  assert.equal(await cdp.evaluate('document.querySelector("dialog [name=durationMinutes]").value'), '105');
  await field('title', 'Phim đã chỉnh sửa'); await field('status', 'NOW_SHOWING'); await field('posterUrl', ''); await field('trailerUrl', ''); await field('description', ''); await submit();
  await cdp.wait(`!document.querySelector('dialog[open]') && document.querySelector('main tbody').textContent.includes('Phim đã chỉnh sửa')`);
  const updated = requests.filter(r => r.method === 'PUT').at(-1);
  assert.equal(updated.route, '/admin/movies/26'); assert.equal(updated.body.posterUrl, null); assert.equal(updated.body.trailerUrl, null); assert.equal(updated.body.description, null);
  await reload(); assert.equal(await cdp.evaluate('document.querySelector("main tbody").textContent.includes("Phim đã chỉnh sửa")'), true);
  passed.push('edit prefills every writable field, uses PUT, clears optional values with null and survives F5');

  reset({ writeStatus: 400 }); await boot(); await waitTable(); await openCreate(); await fillMovie(); await submit();
  await cdp.wait(`document.querySelector('dialog').textContent.includes('Tên phim bị trùng')`);
  assert.equal(await cdp.evaluate('document.querySelector("dialog [name=title]").value'), 'Phim mới thử nghiệm');
  assert.equal(await cdp.evaluate('document.querySelector("dialog [name=durationMinutes]").getAttribute("aria-invalid")'), 'true');
  assert.equal(await cdp.evaluate('document.querySelectorAll("[data-sonner-toast]").length'), 0);
  scenario.writeStatus = 500; await field('title', 'Giữ bản nháp'); await submit();
  await cdp.wait(`document.querySelector('dialog').textContent.includes('Không thể lưu phim lúc này')`);
  assert.equal(await cdp.evaluate('document.querySelector("dialog [name=title]").value'), 'Giữ bản nháp');
  assert.equal(await cdp.evaluate('document.querySelectorAll("[data-sonner-toast][data-type=error]").length'), 1);
  assert.equal(scenario.writes, 2);
  scenario.writeStatus = 200; await submit(); await cdp.wait('!document.querySelector("dialog[open]")');
  passed.push('400 maps to fields with no toast, 500 preserves the draft with one toast and explicit resubmit recovers');

  reset({ count: 11, status: 'NOW_SHOWING' }); await boot({ route: '/admin/movies?status=NOW_SHOWING&page=2' }); await waitTable();
  await cdp.evaluate(`document.querySelector('main tbody button').click()`); await cdp.wait('Boolean(document.querySelector("dialog[open]"))');
  await field('status', 'ENDED'); await submit();
  await cdp.wait(`!document.querySelector('dialog[open]') && !new URLSearchParams(location.search).has('page')`); await waitTable();
  assert.equal(await cdp.evaluate('document.querySelectorAll("main tbody tr").length'), 10);
  assert.equal(movies.find(movie => movie.id === 1).status, 'ENDED');
  passed.push('editing the only filtered row on the last page removes it and returns to a valid page');

  reset(); movies.at(-1).title = 'Phim đổi trạng thái'; await boot(); await waitTable();
  await spa('/movies'); await cdp.wait(`document.querySelector('main').textContent.includes('Phim đổi trạng thái')`);
  await spa('/admin/movies?q=Phim+đổi+trạng+thái'); await waitTable();
  await cdp.evaluate(`document.querySelector('main tbody button').click()`); await cdp.wait('Boolean(document.querySelector("dialog[open]"))'); await field('status', 'ENDED'); await submit();
  await cdp.wait('!document.querySelector("dialog[open]")');
  await spa('/movies'); await cdp.wait(`document.querySelector('main h1')?.textContent.includes('Khám phá')`); await delay(150);
  assert.equal(await cdp.evaluate('document.querySelector("main").textContent.includes("Phim đổi trạng thái")'), false);
  await spa('/admin/movies?q=Phim+đổi+trạng+thái'); await waitTable();
  await cdp.evaluate(`document.querySelector('main tbody button').click()`); await cdp.wait('Boolean(document.querySelector("dialog[open]"))'); await field('status', 'COMING_SOON'); await submit();
  await cdp.wait('!document.querySelector("dialog[open]")');
  await spa('/movies?status=COMING_SOON'); await cdp.wait(`document.querySelector('main').textContent.includes('Phim đổi trạng thái')`);
  assert.equal(movies.at(-1).country, 'Việt Nam'); assert.deepEqual(movies.at(-1).directors, ['Đạo diễn mẫu']);
  passed.push('a warm customer catalog drops ENDED films and refreshes COMING_SOON after Admin edits without losing unsupported metadata');

  reset({ holdWrite: true, commitBeforeTimeout: true }); await boot(); await waitTable(); await openCreate(); await fillMovie({ title: 'Mất phản hồi' });
  // Simulate a lost response promptly; production timeout remains the normal Axios timeout.
  await submit(); await waitHeld('write');
  const held = scenario.held.find(item => item.kind === 'write');
  await cdp.send('Fetch.failRequest', { requestId: held.requestId, errorReason: 'TimedOut' }); scenario.held = [];
  await cdp.wait(`document.querySelector('dialog').textContent.includes('Chưa xác định được kết quả lưu')`); await delay(1200);
  assert.equal(scenario.writes, 1); assert.equal(await cdp.evaluate('document.querySelector("dialog [name=title]").value'), 'Mất phản hồi');
  await cdp.click('Kiểm tra lại danh sách', 'dialog'); await cdp.wait(`document.querySelector('dialog').textContent.includes('Danh sách đã được làm mới')`);
  assert.equal(scenario.writes, 1); await cdp.key('Escape'); await cdp.wait('!document.querySelector("dialog[open]")');
  assert.equal(await cdp.evaluate('document.querySelector("main tbody").textContent.includes("Mất phản hồi")'), true);
  passed.push('lost response after server commit preserves draft, sends no automatic POST and allows a read-only reconciliation');

  reset(); await boot({ width: 390 }); await waitTable();
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await writeFile(path.join(artifacts, 'movies-390.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await openCreate(); await fillMovie();
  for (let index = 0; index < 26; index++) { await cdp.key('Tab', index < 13 ? 0 : 8); assert.equal(await cdp.evaluate('document.querySelector("dialog").contains(document.activeElement)'), true); }
  assert.equal(await cdp.evaluate('document.querySelector("dialog").scrollWidth <= document.querySelector("dialog").clientWidth'), true);
  await cdp.evaluate('document.querySelector("dialog").scrollTop = 0');
  await writeFile(path.join(artifacts, 'movie-form-390.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await cdp.key('Escape'); await cdp.wait('!document.querySelector("dialog[open]")');
  assert.equal(await cdp.evaluate('document.activeElement.textContent.includes("Thêm phim")'), true);
  passed.push('390px real table/form do not overflow the page; Tab/Shift+Tab loop and Escape restore opener focus');

  reset({ user: { ...user, role: 'CUSTOMER' } }); const before = requests.filter(r => r.route === '/movies').length;
  await boot({ account: scenario.user }); await cdp.wait(`document.body.textContent.includes('403 — Không có quyền quản trị')`);
  assert.equal(requests.filter(r => r.route === '/movies').length, before);
  passed.push('CUSTOMER never loads the movie list or a mutation form');

  assert.deepEqual(exceptions, []);
  const report = { mode: 'Edge production build with mocked REST and in-memory catalog; no live integration', passed, runtimeExceptions: exceptions.length, mockRequests: requests.length };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, artifacts }, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ passed, requests, exceptions, scenario,
    location: await cdp?.evaluate('location.href'), body: await cdp?.evaluate('document.body.innerText') }, null, 2));
  console.error(`Movie browser check failed: ${path.join(artifacts, 'failure.json')}`); throw error;
} finally { await browser?.close(); }
