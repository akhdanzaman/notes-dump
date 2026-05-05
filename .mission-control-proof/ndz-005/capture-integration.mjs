import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const outDir = '.mission-control-proof/ndz-005/viewports';
const appUrl = process.env.NDZ_APP_URL || 'http://127.0.0.1:3000/';
await mkdir(outDir, { recursive: true });

const port = 9710 + Math.floor(Math.random() * 500);
const userDataDir = `/tmp/ndz-005-chrome-${process.pid}`;
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
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

const inspectExpression = `(() => {
  const visible = (node) => {
    if (!node) return false;
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };
  const text = document.body.innerText || '';
  const desktopRail = [...document.querySelectorAll('aside')].find((node) => node.textContent?.includes('My Assistant'));
  const bottomNav = document.querySelector('[aria-label="Mobile bottom navigation"]');
  const input = document.querySelector('textarea, input[placeholder*="Dump"], input[placeholder*="Add"], textarea[placeholder]');
  const controlCenterSidebar = document.querySelector('aside[aria-label="Control Center sections"]');
  const controlCenterPanel = controlCenterSidebar?.closest('[class*="fixed"]') || [...document.querySelectorAll('div')].find((node) => {
    const nodeText = node.innerText || '';
    const rect = node.getBoundingClientRect();
    return rect.height > innerHeight * 0.45 && (nodeText.includes('SYSTEM STATUS') || nodeText.includes('SPREADSHEET CONNECTION') || nodeText.includes('Danger Zone'));
  });
  const panelRect = controlCenterPanel?.getBoundingClientRect();
  const main = document.querySelector('main');
  const mainRect = main?.getBoundingClientRect();
  return {
    url: location.href,
    title: document.title,
    width: innerWidth,
    height: innerHeight,
    textSample: text.slice(0, 800),
    desktopRailVisible: visible(desktopRail),
    bottomNavVisible: visible(bottomNav) && visible(bottomNav.parentElement),
    inputVisible: visible(input),
    controlCenterOpen: !!controlCenterPanel,
    controlCenterSidebarVisible: visible(controlCenterSidebar),
    controlCenterHasDangerZone: text.includes('Danger Zone'),
    controlCenterHasSpreadsheetCopy: text.includes('SPREADSHEET CONNECTION') || text.includes('Share your spreadsheet with'),
    controlCenterLeft: panelRect ? Math.round(panelRect.left) : null,
    controlCenterTop: panelRect ? Math.round(panelRect.top) : null,
    controlCenterBottomGap: panelRect ? Math.round(innerHeight - panelRect.bottom) : null,
    mainLeft: mainRect ? Math.round(mainRect.left) : null,
    mainWidth: mainRect ? Math.round(mainRect.width) : null,
    hasHome: text.includes('Home') || text.includes('Dashboard') || text.includes('DASHBOARD'),
    hasPlan: text.includes('Focus') || text.includes('Shopping') || text.includes('Goals'),
    hasLibrary: text.includes('Notes') || text.includes('Library') || text.includes('Journal'),
    hasMoney: text.includes('Money') || text.includes('Wallet') || text.includes('Budget'),
    hasCalendar: text.includes('Calendar'),
  };
})()`;

async function clickByText(cdp, includesText) {
  return evaluate(cdp, `(() => {
    const isVisible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const button = [...document.querySelectorAll('button')].find((node) => isVisible(node) && (node.innerText || '').includes(${JSON.stringify(includesText)}));
    if (!button) return false;
    button.click();
    return true;
  })()`);
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
      localStorage.setItem('braindump_seen_changelog_version', 'v0.3.31');
      localStorage.setItem('braindump_feature_tutorials_disabled', 'true');
      localStorage.setItem('braindump_has_seen_onboarding', 'true');
    `,
  });
  await cdp.send('Page.navigate', { url: appUrl });

  let initial;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await sleep(200);
    initial = await evaluate(cdp, inspectExpression);
    if (initial.hasHome || initial.desktopRailVisible || initial.bottomNavVisible) break;
  }

  const tabClicks = {};
  for (const label of ['Money', 'Calendar']) {
    tabClicks[label] = await clickByText(cdp, label);
    await sleep(250);
  }

  const openedMenu = width >= 1024 ? await clickByText(cdp, 'Control Center') : await evaluate(cdp, `(() => {
    const nav = document.querySelector('[aria-label="Mobile bottom navigation"]');
    const buttons = nav ? [...nav.querySelectorAll('button')] : [];
    const menu = buttons[buttons.length - 1];
    if (!menu) return false;
    menu.click();
    return true;
  })()`);
  await sleep(500);
  const opened = await evaluate(cdp, inspectExpression);

  const clickedConnect = await clickByText(cdp, 'Connect');
  await sleep(300);
  const connectState = await evaluate(cdp, inspectExpression);

  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(`${outDir}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
  cdp.close();
  return { name, width, height, initial, tabClicks, openedMenu, opened, clickedConnect, connect: connectState };
}

try {
  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const browserCdp = connect(version.webSocketDebuggerUrl);
  await browserCdp.opened;
  const viewports = [
    ['mobile-390x844', 390, 844],
    ['tablet-820x1180', 820, 1180],
    ['desktop-1440x900', 1440, 900],
    ['wide-1680x1050', 1680, 1050],
  ];
  const results = [];
  for (const viewport of viewports) results.push(await capture(browserCdp, ...viewport));
  browserCdp.close();
  await writeFile(`${outDir}/integration-proof.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  chrome.kill('SIGTERM');
}
