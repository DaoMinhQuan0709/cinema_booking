import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { preview } from 'vite';

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.sequence = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const entry = this.pending.get(message.id); if (!entry) return;
        this.pending.delete(message.id);
        message.error ? entry.reject(new Error(JSON.stringify(message.error))) : entry.resolve(message.result);
      } else this.handlers.get(message.method)?.forEach(callback => callback(message.params));
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
  async click(text, scope = 'main') {
    assert.equal(await this.evaluate(`(() => {
      const button = [...document.querySelectorAll(${JSON.stringify(scope + ' button')})].find(b => b.textContent.trim() === ${JSON.stringify(text)} && b.offsetWidth && !b.disabled);
      if (!button) return false; button.focus(); button.click(); return true;
    })()`), true, `Visible enabled button: ${text}`);
  }
  async key(key, modifiers = 0) {
    const windowsVirtualKeyCode = { Tab: 9, Enter: 13, Escape: 27 }[key];
    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key, modifiers, windowsVirtualKeyCode });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers, windowsVirtualKeyCode });
  }
}

export async function startEdgeBrowser({ root, port, debugPort, artifacts, executable }) {
  let server, edge, socket;
  const close = async () => {
    if (socket?.readyState === WebSocket.OPEN) socket.close();
    edge?.kill();
    await server?.close();
  };
  try {
    server = await preview({ root, configFile: path.join(root, 'vite.config.js'), preview: { host: '127.0.0.1', port, strictPort: true } });
    edge = spawn(executable || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
      '--headless=new', '--disable-gpu', '--no-first-run', '--disable-extensions', '--disable-background-networking',
      `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.join(artifacts, 'profile')}`, 'about:blank',
    ], { windowsHide: true, stdio: 'ignore' });
    let launchError, page;
    edge.on('error', error => { launchError = error; });
    for (let attempt = 0; attempt < 80; attempt++) {
      try { page = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page'); } catch { /* Edge starting. */ }
      if (page || launchError) break; await delay(100);
    }
    assert.ok(page, launchError?.message || 'Edge must start');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
    const cdp = new CDP(socket);
    await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
    return { cdp, close };
  } catch (error) { await close(); throw error; }
}
