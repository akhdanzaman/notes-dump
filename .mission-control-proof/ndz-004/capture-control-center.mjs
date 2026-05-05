import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const outDir = '.mission-control-proof/ndz-004/viewports';
const appUrl = process.env.NDZ_APP_URL || 'http://127.0.0.1:3000/';
await mkdir(outDir, { recursive: true });

const port = 9323 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/ndz-004-chrome-${process.pid}`;
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

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { returnByValue: true, expression });
  return result.result.value;
}

const invariantExpression = `(() => {
  const visible = (node) => !!node && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden';
  const desktopRail = [...document.querySelectorAll('aside')].find((node) => node.textContent?.includes('My Assistant'));
  const bottomNavNode = document.querySelector('[aria-label="Mobile bottom navigation"]');
  const ccSidebar = document.querySelector('aside[aria-label="Control Center sections"]');
  const panelCandidates = [...document.querySelectorAll('div')].filter((node) => {
    const text = node.innerText || '';
    return text.includes('SYSTEM STATUS') || text.includes('GOOGLE ACCOUNT') || text.includes('SPREADSHEET CONNECTION');
  });
  const panel = ccSidebar?.closest('[class*="fixed"]') || panelCandidates.find((node) => {
    const rect = node.getBoundingClientRect();
    return rect.height > innerHeight * 0.45 && rect.width > Math.min(300, innerWidth * 0.7);
  });
  const ccHandle = panel?.querySelector('[class*="lg:hidden"]');
  const rect = panel?.getBoundingClientRect();
  return {
    title: document.title,
    width: innerWidth,
    height: innerHeight,
    desktopRailVisible: visible(desktopRail),
    bottomNavVisible: visible(bottomNavNode) && visible(bottomNavNode.parentElement),
    controlCenterOpen: !!panel,
    controlCenterSidebarVisible: visible(ccSidebar),
    controlCenterHandleVisible: visible(ccHandle),
    controlCenterLeft: rect ? Math.round(rect.left) : null,
    controlCenterTop: rect ? Math.round(rect.top) : null,
    controlCenterBottom: rect ? Math.round(innerHeight - rect.bottom) : null,
    hasServiceAccountCopy: document.body.innerText.includes('Share your spreadsheet with') && document.body.innerText.includes('Google sign-in is only a fallback'),
    hasOptionalGoogleCopy: document.body.innerText.includes('Google sign-in is optional'),
    hasDangerZone: document.body.innerText.includes('Danger Zone'),
    bodyText: document.body.innerText.slice(0, 500),
  };
})()`;

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
      localStorage.setItem('braindump_has_seen_onboarding', 'true');
    `,
  });
  await cdp.send('Page.navigate', { url: appUrl });

  let initial;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(250);
    initial = await evaluate(cdp, invariantExpression);
    if (initial.bodyText.includes('DASHBOARD') || initial.bodyText.includes('MY ASSISTANT')) break;
  }

  await evaluate(cdp, `(() => {
    const desktopButton = [...document.querySelectorAll('button')].find((button) => button.innerText.includes('Control Center'));
    const mobileMenuButton = document.querySelector('[aria-label="Mobile bottom navigation"] button:last-child');
    (desktopButton || mobileMenuButton)?.click();
  })()`);
  await sleep(500);
  const opened = await evaluate(cdp, invariantExpression);

  await evaluate(cdp, `(() => {
    const connectButton = [...document.querySelectorAll('button')].find((button) => button.innerText.trim().startsWith('Connect'));
    connectButton?.click();
  })()`);
  await sleep(500);
  const connectTab = await evaluate(cdp, invariantExpression);

  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${outDir}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
  cdp.close();
  return { name, initial, opened, connect: connectTab };
}

try {
  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const browserCdp = connect(version.webSocketDebuggerUrl);
  await browserCdp.opened;
  const results = [];
  results.push(await capture(browserCdp, 'mobile-390x844', 390, 844));
  results.push(await capture(browserCdp, 'tablet-820x1180', 820, 1180));
  results.push(await capture(browserCdp, 'desktop-1440x900', 1440, 900));
  results.push(await capture(browserCdp, 'wide-1680x1050', 1680, 1050));
  browserCdp.close();
  await writeFile(`${outDir}/control-center-proof.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  chrome.kill('SIGTERM');
}
