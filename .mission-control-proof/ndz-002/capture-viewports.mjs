import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const outDir = '.mission-control-proof/ndz-002';
const appUrl = process.env.NDZ_APP_URL || 'http://127.0.0.1:3181/';
await mkdir(outDir, { recursive: true });

const port = 9223 + Math.floor(Math.random() * 1000);
const userDataDir = `/tmp/ndz-002-chrome-${process.pid}`;
const chrome = spawn('google-chrome', [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(url, timeoutMs = 10000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();

  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result || {});
    }
  });

  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  return {
    opened,
    send(method, params = {}) {
      const callId = ++id;
      ws.send(JSON.stringify({ id: callId, method, params }));
      return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
    },
    close() { ws.close(); },
  };
}

async function capture(browserCdp, name, width, height) {
  const created = await browserCdp.send('Target.createTarget', { url: 'about:blank' });
  const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
  const target = targets.find((entry) => entry.id === created.targetId);
  if (!target?.webSocketDebuggerUrl) throw new Error(`Target ${created.targetId} did not expose a websocket URL`);
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.opened;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      localStorage.setItem('braindump_onboarding_completed', 'true');
      localStorage.setItem('braindump_seen_changelog_version', 'v0.3.30');
      localStorage.setItem('braindump_feature_tutorials_disabled', 'true');
    `,
  });
  await cdp.send('Page.navigate', { url: appUrl });
  let invariant;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(250);
    invariant = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const aside = document.querySelector('aside');
        const bottomNavNode = document.querySelector('[aria-label="Mobile bottom navigation"]');
        const railVisible = !!aside && getComputedStyle(aside).display !== 'none';
        const bottomNavVisible = !!bottomNavNode && getComputedStyle(bottomNavNode).display !== 'none' && getComputedStyle(bottomNavNode.parentElement || bottomNavNode).display !== 'none';
        const inputVisible = [...document.querySelectorAll('textarea')].some((node) => node.placeholder?.includes('Dump your brain'));
        return { title: document.title, width: innerWidth, railVisible, bottomNavVisible, inputVisible, bodyText: document.body.innerText.slice(0, 300) };
      })()`,
    });
    const value = invariant.result.value;
    const hasShellContent = value.bodyText.includes('DASHBOARD') || value.bodyText.includes('MY ASSISTANT');
    if (value.inputVisible && hasShellContent) break;
  }
  if (!invariant) throw new Error(`No viewport invariant collected for ${name}`);
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${outDir}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
  cdp.close();
  return { name, ...invariant.result.value };
}

try {
  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const browserCdp = connect(version.webSocketDebuggerUrl);
  await browserCdp.opened;
  const results = [];
  results.push(await capture(browserCdp, 'mobile', 390, 844));
  results.push(await capture(browserCdp, 'tablet', 820, 1180));
  results.push(await capture(browserCdp, 'desktop', 1440, 900));
  browserCdp.close();
  await writeFile(`${outDir}/viewport-proof.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  chrome.kill('SIGTERM');
}
