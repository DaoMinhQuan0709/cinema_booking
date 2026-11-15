// Hai chế độ tách biệt: REST mô phỏng hoặc API localhost thật chỉ đọc, không tạo dữ liệu.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startEdgeBrowser } from './lib/edge-browser.mjs';
import { getVietnamClock, buildScheduleDays } from '../src/features/showtimes/scheduleUtils.js';
import { filterCinemas, getCinemaCities, normalizeCinemaSearch } from '../src/features/cinemas/cinemaUtils.js';

const live = process.argv.includes('--live');
const root = fileURLToPath(new URL('..', import.meta.url));
const port = live ? 4207 : 4206;
const origin = `http://127.0.0.1:${port}`;
const artifacts = await mkdtemp(path.join(tmpdir(), live ? 'cinema-cinemas-live-' : 'cinema-cinemas-mock-'));
const apiBase = process.env.CINEMAS_TEST_API_BASE || 'http://localhost:8080/api/v1';
assert.match(apiBase, /^http:\/\/(localhost|127\.0\.0\.1):\d+\/api\/v1$/);
const days = buildScheduleDays();
const today = getVietnamClock().date;
const requests = [], exceptions = [], passed = [], responses = [];
let browser, cdp, scenario = { mode: 'ok' };

const fixtures = [
  { id: 1, name: 'Galaxy Đà Nẵng', address: 'Tầng 3, đường Điện Biên Phủ', city: 'Đà Nẵng', phone: '1900 2224', displayOrder: 2,
    imageLandscape: 'https://images.example.invalid/broken.jpg', imagePortrait: 'https://images.example.invalid/portrait.svg' },
  { id: 2, name: 'Galaxy Hà Nội', address: '175 Nguyễn Thái Học, Hà Nội', city: 'Hà Nội', phone: '+84 (28) 1234-5678', displayOrder: 0,
    imageLandscape: 'https://images.example.invalid/hanoi.svg' },
  { id: 3, name: 'Rạp Chưa Có Suất', address: '', city: 'Chưa xác định', phone: null },
  { id: 4, name: 'Rạp Sắp Có Lịch', address: 'Địa chỉ rạp mới', city: 'Hà Nội', phone: '1900 2224', displayOrder: 3 },
];
const mockSlots = [{ id: 501, movieId: 10, movieTitle: 'Phim thử lịch', cinemaId: 2, cinemaName: 'Galaxy Hà Nội',
  auditoriumName: 'Phòng 1', startTime: `${today}T23:59:59`, endTime: `${days[1].date}T01:30:00`, basePrice: 89000 }];
const cards = `document.querySelectorAll('main article[aria-labelledby^="cinema-name-"]')`;

async function reply(requestId, status, data) {
  await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Accept, Authorization' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' }],
    body: Buffer.from(JSON.stringify({ code: status, message: status === 200 ? 'OK' : 'Lỗi mô phỏng', data })).toString('base64') });
}

async function intercept(event) {
  const { requestId, request } = event;
  const url = new URL(request.url);
  if (url.hostname === 'images.example.invalid') {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#262635"/></svg>';
    return cdp.send('Fetch.fulfillRequest', { requestId, responseCode: url.pathname === '/broken.jpg' ? 404 : 200,
      responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }], body: Buffer.from(url.pathname === '/broken.jpg' ? 'ảnh lỗi mô phỏng' : svg).toString('base64') });
  }
  const route = url.pathname.replace(/^\/api\/v1/, '');
  requests.push({ method: request.method, route, search: url.search });
  assert.ok(['GET', 'OPTIONS'].includes(request.method), 'Kiểm tra danh bạ không được ghi dữ liệu');
  assert.ok(['/cinemas', '/showtimes'].includes(route), `API ngoài phạm vi: ${route}`);
  if (live) return cdp.send('Fetch.continueRequest', { requestId, url: apiBase + route + url.search });
  if (request.method === 'OPTIONS') return reply(requestId, 200, null);
  if (route === '/cinemas') {
    if (scenario.mode === 'held') { scenario.held = requestId; return; }
    if (scenario.mode === 'error') return reply(requestId, 503, null);
    if (scenario.mode === 'invalid') return reply(requestId, 200, { không: 'phải mảng' });
    return reply(requestId, 200, scenario.mode === 'empty' ? [] : fixtures);
  }
  return reply(requestId, 200, url.searchParams.get('date') === today ? mockSlots : []);
}

async function boot(route = '/cinemas', width = 1366) {
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: origin + route });
  await cdp.wait(`Boolean(document.querySelector('main #cinema-search')) || Boolean(document.querySelector('#schedule-cinemaId'))`);
}

async function ready(count) { await cdp.wait(`${cards}.length === ${count}`); }
async function setField(selector, value) {
  await cdp.evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  })()`);
}
async function screenshot(name) {
  await writeFile(path.join(artifacts, name), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
}
async function visibleImagesReady() {
  await cdp.wait(`[...document.querySelectorAll('main article img')].filter(img => img.getBoundingClientRect().top < innerHeight && img.getBoundingClientRect().bottom > 0).every(img => img.complete && img.naturalWidth > 0)`, 25000);
}
const cinemaReads = () => requests.filter(r => r.method === 'GET' && r.route === '/cinemas').length;
async function openSchedule(id) {
  await cdp.evaluate(`document.querySelector('article[aria-labelledby="cinema-name-${id}"] a[href^="/showtimes"]').click()`);
  await cdp.wait(`Boolean(document.querySelector('#schedule-cinemaId')) && ![...document.querySelectorAll('main button')].some(b => b.textContent.trim() === 'Làm mới' && b.disabled)`);
  await cdp.wait(`document.querySelector('#schedule-cinemaId')?.value === ${JSON.stringify(String(id))}`);
  assert.equal(await cdp.evaluate(`new URLSearchParams(location.search).get('cinemaId')`), String(id));
}

async function runMock() {
  await boot('/cinemas?ref=footer'); await ready(4);
  assert.deepEqual(await cdp.evaluate(`[...${cards}].map(c => c.querySelector('h2').textContent)`), ['Galaxy Hà Nội', 'Galaxy Đà Nẵng', 'Rạp Sắp Có Lịch', 'Rạp Chưa Có Suất']);
  assert.equal(await cdp.evaluate(`document.querySelector('header a[href="/cinemas"][aria-current="page"]')?.textContent.trim()`), 'Rạp chiếu phim');
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('footer')) && Boolean(document.querySelector('button[aria-label="Mở trợ lý CineBot"]'))`), true);
  passed.push('Trang công khai dùng MainLayout, menu đúng, đủ thẻ và thứ tự hiển thị');

  await cdp.wait(`document.querySelector('[aria-labelledby="cinema-name-1"] img')?.src.endsWith('/portrait.svg')`);
  assert.equal(await cdp.evaluate(`[...document.querySelectorAll('main article img')].every(img => img.loading === 'lazy')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('[aria-labelledby="cinema-name-3"]').textContent.includes('Ảnh rạp đang cập nhật')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('[aria-labelledby="cinema-name-3"]').textContent.includes('Địa chỉ đang cập nhật')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('[aria-labelledby="cinema-name-2"] a[href^="tel:"]').getAttribute('href')`), 'tel:+842812345678');
  passed.push('Ảnh ngang lỗi chuyển ảnh dọc, ảnh lazy, metadata thiếu có fallback và số gọi đúng');

  const reads = cinemaReads();
  await setField('#cinema-search', 'DA NANG'); await ready(1);
  assert.equal(await cdp.evaluate(`document.querySelector('main article h2').textContent`), 'Galaxy Đà Nẵng');
  await setField('#cinema-city', 'Hà Nội'); await ready(0);
  assert.equal(await cdp.evaluate(`document.querySelector('main').textContent.includes('Không tìm thấy rạp phù hợp')`), true);
  await setField('#cinema-search', 'ha noi'); await ready(1);
  assert.equal(cinemaReads(), reads);
  assert.equal(await cdp.evaluate(`new URLSearchParams(location.search).get('ref')`), 'footer');
  passed.push('Tìm không dấu/hoa thường kết hợp tỉnh, không gọi API mỗi ký tự và giữ tham số khác');

  await cdp.click('Xóa bộ lọc'); await ready(4);
  await setField('#cinema-city', 'Chưa xác định'); await ready(1);
  assert.equal(await cdp.evaluate(`document.querySelector('main article h2').textContent`), 'Rạp Chưa Có Suất');
  await cdp.click('Xóa bộ lọc'); await ready(4);
  passed.push('Giữ nhóm Chưa xác định và xóa bộ lọc phục hồi đủ rạp');

  await setField('#cinema-city', 'Hà Nội'); await ready(2);
  await setField('#cinema-city', 'Đà Nẵng'); await ready(1);
  await cdp.evaluate('history.back()'); await cdp.wait(`document.querySelector('#cinema-city').value === 'Hà Nội'`); await ready(2);
  await cdp.evaluate('history.forward()'); await cdp.wait(`document.querySelector('#cinema-city').value === 'Đà Nẵng'`);
  await cdp.send('Page.reload'); await cdp.wait(`document.querySelector('#cinema-city')?.value === 'Đà Nẵng'`); await ready(1);
  passed.push('URL/Back/Forward/reload giữ đúng tỉnh và kết quả');

  await boot('/cinemas?q=old&q=other&city=Không+có&ref=share'); await ready(0);
  await cdp.wait(`new URLSearchParams(location.search).getAll('q').length === 1`);
  assert.equal(await cdp.evaluate(`document.querySelector('#cinema-city').value`), 'Không có');
  passed.push('Chuẩn hóa URL trùng tham số và giữ bộ lọc không có kết quả');

  await boot(); await ready(4); const cachedReads = cinemaReads();
  await openSchedule(3);
  await cdp.wait(`document.querySelector('main').textContent.includes('Rạp đã chọn chưa có suất chiếu phù hợp')`);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('a[href="/booking/501"]'))`), false);
  await cdp.evaluate(`document.querySelector('header a[href="/cinemas"]').click()`); await ready(4);
  assert.equal(cinemaReads(), cachedReads);
  passed.push('Sang rạp chưa có suất giữ ID, không lộ lịch rạp khác; quay lại dùng cache');

  await openSchedule(2);
  await cdp.wait(`Boolean(document.querySelector('a[href="/booking/501"]'))`);
  const dateLabel = `${days[1].label}, ${days[1].fullDate}`;
  await cdp.evaluate(`document.querySelector('button[aria-label=${JSON.stringify(dateLabel)}]').click()`);
  await cdp.wait(`document.querySelector('main').textContent.includes('Rạp đã chọn chưa có suất chiếu phù hợp')`);
  assert.equal(await cdp.evaluate(`document.querySelector('#schedule-cinemaId').value`), '2');
  assert.equal(await cdp.evaluate(`new URLSearchParams(location.search).get('cinemaId')`), '2');
  passed.push('Có lịch ở ngày đầu, đổi ngày hết lịch vẫn giữ rạp và URL');

  scenario = { mode: 'error' }; await boot();
  await cdp.wait(`document.querySelector('main [role="alert"]')?.textContent.includes('Không tải được danh sách rạp')`);
  scenario.mode = 'ok'; await cdp.click('Thử lại'); await ready(4);
  passed.push('Lỗi tải ban đầu có thử lại và phục hồi danh sách');

  scenario.mode = 'error'; await cdp.click('Làm mới');
  await cdp.wait(`document.querySelector('main [role="alert"]')?.textContent.includes('dữ liệu đã tải trước đó')`);
  assert.equal(await cdp.evaluate(`${cards}.length`), 4);
  scenario.mode = 'ok'; await cdp.click('Thử lại'); await cdp.wait(`!document.querySelector('main [role="alert"]')`);
  passed.push('Lỗi làm mới giữ dữ liệu cũ có cảnh báo, thử lại thành công xóa cảnh báo');

  scenario = { mode: 'empty' }; await boot();
  await cdp.wait(`document.querySelector('main').textContent.includes('Chưa có rạp trong danh sách')`);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main [role="alert"]'))`), false);
  passed.push('Danh sách rỗng được phân biệt với lỗi và không có kết quả lọc');

  scenario = { mode: 'invalid' }; await boot();
  await cdp.wait(`document.querySelector('main [role="alert"]')?.textContent.includes('Không tải được danh sách rạp')`);
  passed.push('Payload 200 sai cấu trúc được báo lỗi, không hiện như danh sách trống');

  scenario = { mode: 'held' }; await boot();
  await cdp.wait(`document.querySelector('main [role="status"]')?.textContent.includes('Đang tìm rạp')`);
  await cdp.wait(`document.querySelectorAll('main [aria-hidden="true"]').length > 5`);
  await cdp.wait(`Boolean(document.querySelector('main #cinema-search'))`);
  assert.ok(scenario.held); scenario.mode = 'ok'; await reply(scenario.held, 200, fixtures); await ready(4);
  passed.push('Response chậm hiện loading, sau đó hiển thị dữ liệu');

  scenario = { mode: 'error' }; await boot('/showtimes?cinemaId=3');
  await cdp.wait(`document.querySelector('main [role="alert"]')?.textContent.includes('thông tin thành phố')`);
  assert.equal(await cdp.evaluate(`document.querySelector('#schedule-cinemaId').value`), '3');
  assert.equal(await cdp.evaluate(`new URLSearchParams(location.search).get('cinemaId')`), '3');
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('a[href="/booking/501"]'))`), false);
  scenario.mode = 'ok'; await cdp.click('Thử lại thông tin rạp');
  await cdp.wait(`document.querySelector('#schedule-cinemaId').selectedOptions[0].textContent === 'Rạp Chưa Có Suất'`);
  passed.push('Lỗi metadata khi mở trực tiếp lịch không bỏ ID; thử lại phục hồi tên rạp');

  await boot('/cinemas', 390); await ready(4);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await cdp.evaluate(`getComputedStyle(document.querySelector('main article').parentElement).gridTemplateColumns.split(' ').length`), 1);
  await cdp.evaluate(`document.querySelector('#cinema-search').focus()`); await cdp.key('Tab');
  assert.equal(await cdp.evaluate(`document.activeElement.id`), 'cinema-city');
  assert.notEqual(await cdp.evaluate(`getComputedStyle(document.activeElement).boxShadow`), 'none');
  await screenshot('cinemas-mobile-mock.png');
  await cdp.evaluate(`document.querySelector('[aria-labelledby="cinema-name-2"] a[href^="tel:"]').focus()`);
  await cdp.key('Tab'); assert.equal(await cdp.evaluate(`document.activeElement.getAttribute('href')`), '/showtimes?cinemaId=2');
  await cdp.key('Enter'); await cdp.wait(`document.querySelector('#schedule-cinemaId')?.value === '2'`);
  passed.push('390px không tràn ngang, một cột, Tab/focus rõ và Enter mở đúng lịch');
}

async function readApi(route) {
  const response = await fetch(apiBase + route); assert.equal(response.status, 200, route);
  return (await response.json()).data;
}

async function runLive() {
  const catalog = await readApi('/cinemas'); assert.ok(Array.isArray(catalog) && catalog.length > 0);
  await boot(); await ready(catalog.length);
  const expected = filterCinemas(catalog);
  assert.deepEqual(await cdp.evaluate(`[...${cards}].map(card => card.querySelector('h2').textContent)`), expected.map(cinema => cinema.name));
  const sample = expected.find(cinema => cinema.imageLandscape && cinema.phone);
  assert.ok(sample);
  assert.equal(await cdp.evaluate(`document.querySelector('[aria-labelledby="cinema-name-${sample.id}"]').textContent.includes(${JSON.stringify(sample.address)})`), true);
  await cdp.wait(`document.querySelector('[aria-labelledby="cinema-name-${sample.id}"] img')?.complete`);
  assert.equal(await cdp.evaluate(`document.querySelector('[aria-labelledby="cinema-name-${sample.id}"] img').naturalWidth > 0`), true);
  await visibleImagesReady();
  await screenshot('cinemas-desktop-live.png');
  passed.push(`Danh sách/thứ tự/địa chỉ khớp ${catalog.length} rạp từ API thật; ảnh CDN tải được`);

  const reads = cinemaReads(); const keyword = normalizeCinemaSearch(sample.name);
  await setField('#cinema-search', keyword); await ready(filterCinemas(catalog, { q: keyword }).length);
  const city = getCinemaCities(catalog)[0];
  await setField('#cinema-city', city); await ready(filterCinemas(catalog, { q: keyword, city }).length);
  assert.equal(cinemaReads(), reads);
  await cdp.click('Xóa bộ lọc'); await ready(catalog.length);
  passed.push('Tìm không dấu/lọc kết hợp dữ liệu thật không tạo thêm GET danh sách');

  const beforeRefresh = cinemaReads(); await cdp.click('Làm mới');
  await cdp.wait(`![...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Làm mới').disabled`);
  assert.equal(cinemaReads(), beforeRefresh + 1);
  passed.push('Làm mới gửi GET thật và giữ danh sách');

  const slots = await readApi('/showtimes?date=' + today);
  const withSlots = new Set(slots.map(slot => String(slot.cinemaId)));
  const target = expected.find(cinema => !withSlots.has(String(cinema.id))) || expected[0];
  await openSchedule(target.id);
  if (!withSlots.has(String(target.id))) {
    await cdp.wait(`document.querySelector('main').textContent.includes('Rạp đã chọn chưa có suất chiếu phù hợp')`);
    passed.push(`Liên kết API thật giữ rạp ${target.id} chưa có suất trong ngày, hiển thị trạng thái rỗng`);
  } else passed.push(`Liên kết API thật giữ đúng rạp ${target.id}; nhánh rỗng được kiểm tra bằng mô phỏng`);

  await boot('/cinemas?city=' + encodeURIComponent(city), 390);
  await ready(filterCinemas(catalog, { city }).length);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await visibleImagesReady();
  await screenshot('cinemas-mobile-live.png');
  await cdp.send('Page.reload'); await cdp.wait(`document.querySelector('#cinema-city')?.value === ${JSON.stringify(city)}`);
  await ready(filterCinemas(catalog, { city }).length);
  passed.push('390px với dữ liệu thật không tràn ngang; URL/reload giữ tỉnh và kết quả');
  assert.ok(responses.some(response => response.route.includes('/cinemas') && response.status === 200));
}

try {
  browser = await startEdgeBrowser({ root, port, debugPort: live ? 9240 : 9239, artifacts, executable: process.env.ADMIN_EDGE_PATH });
  cdp = browser.cdp;
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `if (location.origin === ${JSON.stringify(origin)}) localStorage.clear();` });
  await cdp.send('Network.enable');
  cdp.on('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  cdp.on('Network.responseReceived', event => {
    const url = new URL(event.response.url);
    if (url.pathname.startsWith('/api/v1/')) responses.push({ route: url.pathname, status: event.response.status });
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }, ...(!live ? [{ urlPattern: 'https://images.example.invalid/*' }] : [])] });
  cdp.on('Fetch.requestPaused', event => { void intercept(event).catch(async error => {
    exceptions.push(error.stack); await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
  }); });
  if (live) await runLive(); else await runMock();
  assert.deepEqual(exceptions, []);
  assert.ok(requests.every(request => ['GET', 'OPTIONS'].includes(request.method)));
  const report = { mode: live ? 'Edge production / API localhost thật chỉ đọc, không mô phỏng response' : 'Edge production / REST và ảnh mô phỏng, không xác nhận DB/HTTP thật',
    passed, requests, responses, runtimeExceptions: exceptions.length, artifacts };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, requests: requests.length, responses: responses.length }, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ passed, requests, exceptions, body: await cdp?.evaluate('document.body.innerText').catch(() => '') }, null, 2));
  if (cdp) await screenshot('failure.png').catch(() => {});
  console.error(`Kiểm tra rạp thất bại: ${artifacts}`); throw error;
} finally { await browser?.close(); }
