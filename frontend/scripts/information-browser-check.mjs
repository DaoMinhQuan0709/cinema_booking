import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startEdgeBrowser } from './lib/edge-browser.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const artifacts = await mkdtemp(path.join(tmpdir(), 'cinema-information-'));
const origin = 'http://127.0.0.1:4218';
const routes = [
  ['/terms', 'Điều khoản sử dụng'], ['/privacy', 'Bảo mật thông tin'],
  ['/booking-guide', 'Giữ chỗ 10 phút'], ['/refund-policy', 'Đổi trả & hoàn vé'],
  ['/faq', 'Câu hỏi thường gặp'], ['/concessions', 'Bắp nước & combo'],
];
const products = [
  { id: 1, name: 'Combo Một Người', description: 'Một bắp và một nước ngọt.', price: 89000, isAvailable: true, imageUrl: '/missing-product.jpg' },
  { id: 2, name: 'Combo Đôi', description: 'Một bắp và hai nước ngọt.', price: 129000, isAvailable: true },
  { id: 3, name: 'Sản phẩm ngừng bán', price: 10000, isAvailable: false },
];
const requests = [], errors = [], passed = [];
let browser, cdp, mode = 'ok';

async function boot(route, width = 1440) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
  await cdp.send('Page.navigate', { url: origin + route });
  await cdp.wait(`Boolean(document.querySelector('.information-page h1')) && location.pathname === ${JSON.stringify(route.split('#')[0])}`);
}
async function screenshot(name) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(artifacts, name), Buffer.from(data, 'base64'));
}
async function field(value) {
  await cdp.evaluate(`(() => { const input = document.querySelector('#faq-search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
}

try {
  browser = await startEdgeBrowser({ root, port: 4218, debugPort: 9251, artifacts, executable: process.env.ADMIN_EDGE_PATH });
  cdp = browser.cdp;
  cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*/api/v1/*' }] });
  cdp.on('Fetch.requestPaused', event => { void (async () => {
    const url = new URL(event.request.url);
    requests.push({ path: url.pathname, method: event.request.method });
    const catalog = url.pathname.endsWith('/products');
    const status = catalog && mode === 'error' ? 503 : 200;
    const data = catalog ? (mode === 'empty' ? [] : products) : [];
    await cdp.send('Fetch.fulfillRequest', {
      requestId: event.requestId, responseCode: status,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: origin },
        { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
        { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
      ],
      body: Buffer.from(JSON.stringify({ code: status, message: status === 200 ? 'OK' : 'Unavailable', data })).toString('base64'),
    });
  })().catch(error => {
    if (!error.message.includes('Invalid InterceptionId')) errors.push(error.message);
  }); });

  for (const width of [1440, 390, 320]) {
    for (const [route, title] of routes) {
      await boot(route, width);
      assert.equal(await cdp.evaluate(`document.title === ${JSON.stringify(`${title} | PremierCinema`)}`), true);
      assert.equal(await cdp.evaluate('document.documentElement.scrollWidth <= innerWidth'), true, `${route} fits ${width}px`);
      assert.equal(await cdp.evaluate('document.querySelectorAll("h1").length'), 1);
      assert.equal(await cdp.evaluate('document.querySelectorAll("footer").length'), 1);
      assert.equal(await cdp.evaluate(`document.querySelector('a[href="mailto:support@premiercinema.vn"]') !== null`), true);
      if (width < 768 && route !== '/concessions') {
        assert.equal(await cdp.evaluate(`(() => { const active = document.querySelector('.information-sidebar [aria-current="page"]').getBoundingClientRect(); return active.left >= 0 && active.right <= innerWidth; })()`), true, 'Active mobile navigation item stays visible');
      }
      if (width !== 320 && ['/booking-guide', '/faq', '/concessions'].includes(route)) await screenshot(`${route.slice(1)}-${width}.png`);
    }
  }
  passed.push('All six routes load directly at 1440px, 390px and 320px, with correct title, one heading/footer and no horizontal overflow');

  await boot('/faq');
  for (const [route, title] of routes) {
    await cdp.evaluate(`document.querySelector('footer a[href="${route}"]').click()`);
    await cdp.wait(`location.pathname === ${JSON.stringify(route)} && document.title === ${JSON.stringify(`${title} | PremierCinema`)}`);
    await cdp.wait('scrollY < 10');
  }
  passed.push('All six Footer links navigate within the app and reset scroll');

  await boot('/faq', 390);
  await cdp.evaluate('document.querySelector(".faq-item summary").focus()');
  await cdp.key('Enter');
  await cdp.wait('document.querySelector(".faq-item").open');
  await field('giu ghe');
  await cdp.wait('document.querySelector("#faq-search").value === "giu ghe" && document.querySelectorAll(".faq-item").length > 0 && document.querySelectorAll(".faq-item").length < 11');
  await cdp.click('Thanh toán');
  await cdp.wait(`[...document.querySelectorAll('.faq-item summary small')].every(e => e.textContent === 'Thanh toán')`);
  await field('khong-co-cau-hoi-xyz');
  await cdp.wait('Boolean(document.querySelector(".information-empty"))');
  await cdp.click('Xóa bộ lọc');
  await cdp.wait('document.querySelectorAll(".faq-item").length === 11');
  passed.push('FAQ supports native keyboard expansion, accent-insensitive search, category filtering, no results and clearing filters');

  await boot('/refund-policy#pending', 390);
  await cdp.wait('document.querySelector("#pending").getBoundingClientRect().top >= 0 && document.querySelector("#pending").getBoundingClientRect().top < 200');
  await cdp.send('Page.reload');
  await cdp.wait('document.querySelector("#pending")?.getBoundingClientRect().top < 200');
  passed.push('Policy section links work on direct entry and reload');

  await boot('/concessions');
  await cdp.wait('document.querySelectorAll(".concession-card").length === 2');
  assert.equal(await cdp.evaluate('document.querySelector(".concession-card").innerText.includes("89.000")'), true);
  await cdp.wait('document.querySelectorAll(".concession-image > svg").length === 2');
  assert.equal(await cdp.evaluate('document.querySelector("main").innerText.includes("Sản phẩm ngừng bán")'), false);
  passed.push('Concessions renders API products and prices, hides withdrawn products, and handles missing/broken images');

  mode = 'empty'; await boot('/concessions');
  await cdp.wait('document.querySelector(".information-empty")?.innerText.includes("Thực đơn đang được cập nhật")');
  mode = 'error'; await boot('/concessions');
  await cdp.wait('document.querySelector(".information-empty")?.innerText.includes("Chưa tải được thực đơn")');
  mode = 'ok'; await cdp.click('Thử lại');
  await cdp.wait('document.querySelectorAll(".concession-card").length === 2 && !document.querySelector(".information-empty")');
  passed.push('Concessions handles empty catalog, API errors and successful retry');
  assert.deepEqual(errors, []);
  assert.ok(requests.every(request => ['GET', 'OPTIONS'].includes(request.method)));
  const report = { mode: 'Production build in headless Edge with mocked REST responses; no live backend validation', passed, runtimeErrors: errors.length, requests: requests.length, artifacts };
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await screenshot('failure.png').catch(() => {});
  console.error(`Information page checks failed. Artifacts: ${artifacts}`);
  throw error;
} finally { await browser?.close(); }
