// Hai chế độ tách biệt: REST mô phỏng hoặc API localhost thật chỉ đọc, không tạo dữ liệu.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { delay, startEdgeBrowser } from './lib/edge-browser.mjs';
import { getVietnamClock, buildScheduleDays } from '../src/features/showtimes/scheduleUtils.js';
import { filterCinemas, getCinemaCities, normalizeCinemaSearch } from '../src/features/cinemas/cinemaUtils.js';
import { isInternalShowtimeId } from '../src/utils/showtimeId.js';
import { getManualGoogleEmbedUrl } from '../src/features/cinemas/cinemaDetailInfoUtils.js';
import { cinemaGoogleMapEmbeds } from '../src/features/cinemas/cinemaGoogleMapEmbeds.js';

const live = process.argv.includes('--live');
const checkMap = process.argv.includes('--check-map');
assert.ok(!(live && checkMap), 'Dùng --check-map riêng với chế độ mô phỏng');
const root = fileURLToPath(new URL('..', import.meta.url));
const port = live ? 4207 : 4206;
const origin = `http://127.0.0.1:${port}`;
const artifacts = await mkdtemp(path.join(tmpdir(), live ? 'cinema-cinemas-live-' : 'cinema-cinemas-mock-'));
const apiBase = process.env.CINEMAS_TEST_API_BASE || 'http://localhost:8080/api/v1';
assert.match(apiBase, /^http:\/\/(localhost|127\.0\.0\.1):\d+\/api\/v1$/);
const days = buildScheduleDays();
const today = getVietnamClock().date;
const requests = [], exceptions = [], passed = [], responses = [], mapResponses = [];
let browser, cdp, scenario = { mode: 'ok' };
let mapCheck;

const fixtures = [
  { id: 1, name: 'Galaxy Đà Nẵng', address: 'Tầng 3, đường Điện Biên Phủ', city: 'Đà Nẵng', phone: '1900 2224', displayOrder: 2,
    imageLandscape: 'https://images.example.invalid/broken.jpg', imagePortrait: 'https://images.example.invalid/portrait.svg' },
  { id: 2, name: 'Galaxy Hà Nội', address: '175 Nguyễn Thái Học, Hà Nội', city: 'Hà Nội', phone: '+84 (28) 1234-5678', displayOrder: 0,
    latitude: 21.033, longitude: 105.839,
    imageLandscape: 'https://images.example.invalid/hanoi.svg',
    imageUrls: ['https://images.example.invalid/hanoi.svg', 'https://images.example.invalid/auditorium.svg', 'https://images.example.invalid/foyer.svg', 'https://images.example.invalid/hanoi.svg'] },
  { id: 3, name: 'Rạp Chưa Có Suất', address: '', city: 'Chưa xác định', phone: null },
  { id: 4, name: 'Rạp Sắp Có Lịch', address: 'Địa chỉ rạp mới', city: 'Hà Nội', phone: '1900 2224', displayOrder: 3,
    imageUrls: ['https://images.example.invalid/broken.jpg', 'https://images.example.invalid/broken-2.jpg'] },
];
const mapCinema = { id: 9, name: 'Galaxy Cinema Nguyễn Du', address: '116 Nguyễn Du, Quận 1, TP. Hồ Chí Minh', city: 'TP. Hồ Chí Minh' };
const mockSlots = [{ id: 501, movieId: 10, movieTitle: 'Phim thử lịch', cinemaId: 2, cinemaName: 'Galaxy Hà Nội',
  posterUrl: 'https://images.example.invalid/showtime-poster.svg', auditoriumName: 'Phòng 1',
  startTime: `${today}T23:59:59`, endTime: `${days[1].date}T01:30:00`, basePrice: 89000 }];
const mockMovie = { id: 10, title: 'Phim thử lịch', posterUrl: 'https://images.example.invalid/movie-poster.svg', ageRating: 'C13', status: 'NOW_SHOWING' };
const secondMovie = { id: 11, title: 'Phim thứ hai', posterUrl: 'https://images.example.invalid/second-movie-poster.svg', ageRating: 'T16', status: 'COMING_SOON' };
const secondDaySlots = [
  { ...mockSlots[0], id: 502, movieId: 11, movieTitle: secondMovie.title, posterUrl: 'https://images.example.invalid/second-showtime-poster.svg',
    startTime: `${days[1].date}T13:00:00`, endTime: `${days[1].date}T15:00:00`, basePrice: 99000 },
  { ...mockSlots[0], id: 503, startTime: `${days[1].date}T14:30:00`, endTime: `${days[1].date}T16:30:00` },
];
const cards = `document.querySelectorAll('main article[aria-labelledby^="cinema-name-"]')`;
const gallery = 'main section[aria-roledescription="carousel"]';
const galleryViewport = `${gallery} > div[aria-label="Ảnh rạp"]`;
const picker = 'main section[aria-label="Chọn rạp khác"]';
const pickerCity = `${picker} > div:first-child select`;
const pickerCinema = `${picker} > div:nth-child(2) select`;
const detailSchedule = 'main section[aria-label="Chọn ngày và phim tại rạp"]';
const movieGrid = `${detailSchedule} section[aria-label="Phim đang chiếu tại rạp"]`;
const showtimePanel = `${detailSchedule} section[aria-labelledby="cinema-showtime-title"]`;
const pricingPanel = `${detailSchedule} section[aria-labelledby="cinema-pricing-title"]`;
const locationPanel = `${detailSchedule} section[aria-labelledby="cinema-location-title"]`;

async function reply(requestId, status, data) {
  await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Accept, Authorization' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' }],
    body: Buffer.from(JSON.stringify({ code: status, message: status === 200 ? 'OK' : 'Lỗi mô phỏng', data })).toString('base64') });
}

async function replyIfStillActive(requestId, status, data) {
  try { await reply(requestId, status, data); }
  catch (error) {
    if (!error.message.includes('Invalid InterceptionId')) throw error;
  }
}

async function intercept(event) {
  const { requestId, request } = event;
  const url = new URL(request.url);
  if (url.hostname === 'images.example.invalid') {
    const [color, label] = ({ '/hanoi.svg': ['#38444e', '01'], '/auditorium.svg': ['#53343a', '02'], '/foyer.svg': ['#45413b', '03'] })[url.pathname] || ['#262635', '04'];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="${color}"/><path d="M0 720L400 200H880L1280 720" fill="none" stroke="#ffffff" stroke-opacity=".1" stroke-width="2"/><text x="640" y="390" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="80">${label}</text><text x="640" y="440" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="18">GALLERY TEST FIXTURE</text></svg>`;
    const broken = url.pathname.startsWith('/broken');
    return cdp.send('Fetch.fulfillRequest', { requestId, responseCode: broken ? 404 : 200,
      responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }], body: Buffer.from(broken ? 'ảnh lỗi mô phỏng' : svg).toString('base64') });
  }
  const route = url.pathname.replace(/^\/api\/v1/, '');
  requests.push({ method: request.method, route, search: url.search });
  assert.ok(['GET', 'OPTIONS'].includes(request.method), 'Kiểm tra danh bạ không được ghi dữ liệu');
  const mockSeatRead = !live && /^\/showtimes\/50[12](?:\/seats)?$/.test(route);
  const mockUserRead = !live && route === '/users/me';
  const mockTicketsRead = !live && route === '/users/me/bookings';
  const mockMovieRead = !live && route === '/movies/10';
  assert.ok(['/cinemas', '/showtimes', '/movies'].includes(route) || /^\/cinemas\/[1-9]\d*$/.test(route) || mockSeatRead || mockUserRead || mockMovieRead || mockTicketsRead, `API ngoài phạm vi: ${route}`);
  if (live) return cdp.send('Fetch.continueRequest', { requestId, url: apiBase + route + url.search });
  if (request.method === 'OPTIONS') return reply(requestId, 200, null);
  if (mockUserRead) return reply(requestId, 200, { id: 100, fullName: 'Khách thử nghiệm', email: 'navigation@example.invalid', role: 'USER' });
  if (mockTicketsRead) return reply(requestId, 200, []);
  if (mockMovieRead) return reply(requestId, 200, { ...mockMovie, durationMinutes: 120, releaseDate: today });
  if (route === '/showtimes/502') return reply(requestId, 200, secondDaySlots[0]);
  if (route === '/showtimes/501') return reply(requestId, 200, mockSlots[0]);
  if (/^\/showtimes\/50[12]\/seats$/.test(route)) return reply(requestId, 200, {
    showtimeId: Number(route.split('/')[2]), auditoriumId: 1, auditoriumName: 'Phòng 1', totalRows: 1, totalCols: 2,
    seats: [{ showtimeSeatId: 701, seatId: 801, rowChar: 'A', seatNumber: 1, seatType: 'STANDARD', status: 'AVAILABLE', price: 99000, version: 0 }],
  });
  if (route === '/cinemas') {
    if (scenario.mode === 'map') return reply(requestId, 200, [mapCinema]);
    if (scenario.mode === 'held') { scenario.held = requestId; return; }
    if (scenario.mode === 'error') return reply(requestId, 503, null);
    if (scenario.mode === 'invalid') return reply(requestId, 200, { không: 'phải mảng' });
    return reply(requestId, 200, scenario.mode === 'empty' ? [] : fixtures);
  }
  if (route.startsWith('/cinemas/')) {
    if (scenario.mode === 'map' && route === '/cinemas/9') return reply(requestId, 200, mapCinema);
    if (scenario.detailMode === 'held') { scenario.heldDetail = requestId; return; }
    if (scenario.detailMode === 'heldFor2' && route === '/cinemas/2') { scenario.heldDetail = requestId; return; }
    if (scenario.detailMode === 'error') return reply(requestId, 503, null);
    if (scenario.detailMode === 'invalid') return reply(requestId, 200, null);
    const cinema = fixtures.find(item => String(item.id) === route.split('/').at(-1));
    return reply(requestId, cinema ? 200 : 404, cinema ? { ...cinema, ...scenario.detailOverrides } : null);
  }
  if (route === '/movies') {
    if (scenario.movieMode === 'error') return reply(requestId, 503, null);
    const status = url.searchParams.get('status');
    let content = [];
    if (scenario.movieMode === 'multi' && status === 'COMING_SOON') content = [secondMovie];
    else if (scenario.movieMode !== 'empty' && status === 'NOW_SHOWING') {
      content = [{ ...mockMovie, posterUrl: scenario.movieMode === 'brokenPoster' ? 'https://images.example.invalid/broken-poster.jpg' : mockMovie.posterUrl }];
    }
    return reply(requestId, 200, { content, pageNo: 0, pageSize: 100, totalElements: content.length, totalPages: 1, last: true });
  }
  if (scenario.showtimeMode === 'held') { scenario.heldShowtime = requestId; return; }
  if (scenario.showtimeMode === 'heldFor2' && url.searchParams.get('cinemaId') === '2') { scenario.heldShowtime = requestId; return; }
  if (scenario.showtimeMode === 'error') return reply(requestId, 503, null);
  if (scenario.showtimeMode === 'invalid') return reply(requestId, 200, { unexpected: true });
  if (scenario.showtimeMode === 'invalidIds') return reply(requestId, 200, [{ ...mockSlots[0], id: 'galaxy-501' }, ...mockSlots]);
  if (scenario.showtimeMode === 'onlyInvalidIds') return reply(requestId, 200, [{ ...mockSlots[0], id: 'galaxy-501' }]);
  if (scenario.showtimeMode === 'multi') return reply(requestId, 200, url.searchParams.get('date') === days[1].date ? secondDaySlots : []);
  return reply(requestId, 200, url.searchParams.get('date') === today ? mockSlots : []);
}

async function boot(route = '/cinemas', width = 1366) {
  await cdp.send('Page.navigate', { url: 'about:blank' });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url: origin + route });
  await cdp.wait(`Boolean(document.querySelector('main #cinema-search')) || Boolean(document.querySelector('main nav [aria-current="page"]')) || location.pathname === '/profile/bookings' && Boolean(document.querySelector('main h1'))`);
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
const detailReads = id => requests.filter(r => r.method === 'GET' && r.route === `/cinemas/${id}`).length;
async function detailReady(name) {
  await cdp.wait(`document.querySelector('main h1')?.textContent === ${JSON.stringify(name)}`);
}
async function openDetail(id, name) {
  await cdp.evaluate(`document.querySelector('article[aria-labelledby="cinema-name-${id}"] a[href="/cinemas/${id}"]').click()`);
  await detailReady(name);
  assert.equal(await cdp.evaluate('location.pathname'), `/cinemas/${id}`);
}
async function returnToList() {
  await cdp.evaluate(`[...document.querySelectorAll('main a')].find(a => a.textContent.trim() === 'Về danh sách rạp').click()`);
  await cdp.wait(`Boolean(document.querySelector('#cinema-search'))`);
}
async function openSchedule(id) {
  await boot(`/cinemas/${id}`);
  await cdp.wait(`Boolean(document.querySelector('#cinema-detail-movie')) && !document.querySelector('${detailSchedule}').textContent.includes('Đang tải suất chiếu')`);
  assert.equal(await cdp.evaluate('location.pathname'), `/cinemas/${id}`);
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
  await openDetail(3, 'Rạp Chưa Có Suất');
  assert.equal(await cdp.evaluate(`document.querySelector('main').textContent.includes('Địa chỉ đang cập nhật')`), true);
  await cdp.evaluate(`document.querySelector('header a[href="/cinemas"]').click()`); await ready(4);
  assert.equal(cinemaReads(), cachedReads);
  passed.push('CTA mở chi tiết rạp, thiếu địa chỉ có fallback; quay lại danh sách dùng cache');

  await openSchedule(3);
  await cdp.wait(`document.querySelector('main').textContent.includes('Rạp chưa có suất chiếu còn mở bán')`);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('a[href="/booking/501"]'))`), false);
  passed.push('Mở trực tiếp lịch rạp chưa có suất giữ ID và không lộ lịch rạp khác');

  await openSchedule(2);
  await setField('#cinema-detail-movie', '10');
  await cdp.wait(`Boolean(document.querySelector('a[href="/booking/501"]'))`);
  const dateLabel = `${days[1].label}, ${days[1].fullDate}`;
  await cdp.evaluate(`document.querySelector('button[aria-label=${JSON.stringify(dateLabel)}]').click()`);
  await cdp.wait(`document.querySelector('main').textContent.includes('Rạp chưa có suất chiếu còn mở bán')`);
  assert.equal(await cdp.evaluate('location.pathname'), '/cinemas/2');
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

  scenario = { mode: 'error' }; await boot('/cinemas/3');
  await cdp.wait(`document.querySelector('${picker} [role="alert"]')?.textContent.includes('Chưa tải được danh sách rạp khác')`);
  assert.equal(await cdp.evaluate('location.pathname'), '/cinemas/3');
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('a[href="/booking/501"]'))`), false);
  scenario.mode = 'ok'; await cdp.click('Thử lại', picker);
  await cdp.wait(`document.querySelector('${pickerCinema}').selectedOptions[0].textContent === 'Rạp Chưa Có Suất'`);
  passed.push('Lỗi metadata khi mở trực tiếp lịch không bỏ ID; thử lại phục hồi tên rạp');

  await boot('/cinemas', 390); await ready(4);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await cdp.evaluate(`getComputedStyle(document.querySelector('main article').parentElement).gridTemplateColumns.split(' ').length`), 1);
  await cdp.evaluate(`document.querySelector('#cinema-search').focus()`); await cdp.key('Tab');
  assert.equal(await cdp.evaluate(`document.activeElement.id`), 'cinema-city');
  assert.notEqual(await cdp.evaluate(`getComputedStyle(document.activeElement).boxShadow`), 'none');
  await screenshot('cinemas-mobile-mock.png');
  await cdp.evaluate(`document.querySelector('[aria-labelledby="cinema-name-2"] a[href^="tel:"]').focus()`);
  await cdp.key('Tab'); assert.equal(await cdp.evaluate(`document.activeElement.getAttribute('href')`), '/cinemas/2');
  await cdp.key('Enter'); await detailReady('Galaxy Hà Nội');
  passed.push('390px không tràn ngang, một cột, Tab/focus rõ và Enter mở đúng chi tiết rạp');
}

async function runNavigationMock() {
  scenario = { mode: 'ok' };
  for (const authenticated of [false, true]) {
    const ticketsReady = `location.pathname === '/profile/bookings' && document.querySelector('main h1')?.textContent === ${JSON.stringify(authenticated ? 'Vé của tôi.' : 'Đăng nhập để xem vé')}`;
    let sessionScript;
    if (authenticated) {
      sessionScript = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
        if (location.origin === ${JSON.stringify(origin)}) {
          localStorage.setItem('premier_cinema_access_token', 'navigation-mock-token');
          localStorage.setItem('premier_cinema_refresh_token', 'navigation-mock-refresh');
          localStorage.setItem('premier_cinema_session_id', 'navigation-mock-session');
          localStorage.setItem('premier_cinema_user', JSON.stringify({ id: 100, fullName: 'Khách thử nghiệm', email: 'navigation@example.invalid', role: 'USER' }));
        }
      ` })).identifier;
    }
    try {
      for (const width of [390, 768, 1440]) {
        await boot('/cinemas/2', width); await detailReady('Galaxy Hà Nội');
        const mobile = await cdp.evaluate(`document.querySelector('button[aria-label="Toggle menu"]').offsetWidth > 0`);
        if (mobile) await cdp.evaluate(`document.querySelector('button[aria-label="Toggle menu"]').click()`);
        assert.equal(await cdp.evaluate(`document.querySelectorAll('header nav a[href="/profile/bookings"]').length`), mobile ? 2 : 1);
        assert.equal(await cdp.evaluate(`document.querySelectorAll('header a[href="/profile/bookings"]').length`), mobile ? 2 : 1, 'Only one ticket entry in the mobile drawer');
        assert.equal(await cdp.evaluate(`[...document.querySelectorAll('header nav a[href="/cinemas"]')].filter(a => a.offsetWidth > 0).every(a => a.getAttribute('aria-current') === 'page')`), true);
        assert.equal(await cdp.evaluate(`document.querySelectorAll('header a[href="/showtimes"], footer a[href="/showtimes"]').length`), 0);
        assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Header at ${width}px`);
        await cdp.evaluate(`[...document.querySelectorAll('header nav a[href="/profile/bookings"]')].find(a => a.offsetWidth > 0).click()`);
        await cdp.wait(ticketsReady);
        if (mobile) {
          assert.equal(await cdp.evaluate(`document.querySelector('button[aria-label="Toggle menu"]').getAttribute('aria-expanded')`), 'false');
          await cdp.evaluate(`document.querySelector('button[aria-label="Toggle menu"]').click()`);
        }
        assert.deepEqual(await cdp.evaluate(`[...document.querySelectorAll('header nav a[aria-current="page"]')].filter(a => a.offsetWidth > 0).map(a => a.getAttribute('href'))`), ['/profile/bookings']);
        if (mobile) await cdp.evaluate(`document.querySelector('button[aria-label="Toggle menu"]').click()`);
        await cdp.evaluate('history.back()'); await detailReady('Galaxy Hà Nội');
        await cdp.evaluate('history.forward()'); await cdp.wait(`location.pathname === '/profile/bookings'`);
        await cdp.evaluate('history.back()'); await detailReady('Galaxy Hà Nội');
        if (authenticated && !mobile) {
          await cdp.evaluate(`document.querySelector('button[aria-label="Menu tài khoản"]').click()`);
          await cdp.wait(`document.querySelectorAll('header a[href="/profile/bookings"]').length === 2`);
          await cdp.evaluate(`[...document.querySelectorAll('header a[href="/profile/bookings"]')].find(a => !a.closest('nav')).click()`);
          await cdp.wait(`document.querySelector('button[aria-label="Menu tài khoản"]').getAttribute('aria-expanded') === 'false'`);
          await cdp.evaluate('history.back()'); await detailReady('Galaxy Hà Nội');
        }
        await cdp.evaluate(`document.querySelector('footer a[href="/profile/bookings"]').click()`);
        await cdp.wait(ticketsReady);
        await cdp.evaluate('window.__beforeTicketsReload = true');
        await cdp.send('Page.reload'); await cdp.wait(`!window.__beforeTicketsReload && (${ticketsReady})`);
        assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
        passed.push(`Header/footer Vé của tôi, active rạp/ vé, menu và Back/Forward/reload: ${authenticated ? 'đã đăng nhập' : 'khách'}, ${width}px`);
      }
    } finally {
      if (sessionScript) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: sessionScript });
    }
  }

  await boot('/cinemas?ref=before-legacy'); await ready(4);
  await cdp.evaluate(`history.pushState(null, '', '/showtimes?cinemaId=2&date=${today}&movieId=10'); dispatchEvent(new PopStateEvent('popstate'))`);
  await cdp.wait(`location.pathname === '/cinemas/2' && Boolean(document.querySelector('${showtimePanel} a[href="/booking/501"]'))`);
  assert.deepEqual(await cdp.evaluate(`Object.fromEntries(new URLSearchParams(location.search))`), { date: today, movieId: '10' });
  await cdp.evaluate('history.back()'); await ready(4);
  assert.equal(await cdp.evaluate('location.search'), '?ref=before-legacy');
  await cdp.evaluate('history.forward()'); await detailReady('Galaxy Hà Nội');
  assert.equal(await cdp.evaluate('location.pathname'), '/cinemas/2');
  passed.push('URL lịch cũ giữ ngày/phim, replace không tạo vòng lặp Back/Forward');

  for (const search of ['', '?cinemaId=bad', '?cinemaId=0', '?cinemaId=01', '?cinemaId=9223372036854775808']) {
    await boot('/showtimes' + search + (search ? '&' : '?') + 'city=H%C3%A0+N%E1%BB%99i'); await ready(2);
    assert.equal(await cdp.evaluate('location.pathname'), '/cinemas');
    assert.equal(await cdp.evaluate(`document.querySelector('#cinema-city').value`), 'Hà Nội');
  }
  await boot('/showtimes'); await ready(4);
  assert.equal(await cdp.evaluate('location.pathname + location.search'), '/cinemas');
  await boot('/showtimes?cinemaId=2&date=2026-02-30&movieId=galaxy-10'); await detailReady('Galaxy Hà Nội');
  assert.equal(await cdp.evaluate('location.search'), '');
  await boot('/showtimes?cinemaId=999');
  await cdp.wait(`document.querySelector('main').textContent.includes('Không tìm thấy rạp')`);
  assert.equal(await cdp.evaluate('location.pathname'), '/cinemas/999');
  passed.push('URL lịch cũ thiếu/sai ID về danh sách giữ city; ngày/phim sai bị bỏ; ID không tồn tại hiện 404 rạp');

  await boot('/movies/10');
  await cdp.wait(`Boolean(document.querySelector('main button[title="Phòng 1"]'))`);
  assert.equal(await cdp.evaluate(`document.querySelector('main h1').textContent`), mockMovie.title);
  await cdp.evaluate(`document.querySelector('main button[title="Phòng 1"]').click()`);
  await cdp.wait(`location.pathname === '/booking/501' && Boolean(document.querySelector('button[aria-label^="A1 -"]'))`);
  passed.push('Trang phim vẫn hiển thị lịch và chọn suất tới đúng trang ghế bằng ID nội bộ');
}

async function runDetailMock() {
  scenario = { mode: 'ok' };
  const listSearch = new URLSearchParams({ q: 'ha noi', city: 'Hà Nội', ref: 'detail-check' }).toString();
  await boot('/cinemas?' + listSearch); await ready(1);
  const listReads = cinemaReads(), initialDetailReads = detailReads(2);
  await openDetail(2, 'Galaxy Hà Nội');
  assert.equal(await cdp.evaluate(`document.querySelector('main').textContent.includes('175 Nguyễn Thái Học, Hà Nội')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('main a[href^="tel:"]').getAttribute('href')`), 'tel:+842812345678');
  assert.equal(await cdp.evaluate(`document.querySelectorAll('footer').length`), 1);
  assert.equal(detailReads(2), initialDetailReads + 1);
  await cdp.evaluate('history.back()'); await ready(1);
  assert.equal(await cdp.evaluate('location.search'), '?' + listSearch);
  assert.equal(await cdp.evaluate(`document.querySelector('#cinema-search').value`), 'ha noi');
  await cdp.evaluate('history.forward()'); await detailReady('Galaxy Hà Nội');
  assert.equal(detailReads(2), initialDetailReads + 1);
  await returnToList(); await ready(1);
  assert.equal(await cdp.evaluate('location.search'), '?' + listSearch);
  assert.equal(cinemaReads(), listReads);
  await openDetail(2, 'Galaxy Hà Nội');
  await cdp.send('Page.reload'); await detailReady('Galaxy Hà Nội');
  await returnToList(); await ready(1);
  assert.equal(await cdp.evaluate('location.search'), '?' + listSearch);
  passed.push('Danh sách → chi tiết → Back/Forward/quay lại giữ tìm/lọc/ref, dùng cache; reload giữ lối về danh sách');

  await boot('/cinemas/2'); await detailReady('Galaxy Hà Nội');
  const beforeReload = detailReads(2);
  await cdp.send('Page.reload');
  await cdp.wait(`Boolean(document.querySelector('main h1'))`); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelectorAll('footer').length === 1`);
  assert.equal(detailReads(2), beforeReload + 1);
  await returnToList(); await ready(4);
  assert.equal(await cdp.evaluate('location.pathname + location.search'), '/cinemas');
  passed.push('Mở URL chi tiết trực tiếp và reload tải đúng API; không có state vẫn về /cinemas');

  for (const id of ['galaxy-ha-noi', '0', '9223372036854775808']) {
    const before = requests.length;
    await boot(`/cinemas/${id}`); await detailReady('Không tìm thấy rạp');
    assert.equal(requests.length, before, 'ID sai không được gọi API');
    await returnToList(); await ready(4);
  }
  const before404 = detailReads(999);
  await boot('/cinemas/999'); await detailReady('Không tìm thấy rạp');
  assert.equal(detailReads(999), before404 + 1);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main button'))`), false);
  await returnToList(); await ready(4);
  passed.push('ID sai không gọi API; 404 không retry; mọi nhánh đều có đường về danh sách');

  scenario.detailMode = 'error';
  await boot('/cinemas/2'); await detailReady('Không tải được thông tin rạp');
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('main [role="alert"]'))`), true);
  scenario.detailMode = 'ok'; await cdp.click('Thử lại'); await detailReady('Galaxy Hà Nội');
  scenario.detailMode = 'invalid';
  await boot('/cinemas/2'); await detailReady('Không tải được thông tin rạp');
  scenario.detailMode = 'ok'; await cdp.click('Thử lại'); await detailReady('Galaxy Hà Nội');
  passed.push('Lỗi 503 và payload null có thông báo/thử lại; phục hồi đúng rạp');

  scenario.detailMode = 'held';
  await boot('/cinemas/1');
  await cdp.wait(`document.querySelector('main [role="status"]')?.textContent.includes('Đang tải thông tin rạp')`);
  assert.ok(scenario.heldDetail);
  scenario.detailMode = 'ok'; await reply(scenario.heldDetail, 200, fixtures[0]); await detailReady('Galaxy Đà Nẵng');
  passed.push('Request chi tiết chậm hiện loading trước khi có dữ liệu');

  for (const [width, columns] of [[390, 2], [768, 3], [1440, 6]]) {
    await boot('/cinemas/2', width); await detailReady('Galaxy Hà Nội');
    await galleryReady(1, 3);
    await cdp.wait(`Boolean(document.querySelector('${movieGrid} ul'))`);
    assert.equal(await cdp.evaluate(`getComputedStyle(document.querySelector('${movieGrid} ul')).gridTemplateColumns.split(' ').length`), columns);
    assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Chi tiết ${width}px không tràn ngang`);
    assert.equal(await cdp.evaluate(`document.querySelectorAll('footer').length`), 1);
    await screenshot(`cinema-detail-${width}-mock.png`);
  }
  passed.push('Chi tiết 390/768/1440px không tràn ngang và chỉ có một Footer');
}

async function runInfoHeaderMock() {
  scenario = { mode: 'ok' };
  await boot('/cinemas?ref=picker-check'); await ready(4);
  const cachedReads = cinemaReads();
  await openDetail(2, 'Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${pickerCity}')?.value === 'Hà Nội'`);
  await cdp.wait(`document.querySelectorAll('${pickerCity} option').length === 3`);
  assert.equal(cinemaReads(), cachedReads, 'Bộ chọn dùng cache danh sách đã tải');
  assert.equal(await cdp.evaluate(`document.querySelector('${pickerCinema}').value`), '2');

  await setField(pickerCity, 'Đà Nẵng');
  await cdp.wait(`document.querySelector('${pickerCinema}')?.value === ''`);
  assert.equal(await cdp.evaluate('location.pathname + location.search'), '/cinemas/2');
  assert.deepEqual(await cdp.evaluate(`[...document.querySelectorAll('${pickerCinema} option')].map(option => option.value)`), ['', '1']);
  await setField(pickerCinema, '1'); await detailReady('Galaxy Đà Nẵng');
  assert.equal(await cdp.evaluate('location.pathname'), '/cinemas/1');
  assert.equal(await cdp.evaluate(`document.querySelector('${pickerCity}').value`), 'Đà Nẵng');
  assert.equal(await cdp.evaluate(`document.querySelector('${gallery}').textContent.includes('Ảnh rạp đang cập nhật')`), true);
  await cdp.evaluate('history.back()'); await detailReady('Galaxy Hà Nội');
  assert.equal(await cdp.evaluate(`document.querySelector('${pickerCity}').value`), 'Hà Nội');
  await returnToList(); await ready(4);
  assert.equal(await cdp.evaluate('location.search'), '?ref=picker-check');
  passed.push('Bộ chọn dùng cache, đổi thành phố chỉ lọc rạp; chọn rạp mới đổi route/ảnh/thông tin, Back khôi phục rạp và bộ lọc');

  await boot(`/cinemas/2?date=${today}&movieId=10`); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${pickerCity}')?.value === 'Hà Nội'`);
  await setField(pickerCity, 'Đà Nẵng');
  await cdp.wait(`document.querySelector('${pickerCinema}')?.value === ''`);
  await setField(pickerCinema, '1');
  await detailReady('Galaxy Đà Nẵng');
  assert.equal(await cdp.evaluate('location.pathname + location.search'), `/cinemas/1?date=${today}`);
  await cdp.evaluate('history.back()'); await detailReady('Galaxy Hà Nội');
  assert.equal(await cdp.evaluate('location.pathname + location.search'), `/cinemas/2?date=${today}&movieId=10`);
  passed.push('Đổi rạp giữ date, bỏ movieId; Back khôi phục URL trước đó');

  await cdp.evaluate(`(() => {
    const select = document.querySelector('${pickerCity}');
    select.add(new Option('Huế', 'Huế'));
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'Huế');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await cdp.wait(`document.querySelector('${pickerCinema}')?.disabled`);
  assert.equal(await cdp.evaluate(`document.querySelector('${pickerCity}').value`), 'Huế');
  assert.equal(await cdp.evaluate(`document.querySelector('${picker} [role="status"]')?.textContent.includes('Huế hiện chưa có rạp')`), true);
  assert.equal(await cdp.evaluate('location.pathname'), '/cinemas/2');
  passed.push('Thành phố không còn rạp giữ lựa chọn, vô hiệu ô rạp và hiện trạng thái rỗng');

  scenario = { mode: 'held' };
  await boot('/cinemas/2'); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${pickerCinema}')?.value === '2'`);
  for (let attempt = 0; attempt < 30 && !scenario.held; attempt += 1) await delay(30);
  assert.ok(scenario.held, 'Danh sách rạp đang tải');
  assert.equal(await cdp.evaluate(`document.querySelector('${picker} [role="status"]')?.textContent.includes('Đang tải danh sách rạp khác')`), true);
  scenario.mode = 'ok'; await reply(scenario.held, 200, fixtures);
  await cdp.wait(`document.querySelectorAll('${pickerCity} option').length === 3`);
  passed.push('Danh sách rạp đang tải vẫn giữ rạp hiện tại trong ô chọn');

  scenario = { mode: 'error' };
  await boot('/cinemas/2'); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${picker} [role="alert"]')?.textContent.includes('Chưa tải được danh sách rạp khác')`, 20000);
  assert.equal(await cdp.evaluate(`document.querySelector('${pickerCinema}').value`), '2');
  scenario.mode = 'ok';
  await cdp.evaluate(`document.querySelector('${picker} button').click()`);
  await cdp.wait(`document.querySelectorAll('${pickerCity} option').length === 3`);
  passed.push('Lỗi danh sách rạp vẫn giữ rạp hiện tại; Thử lại tải được các thành phố khác');

  scenario = { mode: 'ok', detailOverrides: { city: 'Huế' } };
  await boot('/cinemas/2'); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${pickerCity}')?.value === 'Huế'`);
  assert.equal(await cdp.evaluate(`document.querySelector('${pickerCinema}').value`), '2');
  assert.deepEqual(await cdp.evaluate(`[...document.querySelectorAll('${pickerCinema} option')].map(option => option.value)`), ['2']);
  passed.push('Thông tin chi tiết mới hơn cache danh sách vẫn giữ đúng thành phố và rạp hiện tại');
}

async function runRapidSwitchMock() {
  scenario = { mode: 'ok', detailMode: 'heldFor2' };
  await boot('/cinemas/2');
  await cdp.wait(`document.querySelector('main [role="status"]')?.textContent.includes('Đang tải thông tin rạp')`);
  for (let attempt = 0; attempt < 30 && !scenario.heldDetail; attempt += 1) await delay(30);
  assert.ok(scenario.heldDetail, 'Request chi tiết rạp cũ phải đang chờ');
  await cdp.evaluate(`history.pushState(null, '', '/cinemas/1'); dispatchEvent(new PopStateEvent('popstate'))`);
  await detailReady('Galaxy Đà Nẵng');
  await replyIfStillActive(scenario.heldDetail, 200, fixtures[1]);
  await delay(100);
  assert.equal(await cdp.evaluate(`document.querySelector('main h1').textContent`), 'Galaxy Đà Nẵng');
  assert.equal(await cdp.evaluate(`document.querySelector('${locationPanel}').textContent.includes('175 Nguyễn Thái Học')`), false);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('footer').length`), 1);
  passed.push('Đổi rạp khi GET chi tiết cũ còn chờ không ghi đè thông tin rạp mới');

  scenario = { mode: 'ok', showtimeMode: 'heldFor2' };
  await boot(`/cinemas/2?date=${days[1].date}&movieId=10`); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${detailSchedule} [role="status"]')?.textContent.includes('Đang tải suất chiếu')`);
  for (let attempt = 0; attempt < 30 && !scenario.heldShowtime; attempt += 1) await delay(30);
  assert.ok(scenario.heldShowtime, 'Request suất rạp cũ phải đang chờ');
  await cdp.evaluate(`history.pushState(null, '', '/cinemas/1?date=${days[1].date}'); dispatchEvent(new PopStateEvent('popstate'))`);
  await detailReady('Galaxy Đà Nẵng');
  await cdp.wait(`document.querySelector('${detailSchedule} [role="status"]')?.textContent.includes('chưa có suất chiếu')`);
  await replyIfStillActive(scenario.heldShowtime, 200, secondDaySlots);
  await delay(100);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('${movieGrid}'))`), false);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('${showtimePanel}'))`), false);
  assert.equal(await cdp.evaluate(`document.querySelector('${pricingPanel}').textContent.includes('99.000đ')`), false);
  assert.equal(await cdp.evaluate(`document.querySelector('${locationPanel}').textContent.includes('Tầng 3, đường Điện Biên Phủ')`), true);
  passed.push('Đổi rạp khi GET suất cũ còn chờ không lẫn phim, giá hoặc vị trí rạp');
}

async function runDetailSelectionMock() {
  scenario = { mode: 'ok' };
  await boot('/cinemas/2?ref=share'); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelectorAll('${detailSchedule} #cinema-detail-movie option').length === 2`);
  assert.equal(await cdp.evaluate(`document.querySelector('${detailSchedule} button[aria-pressed="true"] time').dateTime`), today);
  assert.equal(await cdp.evaluate(`document.querySelector('#cinema-detail-movie').value`), '');
  assert.equal(await cdp.evaluate('location.search'), '?ref=share');
  assert.ok(requests.some(request => request.route === '/showtimes' && request.search.includes(`cinemaId=2`) && request.search.includes(`date=${today}`)));
  await cdp.wait(`document.querySelector('${movieGrid} button') && document.querySelector('${movieGrid} img')?.complete`);
  assert.equal(await cdp.evaluate(`document.querySelector('${movieGrid} img').src.endsWith('/movie-poster.svg')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('${movieGrid} button').textContent.includes('C13')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('${movieGrid} button').getAttribute('aria-pressed')`), 'false');
  await cdp.evaluate(`document.querySelector('${movieGrid} button').click()`);
  await cdp.wait(`new URLSearchParams(location.search).get('movieId') === '10'`);
  assert.equal(await cdp.evaluate(`document.querySelector('#cinema-detail-movie').value`), '10');
  assert.equal(await cdp.evaluate(`document.querySelector('${movieGrid} button').getAttribute('aria-pressed')`), 'true');
  assert.equal(await cdp.evaluate('location.pathname'), '/cinemas/2');
  await cdp.wait(`Boolean(document.querySelector('${showtimePanel} a[href="/booking/501"]'))`);
  assert.equal(await cdp.evaluate(`document.querySelector('${showtimePanel} a').textContent.includes('Phòng 1')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('${showtimePanel} a').textContent.includes('Giá cơ bản 89.000đ')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('${showtimePanel} a').getAttribute('aria-label').includes('Giá cơ bản 89.000đ')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('${pricingPanel}').textContent.includes('Giá cơ bản') && document.querySelector('${pricingPanel}').textContent.includes('89.000đ')`), true);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${pricingPanel} li').length`), 1);
  assert.equal(await cdp.evaluate(`document.querySelector('${locationPanel}').textContent.includes('175 Nguyễn Thái Học, Hà Nội')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('${locationPanel} a[href^="tel:"]').getAttribute('href')`), 'tel:+842812345678');
  assert.equal(await cdp.evaluate(`new URL(document.querySelector('${locationPanel} a[href^="https://www.google.com/maps/dir/"]').href).searchParams.get('destination')`), '21.033,105.839');
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('${locationPanel} iframe'))`), false);
  assert.equal(await cdp.evaluate(`document.querySelector('${locationPanel} [role="status"]')?.textContent.includes('Bản đồ Google Maps của rạp đang cập nhật')`), true);
  await cdp.evaluate(`document.querySelector('${pricingPanel}').scrollIntoView({ block: 'start' })`);
  await cdp.evaluate('window.scrollBy(0, -160)');
  await screenshot('cinema-pricing-location-1440-mock.png');
  await setField('#cinema-detail-movie', '');
  await cdp.wait(`!new URLSearchParams(location.search).has('movieId')`);
  assert.equal(await cdp.evaluate(`document.querySelector('${movieGrid} button').getAttribute('aria-pressed')`), 'false');
  await setField('#cinema-detail-movie', '10');
  await cdp.wait(`new URLSearchParams(location.search).get('movieId') === '10'`);
  assert.equal(await cdp.evaluate(`document.querySelector('${detailSchedule} [role="status"]')?.textContent.includes('1 suất chiếu')`), true);
  passed.push('Chi tiết rạp tải suất theo đúng rạp/ngày; hôm nay mặc định, không tự chọn phim và giữ tham số URL khác');
  passed.push('Lưới chọn phim cập nhật URL và ô chọn cùng lúc, không mở trang phim; poster/nhãn tuổi lấy từ API phim');
  passed.push('Panel hiện giờ, phòng, giá cơ bản và liên kết tới /booking/501 bằng ID nội bộ');
  passed.push('Khối giá và vị trí lấy đúng rạp/ngày; chưa có iframe thủ công thì giữ chỉ đường bằng tọa độ');

  const nextDayLabel = `${days[1].label}, ${days[1].fullDate}`;
  await cdp.evaluate(`document.querySelector('${detailSchedule} button[aria-label=${JSON.stringify(nextDayLabel)}]').click()`);
  await cdp.wait(`new URLSearchParams(location.search).get('date') === ${JSON.stringify(days[1].date)} && !new URLSearchParams(location.search).has('movieId')`);
  assert.equal(await cdp.evaluate(`document.querySelector('${detailSchedule} [role="status"]')?.textContent.includes('chưa có suất chiếu')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('${pricingPanel} [role="status"]')?.textContent.includes('Chưa có giá cơ bản')`), true);
  await cdp.evaluate('history.back()');
  await cdp.wait(`document.querySelector('#cinema-detail-movie')?.value === '10'`);
  assert.equal(await cdp.evaluate('location.search'), '?ref=share&movieId=10');
  await cdp.evaluate('history.forward()');
  await cdp.wait(`new URLSearchParams(location.search).get('date') === ${JSON.stringify(days[1].date)} && !new URLSearchParams(location.search).has('movieId')`);
  assert.equal(await cdp.evaluate('location.pathname'), '/cinemas/2');
  passed.push('Đổi ngày hết suất xóa phim sau phản hồi thành công; Back/Forward khôi phục ngày và phim, giữ ID rạp');

  await boot('/cinemas/2?date=bad&movieId=galaxy&ref=share'); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`location.search === '?ref=share'`);
  assert.equal(await cdp.evaluate(`document.querySelector('${detailSchedule} button[aria-pressed="true"] time').dateTime`), today);
  passed.push('URL ngày và ID phim sai được chuẩn hóa bằng replace, không tự thêm ngày khi thiếu');

  scenario = { mode: 'ok', movieMode: 'empty' };
  await boot('/cinemas/2'); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${movieGrid} img')?.complete`);
  assert.equal(await cdp.evaluate(`document.querySelector('${movieGrid} img').src.endsWith('/showtime-poster.svg')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('${movieGrid} button').textContent.includes('C13')`), false);
  passed.push('Thiếu metadata phim vẫn hiện poster từ suất và ẩn nhãn tuổi');

  scenario = { mode: 'ok', movieMode: 'brokenPoster' };
  await boot('/cinemas/2'); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${movieGrid} img')?.src.endsWith('/showtime-poster.svg') && document.querySelector('${movieGrid} img').naturalWidth > 0`);
  assert.equal(await cdp.evaluate(`document.querySelector('${movieGrid} button').textContent.includes('C13')`), true);
  passed.push('Poster metadata tải lỗi chuyển sang poster của suất, nhãn tuổi vẫn giữ đúng');

  scenario = { mode: 'ok', movieMode: 'error' };
  await boot('/cinemas/2'); await detailReady('Galaxy Hà Nội');
  for (let attempt = 0; attempt < 100 && !responses.some(response => response.route.endsWith('/movies') && response.status === 503); attempt += 1) await delay(50);
  assert.ok(responses.some(response => response.route.endsWith('/movies') && response.status === 503));
  await cdp.wait(`document.querySelector('${movieGrid} img')?.src.endsWith('/showtime-poster.svg')`);
  assert.equal(await cdp.evaluate(`document.querySelector('${movieGrid} button').textContent.includes('C13')`), false);
  assert.equal(await cdp.evaluate(`document.querySelector('${detailSchedule}').textContent.includes('Phim thử lịch')`), true);
  passed.push('API phim lỗi vẫn giữ phim/suất từ lịch và dùng poster suất, không bịa nhãn tuổi');

  scenario = { mode: 'ok', movieMode: 'multi', showtimeMode: 'multi' };
  await boot(`/cinemas/2?date=${days[1].date}`); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelectorAll('${movieGrid} button').length === 2 && document.querySelector('${movieGrid} button').textContent.includes('T16')`);
  assert.deepEqual(await cdp.evaluate(`[...document.querySelectorAll('${movieGrid} button')].map(button => button.querySelector('.line-clamp-2').textContent)`), ['Phim thứ hai', 'Phim thử lịch']);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${pricingPanel} li').length`), 2);
  await cdp.evaluate(`document.querySelector('${movieGrid} button').click()`);
  await cdp.wait(`Boolean(document.querySelector('${showtimePanel} a[href="/booking/502"]'))`);
  assert.equal(await cdp.evaluate(`new URLSearchParams(location.search).get('movieId')`), '11');
  assert.equal(await cdp.evaluate(`document.querySelector('${showtimePanel}').textContent.includes('99.000đ')`), true);
  await cdp.evaluate(`document.querySelector('${movieGrid} button').focus()`);
  await cdp.key('Tab');
  assert.equal(await cdp.evaluate(`document.activeElement === document.querySelectorAll('${movieGrid} button')[1]`), true);
  await cdp.key('Enter');
  await cdp.wait(`Boolean(document.querySelector('${showtimePanel} a[href="/booking/503"]'))`);
  assert.equal(await cdp.evaluate(`new URLSearchParams(location.search).get('movieId')`), '10');
  assert.equal(await cdp.evaluate(`document.querySelectorAll('footer').length`), 1);
  passed.push('Fixture hai phim/suất sắp đúng giờ; phim sắp chiếu có metadata, Tab/Enter đổi phim và panel đúng ID/giá');

  scenario = { mode: 'ok' };
  await boot('/cinemas/2', 390); await detailReady('Galaxy Hà Nội');
  await cdp.evaluate(`document.querySelector('${detailSchedule} [aria-label^="Hôm nay"]').focus()`);
  await cdp.key('Tab');
  assert.equal(await cdp.evaluate(`document.activeElement.getAttribute('aria-label')`), `${days[1].label}, ${days[1].fullDate}`);
  await cdp.key('Enter');
  await cdp.wait(`new URLSearchParams(location.search).get('date') === ${JSON.stringify(days[1].date)}`);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  passed.push('390px Tab/Enter chọn ngày trên trang chi tiết, cập nhật URL và không tràn ngang');

  scenario = { mode: 'ok', showtimeMode: 'invalidIds' };
  await boot(`/cinemas/2?date=${today}&movieId=10`); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`Boolean(document.querySelector('${showtimePanel} a[href="/booking/501"]'))`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${showtimePanel} a').length`), 1);
  assert.equal(await cdp.evaluate(`document.querySelector('${movieGrid} button').textContent.includes('1 suất chiếu')`), true);
  scenario = { mode: 'ok', showtimeMode: 'onlyInvalidIds' };
  await boot(`/cinemas/2?date=${today}&movieId=10`); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`!new URLSearchParams(location.search).has('movieId')`);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('${showtimePanel}'))`), false);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('${movieGrid}'))`), false);
  assert.equal(await cdp.evaluate(`document.querySelector('${pricingPanel} [role="status"]')?.textContent.includes('Chưa có giá cơ bản')`), true);
  passed.push('Suất có ID sai không được tính vào lưới/panel; chỉ còn ID sai thì xóa lựa chọn phim sau tải thành công');

  scenario = { mode: 'ok', showtimeMode: 'held' };
  await boot(`/cinemas/2?date=${days[1].date}&movieId=10`); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${detailSchedule} [role="status"]')?.textContent.includes('Đang tải suất chiếu')`);
  assert.equal(await cdp.evaluate(`document.querySelector('${pricingPanel} [role="status"]')?.textContent.includes('Đang tải giá cơ bản')`), true);
  assert.equal(await cdp.evaluate(`new URLSearchParams(location.search).get('movieId')`), '10');
  assert.ok(scenario.heldShowtime);
  scenario.showtimeMode = 'ok'; await reply(scenario.heldShowtime, 200, []);
  await cdp.wait(`!new URLSearchParams(location.search).has('movieId')`);
  passed.push('Suất đang tải giữ lựa chọn phim; chỉ xóa khi phản hồi thành công xác nhận hết suất');

  scenario = { mode: 'ok', showtimeMode: 'error' };
  await boot(`/cinemas/2?date=${days[1].date}&movieId=10`); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${detailSchedule} [role="alert"]')?.textContent.includes('Không tải được suất chiếu')`, 20000);
  assert.equal(await cdp.evaluate(`document.querySelector('${pricingPanel} [role="status"]')?.textContent.includes('Chưa tải được giá cơ bản')`), true);
  assert.equal(await cdp.evaluate(`new URLSearchParams(location.search).get('movieId')`), '10');
  scenario.showtimeMode = 'ok';
  await cdp.evaluate(`document.querySelector('${detailSchedule} [role="alert"] button').click()`);
  await cdp.wait(`!new URLSearchParams(location.search).has('movieId')`);
  passed.push('Lỗi suất giữ movieId và có Thử lại; phản hồi thành công mới chuẩn hóa lựa chọn');

  scenario = { mode: 'ok', showtimeMode: 'invalid' };
  await boot(`/cinemas/2?date=${days[1].date}&movieId=10`); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`document.querySelector('${detailSchedule} [role="alert"]')?.textContent.includes('Không tải được suất chiếu')`);
  assert.equal(await cdp.evaluate(`new URLSearchParams(location.search).get('movieId')`), '10');
  scenario.showtimeMode = 'ok';
  await cdp.evaluate(`document.querySelector('${detailSchedule} [role="alert"] button').click()`);
  await cdp.wait(`!new URLSearchParams(location.search).has('movieId')`);
  passed.push('Payload suất sai cấu trúc không xóa phim đã chọn; thử lại sau phản hồi hợp lệ');

  scenario = { mode: 'ok' };
  await boot(`/cinemas/1?date=${today}&movieId=10`); await detailReady('Galaxy Đà Nẵng');
  await cdp.wait(`!new URLSearchParams(location.search).has('movieId')`);
  assert.equal(await cdp.evaluate(`document.querySelector('${detailSchedule} [role="status"]')?.textContent.includes('chưa có suất chiếu')`), true);
  assert.equal(await cdp.evaluate('location.pathname'), '/cinemas/1');
  assert.equal(await cdp.evaluate(`document.querySelector('${locationPanel}').textContent.includes('Tầng 3, đường Điện Biên Phủ')`), true);
  assert.equal(await cdp.evaluate(`new URL(document.querySelector('${locationPanel} a[href^="https://www.google.com/maps/dir/"]').href).searchParams.get('destination').includes('Galaxy Đà Nẵng')`), true);
  passed.push('Rạp không có suất giữ route/ID; không hiển thị phim hoặc suất của rạp khác');

  await boot('/cinemas/3'); await detailReady('Rạp Chưa Có Suất');
  assert.equal(await cdp.evaluate(`document.querySelector('${locationPanel}').textContent.includes('Địa chỉ đang cập nhật')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('${locationPanel}').textContent.includes('Điện thoại đang cập nhật')`), true);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('${locationPanel} a[href^="https://www.google.com/maps/dir/"]'))`), false);
  assert.equal(await cdp.evaluate(`document.querySelector('${locationPanel} [role="status"]')?.textContent.includes('Vị trí rạp đang cập nhật')`), true);
  passed.push('Thiếu giá, địa chỉ và tọa độ có thông báo; không tạo liên kết chỉ đường sai');

  await boot('/cinemas/2', 390); await detailReady('Galaxy Hà Nội');
  await cdp.wait(`Boolean(document.querySelector('${pricingPanel} li'))`);
  await cdp.evaluate(`document.querySelector('${pricingPanel}').scrollIntoView({ block: 'start' })`);
  await cdp.evaluate('window.scrollBy(0, -120)');
  await screenshot('cinema-pricing-location-390-mock.png');
}

async function galleryReady(position, total) {
  await cdp.wait(`(() => {
    const slide = document.querySelector('${gallery} [aria-roledescription="slide"]');
    const img = slide?.querySelector('img');
    return slide?.getAttribute('aria-label') === '${position} / ${total}' && img.complete && img.naturalWidth > 0;
  })()`);
}

async function galleryClick(label) {
  await cdp.evaluate(`document.querySelector('${gallery} button[aria-label="${label}"]').click()`);
}

async function swipeGallery(dx, dy = 0) {
  const point = await cdp.evaluate(`(() => {
    const rect = document.querySelector('${galleryViewport}').getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - ${dx} / 2, y: rect.top + rect.height / 2 - ${dy} / 2 };
  })()`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
  for (let step = 1; step <= 4; step += 1) {
    await delay(25);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + dx * step / 4, y: point.y + dy * step / 4, id: 1 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function runBookingJourneyMock() {
  scenario = { mode: 'ok', showtimeMode: 'multi', movieMode: 'multi' };
  await boot('/cinemas', 390); await ready(4);
  await openDetail(2, 'Galaxy Hà Nội');
  const nextDayLabel = `${days[1].label}, ${days[1].fullDate}`;
  await cdp.evaluate(`document.querySelector('${detailSchedule} button[aria-label=${JSON.stringify(nextDayLabel)}]').click()`);
  await cdp.wait(`new URLSearchParams(location.search).get('date') === ${JSON.stringify(days[1].date)} && Boolean(document.querySelector('${movieGrid} button'))`);
  await cdp.evaluate(`[...document.querySelectorAll('${movieGrid} button')].find(button => button.textContent.includes('Phim thứ hai')).click()`);
  await cdp.wait(`new URLSearchParams(location.search).get('movieId') === '11' && Boolean(document.querySelector('${showtimePanel} a[href="/booking/502"]'))`);
  assert.equal(await cdp.evaluate(`document.querySelector('${showtimePanel} a[href="/booking/502"]').textContent.includes('99.000đ')`), true);
  await cdp.evaluate(`document.querySelector('${showtimePanel} a[href="/booking/502"]').click()`);
  await cdp.wait(`location.pathname === '/booking/502' && Boolean(document.querySelector('button[aria-label^="A1 -"]'))`);
  assert.equal(await cdp.evaluate(`document.querySelector('main h1')?.textContent`), 'Chọn ghế của bạn');
  assert.equal(await cdp.evaluate(`document.querySelector('main aside').textContent.includes('Phim thứ hai') && document.querySelector('main aside').textContent.includes('Galaxy Hà Nội')`), true);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('footer').length`), 1);
  assert.ok(requests.some(request => request.method === 'GET' && request.route === '/showtimes/502'));
  assert.ok(requests.some(request => request.method === 'GET' && request.route === '/showtimes/502/seats'));
  await screenshot('cinema-to-seats-390-mock.png');
  passed.push('Danh sách → chi tiết → ngày → phim → suất 502 mở đúng trang ghế; hai GET chi tiết/ghế mô phỏng, không tạo booking');
}

async function runMapSmoke() {
  scenario = { mode: 'map' };
  await boot('/cinemas/9', 1440); await detailReady(mapCinema.name);
  const expectedUrl = getManualGoogleEmbedUrl(cinemaGoogleMapEmbeds['9']);
  assert.ok(expectedUrl);
  await cdp.wait(`Boolean(document.querySelector('${locationPanel} iframe'))`);
  const iframeSrc = await cdp.evaluate(`document.querySelector('${locationPanel} iframe').src`);
  assert.equal(iframeSrc, expectedUrl);
  await cdp.evaluate(`document.querySelector('${locationPanel} iframe').scrollIntoView({ block: 'center' })`);
  await delay(8000);
  await screenshot('cinema-google-map-9.png');
  mapCheck = { cinemaId: 9, iframeSrcMatchesConfig: true, responses: mapResponses,
    httpOk: mapResponses.some(item => item.status >= 200 && item.status < 300) };
  assert.ok(mapCheck.httpOk, 'Iframe Google Maps rạp 9 không nhận được HTTP 2xx');
  passed.push('Iframe Google Maps rạp 9 nhận phản hồi HTTP thành công trong Edge');
}

async function runGalleryMock() {
  scenario = { mode: 'ok' };
  await boot('/cinemas/2', 1440); await detailReady('Galaxy Hà Nội'); await galleryReady(1, 3);
  const apiReads = requests.length;
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${gallery} [aria-label="Chọn ảnh rạp"] button').length`), 3);
  assert.equal(await cdp.evaluate(`(() => {
    const viewport = document.querySelector('${galleryViewport}').getBoundingClientRect();
    const center = document.querySelector('${gallery} [aria-roledescription="slide"]').getBoundingClientRect();
    const [left, right] = [...document.querySelectorAll('${galleryViewport} > div[aria-hidden="true"]')].map(el => el.getBoundingClientRect());
    return center.left > viewport.left && center.right < viewport.right
      && left.left < viewport.left && left.right > viewport.left
      && right.left < viewport.right && right.right > viewport.right;
  })()`), true, 'Desktop hé đúng hai ảnh bên cạnh');
  await galleryClick('Ảnh tiếp theo'); await galleryReady(2, 3);
  await galleryClick('Ảnh trước'); await galleryReady(1, 3);
  await galleryClick('Ảnh trước'); await galleryReady(3, 3);
  await galleryClick('Xem ảnh 2'); await galleryReady(2, 3);
  assert.equal(await cdp.evaluate(`document.querySelector('${gallery} [aria-current="true"]').getAttribute('aria-label')`), 'Xem ảnh 2');
  passed.push('Gallery loại ảnh trùng, desktop hé hai bên; nút/chấm chọn đúng ảnh và quay vòng ở hai đầu');

  await cdp.evaluate(`document.querySelector('${galleryViewport}').focus()`);
  assert.equal(await cdp.evaluate(`getComputedStyle(document.activeElement).outlineStyle !== 'none'`), true);
  await cdp.key('ArrowRight'); await galleryReady(3, 3);
  await cdp.key('ArrowLeft'); await galleryReady(2, 3);
  await cdp.key('End'); await galleryReady(3, 3);
  await cdp.key('Home'); await galleryReady(1, 3);
  await cdp.key('Tab');
  assert.equal(await cdp.evaluate(`document.activeElement.getAttribute('aria-label')`), 'Ảnh trước');
  await cdp.key('Enter'); await galleryReady(3, 3);
  await cdp.evaluate(`document.querySelector('${gallery} button[aria-label="Xem ảnh 1"]').focus()`);
  await cdp.key('Enter'); await galleryReady(1, 3);
  assert.equal(requests.length, apiReads, 'Chuyển ảnh không gọi thêm API');
  await screenshot('cinema-gallery-desktop-mock.png');
  passed.push('Gallery hỗ trợ mũi tên/Home/End, Tab/Enter và focus rõ; chuyển ảnh không gọi API');

  await boot('/cinemas/2', 390); await galleryReady(1, 3);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  try {
    await swipeGallery(-120); await galleryReady(2, 3);
    await swipeGallery(120); await galleryReady(1, 3);
    await swipeGallery(-20); await galleryReady(1, 3);
    await swipeGallery(5, -80); await galleryReady(1, 3);
    await cdp.wait('scrollY > 0');
    assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    await cdp.evaluate('window.scrollTo(0, 0)');
    await screenshot('cinema-gallery-mobile-mock.png');
  } finally { await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false }); }
  passed.push('Vuốt ngang chuyển ảnh trên 390px; vuốt ngắn không đổi ảnh và vuốt dọc vẫn cuộn trang');

  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await galleryClick('Ảnh tiếp theo'); await galleryReady(2, 3);
  assert.equal(await cdp.evaluate(`matchMedia('(prefers-reduced-motion: reduce)').matches`), true);
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });
  passed.push('Chế độ giảm chuyển động vẫn điều hướng được gallery, không có tự chuyển ảnh');

  scenario.detailOverrides = { imageUrls: ['https://images.example.invalid/hanoi.svg'], imageLandscape: 'https://images.example.invalid/landscape.svg', imagePortrait: 'https://images.example.invalid/portrait.svg' };
  await boot('/cinemas/2'); await galleryReady(1, 1);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${gallery} button').length`), 0);
  assert.equal(await cdp.evaluate(`document.querySelector('${galleryViewport}').hasAttribute('tabindex')`), false);
  scenario.detailOverrides.imageUrls = ['https://images.example.invalid/hanoi.svg', 'https://images.example.invalid/auditorium.svg'];
  await boot('/cinemas/2', 1440); await galleryReady(1, 2);
  await galleryClick('Ảnh tiếp theo'); await galleryReady(2, 2);
  await galleryClick('Ảnh tiếp theo'); await galleryReady(1, 2);
  passed.push('Một ảnh ẩn toàn bộ điều hướng; hai ảnh vẫn quay vòng đúng mà không nhân đôi số ảnh');

  scenario.detailOverrides = { imageUrls: ['https://images.example.invalid/broken.jpg', 'https://images.example.invalid/danang.svg'] };
  await boot('/cinemas/1'); await detailReady('Galaxy Đà Nẵng'); await galleryReady(1, 1);
  assert.equal(await cdp.evaluate(`document.querySelector('${gallery} [aria-roledescription="slide"] img').src.endsWith('/danang.svg')`), true);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${gallery} button').length`), 0);
  scenario.detailOverrides = { imageLandscape: 'https://images.example.invalid/landscape.svg', imagePortrait: 'https://images.example.invalid/portrait.svg' };
  await boot('/cinemas/4'); await detailReady('Rạp Sắp Có Lịch');
  await cdp.wait(`document.querySelector('${gallery}').textContent.includes('Chưa tải được ảnh rạp')`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${gallery} img, ${gallery} button').length`), 0);
  scenario.detailOverrides.imageUrls = [];
  await boot('/cinemas/3'); await detailReady('Rạp Chưa Có Suất');
  assert.equal(await cdp.evaluate(`document.querySelector('${gallery}').textContent.includes('Ảnh rạp đang cập nhật')`), true);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${gallery} button').length`), 0);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${gallery} img').length`), 0);
  delete scenario.detailOverrides;
  passed.push('Gallery chỉ dùng imageUrls; bỏ ảnh lỗi, không dùng ảnh ngang/dọc khi gallery rỗng hoặc toàn bộ ảnh lỗi');

  await boot(); await ready(4); await openDetail(2, 'Galaxy Hà Nội'); await galleryReady(1, 3);
  await galleryClick('Xem ảnh 3'); await galleryReady(3, 3);
  // Switch the route without unmounting the detail page, as the upcoming cinema selector will do.
  await cdp.evaluate(`history.pushState(null, '', '/cinemas/1'); dispatchEvent(new PopStateEvent('popstate'))`);
  await detailReady('Galaxy Đà Nẵng');
  await cdp.wait(`document.querySelector('${gallery}').textContent.includes('Ảnh rạp đang cập nhật')`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${gallery} img').length`), 0);
  await cdp.evaluate(`history.back()`); await detailReady('Galaxy Hà Nội'); await galleryReady(1, 3);
  assert.equal(await cdp.evaluate(`document.querySelector('${gallery} [aria-roledescription="slide"] img').src.endsWith('/hanoi.svg')`), true);
  passed.push('Đổi route rạp và Back đặt lại ảnh đầu, không giữ ảnh hoặc lỗi ảnh của rạp trước');
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
  const sample = expected.find(cinema => cinema.address?.trim() && cinemaGoogleMapEmbeds[String(cinema.id)]) || expected[0];
  assert.ok(sample);
  assert.equal(await cdp.evaluate(`document.querySelector('[aria-labelledby="cinema-name-${sample.id}"]').textContent.includes(${JSON.stringify(sample.address?.trim() || 'Địa chỉ đang cập nhật')})`), true);
  await cdp.wait(`(() => { const card = document.querySelector('[aria-labelledby="cinema-name-${sample.id}"]'); const img = card?.querySelector('img'); return !img || (img.complete && img.naturalWidth > 0); })()`, 25000);
  await visibleImagesReady();
  await screenshot('cinemas-desktop-live.png');
  passed.push(`Danh sách/thứ tự/địa chỉ khớp ${catalog.length} rạp từ API thật; ảnh có tải được hoặc hiện fallback`);

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

  const detail = await readApi(`/cinemas/${sample.id}`);
  await openDetail(sample.id, detail.name);
  assert.equal(await cdp.evaluate(`document.querySelector('main').textContent.includes(${JSON.stringify(detail.address?.trim() || 'Địa chỉ đang cập nhật')})`), true);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('footer').length`), 1);
  const expectedMapUrl = getManualGoogleEmbedUrl(cinemaGoogleMapEmbeds[String(sample.id)]);
  assert.ok(expectedMapUrl, `Rạp mẫu ${sample.id} chưa có mã nhúng Google Maps`);
  await cdp.wait(`Boolean(document.querySelector('${locationPanel} iframe'))`);
  assert.equal(await cdp.evaluate(`document.querySelector('${locationPanel} iframe').src`), expectedMapUrl);
  await cdp.evaluate(`document.querySelector('${locationPanel} iframe').scrollIntoView({ block: 'center' })`);
  await delay(8000);
  await screenshot(`cinema-google-map-${sample.id}-live.png`);
  mapCheck = { cinemaId: sample.id, source: 'API thật', iframeSrcMatchesConfig: true,
    responses: mapResponses, httpOk: mapResponses.some(item => item.status >= 200 && item.status < 300) };
  assert.ok(mapCheck.httpOk, `Iframe Google Maps rạp ${sample.id} không nhận được HTTP 2xx`);
  passed.push(`Iframe Google Maps của rạp ${sample.id} từ API thật tải thành công trong Edge`);
  for (const width of [390, 768, 1440]) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `Chi tiết live ${width}px tràn ngang`);
    assert.equal(await cdp.evaluate(`document.querySelectorAll('footer').length`), 1);
  }
  passed.push('Chi tiết rạp với API thật ở 390/768/1440px không tràn ngang và chỉ có một Footer');
  await cdp.send('Page.reload'); await detailReady(detail.name);
  await returnToList(); await ready(catalog.length);
  passed.push(`CTA/reload hiển thị chi tiết rạp ${sample.id} khớp GET thật; quay lại danh sách`);

  const slots = await readApi('/showtimes?date=' + today);
  const withSlots = new Set(slots.map(slot => String(slot.cinemaId)));
  const target = expected.find(cinema => !withSlots.has(String(cinema.id))) || expected[0];
  await openSchedule(target.id);
  if (!withSlots.has(String(target.id))) {
    await cdp.wait(`document.querySelector('main').textContent.includes('Rạp chưa có suất chiếu còn mở bán')`);
    passed.push(`Mở trực tiếp lịch API thật giữ rạp ${target.id} chưa có suất trong ngày, hiển thị trạng thái rỗng`);
  } else passed.push(`Mở trực tiếp lịch API thật giữ đúng rạp ${target.id}; nhánh rỗng được kiểm tra bằng mô phỏng`);

  await boot('/cinemas?city=' + encodeURIComponent(city), 390);
  await ready(filterCinemas(catalog, { city }).length);
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await visibleImagesReady();
  await screenshot('cinemas-mobile-live.png');
  await cdp.send('Page.reload'); await cdp.wait(`document.querySelector('#cinema-city')?.value === ${JSON.stringify(city)}`);
  await ready(filterCinemas(catalog, { city }).length);
  passed.push('390px với dữ liệu thật không tràn ngang; URL/reload giữ tỉnh và kết quả');

  const nextDate = days[1].date;
  const nextSlots = await readApi(`/showtimes?date=${nextDate}`);
  const activeCinema = expected.find(cinema => nextSlots.some(slot => String(slot.cinemaId) === String(cinema.id) && isInternalShowtimeId(slot.id) && isInternalShowtimeId(slot.movieId)));
  if (activeCinema) {
    const firstSlot = nextSlots.find(slot => String(slot.cinemaId) === String(activeCinema.id) && isInternalShowtimeId(slot.id) && isInternalShowtimeId(slot.movieId));
    await boot('/cinemas', 390); await ready(catalog.length); await openDetail(activeCinema.id, activeCinema.name);
    const nextDayLabel = `${days[1].label}, ${days[1].fullDate}`;
    await cdp.evaluate(`document.querySelector('${detailSchedule} button[aria-label=${JSON.stringify(nextDayLabel)}]').click()`);
    await cdp.wait(`new URLSearchParams(location.search).get('date') === ${JSON.stringify(nextDate)} && Boolean(document.querySelector('#cinema-detail-movie option[value="${firstSlot.movieId}"]'))`);
    await setField('#cinema-detail-movie', String(firstSlot.movieId));
    await cdp.wait(`new URLSearchParams(location.search).get('movieId') === ${JSON.stringify(String(firstSlot.movieId))} && Boolean(document.querySelector('${showtimePanel} a[href="/booking/${firstSlot.id}"]'))`);
    const actualIds = await cdp.evaluate(`[...document.querySelectorAll('${showtimePanel} a[href^="/booking/"]')].map(a => a.getAttribute('href').split('/').at(-1)).sort()`);
    const expectedIds = nextSlots.filter(slot => String(slot.cinemaId) === String(activeCinema.id) && String(slot.movieId) === String(firstSlot.movieId) && isInternalShowtimeId(slot.id)).map(slot => String(slot.id)).sort();
    assert.deepEqual(actualIds, expectedIds);
    assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    assert.equal(await cdp.evaluate(`document.querySelectorAll('footer').length`), 1);
    await cdp.evaluate(`document.querySelector('${showtimePanel}').scrollIntoView({ block: 'start' })`);
    await screenshot('cinema-live-movie-showtimes-390.png');
    passed.push(`Dữ liệu API thật: rạp ${activeCinema.id} → ngày ${nextDate} → phim ${firstSlot.movieId} hiện đúng ${actualIds.length} suất và link ghế, không lẫn rạp`);
  } else passed.push(`API thật không có suất hợp lệ ngày ${nextDate}; hành trình chọn suất đã kiểm tra bằng mô phỏng`);
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
    if (url.hostname === 'www.google.com' && url.pathname === '/maps/embed') mapResponses.push({ status: event.response.status, url: event.response.url });
  });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }, ...(!live ? [
    { urlPattern: 'https://images.example.invalid/*' },
  ] : [])] });
  cdp.on('Fetch.requestPaused', event => { void intercept(event).catch(async error => {
    // A page navigation can cancel an image request before its mocked response is sent.
    if (error.message.includes('"code":-32602,"message":"Invalid InterceptionId."')) return;
    exceptions.push(error.stack); await cdp.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
  }); });
  if (live) await runLive(); else { await runMock(); await runNavigationMock(); await runDetailMock(); await runInfoHeaderMock(); await runRapidSwitchMock(); await runDetailSelectionMock(); await runBookingJourneyMock(); await runGalleryMock(); if (checkMap) await runMapSmoke(); }
  assert.deepEqual(exceptions, []);
  assert.ok(requests.every(request => ['GET', 'OPTIONS'].includes(request.method)));
  const report = { mode: live ? 'Edge production / API localhost thật chỉ đọc, không mô phỏng response' : 'Edge production / REST và ảnh mô phỏng, không xác nhận DB/HTTP thật',
    passed, requests, responses, mapCheck, runtimeExceptions: exceptions.length, artifacts };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, requests: requests.length, responses: responses.length }, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ passed, requests, exceptions, body: await cdp?.evaluate('document.body.innerText').catch(() => '') }, null, 2));
  if (cdp) await screenshot('failure.png').catch(() => {});
  console.error(`Kiểm tra rạp thất bại: ${artifacts}`); throw error;
} finally { await browser?.close(); }
