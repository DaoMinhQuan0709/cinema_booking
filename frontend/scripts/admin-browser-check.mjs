// Windows/Edge session checks with intercepted REST APIs and test-only lazy children.
// No backend, database, real login or external Admin request is used.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = await mkdtemp(path.join(tmpdir(), 'cinema-admin-browser-'));
const port = 4198, debugPort = 9231;
const origin = `http://127.0.0.1:${port}`;
const admin = { id: 1, email: 'admin@example.invalid', fullName: 'Admin mô phỏng', role: 'ADMIN' };
const customer = { id: 2, email: 'customer@example.invalid', fullName: 'Khách mô phỏng', role: 'CUSTOMER' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [], exceptions = [], requests = [], moduleRequests = [];
let server, edge, socket, cdp, bootScript, scenario, bootSequence = 0;

class CDP {
  constructor(ws) {
    this.ws = ws; this.sequence = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = this.pending.get(message.id); if (!entry) return;
        this.pending.delete(message.id);
        message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
      } else this.handlers.get(message.method)?.forEach(fn => fn(message.params));
    });
  }
  on(method, callback) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(callback);
  }
  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
  }
  async wait(expression, timeout = 10000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await this.evaluate(expression)) return; await delay(60); }
    throw new Error(`Timed out waiting for ${expression}`);
  }
  async click(text) {
    assert.equal(await this.evaluate(`(() => {
      const button = [...document.querySelectorAll('main button, [aria-labelledby="admin-access-title"] button')].find(b => b.textContent.includes(${JSON.stringify(text)}) && b.offsetWidth && !b.disabled);
      if (!button) return false; button.click(); return true;
    })()`), true, `Visible enabled button: ${text}`);
  }
}

function reset(options = {}) {
  scenario = { user: admin, meStatus: 200, refreshStatus: 200, probeStatus: 200,
    me: 0, refresh: 0, login: 0, probe: 0, held: [], ...options };
}

async function respond(requestId, status, data, message) {
  await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
    ],
    body: Buffer.from(JSON.stringify({ code: status, message: message || (status >= 400 ? 'Mock error' : 'OK'), data })).toString('base64'),
  });
}

async function intercept({ request, requestId }) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/src/features/admin/')) {
    if (scenario.holdMovieModule && url.pathname.endsWith('/MovieManager.jsx')) {
      scenario.held.push({ requestId, kind: 'module' });
      return;
    }
    return cdp.send('Fetch.continueRequest', { requestId });
  }
  if (request.method === 'OPTIONS') return respond(requestId, 200);
  const pathname = url.pathname.replace('/api/v1', '');
  requests.push({ pathname, search: url.search, method: request.method, bearer: request.headers.Authorization,
    body: request.postData ? JSON.parse(request.postData) : null });
  const hold = (kind, status, data) => scenario.held.push({ requestId, kind, status, data });
  if (pathname === '/users/me') {
    scenario.me++;
    if (scenario.holdMe) return hold('me', scenario.meStatus, scenario.user);
    const status = scenario.expiredOnce && scenario.me === 1 ? 401 : scenario.meStatus;
    return respond(requestId, status, scenario.user);
  }
  if (pathname === '/auth/login' || pathname === '/auth/register') {
    scenario.login++;
    const data = { accessToken: 'login-token', refreshToken: 'login-refresh', user: scenario.user };
    if (scenario.holdLogin) return hold('login', scenario.loginStatus || 200, data);
    return respond(requestId, scenario.loginStatus || 200, data);
  }
  if (pathname === '/auth/refresh') {
    scenario.refresh++;
    const data = { accessToken: 'fresh-token', refreshToken: 'fresh-refresh', user: scenario.user };
    if (scenario.holdRefresh) return hold('refresh', scenario.refreshStatus, data);
    return respond(requestId, scenario.refreshStatus, data);
  }
  if (pathname === '/admin/probe') {
    scenario.probe++;
    if (scenario.holdProbe) return hold('probe', scenario.probeStatus, { label: 'Private Admin data' });
    return respond(requestId, scenario.probeStatus, { label: 'Private Admin data' });
  }
  if (pathname === '/admin/expired') return respond(requestId, 401);
  if (pathname.startsWith('/admin/refresh-probe/')) {
    return respond(requestId, request.headers.Authorization === 'Bearer fresh-token' ? 200 : 401, { label: 'Refreshed' });
  }
  if (pathname === '/admin/late') return hold('late', 403);
  if (pathname === '/movies') {
    if (!scenario.foundation) return respond(requestId, 200, { content: [], totalElements: 0, totalPages: 0, last: true });
    const pageNo = Number(url.searchParams.get('page') || 0);
    const empty = url.searchParams.get('keyword') === 'empty';
    const data = { content: empty ? [] : [{ id: pageNo + 7,
      title: scenario.savedTitle || `Phim trang ${pageNo + 1}`, description: 'Mô tả phim' }], pageNo, pageSize: 1, totalElements: empty ? 0 : 2, totalPages: empty ? 0 : 2, last: empty || pageNo === 1 };
    if (scenario.holdMovies) return hold('movies', 200, data);
    return respond(requestId, scenario.moviesStatus || 200, data);
  }
  if (pathname === '/cinemas') return respond(requestId, 200, scenario.foundation ? [{ id: 2, auditoriums: [{ id: 3 }] }] : []);
  if (pathname === '/showtimes') return respond(requestId, 200, scenario.foundation ? [{ id: 11, movieId: 7, auditoriumId: 3 }] : []);
  if (pathname === '/admin/reports/revenue') return respond(requestId, 200, { totalRevenue: 90000 });
  if (pathname === '/admin/reports/occupancy') return respond(requestId, 200, { totalSeats: 50 });
  if (pathname === '/admin/sync/galaxy/status') return respond(requestId, 200, { lastSuccessAt: '2026-11-01T00:00:00Z' });
  if ((pathname === '/admin/movies' && request.method === 'POST') || pathname === '/admin/movies/7' || pathname === '/admin/showtimes' || pathname === '/admin/sync/galaxy/local-file') {
    scenario.writes = (scenario.writes || 0) + 1;
    const status = scenario.writeStatus || 200;
    const data = status === 400 ? { title: 'Tên phim bị trùng', durationMinutes: 'Thời lượng không hợp lệ' } : { id: 7, ...JSON.parse(request.postData || '{}') };
    if (scenario.holdWrite) return hold('write', status, data);
    if (status < 300 && pathname.startsWith('/admin/movies')) scenario.savedTitle = data.title;
    return respond(requestId, status, data, status === 400 ? 'Dữ liệu yêu cầu không hợp lệ' : status === 409 ? 'Phòng chiếu đã có suất trùng giờ' : undefined);
  }
  throw new Error(`Unexpected API request: ${pathname}`);
}

async function release(kind, { allowAborted = false } = {}) {
  const index = scenario.held.findIndex(item => item.kind === kind);
  assert.ok(index >= 0, `Held ${kind} request exists`);
  const [held] = scenario.held.splice(index, 1);
  if (kind === 'module') return cdp.send('Fetch.continueRequest', { requestId: held.requestId });
  if (kind === 'write' && held.status < 300 && held.data?.title) scenario.savedTitle = held.data.title;
  try {
    await respond(held.requestId, held.status, held.data);
  } catch (error) {
    // Edge discards a paused request when Axios aborts it; it cannot receive a late response.
    if (!allowAborted || !error.message.includes('Invalid InterceptionId')) throw error;
  }
}

async function waitHeld(kind) {
  const deadline = Date.now() + 10000;
  while (!scenario.held.some(item => item.kind === kind)) {
    if (Date.now() > deadline) throw new Error(`Missing held ${kind} request`);
    await delay(60);
  }
}

async function boot({ user = admin, route = '/admin/movies?q=arrival#edit', width = 1280 } = {}) {
  if (bootScript) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: bootScript });
  // Navigating to an identical URL with a fragment can be a same-document navigation.
  await cdp.send('Page.navigate', { url: 'about:blank' });
  bootSequence++;
  bootScript = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.clear();
    ${user ? `localStorage.setItem('premier_cinema_access_token', 'boot-token');
      localStorage.setItem('premier_cinema_refresh_token', 'boot-refresh');
      localStorage.setItem('premier_cinema_user', ${JSON.stringify(JSON.stringify(user))});
      localStorage.setItem('premier_cinema_session_id', 'boot-${bootSequence}');` : ''}
    window.__adminBoot = ${bootSequence};
  ` })).identifier;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp.send('Page.navigate', { url: origin + route });
  await cdp.wait(`window.__adminBoot === ${bootSequence} && Boolean(document.querySelector('main, #admin-access-title, #root [role="status"]'))`);
}

const bodyIncludes = text => `document.body.textContent.includes(${JSON.stringify(text)})`;
const state = property => `window.__admin.testApi.auth.getState().${property}`;
async function installProbe(mount = false) {
  await cdp.evaluate(`(async () => { window.__admin = await import('/scripts/fixtures/admin-route-probe.jsx'); ${mount ? 'window.__admin.mountAdminProbe();' : ''} })()`);
}

async function installFoundation(mode = 'movies', guarded = true) {
  await installProbe();
  await cdp.evaluate(`window.__admin.mountFoundationProbe(${JSON.stringify(mode)}, ${guarded})`);
  await cdp.wait('Boolean(document.querySelector("#admin-foundation-probe button"))');
}

async function pressKey(key, modifiers = 0) {
  const windowsVirtualKeyCode = { Tab: 9, Enter: 13, Escape: 27 }[key];
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, windowsVirtualKeyCode, modifiers });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, windowsVirtualKeyCode, modifiers });
}

async function foundationBoot(options = {}, mode = 'movies', bootOptions = {}) {
  reset({ foundation: true, ...options }); await boot({ route: '/admin/sync', ...bootOptions }); await cdp.wait('Boolean(document.querySelector("#admin-main"))');
  await installFoundation(mode);
}

async function seedRelatedCaches() {
  await cdp.evaluate(`(() => {
    const q = window.__admin.testApi.queryClient;
    for (const key of [['movies', 'public'], ['showtimes', 'public'], ['cinemas', 'public'], ['admin', 'reports', 'cached'], ['admin', 'movie-options', 'cached'], ['admin', 'showtimes', 'cached']]) q.setQueryData(key, ['old']);
  })()`);
}
async function seedCaches() {
  await cdp.evaluate(`(async () => {
    const q = window.__admin.testApi.queryClient;
    q.setQueryData(['admin', 'sensitive'], { secret: 'old admin' });
    q.setQueryData(['movies', 'public-probe'], ['public catalog']);
    await q.getMutationCache().build(q, { mutationKey: ['admin', 'write'], mutationFn: async () => 'old mutation' }).execute();
  })()`);
}
async function assertCacheCleared({ allowCurrentQueries = false } = {}) {
  if (!allowCurrentQueries) assert.equal(await cdp.evaluate(`window.__admin.testApi.queryClient.getQueryCache().findAll({ queryKey: ['admin'] }).length`), 0);
  assert.equal(await cdp.evaluate(`window.__admin.testApi.queryClient.getQueryData(['admin', 'sensitive']) === undefined`), true);
  assert.equal(await cdp.evaluate(`window.__admin.testApi.queryClient.getMutationCache().getAll().filter(m => m.options.mutationKey?.[0] === 'admin').length`), 0);
  assert.deepEqual(await cdp.evaluate(`window.__admin.testApi.queryClient.getQueryData(['movies', 'public-probe'])`), ['public catalog']);
}

try {
  server = await createServer({ root, configFile: path.join(root, 'vite.config.js'), server: { host: '127.0.0.1', port, strictPort: true } });
  await server.listen();
  edge = spawn(process.env.ADMIN_EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(artifacts, 'profile')}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  edge.on('error', error => exceptions.push(error.message));
  let page;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { page = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page'); } catch { /* Edge starting. */ }
    if (page) break; await delay(100);
  }
  assert.ok(page, `Edge started: ${exceptions.join(', ')}`);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  cdp = new CDP(socket);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable'); await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', event => {
    if (/\/src\/(features\/admin\/[^/]+\.jsx|layouts\/AdminLayout\.jsx)/.test(event.request.url)) moduleRequests.push(event.request.url);
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }, { urlPattern: '*/src/features/admin/*.jsx*' }] });
  cdp.on('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  cdp.on('Fetch.requestPaused', event => { void intercept(event).catch(error => exceptions.push(error.stack)); });

  reset(); await boot({ user: null, width: 390 });
  await cdp.wait(bodyIncludes('Đăng nhập để vào quản trị'));
  assert.equal(scenario.me, 0); assert.equal(scenario.probe, 0);
  await cdp.click('Đăng nhập');
  await cdp.evaluate(`(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    for (const [name, value] of [['email', 'admin@example.invalid'], ['password', 'password123']]) {
      const input = document.querySelector('input[name=' + name + ']'); setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('form').requestSubmit();
  })()`);
  await cdp.wait(bodyIncludes('Quản lý phim'));
  assert.equal(await cdp.evaluate('location.pathname + location.search + location.hash'), '/admin/movies?q=arrival#edit');
  assert.equal(scenario.login, 1); assert.equal(scenario.me, 1);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  results.push('guest + real login form at 390px: one login, /me verification, full destination URL preserved');

  reset({ user: customer, holdMe: true }); await boot(); await waitHeld('me'); await installProbe(true);
  await cdp.wait(bodyIncludes('Đang xác minh phiên quản trị'));
  assert.equal(await cdp.evaluate('window.__adminProbe.lazyLoads'), 0); assert.equal(scenario.probe, 0);
  scenario.holdMe = false; await release('me'); await cdp.wait(bodyIncludes('403 — Không có quyền quản trị'));
  assert.equal(await cdp.evaluate('window.__adminProbe.lazyLoads'), 0); assert.equal(scenario.probe, 0);
  assert.equal(scenario.me, 1);
  results.push('forged cached ADMIN with real CUSTOMER: no lazy child load or Admin request, shared verification once');

  reset({ holdMe: true }); await boot({ user: customer }); await waitHeld('me'); await installProbe(true);
  assert.equal(await cdp.evaluate('window.__adminProbe.lazyLoads'), 0);
  scenario.holdMe = false; await release('me'); await cdp.wait(bodyIncludes('Private Admin data'));
  assert.equal(await cdp.evaluate('window.__adminProbe.lazyLoads'), 1); assert.equal(scenario.probe, 1);
  await cdp.evaluate('window.__reloadMarker = true');
  await cdp.send('Page.reload'); await cdp.wait(`!window.__reloadMarker && ${bodyIncludes('Quản lý phim')}`);
  assert.equal(scenario.me, 2);
  results.push('real ADMIN overrides cached CUSTOMER, mounts lazy child only after /me, direct F5 succeeds');

  reset(); await boot({ route: '/admin?date=2026-11-12#totals' });
  await cdp.wait(bodyIncludes('Báo cáo quản trị'));
  assert.equal(await cdp.evaluate('location.pathname'), '/admin/reports');
  assert.equal(await cdp.evaluate('new URLSearchParams(location.search).get("date")'), '2026-11-12');
  assert.equal(await cdp.evaluate('location.hash'), '#totals');
  results.push('/admin redirects to reports after verification and preserves search/hash');

  reset({ expiredOnce: true }); await boot(); await cdp.wait(bodyIncludes('Quản lý phim')); await installProbe();
  assert.equal(scenario.me, 2); assert.equal(scenario.refresh, 1);
  assert.equal(await cdp.evaluate(state('accessToken')), 'fresh-token');
  results.push('401 refreshes once, retries /me, synchronizes store token');

  reset(); await boot(); await cdp.wait(bodyIncludes('Quản lý phim')); await installProbe(); scenario.holdRefresh = true;
  await cdp.evaluate(`void (window.__batch = Promise.all([1, 2, 3].map(id => window.__admin.testApi.axiosInstance.get('/admin/refresh-probe/' + id))))`);
  await waitHeld('refresh'); await delay(150); await release('refresh');
  assert.equal((await cdp.evaluate('window.__batch.then(responses => responses.map(response => response.data))')).length, 3); assert.equal(scenario.refresh, 1);
  results.push('three concurrent Admin 401 responses share one refresh and each retry once');

  for (const refreshStatus of [401, 200]) {
    reset({ meStatus: 401, refreshStatus }); await boot(); await cdp.wait(bodyIncludes('Đăng nhập để vào quản trị'));
    assert.equal(scenario.refresh, 1); assert.equal(scenario.me, refreshStatus === 200 ? 2 : 1);
    assert.equal(await cdp.evaluate(`localStorage.getItem('premier_cinema_access_token')`), null);
  }
  results.push('refresh denied and retried /me still 401: login gate, cleared token, no refresh loop');

  reset({ meStatus: 403 }); await boot(); await cdp.wait(bodyIncludes('403 — Không có quyền quản trị'));
  assert.equal(scenario.refresh, 0); scenario.meStatus = 200; await cdp.click('Thử lại xác minh');
  await cdp.wait(bodyIncludes('Quản lý phim')); assert.equal(scenario.me, 2);
  results.push('/me 403 denies access without refreshing; explicit retry can recover');

  reset({ meStatus: 500 }); await boot(); await cdp.wait(bodyIncludes('Chưa xác minh được phiên'));
  assert.equal(scenario.me, 1); assert.equal(await cdp.evaluate(`localStorage.getItem('premier_cinema_access_token')`), 'boot-token');
  scenario.meStatus = 200; await cdp.click('Thử lại xác minh'); await cdp.wait(bodyIncludes('Quản lý phim'));
  assert.equal(scenario.me, 2);
  results.push('verification 500 fails closed, retains login and recovers with one explicit retry');

  reset({ probeStatus: 403 }); await boot(); await cdp.wait(bodyIncludes('Quản lý phim')); await installProbe(); await seedCaches();
  await cdp.evaluate('window.__admin.mountAdminProbe()'); await cdp.wait(bodyIncludes('403 — Không có quyền quản trị'));
  await assertCacheCleared(); await delay(250); assert.equal(scenario.probe, 1);
  results.push('Admin API 403 unmounts protected content, clears query/mutation cache and does not retry');

  reset({ holdProbe: true, refreshStatus: 401 }); await boot(); await cdp.wait(bodyIncludes('Quản lý phim')); await installProbe(true); await waitHeld('probe'); await seedCaches();
  await cdp.evaluate(`window.__expiredRequest = window.__admin.testApi.axiosInstance.get('/admin/expired', { skipErrorToast: true }).catch(() => null)`);
  await cdp.wait(bodyIncludes('Đăng nhập để vào quản trị')); await assertCacheCleared();
  assert.equal(await cdp.evaluate('window.__adminProbe.aborted'), 1);
  await release('probe', { allowAborted: true }); await delay(200); await assertCacheCleared();
  assert.equal(await cdp.evaluate(bodyIncludes('Private Admin data')), false);
  results.push('expiry during Admin query: abort, unmount, cache removal; late response cannot repopulate cache');

  reset(); await boot(); await cdp.wait(bodyIncludes('Quản lý phim')); await installProbe(); await seedCaches();
  const oldSession = await cdp.evaluate(state('sessionId'));
  await cdp.evaluate(`window.__admin.testApi.auth.getState().login({ email: 'admin@example.invalid', password: 'password123' })`);
  await cdp.wait(bodyIncludes('Quản lý phim')); await assertCacheCleared({ allowCurrentQueries: true });
  assert.notEqual(await cdp.evaluate(state('sessionId')), oldSession);
  results.push('same-account login starts a new session and clears Admin query/mutation cache while preserving public catalog');

  reset({ holdMe: true }); await boot(); await waitHeld('me'); await installProbe();
  await cdp.evaluate('window.__admin.testApi.auth.getState().logout({ silent: true })'); await release('me');
  await cdp.wait(bodyIncludes('Đăng nhập để vào quản trị')); await delay(150);
  assert.equal(await cdp.evaluate(state('user')), null); assert.equal(await cdp.evaluate(state('sessionStatus')), 'anonymous');
  results.push('late /me success after logout cannot restore a user or Admin role');

  reset({ holdLogin: true }); await boot({ user: null }); await cdp.wait(bodyIncludes('Đăng nhập để vào quản trị')); await installProbe();
  await cdp.evaluate(`void (window.__login = window.__admin.testApi.auth.getState().login({ email: 'admin@example.invalid', password: 'password123' }))`);
  await waitHeld('login'); await cdp.evaluate('window.__admin.testApi.auth.getState().logout({ silent: true })'); await release('login');
  await cdp.evaluate('window.__login'); assert.equal(await cdp.evaluate(state('sessionStatus')), 'anonymous');
  assert.equal(await cdp.evaluate(`localStorage.getItem('premier_cinema_access_token')`), null);
  results.push('late login success after explicit logout is ignored even when the request started anonymously');

  reset({ meStatus: 401, holdRefresh: true }); await boot(); await waitHeld('refresh'); await installProbe();
  await cdp.evaluate('window.__admin.testApi.auth.getState().logout({ silent: true })'); await release('refresh');
  await cdp.wait(bodyIncludes('Đăng nhập để vào quản trị')); await delay(150);
  assert.equal(await cdp.evaluate(`localStorage.getItem('premier_cinema_access_token')`), null);
  results.push('late refresh success after logout cannot restore tokens');

  reset({ meStatus: 401, holdRefresh: true, refreshStatus: 401 }); await boot(); await waitHeld('refresh'); await installProbe();
  scenario.meStatus = 200; scenario.user = customer;
  await cdp.evaluate(`window.__admin.testApi.auth.getState().login({ email: 'customer@example.invalid', password: 'password123' })`);
  await cdp.wait(bodyIncludes('403 — Không có quyền quản trị')); await release('refresh'); await delay(150);
  assert.equal(await cdp.evaluate(state('user.role')), 'CUSTOMER'); assert.equal(await cdp.evaluate(state('isAuthenticated')), true);
  assert.equal(await cdp.evaluate(state('sessionStatus')), 'authenticated');
  results.push('old refresh failure cannot log out the newly signed-in CUSTOMER');

  reset(); await boot(); await cdp.wait(bodyIncludes('Quản lý phim')); await installProbe();
  await cdp.evaluate(`void (window.__lateRequest = window.__admin.testApi.axiosInstance.get('/admin/late').catch(() => null))`); await waitHeld('late');
  await cdp.evaluate(`window.__admin.testApi.auth.getState().login({ email: 'admin@example.invalid', password: 'password123' })`);
  await cdp.wait(bodyIncludes('Quản lý phim')); await release('late'); await delay(150);
  assert.equal(await cdp.evaluate(state('sessionStatus')), 'authenticated');
  results.push('403 response from an old session cannot revoke the new session');

  reset(); await boot(); await cdp.wait(bodyIncludes('Quản lý phim')); await installProbe(); await seedCaches();
  await cdp.evaluate(`localStorage.clear(); window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }))`);
  await cdp.wait(bodyIncludes('Đăng nhập để vào quản trị')); await assertCacheCleared();
  results.push('simulated other-tab logout invalidates the gate and clears Admin cache');

  for (const route of ['/admin/reports', '/admin/showtimes', '/admin/sync', '/admin/unknown']) {
    reset({ user: customer }); await boot({ route }); await cdp.wait(bodyIncludes('403 — Không có quyền quản trị'));
    assert.equal(scenario.probe, 0);
  }
  results.push('all four Admin URLs and unknown Admin paths use the same guard');

  const layoutResults = [], foundationResults = [];
  for (const [route, heading] of [['reports', 'Báo cáo quản trị'], ['movies', 'Quản lý phim'], ['showtimes', 'Quản lý suất chiếu'], ['sync', 'Nhập dữ liệu mẫu']]) {
    reset(); await boot({ route: '/admin/' + route });
    await cdp.wait(`document.querySelector('#admin-page-title')?.textContent === ${JSON.stringify(heading)}`);
    assert.equal(await cdp.evaluate(`document.querySelector('aside a[aria-current="page"]')?.getAttribute('href')`), '/admin/' + route);
    assert.equal(await cdp.evaluate(`document.querySelector('aside').textContent.includes('admin@example.invalid')`), true);
    assert.equal(await cdp.evaluate(`Boolean(document.querySelector('footer, button[aria-label*="CineBot"]'))`), false);
    assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  }
  await cdp.evaluate(`document.querySelector('a[href="#admin-main"]').focus()`); await pressKey('Enter');
  await cdp.wait(`document.activeElement.id === 'admin-main'`);
  layoutResults.push('desktop: all four direct URLs, active menu, account, skip link, isolated customer layout');

  reset(); await boot({ route: '/admin/reports', width: 390 }); await cdp.wait(`Boolean(document.querySelector('#admin-main'))`);
  const openDrawer = async () => { await cdp.evaluate(`document.querySelector('button[aria-label="Mở menu quản trị"]').click()`); await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`); };
  await openDrawer();
  for (let index = 0; index < 12; index++) {
    await pressKey('Tab', index < 6 ? 0 : 8);
    assert.equal(await cdp.evaluate(`document.querySelector('dialog').contains(document.activeElement)`), true);
  }
  await pressKey('Escape'); await cdp.wait(`!document.querySelector('dialog[open]')`);
  assert.equal(await cdp.evaluate(`document.activeElement.getAttribute('aria-label')`), 'Mở menu quản trị');
  await openDrawer(); await cdp.evaluate(`document.querySelector('dialog a[href="/admin/showtimes"]').click()`);
  await cdp.wait(`!document.querySelector('dialog[open]') && document.querySelector('#admin-page-title')?.textContent === 'Quản lý suất chiếu'`);
  await openDrawer(); await cdp.evaluate(`document.querySelector('button[aria-label="Đóng menu quản trị"]').click()`);
  await cdp.wait(`!document.querySelector('dialog[open]')`); await openDrawer();
  await writeFile(path.join(artifacts, 'admin-drawer-390.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 380, y: 350, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 380, y: 350, button: 'left', clickCount: 1 });
  await cdp.wait(`!document.querySelector('dialog[open]')`);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  layoutResults.push('390px drawer: Tab/Shift+Tab focus trap, Escape/X/backdrop, navigation closes and restores focus');

  reset({ holdMovieModule: true }); await boot({ route: '/admin/reports' }); await cdp.wait(`Boolean(document.querySelector('#admin-page-title'))`);
  await cdp.evaluate(`document.querySelector('aside').dataset.suspenseProbe = 'preserved'`);
  await cdp.evaluate(`document.querySelector('aside a[href="/admin/movies"]').click()`); await waitHeld('module');
  // Router transitions may retain the previous outlet instead of replacing it with fallback.
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('#admin-main'))`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('aside').getBoundingClientRect().width > 0`), true);
  await release('module'); await cdp.wait(`document.querySelector('#admin-page-title')?.textContent === 'Quản lý phim'`);
  assert.equal(await cdp.evaluate(`document.querySelector('aside').dataset.suspenseProbe`), 'preserved');
  layoutResults.push('lazy child Suspense keeps the sidebar mounted and usable while its module is delayed');

  reset({ user: customer, holdMe: true }); const moduleStart = moduleRequests.length;
  await boot(); await waitHeld('me'); assert.equal(moduleRequests.length, moduleStart);
  scenario.holdMe = false; await release('me'); await cdp.wait(bodyIncludes('403 — Không có quyền quản trị'));
  assert.equal(moduleRequests.length, moduleStart);
  layoutResults.push('CUSTOMER and unverified sessions fetch neither AdminLayout nor Admin page modules');

  reset(); await boot(); await cdp.wait(`Boolean(document.querySelector('aside'))`);
  await cdp.evaluate(`document.querySelector('aside a[href="/"]').click()`); await cdp.wait(`Boolean(document.querySelector('main h1'))`);
  assert.notEqual(await cdp.evaluate(`localStorage.getItem('premier_cinema_access_token')`), null);
  reset(); await boot(); await cdp.wait(`Boolean(document.querySelector('aside'))`);
  await cdp.evaluate(`document.querySelector('aside button').click()`); await cdp.wait(`location.pathname === '/' && Boolean(document.querySelector('main h1'))`);
  assert.equal(await cdp.evaluate(`localStorage.getItem('premier_cinema_access_token')`), null);
  layoutResults.push('website link preserves the session; account logout returns home and clears credentials');

  await foundationBoot({ holdMovies: true }); await waitHeld('movies');
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-foundation-probe [role="status"]').textContent.includes('Đang tải')`), true);
  scenario.holdMovies = false; await release('movies'); await cdp.wait(bodyIncludes('Phim trang 1'));
  await cdp.evaluate(`[...document.querySelectorAll('#admin-foundation-probe button')].find(b => b.textContent === 'Trang sau').click()`);
  await cdp.wait(bodyIncludes('Phim trang 2'));
  assert.match(requests.filter(r => r.pathname === '/movies').at(-1).search, /page=1/);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('#admin-foundation-probe table caption'))`), true);
  foundationResults.push('table: loading, semantic caption/headers and server pagination preserve filters');

  await foundationBoot({}, 'empty'); await cdp.wait(bodyIncludes('Không có phim phù hợp'));
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-foundation-probe').textContent.includes('Trang 0/0')`), true);
  await foundationBoot({ moviesStatus: 404 }); await cdp.wait(`Boolean(document.querySelector('#admin-foundation-probe [role="alert"]'))`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast]').length`), 0);
  const readCount = requests.filter(r => r.pathname === '/movies').length; await delay(1100);
  assert.equal(requests.filter(r => r.pathname === '/movies').length, readCount);
  scenario.moviesStatus = 200; await cdp.evaluate(`document.querySelector('#admin-foundation-probe [role="alert"] button').click()`);
  await cdp.wait(bodyIncludes('Phim trang 1'));
  foundationResults.push('empty/error/retry UI: no query toast, no client-error retry, successful explicit recovery');

  await foundationBoot({ writeStatus: 400 }); await cdp.wait(bodyIncludes('Phim trang 1'));
  await cdp.evaluate(`const opener = document.querySelector('[data-open-form]'); opener.focus(); opener.click()`);
  await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`);
  for (let index = 0; index < 12; index++) { await pressKey('Tab', index < 6 ? 0 : 8); assert.equal(await cdp.evaluate(`document.querySelector('dialog').contains(document.activeElement)`), true); }
  await cdp.evaluate(`document.querySelector('#admin-probe-form').requestSubmit()`);
  await cdp.wait(bodyIncludes('Tên phim bị trùng'));
  assert.equal(scenario.writes, 1);
  assert.equal(await cdp.evaluate(`document.querySelector('input[name="title"]').value`), 'Phim thử nghiệm');
  assert.equal(await cdp.evaluate(`document.querySelector('input[name="durationMinutes"]').getAttribute('aria-invalid')`), 'true');
  assert.equal(await cdp.evaluate(`document.getElementById(document.querySelector('input[name="title"]').getAttribute('aria-describedby')).textContent`), 'Tên phim bị trùng');
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast]').length`), 0);
  await pressKey('Escape'); await cdp.wait(`!document.querySelector('dialog[open]')`);
  assert.equal(await cdp.evaluate(`document.activeElement.hasAttribute('data-open-form')`), true);
  await cdp.evaluate(`document.querySelector('[data-open-form]').click()`); await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1, y: 1, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1, y: 1, button: 'left', clickCount: 1 });
  await cdp.wait(`!document.querySelector('dialog[open]')`);
  foundationResults.push('400 validation: maps to accessible fields, preserves draft, no duplicate toast; modal traps/restores focus');

  await foundationBoot({ holdWrite: true }, 'movies', { width: 390 }); await cdp.wait(bodyIncludes('Phim trang 1')); await seedRelatedCaches();
  await cdp.evaluate(`document.querySelector('[data-open-form]').click()`); await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`);
  await writeFile(path.join(artifacts, 'admin-modal-390.png'), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await cdp.evaluate(`document.querySelector('#admin-probe-form').requestSubmit(); document.querySelector('#admin-probe-form').requestSubmit()`);
  await waitHeld('write'); await cdp.wait(`document.querySelector('dialog').getAttribute('aria-busy') === 'true'`);
  await pressKey('Escape'); assert.equal(await cdp.evaluate(`Boolean(document.querySelector('dialog[open]'))`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('button[aria-label="Đóng hộp thoại"]').disabled`), true);
  assert.equal(scenario.writes, 1); await release('write');
  await cdp.wait(`!document.querySelector('dialog[open]') && document.querySelectorAll('[data-sonner-toast][data-type="success"]').length === 1`);
  await cdp.wait(bodyIncludes('Phim thử nghiệm'));
  const created = requests.filter(r => r.pathname === '/admin/movies' && r.method === 'POST').at(-1);
  assert.equal(created.bearer, 'Bearer boot-token');
  assert.deepEqual(Object.keys(created.body).sort(), ['ageRating', 'description', 'durationMinutes', 'genre', 'posterUrl', 'releaseDate', 'status', 'title', 'trailerUrl'].sort());
  assert.equal(created.body.durationMinutes, 90); assert.equal(created.body.releaseDate, '2027-01-02');
  for (const key of [['movies', 'public'], ['showtimes', 'public'], ['admin', 'reports', 'cached'], ['admin', 'movie-options', 'cached']]) {
    assert.equal(await cdp.evaluate(`window.__admin.testApi.queryClient.getQueryState(${JSON.stringify(key)}).isInvalidated`), true);
  }
  assert.equal(await cdp.evaluate(`window.__admin.testApi.queryClient.getQueryState(['cinemas','public']).isInvalidated`), false);
  foundationResults.push('create movie: double submit sends one POST, locks modal, exact DTO/Bearer, one toast, refreshes Admin/public cache at 390px');

  await foundationBoot(); await cdp.wait(bodyIncludes('Phim trang 1'));
  await cdp.evaluate(`document.querySelector('[data-update]').click()`); await cdp.wait(bodyIncludes('Phim đã sửa'));
  const updated = requests.filter(r => r.pathname === '/admin/movies/7').at(-1);
  assert.equal(updated.method, 'PUT'); assert.equal(updated.body.title, 'Phim đã sửa'); assert.equal(updated.body.id, undefined);
  foundationResults.push('update movie uses PUT /admin/movies/{id}, strips form-only fields and refreshes active lists');

  await foundationBoot({ writeStatus: 409 }); await cdp.wait(bodyIncludes('Phim trang 1')); await seedRelatedCaches();
  await cdp.evaluate(`document.querySelector('[data-showtime]').click()`); await cdp.wait(bodyIncludes('Phòng chiếu đã có suất trùng giờ'));
  assert.equal(scenario.writes, 1); assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast][data-type="error"]').length`), 1);
  const scheduled = requests.filter(r => r.pathname === '/admin/showtimes').at(-1);
  assert.deepEqual(scheduled.body, { movieId: 7, auditoriumId: 3, startTime: '2027-01-02T19:00:00', endTime: '2027-01-02T20:45:00', basePrice: 90000 });
  scenario.writeStatus = 200; await cdp.evaluate(`document.querySelector('[data-showtime]').click()`);
  await cdp.wait(`Boolean(document.querySelector('[data-sonner-toast][data-type="success"]'))`);
  assert.equal(scenario.writes, 2);
  assert.equal(await cdp.evaluate(`window.__admin.testApi.queryClient.getQueryState(['showtimes','public']).isInvalidated`), true);
  assert.equal(await cdp.evaluate(`window.__admin.testApi.queryClient.getQueryState(['admin','reports','cached']).isInvalidated`), true);
  foundationResults.push('showtime DTO includes both times; 409 produces one toast/no retry, successful explicit resubmit refreshes schedule/reports');

  await foundationBoot({ holdWrite: true }); await cdp.wait(bodyIncludes('Phim trang 1'));
  await cdp.evaluate(`window.__admin.testApi.axiosInstance.defaults.timeout = 100; document.querySelector('[data-open-form]').click()`);
  await cdp.wait(`Boolean(document.querySelector('dialog[open]'))`); await cdp.evaluate(`document.querySelector('#admin-probe-form').requestSubmit()`);
  await waitHeld('write'); await cdp.wait(bodyIncludes('Chưa xác định được kết quả lưu'));
  await delay(1400); assert.equal(scenario.writes, 1);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('dialog[open]'))`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('input[name="title"]').value`), 'Phim thử nghiệm');
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast][data-type="error"]').length`), 1);
  await release('write', { allowAborted: true });
  foundationResults.push('lost write response: one POST, no automatic retry, uncertain-result message, draft retained and one toast');

  await foundationBoot({}, 'all');
  await cdp.wait(`document.querySelector('[data-read-status]').textContent.includes('"lastSuccessAt"') && document.querySelector('[data-read-status]').textContent.includes('"movies":2')`);
  const reads = JSON.parse(await cdp.evaluate(`document.querySelector('[data-read-status]').textContent`));
  assert.deepEqual(reads, { movies: 2, cinemas: 1, showtimes: 1, revenue: 90000, occupancy: 50, lastSuccessAt: '2026-11-01T00:00:00Z' });
  const revenue = requests.filter(r => r.pathname === '/admin/reports/revenue').at(-1);
  for (const [key, value] of Object.entries({ startDate: '2027-01-01', endDate: '2027-01-31', movieId: '7', cinemaId: '2', groupBy: 'movie' })) {
    assert.equal(new URLSearchParams(revenue.search).get(key), value);
  }
  assert.equal(revenue.bearer, 'Bearer boot-token');
  foundationResults.push('query hooks reuse paged catalog/cinema/room/showtime services and send correct report/occupancy/sync parameters');

  await seedRelatedCaches(); await cdp.evaluate(`document.querySelector('[data-sync]').click()`);
  await cdp.wait(`Boolean(document.querySelector('[data-sonner-toast][data-type="success"]'))`);
  const imported = requests.filter(r => r.pathname === '/admin/sync/galaxy/local-file').at(-1);
  assert.equal(imported.method, 'POST'); assert.equal(imported.body, null); assert.equal(new URLSearchParams(imported.search).get('limitShowtimes'), '25');
  assert.equal(scenario.writes, 1);
  for (const key of [['movies', 'public'], ['showtimes', 'public'], ['cinemas', 'public']]) {
    assert.equal(await cdp.evaluate(`window.__admin.testApi.queryClient.getQueryState(${JSON.stringify(key)}).isInvalidated`), true);
  }
  assert.equal(JSON.parse(await cdp.evaluate(`document.querySelector('[data-read-status]').textContent`)).lastSuccessAt, '2026-11-01T00:00:00Z');
  foundationResults.push('local-file sync sends limit as query param, refreshes catalog/reports and keeps online status separate');

  await foundationBoot({ holdMovies: true }); await waitHeld('movies'); await installProbe();
  await cdp.evaluate(`window.__admin.testApi.auth.getState().logout({ silent: true })`);
  await cdp.wait(bodyIncludes('Đăng nhập để vào quản trị'));
  assert.equal(await cdp.evaluate(`window.__admin.testApi.queryClient.getQueryCache().findAll({ queryKey: ['admin'] }).length`), 0);
  await release('movies', { allowAborted: true });
  foundationResults.push('catalog query signal passes through shared service and is aborted/removed on session expiry');

  reset({ foundation: true, user: customer }); await boot(); await cdp.wait(bodyIncludes('403 — Không có quyền quản trị'));
  const beforeCustomerProbe = requests.length; await installFoundation('all', false);
  await cdp.evaluate(`document.querySelector('[data-sync]').click()`); await delay(150);
  assert.equal(requests.length, beforeCustomerProbe);
  foundationResults.push('hooks mounted outside the route still block CUSTOMER reads and writes');

  assert.deepEqual(exceptions, []);
  const report = { mode: 'Edge + Vite development + mocked REST APIs; no live integration', passed: results, layoutPassed: layoutResults, foundationPassed: foundationResults,
    runtimeExceptions: exceptions.length, mockRequests: requests.length };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, artifacts }, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ results, scenario, requests, exceptions,
    location: await cdp?.evaluate('location.href'), body: await cdp?.evaluate('document.body.innerText'),
    modal: await cdp?.evaluate(`document.querySelector('dialog')?.outerHTML`), activeElement: await cdp?.evaluate('document.activeElement?.outerHTML') }, null, 2));
  console.error(`Browser check failed; diagnostics: ${path.join(artifacts, 'failure.json')}`);
  throw error;
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  edge?.kill();
  await server?.close();
}
