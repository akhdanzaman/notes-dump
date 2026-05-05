import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'ndz-014-screenshots');
await mkdir(outDir, { recursive: true });

const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4174';
const userDataDir = '/tmp/ndz014-chrome-profile';
await rm(userDataDir, { recursive: true, force: true });

const port = 9228;
const chrome = spawn('/usr/bin/google-chrome', [
  '--headless=new',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

chrome.stderr.on('data', d => {
  const text = d.toString();
  if (!text.includes('DevTools listening')) process.stderr.write(text);
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitJson(url, attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch {}
    await wait(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.waiters = [];
    this.ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result || {});
      } else if (msg.method) {
        this.events.push(msg);
        const waiter = this.waiters.find(w => w.method === msg.method && (!w.predicate || w.predicate(msg.params)));
        if (waiter) {
          this.waiters = this.waiters.filter(w => w !== waiter);
          waiter.resolve(msg.params);
        }
      }
    };
  }
  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  close() { this.ws.close(); }
}

const now = new Date('2026-05-05T05:00:00.000Z');
const iso = d => d.toISOString();
const today = '2026-05-05';
const tomorrow = '2026-05-06';
const item = (id, type, content, status, dayOffset, meta = {}) => ({
  id,
  type,
  content,
  status,
  created_at: iso(new Date(now.getTime() + dayOffset * 86400000)),
  completed_at: status === 'done' ? iso(new Date(now.getTime() + dayOffset * 86400000 + 3600000)) : undefined,
  meta,
});
const db = {
  data: [
    item('t1', 'TODO', 'Lock mobile bottom stack regression guard', 'pending', 0, { date: today, priority: 'high' }),
    item('t2', 'TODO', 'Verify mobile tab switching still feels native', 'pending', 0, { date: today, priority: 'normal' }),
    item('t3', 'TODO', 'Check menu flow under 1024px', 'pending', tomorrow === today ? 0 : 1, { date: tomorrow, priority: 'normal' }),
    item('f1', 'FINANCE', 'Client payment', 'done', -1, { financeType: 'income', amount: 9500000, paymentMethod: 'bank-main', budgetCategory: 'income', date: '2026-05-04' }),
    item('n1', 'NOTE', 'Mobile baseline must keep bottom nav and composer primary.', 'done', -1),
  ],
  budgetConfig: { monthlyIncome: 9500000, rules: [
    { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
    { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
    { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
  ]},
  wallets: [
    { id: 'bank-main', name: 'Main Bank', type: 'bank', initialBalance: 14000000, color: 'bg-blue-500' },
    { id: 'cash', name: 'Cash', type: 'cash', initialBalance: 550000, color: 'bg-emerald-500' },
  ],
  skills: [],
  monthlyThemes: { '2026-05': 'Protect the mobile muscle memory' },
  appSettings: { defaultCollapsed: false, hideMoney: false, theme: 'dark', enableDailyInsight: false, enableDraftReview: true, parsingModel: 'gemini-2.5-flash', chatModel: 'gemini-2.5-flash', insightModel: 'gemini-2.5-flash' },
  chatHistory: [],
  canonicalRules: [],
};

const seedScript = `(() => {
  localStorage.setItem('braindump_onboarding_completed', 'true');
  localStorage.setItem('braindump_feature_tutorials_disabled', 'true');
  localStorage.setItem('braindump_seen_feature_tutorials_v1', JSON.stringify(['summary','plan','library','money','calendar']));
  localStorage.setItem('braindump_seen_changelog_version', 'v0.3.33');
  localStorage.removeItem('braindump_spreadsheet_config');
  localStorage.setItem('braindump_spreadsheet_cache', ${JSON.stringify(JSON.stringify(db))});
  localStorage.setItem('braindump_ai_insights', JSON.stringify([]));
  localStorage.setItem('braindump_ai_insights_version', 'v2');
  localStorage.setItem('braindump_ai_insights_date', '${today}');
})();`;

async function createPage() {
  const version = await waitJson(`http://127.0.0.1:${port}/json/version`);
  const browser = new CDP(version.webSocketDebuggerUrl);
  await browser.open();
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const list = await waitJson(`http://127.0.0.1:${port}/json/list`);
  const target = list.find(t => t.id === targetId);
  const page = new CDP(target.webSocketDebuggerUrl);
  await page.open();
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript });
  return { browser, page };
}

async function waitForAppShell(page, attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    const res = await page.send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('[data-global-composer]') && document.querySelector('main'))`,
      returnByValue: true,
    });
    if (res.result?.value) return;
    await wait(150);
  }
  throw new Error('Timed out waiting for app shell');
}

async function navigate(page, width, height, mobile = false) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
  await page.send('Page.navigate', { url: previewUrl });
  await wait(1500);
  await waitForAppShell(page);
  await wait(600);
}

async function clickSelector(page, selector) {
  const res = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return { clicked: false };
      el.click();
      return { clicked: true, text: (el.innerText || el.textContent || '').trim() };
    })()`,
    returnByValue: true,
  });
  await wait(700);
  return res.result.value;
}

async function screenshot(page, name) {
  const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  await writeFile(path.join(outDir, `${name}.png`), Buffer.from(shot.data, 'base64'));
}

async function collectMetrics(page, label) {
  const res = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const rail = document.querySelector('[data-desktop-rail="true"]');
      const bottomNav = document.querySelector('[data-mobile-bottom-nav="true"]');
      const composer = document.querySelector('[data-global-composer="true"]');
      const composerSurface = document.querySelector('[data-composer-surface="true"]');
      const menuButton = document.querySelector('[data-mobile-nav-menu="true"]');
      const controlCenter = document.querySelector('[data-control-center-panel="true"]');
      const activeNav = document.querySelector('[data-mobile-nav-tab][data-active="true"]');
      const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
      const composerRect = composerSurface?.getBoundingClientRect();
      return {
        label: ${JSON.stringify(label)},
        viewport: { width: window.innerWidth, height: window.innerHeight },
        railVisible: visible(rail),
        bottomNavVisible: visible(bottomNav),
        composerVisible: visible(composer),
        menuVisible: visible(menuButton),
        controlCenterVisible: visible(controlCenter),
        activeNavTab: activeNav?.getAttribute('data-mobile-nav-tab') || null,
        activeNavLabel: (activeNav?.innerText || activeNav?.textContent || '').trim() || null,
        composerBottomGap: composerRect ? Number((window.innerHeight - composerRect.bottom).toFixed(1)) : null,
      };
    })()`,
    returnByValue: true,
  });
  return res.result.value;
}

const { browser, page } = await createPage();
const metrics = [];

try {
  for (const vp of [
    { width: 390, height: 844, mobile: true, label: 'summary-390x844' },
    { width: 820, height: 1180, mobile: true, label: 'summary-820x1180' },
    { width: 1023, height: 900, mobile: false, label: 'summary-1023x900' },
    { width: 1024, height: 900, mobile: false, label: 'summary-1024x900' },
  ]) {
    await navigate(page, vp.width, vp.height, vp.mobile);
    await screenshot(page, vp.label);
    metrics.push(await collectMetrics(page, vp.label));
  }

  await navigate(page, 390, 844, true);
  await clickSelector(page, '[data-mobile-nav-tab="money"]');
  await screenshot(page, 'money-390x844');
  metrics.push(await collectMetrics(page, 'money-390x844'));

  await clickSelector(page, '[data-mobile-nav-menu="true"]');
  await screenshot(page, 'menu-390x844');
  metrics.push(await collectMetrics(page, 'menu-390x844'));

  await writeFile(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
} finally {
  page.close();
  browser.close();
  chrome.kill('SIGKILL');
}
