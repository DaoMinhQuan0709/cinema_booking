import assert from 'node:assert/strict';
import test, { after, afterEach, before, beforeEach, mock } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { createServer } from 'vite';

let server, hooks, auth, client, requests, subscriptions, activeSession;
const code = 'BK20261120130000ABCD';

before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom' });
  const { tokenStorage } = await server.ssrLoadModule('/src/config/tokenStorage.js');
  mock.method(tokenStorage, 'getSessionId', () => activeSession);
  mock.method(tokenStorage, 'getAccessToken', () => activeSession ? `token-${activeSession}` : null);
  mock.method(tokenStorage, 'getUser', () => ({ id: 1, role: 'CUSTOMER' }));
  mock.method(tokenStorage, 'isAuthenticated', () => Boolean(activeSession));
  ({ useAuthStore: auth } = await server.ssrLoadModule('/src/features/auth/authStore.js'));
  hooks = await server.ssrLoadModule('/src/features/tickets/useTicketQueries.js');
  const { default: axios } = await server.ssrLoadModule('/src/config/axiosInstance.js');
  axios.defaults.adapter = config => new Promise(resolve => {
    requests.push({ config, reply: data => resolve({ config, status: 200, headers: {}, data: config.responseType === 'blob' ? data : { data } }) });
  });
});

beforeEach(() => {
  activeSession = 'A';
  auth.setState({ sessionId: activeSession, sessionStatus: 'authenticated' });
  client = new QueryClient(); requests = []; subscriptions = [];
});
afterEach(() => { subscriptions.forEach(unsubscribe => unsubscribe()); client.clear(); });
after(async () => { mock.restoreAll(); await server?.close(); });

function options(hook, ...args) {
  // React SSR reads Zustand's initial snapshot; sync this test-only snapshot
  // with the chosen session before capturing the real hook options.
  Object.assign(auth.getInitialState(), auth.getState());
  const snapshot = new QueryClient();
  function Probe() { hook(...args); return null; }
  renderToString(createElement(QueryClientProvider, { client: snapshot }, createElement(Probe)));
  const result = snapshot.getQueryCache().getAll()[0].options;
  snapshot.clear(); return result;
}
function observe(opts) {
  const observer = new QueryObserver(client, opts);
  subscriptions.push(observer.subscribe(() => {})); return observer;
}
async function wait(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await delay(5); }
  assert.fail('Expected query state not reached');
}

test('khách/phiên chưa xác minh, mã sai và đơn chưa xác nhận không gọi API riêng tư', async () => {
  for (const sessionStatus of ['anonymous', 'idle', 'checking', 'error', 'forbidden']) {
    auth.setState({ sessionStatus });
    observe(options(hooks.useTicketHistory));
    observe(options(hooks.useTicketDetail, code));
    observe(options(hooks.useTicketQr, code, true));
  }
  auth.setState({ sessionStatus: 'authenticated' });
  observe(options(hooks.useTicketDetail, '../invalid'));
  observe(options(hooks.useTicketQr, code, false));
  await delay(20); assert.equal(requests.length, 0);
});

test('list/detail/QR dùng đúng endpoint với Bearer, giữ JSON DTO và PNG Blob', async () => {
  const list = observe(options(hooks.useTicketHistory));
  const detail = observe(options(hooks.useTicketDetail, code));
  const qr = observe(options(hooks.useTicketQr, code, true));
  await wait(() => requests.length === 3);
  assert.deepEqual(requests.map(({ config }) => config.url), ['/users/me/bookings', `/bookings/${code}`, `/bookings/${code}/qr`]);
  assert.ok(requests.every(({ config }) => config.headers.Authorization === 'Bearer token-A' && config.signal && config.skipErrorToast));
  const blob = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
  requests[0].reply([{ bookingCode: code, status: 'CONFIRMED' }]);
  requests[1].reply({ bookingCode: code, seats: [], products: [] });
  requests[2].reply(blob);
  await wait(() => [list, detail, qr].every(observer => observer.getCurrentResult().isSuccess));
  assert.deepEqual(detail.getCurrentResult().data, { bookingCode: code, seats: [], products: [] });
  assert.equal(qr.getCurrentResult().data, blob);
});

test('đổi phiên abort request đang chờ; response cũ không thành dữ liệu mới', async () => {
  const observer = observe(options(hooks.useTicketHistory));
  await wait(() => requests.length === 1);
  activeSession = 'B'; auth.setState({ sessionId: 'B' });
  observer.setOptions(options(hooks.useTicketHistory));
  await wait(() => requests.length === 2);
  assert.equal(requests[0].config.signal.aborted, true);
  requests[0].reply([{ movieTitle: 'Private A' }]);
  requests[1].reply([{ movieTitle: 'Private B' }]);
  await wait(() => observer.getCurrentResult().isSuccess);
  assert.deepEqual(observer.getCurrentResult().data, [{ movieTitle: 'Private B' }]);
  await wait(() => client.getQueryCache().findAll({ queryKey: ['my-tickets', 'A'] }).length === 0);
});

test('phản hồi thành công đến sau đổi phiên bị Axios bỏ, kể cả adapter không hủy', async () => {
  const observer = observe(options(hooks.useTicketDetail, code));
  await wait(() => requests.length === 1);
  activeSession = 'B';
  requests[0].reply({ bookingCode: code, movieTitle: 'Private A' });
  await wait(() => observer.getCurrentResult().isError);
  assert.equal(observer.getCurrentResult().data, undefined);
});

test('unmount hủy QR đang chờ và xóa query ngay thay vì lưu lại dữ liệu riêng tư', async () => {
  observe(options(hooks.useTicketQr, code, true));
  await wait(() => requests.length === 1);
  subscriptions.pop()();
  assert.equal(requests[0].config.signal.aborted, true);
  await wait(() => client.getQueryCache().getAll().length === 0);
});
