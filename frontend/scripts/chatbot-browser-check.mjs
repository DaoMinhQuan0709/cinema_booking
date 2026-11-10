// Windows/Edge check against the production build. API requests are intercepted;
// this never calls Gemini or needs a logged-in account.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = await mkdtemp(path.join(tmpdir(), 'cinema-chatbot-browser-'));
const origin = 'http://127.0.0.1:4197';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const requests = [], exceptions = [], canceled = [];
const pending = new Map();
let server, edge, socket, sequence = 0, mode = 'hold', held;

try {
  server = await preview({ root, configFile: path.join(root, 'vite.config.js'), preview: { host: '127.0.0.1', port: 4197, strictPort: true } });
  edge = spawn(process.env.CHATBOT_EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking',
    '--remote-debugging-port=9230', `--user-data-dir=${path.join(artifacts, 'profile')}`, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  edge.on('error', error => exceptions.push(error.message));
  let page;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { page = (await (await fetch('http://127.0.0.1:9230/json/list')).json()).find(item => item.type === 'page'); } catch { /* Edge starting. */ }
    if (page) break;
    await delay(100);
  }
  assert.ok(page, `Edge started: ${exceptions.join(', ')}`);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 8000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
  const fulfill = (requestId, data, status = 200) => send('Fetch.fulfillRequest', {
    requestId, responseCode: status,
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json; charset=utf-8' },
      { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, Accept' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
    ],
    body: Buffer.from(JSON.stringify({ code: status, data })).toString('base64'),
  });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const entry = pending.get(message.id); if (!entry) return;
      pending.delete(message.id); clearTimeout(entry.timeout);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    if (message.method === 'Network.loadingFailed' && message.params.canceled) canceled.push(message.params.requestId);
    if (message.method === 'Fetch.requestPaused') {
      const { request, requestId, networkId } = message.params;
      const url = new URL(request.url);
      let response;
      if (url.origin === origin) response = send('Fetch.continueRequest', { requestId });
      else if (request.method === 'OPTIONS') response = fulfill(requestId, {});
      else if (url.pathname.endsWith('/chat/ask')) {
        const body = JSON.parse(request.postData);
        requests.push({ ...body, method: request.method });
        if (mode === 'hold') held = { requestId, networkId };
        else response = fulfill(requestId, { reply: '   ' }, mode === 'error' ? 503 : 200);
      } else response = send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' });
      response?.catch(error => exceptions.push(error.message));
    }
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async expression => {
    for (let attempt = 0; attempt < 80; attempt++) { if (await evaluate(expression)) return; await delay(70); }
    throw new Error(`Timed out: ${expression}`);
  };
  const waitRequest = async count => {
    for (let attempt = 0; attempt < 80 && requests.length < count; attempt++) await delay(70);
    assert.equal(requests.length, count);
  };
  const click = async selector => {
    const point = await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.scrollIntoView({block:'nearest'}); const box = element.getBoundingClientRect(); return {x:box.x+box.width/2,y:box.y+box.height/2}; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  };
  const type = async text => {
    await evaluate('document.querySelector("#cinebot-message").focus(); document.querySelector("#cinebot-message").select()');
    await send('Input.insertText', { text });
  };
  const enter = async (shift = false) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13, modifiers: shift ? 8 : 0 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  };
  const reply = async text => { const request = held; held = null; await fulfill(request.requestId, { reply: text, timestamp: '2026-11-11T12:00:00' }); };
  const launcher = 'button[aria-controls="cinebot-panel"]';
  const submit = '#cinebot-panel button[type="submit"]';
  const answerCount = 'document.querySelectorAll("#cinebot-panel article[aria-label=CineBot]").length';

  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin + '/cinemas' });
  await wait('Boolean(document.querySelector("#cinebot-panel"))');
  await click(launcher); await delay(250);
  assert.equal(await evaluate(`document.querySelector('${submit}').disabled`), true);
  await type('  \n '); await enter(); assert.equal(requests.length, 0);
  await click('#cinebot-panel li:first-child button');
  assert.equal(await evaluate('document.activeElement.id'), 'cinebot-message');
  assert.ok((await evaluate('document.querySelector("#cinebot-message").value')).length > 10);
  console.log('PASS: empty/whitespace blocked, suggested question fills input.');

  const firstQuestion = 'What movies are showing?';
  await type(`  ${firstQuestion}  `);
  await evaluate('const form = document.querySelector("#cinebot-message").form; form.requestSubmit(); form.requestSubmit();');
  await waitRequest(1);
  assert.deepEqual(requests[0], { method: 'POST', message: firstQuestion, conversationHistory: [] });
  await wait('Boolean(document.querySelector("#cinebot-panel [role=status]"))');
  assert.equal(await evaluate(`document.querySelector('${submit}').disabled && document.querySelector('#cinebot-message').readOnly`), true);
  assert.equal(await evaluate('document.querySelector("#cinebot-panel article[aria-label=Bạn]").textContent.trim()'), firstQuestion);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await wait('document.querySelector("#cinebot-panel").getAttribute("aria-hidden") === "true"');
  const firstReply = '## Movie suggestions\n\n**Movie A**\n\n- 20:30\n- 22:00\n\n[Details](/movies/1) [Unsafe](javascript:alert(1))\n\n<img src=x onerror="window.injected=true">\n\n<script>window.injected=true</script>';
  await reply(firstReply); await wait(`${answerCount} === 1`);
  assert.equal(await evaluate('document.activeElement.getAttribute("aria-controls")'), 'cinebot-panel');
  await click(launcher); await delay(250);
  await wait('Boolean(document.querySelector("#cinebot-panel article strong"))');
  assert.equal(await evaluate('Boolean(document.querySelector("#cinebot-panel [role=status]"))'), false);
  assert.equal(await evaluate('document.querySelectorAll("#cinebot-panel article li").length'), 2);
  assert.equal(await evaluate('document.querySelectorAll("#cinebot-panel article img, #cinebot-panel article script, #cinebot-panel article a[href^=javascript]").length'), 0);
  assert.equal(await evaluate('Boolean(window.injected)'), false);
  console.log('PASS: one POST despite duplicate submit, pending indicator, close during request, reply retained, safe Markdown.');

  await type('Next'); await enter(true);
  await send('Input.insertText', { text: 'line' });
  assert.equal(requests.length, 1);
  const secondQuestion = await evaluate('document.querySelector("#cinebot-message").value');
  assert.equal(secondQuestion, 'Next\nline');
  assert.equal(await evaluate('document.querySelector("#cinebot-message").dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", isComposing:true, bubbles:true, cancelable:true}))'), true);
  assert.equal(requests.length, 1);
  await enter(); await waitRequest(2);
  assert.deepEqual(requests[1].conversationHistory, [{ role: 'user', text: firstQuestion }, { role: 'model', text: firstReply }]);
  assert.equal(requests[1].message, secondQuestion);
  const secondReply = '| Cinema | Price |\n| --- | --- |\n| Cinema A | 80000 VND |\n\n' + Array.from({ length: 14 }, (_, i) => `- Showtime ${i + 1}: 20:30`).join('\n') + '\n\n' + 'a'.repeat(220);
  await reply(secondReply); await wait(`${answerCount} === 2`);
  await wait('Boolean(document.querySelector("#cinebot-panel table"))');
  await wait('(() => { const box = document.querySelector("#cinebot-panel [role=log]").parentElement; return box.scrollHeight-box.clientHeight-box.scrollTop < 3; })()');
  console.log('PASS: Shift+Enter newline, IME Enter ignored, Enter submits, exact user/model history, table and latest-answer scroll.');

  mode = 'error'; await type('Failed question'); await click(submit); await waitRequest(3);
  await wait('Boolean(document.querySelector("#cinebot-panel [role=alert]"))');
  assert.equal(await evaluate('document.querySelector("#cinebot-message").value'), 'Failed question');
  assert.equal(await evaluate('document.querySelector("#cinebot-panel [role=status]") === null'), true);
  assert.equal(await evaluate('document.querySelectorAll("#cinebot-panel article").length'), 4);
  mode = 'hold'; await enter(); await waitRequest(4);
  assert.equal(requests[3].conversationHistory.length, 4);
  assert.equal(requests[3].conversationHistory.some(message => message.text === 'Failed question'), false);
  await reply('Recovered'); await wait(`${answerCount} === 3`);
  mode = 'empty'; await type('Invalid reply'); await enter(); await waitRequest(5);
  await wait('Boolean(document.querySelector("#cinebot-panel [role=alert]"))');
  assert.equal(await evaluate('document.querySelector("#cinebot-message").value'), 'Invalid reply');
  assert.equal(await evaluate('document.querySelector("#cinebot-message").readOnly'), false);
  console.log('PASS: HTTP error and invalid reply release pending state and restore draft; failed turn excluded from history.');

  for (const [width, height] of [[390,844],[360,640]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true }); await delay(250);
    const layout = await evaluate(`(() => { const panel = document.querySelector('#cinebot-panel'); const box = panel.getBoundingClientRect(); const button = panel.querySelector('button[type=submit]').getBoundingClientRect(); return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,inputBottom:document.querySelector('#cinebot-message').getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth,inside:[...panel.querySelectorAll('article')].every(item=>item.getBoundingClientRect().right<=box.right),target:button.width>=44&&button.height>=44}; })()`);
    assert.ok(layout.left >= 0 && layout.right <= width && layout.top >= 0 && layout.bottom <= height, JSON.stringify(layout));
    assert.ok(!layout.overflow && layout.inside && layout.inputBottom < layout.bottom && layout.target);
  }
  await writeFile(path.join(artifacts, 'cinebot-mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64'));
  await evaluate(`history.pushState({}, '', '/checkout/TEST'); window.dispatchEvent(new PopStateEvent('popstate'));`);
  await delay(300); assert.equal(await evaluate(answerCount), 3);
  assert.ok(await evaluate('document.querySelector("button[aria-controls=cinebot-panel]").getBoundingClientRect().bottom < innerHeight - 80'));
  console.log('PASS: mobile 360/390px, long replies stay within widget; checkout keeps history and raised launcher.');

  mode = 'hold'; await type('Abort on unmount'); await enter(); await waitRequest(6);
  const requestNetworkId = held.networkId;
  await evaluate(`history.pushState({}, '', '/unmatched-chatbot-check'); window.dispatchEvent(new PopStateEvent('popstate'));`);
  await wait('document.querySelector("#cinebot-panel") === null');
  for (let attempt = 0; attempt < 50 && !canceled.includes(requestNetworkId); attempt++) await delay(70);
  assert.ok(canceled.includes(requestNetworkId), 'Unmount aborts pending chat request');
  assert.deepEqual(exceptions, []);
  console.log(`PASS: unmount cancels request; no runtime exceptions. Screenshot: ${path.join(artifacts, 'cinebot-mobile.png')}`);
} finally {
  socket?.close(); edge?.kill();
  for (const entry of pending.values()) clearTimeout(entry.timeout);
  if (server) { server.httpServer.closeAllConnections(); await new Promise(resolve => server.httpServer.close(resolve)); }
}
