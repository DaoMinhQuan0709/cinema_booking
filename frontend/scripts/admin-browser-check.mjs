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
const results = [], exceptions = [], requests = [];
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
      const button = [...document.querySelectorAll('main button')].find(b => b.textContent.includes(${JSON.stringify(text)}) && b.offsetWidth && !b.disabled);
      if (!button) return false; button.click(); return true;
    })()`), true, `Visible enabled button: ${text}`);
  }
}

function reset(options = {}) {
  scenario = { user: admin, meStatus: 200, refreshStatus: 200, probeStatus: 200,
    me: 0, refresh: 0, login: 0, probe: 0, held: [], ...options };
}

async function respond(requestId, status, data) {
  await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
    ],
    body: Buffer.from(JSON.stringify({ code: status, message: status >= 400 ? 'Mock error' : 'OK', data })).toString('base64'),
  });
}

async function intercept({ request, requestId }) {
  if (request.method === 'OPTIONS') return respond(requestId, 200);
  const pathname = new URL(request.url).pathname.replace('/api/v1', '');
  requests.push({ pathname, method: request.method, bearer: request.headers.Authorization });
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
  if (pathname === '/movies') return respond(requestId, 200, { content: [], totalElements: 0, totalPages: 0, last: true });
  if (pathname === '/cinemas' || pathname === '/showtimes') return respond(requestId, 200, []);
  throw new Error(`Unexpected API request: ${pathname}`);
}

async function release(kind, { allowAborted = false } = {}) {
  const index = scenario.held.findIndex(item => item.kind === kind);
  assert.ok(index >= 0, `Held ${kind} request exists`);
  const [held] = scenario.held.splice(index, 1);
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
  await cdp.wait(`window.__adminBoot === ${bootSequence} && Boolean(document.querySelector('main'))`);
}

const bodyIncludes = text => `document.body.textContent.includes(${JSON.stringify(text)})`;
const state = property => `window.__admin.testApi.auth.getState().${property}`;
async function installProbe(mount = false) {
  await cdp.evaluate(`(async () => { window.__admin = await import('/scripts/fixtures/admin-route-probe.jsx'); ${mount ? 'window.__admin.mountAdminProbe();' : ''} })()`);
}
async function seedCaches() {
  await cdp.evaluate(`(async () => {
    const q = window.__admin.testApi.queryClient;
    q.setQueryData(['admin', 'sensitive'], { secret: 'old admin' });
    q.setQueryData(['movies', 'public-probe'], ['public catalog']);
    await q.getMutationCache().build(q, { mutationKey: ['admin', 'write'], mutationFn: async () => 'old mutation' }).execute();
  })()`);
}
async function assertCacheCleared() {
  assert.equal(await cdp.evaluate(`window.__admin.testApi.queryClient.getQueryCache().findAll({ queryKey: ['admin'] }).length`), 0);
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
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
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
  assert.equal(await cdp.evaluate('location.pathname + location.search + location.hash'), '/admin/reports?date=2026-11-12#totals');
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
  await cdp.wait(bodyIncludes('Quản lý phim')); await assertCacheCleared();
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

  assert.deepEqual(exceptions, []);
  const report = { mode: 'Edge + Vite development + mocked REST APIs; no live integration', passed: results, runtimeExceptions: exceptions.length, mockRequests: requests.length };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, artifacts }, null, 2));
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
