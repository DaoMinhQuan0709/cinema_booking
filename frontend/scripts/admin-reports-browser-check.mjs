// Kiểm tra dashboard production với REST/dữ liệu thử mô phỏng; không kết nối DB/API thật.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVietnamClock } from '../src/features/showtimes/scheduleUtils.js';
import { delay, startEdgeBrowser } from './lib/edge-browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = await mkdtemp(path.join(tmpdir(), 'cinema-admin-reports-'));
const origin = 'http://127.0.0.1:4201';
const today = getVietnamClock().date;
const tomorrow = getVietnamClock(new Date(Date.parse(`${today}T12:00:00+07:00`) + 86_400_000)).date;
const admin = { id: 1, fullName: 'Admin mô phỏng', email: 'admin@example.invalid', role: 'ADMIN' };
const movies = Array.from({ length: 105 }, (_, index) => ({ id: index + 1, title: index < 2 ? 'Phim trùng tên có tiêu đề rất dài để kiểm tra bố cục' : `Phim ${index + 1}`, durationMinutes: 120, status: 'NOW_SHOWING' }));
const cinemas = [{ id: 1, name: 'Rạp trùng tên', auditoriums: [] }, { id: 2, name: 'Rạp trùng tên', auditoriums: [] }, { id: 3, name: 'Rạp ghế đã tắt', auditoriums: [] }];
const requests = [], exceptions = [], modules = [], passed = [];
let browser, cdp, scenario, bootScript, sequence = 0;

function reset(options = {}) {
  scenario = { user: admin, revenueStatus: 200, occupancyStatus: 200, movieStatus: 200, cinemaStatus: 200, held: [], ...options };
}
function revenue(params) {
  let entries = [
    { movieId: 1, cinemaId: 1, date: today, revenue: 240000, ticketCount: 2 },
    { movieId: 2, cinemaId: 1, date: today, revenue: 300000, ticketCount: 3 },
    { movieId: 1, cinemaId: 2, date: today, revenue: 100000, ticketCount: 1 },
    { movieId: 1, cinemaId: 2, date: tomorrow, revenue: 200000, ticketCount: 2 },
  ];
  if (scenario.many) entries = Array.from({ length: 25 }, (_, index) => ({ movieId: index + 1, cinemaId: 1, date: today, revenue: (index + 1) * 10000, ticketCount: 1 }));
  const filtered = scenario.emptyRevenue ? [] : entries.filter(item => (!params.get('cinemaId') || String(item.cinemaId) === params.get('cinemaId'))
    && (!params.get('movieId') || String(item.movieId) === params.get('movieId')) && item.date >= params.get('startDate') && item.date <= params.get('endDate'));
  const groups = new Map();
  for (const entry of filtered) {
    const cinema = params.get('groupBy') === 'cinema';
    const id = cinema ? entry.cinemaId : entry.movieId;
    if (!groups.has(id)) groups.set(id, { id, label: cinema ? cinemas.find(item => item.id === id).name : movies.find(item => item.id === id).title, revenue: 0, bookingCount: 0, ticketCount: 0 });
    const row = groups.get(id); row.revenue += entry.revenue; row.bookingCount++; row.ticketCount += entry.ticketCount;
  }
  return { totalRevenue: filtered.reduce((sum, row) => sum + row.revenue, 0), totalSuccessfulBookings: filtered.length,
    totalTicketsSold: filtered.reduce((sum, row) => sum + row.ticketCount, 0), breakdown: [...groups.values()].sort((a, b) => a.id - b.id) };
}
function occupancy(params) {
  let rows = [
    { showtimeId: 1, movieId: 1, cinemaId: 1, totalSeats: 120, bookedSeats: 60, occupancyRate: 50, capacitySource: 'INVENTORY', active: false, date: today },
    { showtimeId: 2, movieId: 2, cinemaId: 1, totalSeats: 80, bookedSeats: 20, occupancyRate: 25, capacitySource: 'ACTIVE_SEATS', active: true, date: today },
    { showtimeId: 3, movieId: 1, cinemaId: 2, totalSeats: 120, bookedSeats: 0, occupancyRate: 0, capacitySource: 'ROOM_LAYOUT', active: true, date: today },
    { showtimeId: 4, movieId: 2, cinemaId: 2, totalSeats: 0, bookedSeats: 0, occupancyRate: 0, capacitySource: 'UNCONFIGURED', active: false, date: today },
    { showtimeId: 5, movieId: 1, cinemaId: 3, totalSeats: 0, bookedSeats: 0, occupancyRate: 0, capacitySource: 'ACTIVE_SEATS', active: true, date: today },
    { showtimeId: 6, movieId: 1, cinemaId: 1, totalSeats: 100, bookedSeats: 75, occupancyRate: 75, capacitySource: 'INVENTORY', active: true, date: tomorrow },
  ];
  if (scenario.many) rows = Array.from({ length: 25 }, (_, index) => ({ ...rows[0], showtimeId: index + 1, totalSeats: 10, bookedSeats: 1, occupancyRate: 10, date: today }));
  rows = scenario.emptyOccupancy ? [] : rows.filter(item => item.date === params.get('date') && (!params.get('movieId') || String(item.movieId) === params.get('movieId'))
    && (!params.get('cinemaId') || String(item.cinemaId) === params.get('cinemaId')));
  const totalSeatsAvailable = rows.reduce((sum, item) => sum + item.totalSeats, 0), totalSeatsBooked = rows.reduce((sum, item) => sum + item.bookedSeats, 0);
  return { totalSeatsAvailable, totalSeatsBooked, overallOccupancyRate: totalSeatsAvailable ? Math.round(totalSeatsBooked / totalSeatsAvailable * 10000) / 100 : 0,
    showtimesMissingCapacity: rows.filter(item => item.capacitySource === 'UNCONFIGURED').length,
    breakdown: rows.map(item => ({ ...item, auditoriumId: item.cinemaId * 10, startTime: `${item.date}T10:00:00`, label: `Phim ${item.movieId} — Rạp ${item.cinemaId} / Phòng 1 (${item.date} 10:00)` })) };
}
async function reply(requestId, status, data, message = 'OK') {
  await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
    { name: 'Content-Type', value: 'application/json; charset=utf-8' }, { name: 'Access-Control-Allow-Origin', value: origin },
    { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept' },
    { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
  ], body: Buffer.from(JSON.stringify({ code: status, message, data })).toString('base64') });
}
async function intercept({ requestId, request }) {
  if (request.method === 'OPTIONS') return reply(requestId, 200);
  const url = new URL(request.url), route = url.pathname.replace('/api/v1', '');
  requests.push({ route, method: request.method, search: url.search, bearer: request.headers.Authorization });
  assert.equal(request.method, 'GET', 'Dashboard chỉ đọc');
  if (route === '/users/me') return reply(requestId, 200, scenario.user);
  if (route === '/movies') {
    const pageNo = Number(url.searchParams.get('page') || 0), pageSize = Number(url.searchParams.get('size') || 10);
    return reply(requestId, scenario.movieStatus, { content: movies.slice(pageNo * pageSize, (pageNo + 1) * pageSize), pageNo, pageSize,
      totalElements: movies.length, totalPages: Math.ceil(movies.length / pageSize), last: (pageNo + 1) * pageSize >= movies.length }, 'Danh mục phim');
  }
  if (route === '/cinemas') return reply(requestId, scenario.cinemaStatus, cinemas, 'Danh mục rạp');
  const kind = route === '/admin/reports/revenue' ? 'revenue' : route === '/admin/reports/occupancy' ? 'occupancy' : null;
  if (!kind) throw new Error(`API ngoài dự kiến ${route}`);
  const data = kind === 'revenue' ? revenue(url.searchParams) : occupancy(url.searchParams);
  if (scenario[`hold${kind}`]) { scenario.held.push({ kind, requestId, data }); return; }
  const status = scenario[`${kind}Status`];
  return reply(requestId, status, data, status === 200 ? 'OK' : `Lỗi ${kind} mô phỏng`);
}
async function boot({ route = '/admin/reports', width = 1440, timezone = 'Asia/Ho_Chi_Minh' } = {}) {
  if (bootScript) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: bootScript });
  await cdp.send('Page.navigate', { url: 'about:blank' }); sequence++;
  bootScript = (await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.clear();
    localStorage.setItem('premier_cinema_access_token', 'report-token');
    localStorage.setItem('premier_cinema_refresh_token', 'report-refresh');
    localStorage.setItem('premier_cinema_session_id', 'report-session-${sequence}');
    localStorage.setItem('premier_cinema_user', ${JSON.stringify(JSON.stringify(scenario.user))});
    window.__reportBoot = ${sequence};
  ` })).identifier;
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: timezone });
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, mobile: width < 600, deviceScaleFactor: 1 });
  await cdp.send('Page.navigate', { url: origin + route });
  await cdp.wait(`window.__reportBoot === ${sequence} && Boolean(document.querySelector('#admin-page-title, #admin-access-title'))`);
}
async function field(name, value, scope = 'main') {
  assert.equal(await cdp.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(`${scope} [name="${name}"]`)}); if (!input) return false;
    const prototype = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); return true;
  })()`), true, `Trường ${name}`);
}
async function ready() { await cdp.wait(`Boolean(document.querySelector('#admin-kpi-revenue')) && Boolean(document.querySelector('#admin-kpi-occupancy')) && !document.querySelector('main [aria-busy=true]')`); }
async function value(id) { return cdp.evaluate(`document.querySelector(${JSON.stringify(`#admin-kpi-${id}`)})?.textContent`); }
function count(kind) { return requests.filter(item => item.route === `/admin/reports/${kind}`).length; }
async function waitHeld(kind) {
  const deadline = Date.now() + 10000;
  while (!scenario.held.some(item => item.kind === kind)) { if (Date.now() > deadline) throw new Error(`Thiếu request ${kind}`); await delay(50); }
}
async function release(kind, allowAborted = false) {
  const index = scenario.held.findIndex(item => item.kind === kind); assert.ok(index >= 0);
  const [held] = scenario.held.splice(index, 1);
  try { await reply(held.requestId, 200, held.data); }
  catch (error) { if (!allowAborted || !error.message.includes('Invalid InterceptionId')) throw error; }
}
async function capture(name) { await writeFile(path.join(artifacts, name), Buffer.from((await cdp.send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); }

try {
  browser = await startEdgeBrowser({ root, port: 4201, debugPort: 9234, artifacts, executable: process.env.ADMIN_EDGE_PATH }); cdp = browser.cdp;
  await cdp.send('Network.enable');
  cdp.on('Network.requestWillBeSent', event => { if (event.request.url.includes('/assets/')) modules.push(event.request.url); });
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
  cdp.on('Runtime.exceptionThrown', event => exceptions.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  cdp.on('Fetch.requestPaused', event => { void intercept(event).catch(error => exceptions.push(error.stack)); });

  reset(); await boot({ route: '/admin/reports#totals', timezone: 'America/Los_Angeles' }); await ready();
  assert.equal(await value('revenue'), '640.000đ'); assert.equal(await value('bookings'), '3'); assert.equal(await value('tickets'), '6');
  assert.equal(await value('occupancy'), '25%'); assert.equal(await value('capacity'), '320'); assert.equal(await value('booked-seats'), '80');
  const defaults = new URLSearchParams(await cdp.evaluate('location.search'));
  assert.equal(defaults.get('startDate'), `${today.slice(0, 7)}-01`); assert.equal(defaults.get('endDate'), today); assert.equal(defaults.get('occupancyDate'), today);
  assert.equal(await cdp.evaluate('location.hash'), '#totals');
  assert.equal(requests.filter(item => item.route.startsWith('/admin/reports/')).every(item => item.bearer === 'Bearer report-token'), true);
  await capture('reports-desktop.png');
  passed.push('production dashboard shows all KPI/VND/weighted percent and defaults to Vietnam month/today under Los Angeles browser time');

  assert.equal(await cdp.evaluate(`document.querySelectorAll('#admin-revenue-report tbody tr').length`), 2);
  await cdp.wait(`document.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').length === 2`);
  const chartLabels = await cdp.evaluate(`[...document.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')].map(node => node.textContent)`);
  assert.equal(chartLabels.some(label => label.includes('#1')), true); assert.equal(chartLabels.some(label => label.includes('#2')), true);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('#admin-report-catalog-filters [name=movieId] option').length`), 106);
  await field('groupBy', 'cinema'); await cdp.wait(`document.querySelector('#admin-revenue-chart-title')?.textContent.includes('theo rạp')`); await ready();
  assert.equal(await value('revenue'), '640.000đ');
  assert.equal(new URLSearchParams(requests.filter(item => item.route.endsWith('/revenue')).at(-1).search).get('groupBy'), 'cinema');
  await cdp.evaluate(`document.querySelector('.recharts-surface[role=application]').focus()`);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await cdp.wait(`document.querySelector('.recharts-tooltip-wrapper')?.textContent.includes('đ')`);
  passed.push('chart/group table separate duplicate labels by ID; catalog gathers every page; grouping and keyboard tooltip work');

  await field('cinemaId', '1', '#admin-report-catalog-filters'); await ready(); await cdp.wait(`document.querySelector('#admin-kpi-revenue')?.textContent === '540.000đ'`);
  await field('movieId', '1', '#admin-report-catalog-filters'); await cdp.wait(`document.querySelector('#admin-kpi-revenue')?.textContent === '240.000đ'`); await ready();
  assert.equal(await value('occupancy'), '50%'); assert.equal(await cdp.evaluate(`document.querySelector('#admin-occupancy-report tbody').textContent.includes('Đã ngừng mở bán')`), true);
  const appliedUrl = await cdp.evaluate('location.href');
  await cdp.evaluate('window.__reloading = true'); await cdp.send('Page.reload');
  await cdp.wait(`!window.__reloading && document.querySelector('#admin-kpi-revenue')?.textContent === '240.000đ'`); await ready();
  assert.equal(await cdp.evaluate('location.href'), appliedUrl);
  assert.equal(await cdp.evaluate('location.hash'), '#totals');
  await field('movieId', '2', '#admin-report-catalog-filters'); await cdp.wait(`document.querySelector('#admin-kpi-revenue')?.textContent === '300.000đ'`);
  await cdp.evaluate('history.back()'); await cdp.wait(`document.querySelector('#admin-kpi-revenue')?.textContent === '240.000đ'`); await ready();
  passed.push('common cinema/movie filters update both reports; F5 and Back restore URL, selection, KPI, chart and historical rows');

  const revenueBefore = count('revenue');
  await field('occupancyDate', tomorrow); await cdp.wait(`document.querySelector('#admin-kpi-occupancy')?.textContent === '75%'`); await ready();
  assert.equal(count('revenue'), revenueBefore); assert.equal(await value('revenue'), '240.000đ');
  const occupancyBefore = count('occupancy');
  await field('startDate', today, '#admin-revenue-date-filters'); await field('endDate', tomorrow, '#admin-revenue-date-filters'); await cdp.click('Áp dụng ngày'); await ready();
  assert.equal(count('occupancy'), occupancyBefore); assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).get('occupancyDate'), tomorrow);
  passed.push('occupancy date and revenue range are independent, keep each other in URL and only refetch the affected report');

  const beforeInvalid = count('revenue'), urlBeforeInvalid = await cdp.evaluate('location.href');
  await field('startDate', tomorrow, '#admin-revenue-date-filters'); await field('endDate', today, '#admin-revenue-date-filters'); await cdp.click('Áp dụng ngày');
  await cdp.wait(`document.querySelector('#admin-revenue-date-filters [name=endDate]').getAttribute('aria-invalid') === 'true'`);
  assert.equal(count('revenue'), beforeInvalid); assert.equal(await cdp.evaluate('location.href'), urlBeforeInvalid);
  await cdp.click('Đặt lại bộ lọc'); await cdp.wait(`document.querySelector('#admin-kpi-revenue')?.textContent === '640.000đ'`); await ready();
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-revenue-date-filters [name=startDate]').value`), `${today.slice(0, 7)}-01`);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-revenue-date-filters [name=endDate]').getAttribute('aria-invalid')`), 'false');
  passed.push('reversed draft shows accessible validation without changing applied results/URL or sending REST; reset also clears draft errors');

  reset(); const reversedBefore = count('revenue');
  await boot({ route: `/admin/reports?startDate=${tomorrow}&endDate=${today}&occupancyDate=${today}&source=test` });
  await cdp.wait(`document.querySelector('#admin-revenue-report').textContent.includes('Khoảng ngày chưa hợp lệ') && Boolean(document.querySelector('#admin-kpi-occupancy'))`);
  assert.equal(count('revenue'), reversedBefore); assert.equal(await value('revenue'), undefined);
  assert.equal(new URLSearchParams(await cdp.evaluate('location.search')).get('source'), 'test');
  await field('startDate', today, '#admin-revenue-date-filters'); await cdp.click('Áp dụng ngày'); await ready();
  passed.push('a direct reversed URL blocks revenue reads and stale KPI while independent occupancy remains usable; correcting the range recovers');

  reset(); await boot({ route: '/admin/reports?startDate=2026-02-30&endDate=bad&cinemaId=abc&movieId=-1&groupBy=bad&occupancyDate=bad&source=test' }); await ready();
  const normalized = new URLSearchParams(await cdp.evaluate('location.search'));
  assert.equal(normalized.get('endDate'), today); assert.equal(normalized.get('groupBy'), 'movie'); assert.equal(normalized.has('movieId'), false); assert.equal(normalized.get('source'), 'test');
  passed.push('malformed calendar/group/ID parameters normalize before REST while unrelated URL parameters survive');

  reset({ holdrevenue: true }); await boot(); await waitHeld('revenue');
  await cdp.wait(`Boolean(document.querySelector('#admin-kpi-occupancy'))`);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-revenue-report').textContent.includes('Đang tải doanh thu')`), true);
  scenario.holdrevenue = false; await release('revenue'); await ready();
  reset({ emptyRevenue: true, emptyOccupancy: true }); await boot(); await ready();
  assert.equal(await value('revenue'), '0đ'); assert.equal(await value('bookings'), '0'); assert.equal(await value('tickets'), '0'); assert.equal(await value('occupancy'), '—');
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-revenue-report').textContent.includes('Chưa có nhóm doanh thu')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-occupancy-report').textContent.includes('Không có suất chiếu trong bộ lọc này')`), true);
  assert.equal(await cdp.evaluate(`Boolean(document.querySelector('.recharts-surface'))`), false);
  passed.push('report loading is independent and empty data shows real zero KPI, no chart and no invented occupancy percent for zero capacity');

  reset({ revenueStatus: 400 }); const errorBefore = count('revenue'); await boot();
  await cdp.wait(`document.querySelector('#admin-revenue-report [role=alert]')?.textContent.includes('Lỗi revenue') && Boolean(document.querySelector('#admin-kpi-occupancy'))`);
  assert.equal(count('revenue') - errorBefore, 1); assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-sonner-toast]').length`), 0);
  scenario.revenueStatus = 200; await cdp.click('Thử lại', '#admin-revenue-report'); await ready();
  scenario.occupancyStatus = 500; await cdp.click('Làm mới lấp đầy');
  await cdp.wait(`document.querySelector('#admin-occupancy-report [role=alert]')?.textContent.includes('Lỗi occupancy')`);
  assert.equal(await value('occupancy'), '25%'); assert.equal(await value('revenue'), '640.000đ');
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-occupancy-report').textContent.includes('Đang hiển thị dữ liệu đã tải trước đó')`), true);
  scenario.occupancyStatus = 200; await cdp.click('Thử lại', '#admin-occupancy-report'); await ready();
  passed.push('400 does not retry or toast; explicit recovery works; failed occupancy refetch keeps matching old data and leaves revenue usable');

  assert.equal(await cdp.evaluate(`document.querySelector('#admin-occupancy-report [role=alert]').textContent.includes('1 suất thiếu cấu hình')`), true);
  for (const label of ['Ghế theo suất', 'Ghế đang hoạt động', 'Sơ đồ hàng × cột', 'Thiếu cấu hình']) assert.equal(await cdp.evaluate(`document.querySelector('#admin-occupancy-report tbody').textContent.includes(${JSON.stringify(label)})`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-occupancy-report').textContent.includes('không lấy trung bình')`), true);
  await field('cinemaId', '3', '#admin-report-catalog-filters'); await cdp.wait(`document.querySelector('#admin-kpi-capacity')?.textContent === '0'`); await ready();
  assert.equal(await value('occupancy'), '—'); assert.equal(await cdp.evaluate(`document.querySelector('#admin-occupancy-report [role=alert]') === null`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-occupancy-report tbody').textContent.includes('Ghế đang hoạt động')`), true);
  passed.push('all capacity sources and missing-configuration warning are visible; weighted percentage is retained and all-disabled seats do not become fake capacity');

  reset({ movieStatus: 500, cinemaStatus: 500 }); await boot(); await ready();
  await cdp.wait(`document.querySelector('main').textContent.includes('Không thể tải danh mục phim') && document.querySelector('main').textContent.includes('Không thể tải danh mục rạp')`);
  assert.equal(await value('revenue'), '640.000đ');
  assert.equal(await cdp.evaluate(`document.querySelector('#admin-report-catalog-filters [name=movieId]').disabled`), true);
  scenario.movieStatus = 200; scenario.cinemaStatus = 200;
  await cdp.click('Thử lại'); await cdp.click('Thử lại');
  await cdp.wait(`!document.querySelector('#admin-report-catalog-filters [name=movieId]').disabled && !document.querySelector('#admin-report-catalog-filters [name=cinemaId]').disabled`);
  passed.push('catalog errors have separate retries, disable only unavailable selectors and do not block reports');

  reset(); await boot(); await ready(); scenario.holdrevenue = true;
  await cdp.click('Làm mới doanh thu'); await waitHeld('revenue'); scenario.holdrevenue = false;
  await field('cinemaId', '1', '#admin-report-catalog-filters'); await cdp.wait(`document.querySelector('#admin-kpi-revenue')?.textContent === '540.000đ'`); await ready();
  await release('revenue', true); await delay(150); assert.equal(await value('revenue'), '540.000đ');
  passed.push('an older report response cannot overwrite the current filtered KPI/chart/table after navigation');

  reset({ many: true }); await boot(); await ready();
  assert.equal(await cdp.evaluate(`document.querySelectorAll('#admin-revenue-report tbody tr').length`), 20);
  await cdp.wait(`document.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value').length === 10`);
  await cdp.click('Trang sau', '#admin-revenue-report'); assert.equal(await cdp.evaluate(`document.querySelectorAll('#admin-revenue-report tbody tr').length`), 5);
  await cdp.click('Trang sau', '#admin-occupancy-report'); assert.equal(await cdp.evaluate(`document.querySelectorAll('#admin-occupancy-report tbody tr').length`), 5);
  passed.push('large reports show only top-ten chart bars and independently paginate complete group/showtime tables without extra REST');

  reset(); await boot({ width: 390 }); await ready();
  assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await cdp.evaluate(`document.querySelector('.recharts-surface').getBoundingClientRect().width > 0`), true);
  await capture('reports-390.png');
  await cdp.evaluate(`document.querySelector('#admin-revenue-chart-title').scrollIntoView({ block: 'start' })`); await capture('reports-chart-390.png');
  await cdp.evaluate(`document.querySelector('#admin-occupancy-report').scrollIntoView({ block: 'start' })`); await capture('reports-occupancy-390.png');
  await cdp.evaluate(`document.querySelector('#admin-revenue-date-filters [name=startDate]').focus()`); await cdp.key('Tab');
  assert.equal(await cdp.evaluate(`document.activeElement.closest('main') !== null`), true);
  passed.push('390px long labels, KPI/date fields, chart and horizontally scrolling tables fit the page; keyboard navigation remains visible');

  reset({ revenueStatus: 403 }); await boot(); await cdp.wait(`document.body.textContent.includes('403 — Không có quyền quản trị')`);
  assert.equal(await value('revenue'), undefined);
  reset({ user: { ...admin, role: 'CUSTOMER' } }); const requestBefore = requests.length, modulesBefore = modules.length;
  await boot(); await cdp.wait(`document.body.textContent.includes('403 — Không có quyền quản trị')`);
  assert.deepEqual(requests.slice(requestBefore).map(item => item.route), ['/users/me']);
  assert.equal(modules.slice(modulesBefore).some(url => url.includes('ReportDashboard')), false);
  passed.push('report 403 unmounts private content; CUSTOMER loads neither report/catalog queries nor the chart/dashboard bundle');

  assert.deepEqual(exceptions, []);
  const report = { mode: 'Edge production, REST/report data simulated; no real backend or DB', passed, runtimeExceptions: exceptions.length, mockRequests: requests.length };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, artifacts }, null, 2));
} catch (error) {
  await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ passed, requests, exceptions, scenario, location: await cdp?.evaluate('location.href'), body: await cdp?.evaluate('document.body.innerText') }, null, 2));
  console.error(`Kiểm thử dashboard không đạt: ${path.join(artifacts, 'failure.json')}`); throw error;
} finally { await browser?.close(); }
