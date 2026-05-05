import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'ndz-015-screenshots');
await mkdir(outDir, { recursive: true });

const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4175';
const userDataDir = '/tmp/ndz015-chrome-profile';
await rm(userDataDir, { recursive: true, force: true });

const port = 9229;
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
  }
  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
      this.ws.onmessage = event => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(JSON.stringify(msg.error)));
          else resolve(msg.result || {});
        }
      };
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
    item('t1', 'TODO', 'Protect swipe and keyboard flows', 'pending', 0, { date: today, priority: 'high' }),
    item('t2', 'TODO', 'Keep mobile controls reachable under keyboard', 'pending', 0, { date: today, priority: 'normal' }),
    item('t3', 'TODO', 'Regression-check tab swipes across surfaces', 'pending', 1, { date: tomorrow, priority: 'normal' }),
    item('n1', 'NOTE', 'Summary and Money month swipes should keep working.', 'done', -1),
    item('f1', 'FINANCE', 'Client payment', 'done', -1, { financeType: 'income', amount: 9500000, paymentMethod: 'bank-main', budgetCategory: 'income', date: '2026-05-04' }),
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
  monthlyThemes: { '2026-05': 'Protect touch-first flows' },
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
  await page.send('Input.setIgnoreInputEvents', { ignore: false });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: seedScript });
  return { browser, page };
}

async function waitForAppShell(page, attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    const res = await page.send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('[data-global-composer]') && document.querySelector('[data-active-tab]'))`,
      returnByValue: true,
    });
    if (res.result?.value) return;
    await wait(150);
  }
  throw new Error('Timed out waiting for app shell');
}

async function navigate(page, width = 390, height = 844) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: height });
  await page.send('Page.navigate', { url: previewUrl });
  await wait(1800);
  await waitForAppShell(page);
  await wait(500);
}

async function evaluate(page, expression) {
  const res = await page.send('Runtime.evaluate', { expression, returnByValue: true });
  return res.result?.value;
}

async function getRect(page, selector) {
  return await evaluate(page, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  })()`);
}

async function swipe(page, selector, direction = 'left', yFactor = 0.5) {
  const rect = await getRect(page, selector);
  if (!rect) throw new Error(`Missing selector for swipe: ${selector}`);
  const y = rect.top + Math.min(Math.max(rect.height * yFactor, 40), rect.height - 18);
  const startX = direction === 'left' ? rect.left + rect.width * 0.82 : rect.left + rect.width * 0.18;
  const endX = direction === 'left' ? rect.left + rect.width * 0.18 : rect.left + rect.width * 0.82;
  await page.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: Math.round(startX), y: Math.round(y), radiusX: 4, radiusY: 4, force: 1, id: 1 }],
  });
  for (let i = 1; i <= 5; i++) {
    const x = startX + ((endX - startX) * i / 5);
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: Math.round(x), y: Math.round(y), radiusX: 4, radiusY: 4, force: 1, id: 1 }],
    });
    await wait(16);
  }
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(450);
}

async function tap(page, selector) {
  const clicked = await evaluate(page, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Missing selector for tap: ${selector}`);
  await wait(350);
}

async function screenshot(page, name) {
  const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  await writeFile(path.join(outDir, `${name}.png`), Buffer.from(shot.data, 'base64'));
}

async function collectState(page, label) {
  return await evaluate(page, `(() => {
    const root = document.querySelector('[data-active-tab]');
    const fixedBottom = document.querySelector('[data-keyboard-open]');
    const bottomNav = document.querySelector('[data-mobile-bottom-nav="true"]');
    const composer = document.querySelector('[data-composer-surface="true"]');
    const themeMonth = document.querySelector('[data-theme-month-label="true"]');
    const moneyMonth = document.querySelector('[data-money-month-label="true"]');
    const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
    return {
      label: ${JSON.stringify(label)},
      activeTab: root?.getAttribute('data-active-tab') || null,
      planSubTab: root?.getAttribute('data-plan-subtab') || null,
      librarySubTab: root?.getAttribute('data-library-subtab') || null,
      moneyView: root?.getAttribute('data-money-view') || null,
      keyboardOpen: fixedBottom?.getAttribute('data-keyboard-open') || null,
      fixedBottomTransform: fixedBottom ? getComputedStyle(fixedBottom).transform : null,
      bottomNavVisible: visible(bottomNav),
      composerVisible: visible(composer),
      themeMonth: themeMonth ? (themeMonth.textContent || '').trim() : null,
      moneyMonth: moneyMonth ? (moneyMonth.textContent || '').trim() : null,
      libraryJournalMonth: (() => {
        const label = document.querySelector('[data-library-journal-month-label="true"]');
        return label ? (label.textContent || '').trim() : null;
      })(),
    };
  })()`);
}

async function patchVisualViewport(page, height, offsetTop = 0) {
  return await evaluate(page, `(() => {
    const vv = window.visualViewport;
    if (!vv) return { ok: false, reason: 'missing visualViewport' };
    try {
      if (!vv.__ndz015State) vv.__ndz015State = { height: vv.height, offsetTop: vv.offsetTop };
      vv.__ndz015State.height = ${height};
      vv.__ndz015State.offsetTop = ${offsetTop};
      Object.defineProperty(vv, 'height', { configurable: true, get() { return vv.__ndz015State.height; } });
      Object.defineProperty(vv, 'offsetTop', { configurable: true, get() { return vv.__ndz015State.offsetTop; } });
      vv.dispatchEvent(new Event('resize'));
      vv.dispatchEvent(new Event('scroll'));
      return { ok: true, height: vv.height, offsetTop: vv.offsetTop };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  })()`);
}

const { browser, page } = await createPage();
const metrics = [];

try {
  await navigate(page);
  metrics.push(await collectState(page, 'summary-initial'));
  await screenshot(page, 'summary-initial');

  await swipe(page, '[data-swipe-date="summary-theme-month"]', 'left', 0.5);
  metrics.push(await collectState(page, 'summary-theme-swipe-next'));
  await screenshot(page, 'summary-theme-swipe-next');

  await swipe(page, '[data-swipe-tabs="summary"]', 'left', 0.16);
  metrics.push(await collectState(page, 'plan-after-summary-swipe'));

  await tap(page, '[data-plan-subtabs="true"] button:nth-child(2)');
  metrics.push(await collectState(page, 'plan-shopping-subtab-touch'));

  await tap(page, '[data-plan-subtabs="true"] button:nth-child(1)');
  metrics.push(await collectState(page, 'plan-tasks-subtab-touch'));

  await swipe(page, '[data-swipe-tabs="plan"]', 'left', 0.5);
  metrics.push(await collectState(page, 'library-after-plan-swipe'));

  await tap(page, '[data-library-subtabs="true"] button:nth-child(3)');
  metrics.push(await collectState(page, 'library-journal-subtab-touch'));

  await swipe(page, '[data-swipe-date="library-journal-month"]', 'left', 0.5);
  metrics.push(await collectState(page, 'library-journal-month-swipe-next'));

  await swipe(page, '[data-swipe-tabs="library"]', 'left', 0.16);
  metrics.push(await collectState(page, 'money-after-library-swipe'));
  await screenshot(page, 'money-after-library-swipe');

  await swipe(page, '[data-swipe-date="money-month"]', 'left', 0.5);
  metrics.push(await collectState(page, 'money-month-swipe-next'));
  await screenshot(page, 'money-month-swipe-next');

  await swipe(page, '[data-swipe-tabs="money"]', 'left', 0.12);
  metrics.push(await collectState(page, 'calendar-after-money-swipe'));

  await swipe(page, '[data-swipe-tabs="calendar"]', 'right', 0.16);
  metrics.push(await collectState(page, 'money-after-calendar-swipe-back'));

  await tap(page, 'textarea');
  const keyboardPatch = await patchVisualViewport(page, 520, 0);
  await wait(300);
  metrics.push({ label: 'keyboard-patch', patch: keyboardPatch, ...(await collectState(page, 'keyboard-patch')) });
  await screenshot(page, 'keyboard-open');

  await patchVisualViewport(page, 844, 0);
  await wait(300);
  metrics.push(await collectState(page, 'keyboard-reset'));

  await writeFile(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
} finally {
  page.close();
  browser.close();
  chrome.kill('SIGKILL');
}
