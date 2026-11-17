import assert from 'node:assert/strict';
import test, { after, afterEach, before, beforeEach, mock } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { createServer } from 'vite';

let server, useCinemaDetail, useCinemaShowtimes, client, requests, unsubscribers;

before(async () => {
  // Load the real hooks/services with Vite's import and environment handling.
  server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
  });
  ({ useCinemaDetail } = await server.ssrLoadModule('/src/features/cinemas/hooks/useCinemaDetail.js'));
  ({ useCinemaShowtimes } = await server.ssrLoadModule('/src/features/cinemas/hooks/useCinemaShowtimes.js'));
  const { default: axiosInstance } = await server.ssrLoadModule('/src/config/axiosInstance.js');
  const { tokenStorage } = await server.ssrLoadModule('/src/config/tokenStorage.js');
  mock.method(tokenStorage, 'getSessionId', () => null);
  mock.method(tokenStorage, 'getAccessToken', () => null);
  // Replace only the HTTP transport; requests still pass through both services
  // and Axios interceptors. A late response deliberately ignores cancellation.
  axiosInstance.defaults.adapter = config => new Promise((resolve, reject) => {
    const response = { config, headers: {}, status: 200, statusText: 'OK' };
    requests.push({
      config,
      resolve: data => resolve({ ...response, data: { data } }),
      reject: status => reject(Object.assign(new Error('API error'), {
        config, response: { ...response, status, data: { message: 'API error' } },
      })),
    });
  });
});

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retryDelay: 0 } } });
  requests = [];
  unsubscribers = [];
});

afterEach(() => {
  unsubscribers.forEach(unsubscribe => unsubscribe());
  client.clear();
});

after(async () => {
  mock.restoreAll();
  await server?.close();
});

// Capture the actual hook options without a DOM, then exercise subscription,
// key changes and unmounts with React Query's real observer.
function optionsFor(useHook, ...args) {
  const snapshot = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  function Probe() { useHook(...args); return null; }
  renderToString(createElement(QueryClientProvider, { client: snapshot }, createElement(Probe)));
  const options = snapshot.getQueryCache().getAll()[0].options;
  snapshot.clear();
  return { ...options, retryDelay: 0 };
}

function observe(options) {
  const observer = new QueryObserver(client, options);
  unsubscribers.push(observer.subscribe(() => {}));
  return observer;
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail('Query did not reach the expected state');
}

async function reply(index, data, observer) {
  await waitFor(() => requests.length > index);
  requests[index].resolve(data);
  await waitFor(() => observer.getCurrentResult().isSuccess && !observer.getCurrentResult().isFetching);
}

test('cinema details use GET, retain metadata and cache separately by canonical ID', async () => {
  const first = { id: 1, name: 'Rạp Một', imageUrls: ['https://example.com/cinema.jpg'], phone: '1900 2224', auditoriums: [] };
  const observer = observe(optionsFor(useCinemaDetail, 1));
  await reply(0, first, observer);
  assert.deepEqual(observer.getCurrentResult().data, first);
  assert.equal(requests[0].config.method, 'get');
  assert.equal(requests[0].config.url, '/cinemas/1');
  assert.equal(requests[0].config.skipErrorToast, true);
  assert.ok(requests[0].config.signal instanceof AbortSignal);

  observer.setOptions(optionsFor(useCinemaDetail, 2));
  assert.equal(observer.getCurrentResult().data, undefined);
  await reply(1, { id: 2 }, observer);
  assert.equal(requests[1].config.url, '/cinemas/2');
  observer.setOptions(optionsFor(useCinemaDetail, '1'));
  assert.deepEqual(observer.getCurrentResult().data, first);
  assert.equal(observer.getCurrentResult().isFetching, false);
  assert.equal(requests.length, 2);
});

test('showtimes need no movieId and isolate cinema/date caches, including an empty day', async () => {
  const options = (cinemaId, date = '2026-11-16') => optionsFor(useCinemaShowtimes, { cinemaId, date });
  const slots = [{ id: 501, movieId: 10, cinemaId: 1, basePrice: 89000 }];
  const observer = observe(options(1));
  await reply(0, slots, observer);
  assert.equal(requests[0].config.method, 'get');
  assert.equal(requests[0].config.url, '/showtimes');
  assert.deepEqual(requests[0].config.params, { cinemaId: '1', date: '2026-11-16' });
  assert.equal(requests[0].config.skipErrorToast, true);

  observer.setOptions(options(2));
  assert.equal(observer.getCurrentResult().data, undefined);
  await reply(1, [{ id: 502, cinemaId: 2 }], observer);
  observer.setOptions(options(2, '2026-11-17'));
  assert.equal(observer.getCurrentResult().data, undefined);
  await reply(2, [], observer);
  assert.deepEqual(observer.getCurrentResult().data, []);
  assert.deepEqual(requests[2].config.params, { cinemaId: '2', date: '2026-11-17' });

  observer.setOptions(options('1'));
  assert.deepEqual(observer.getCurrentResult().data, slots);
  assert.equal(observer.getCurrentResult().isFetching, false);
  assert.equal(requests.length, 3);
});

const switches = [
  { name: 'cinema detail', options: () => [optionsFor(useCinemaDetail, 1), optionsFor(useCinemaDetail, 2)], data: { id: 2 }, late: { id: 1 } },
  { name: 'showtime cinema', options: () => [1, 2].map(cinemaId => optionsFor(useCinemaShowtimes, { cinemaId, date: '2026-11-16' })), data: [{ cinemaId: 2 }], late: [{ cinemaId: 1 }] },
  { name: 'showtime date', options: () => ['2026-11-16', '2026-11-17'].map(date => optionsFor(useCinemaShowtimes, { cinemaId: 1, date })), data: [{ id: 502 }], late: [{ id: 501 }] },
];

for (const scenario of switches) {
  test(`changing ${scenario.name} aborts the old request and ignores a late response`, async () => {
    const [first, second] = scenario.options();
    const observer = observe(first);
    await waitFor(() => requests.length === 1);
    observer.setOptions(second);
    assert.equal(requests[0].config.signal.aborted, true);
    assert.equal(observer.getCurrentResult().data, undefined);
    await reply(1, scenario.data, observer);
    requests[0].resolve(scenario.late);
    await delay(10);
    assert.deepEqual(observer.getCurrentResult().data, scenario.data);
    assert.equal(client.getQueryData(first.queryKey), undefined);
  });
}

test('unmounting cancels both in-flight requests', async () => {
  observe(optionsFor(useCinemaDetail, 1));
  observe(optionsFor(useCinemaShowtimes, { cinemaId: 1, date: '2026-11-16' }));
  await waitFor(() => requests.length === 2);
  unsubscribers.forEach(unsubscribe => unsubscribe());
  for (const request of requests) assert.equal(request.config.signal.aborted, true);
});

test('missing or invalid cinema IDs and missing dates do not request the catalog', async () => {
  for (const cinemaId of [undefined, null, '', 0, -1, 'galaxy-ha-noi', '1/2', '9223372036854775808']) {
    observe(optionsFor(useCinemaDetail, cinemaId));
    observe(optionsFor(useCinemaShowtimes, { cinemaId, date: '2026-11-16' }));
  }
  observe(optionsFor(useCinemaShowtimes, { cinemaId: 1 }));
  await delay(10);
  assert.equal(requests.length, 0);
});

test('a detail 404 is not retried and does not erase the showtimes result', async () => {
  const detail = observe(optionsFor(useCinemaDetail, 1));
  await waitFor(() => requests.length === 1);
  const showtimes = observe(optionsFor(useCinemaShowtimes, { cinemaId: 1, date: '2026-11-16' }));
  await reply(1, [], showtimes);
  requests[0].reject(404);
  await waitFor(() => detail.getCurrentResult().isError);
  assert.equal(detail.getCurrentResult().error.response.status, 404);
  assert.deepEqual(showtimes.getCurrentResult().data, []);
  assert.equal(showtimes.getCurrentResult().isSuccess, true);
  assert.equal(requests.length, 2);
});

test('failed showtime refresh retries once and retains only that cinema/day snapshot', async () => {
  const detail = observe(optionsFor(useCinemaDetail, 1));
  await reply(0, { id: 1 }, detail);
  const showtimes = observe(optionsFor(useCinemaShowtimes, { cinemaId: 1, date: '2026-11-16' }));
  const slots = [{ id: 501, cinemaId: 1 }];
  await reply(1, slots, showtimes);
  const refresh = showtimes.refetch();
  await waitFor(() => requests.length === 3);
  requests[2].reject(503);
  await waitFor(() => requests.length === 4);
  requests[3].reject(503);
  await refresh;
  assert.equal(showtimes.getCurrentResult().isError, true);
  assert.deepEqual(showtimes.getCurrentResult().data, slots);
  assert.equal(detail.getCurrentResult().isSuccess, true);
  assert.deepEqual(detail.getCurrentResult().data, { id: 1 });
  assert.equal(requests.length, 4);
});
