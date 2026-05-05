import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'ndz-011-screenshots');
await mkdir(outDir, { recursive: true });

const userDataDir = '/tmp/ndz011-chrome-profile';
await rm(userDataDir, { recursive: true, force: true });

const port = 9225;
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
  waitFor(method, predicate, timeout = 10000) {
    const existing = this.events.find(e => e.method === method && (!predicate || predicate(e.params)));
    if (existing) return Promise.resolve(existing.params);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(w => w.resolve !== resolve);
        reject(new Error(`Timeout waiting for ${method}`));
      }, timeout);
      this.waiters.push({ method, predicate, resolve: params => { clearTimeout(timer); resolve(params); } });
    });
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
    item('t1', 'TODO', 'Finalize NDZ-011 shell container mapping', 'pending', 0, { date: today, priority: 'high', tags: ['ndz','desktop'] }),
    item('t2', 'TODO', 'Capture wide desktop proof', 'pending', 0, { date: today, priority: 'normal', tags: ['qa'] }),
    item('t3', 'TODO', 'Compare task workspace density', 'pending', 1, { date: tomorrow, priority: 'normal' }),
    item('s1', 'SHOPPING', 'USB-C dock', 'pending', 0, { shoppingCategory: 'urgent', quantity: '1' }),
    item('s2', 'SHOPPING', 'Monitor arm', 'pending', 0, { shoppingCategory: 'saving', amount: 900000, savedAmount: 350000 }),
    item('f1', 'FINANCE', 'Client payment', 'done', -1, { financeType: 'income', amount: 9500000, paymentMethod: 'bank-main', budgetCategory: 'income', date: '2026-05-04' }),
    item('f2', 'FINANCE', 'Figma subscription', 'done', -1, { financeType: 'expense', amount: 225000, paymentMethod: 'cc-design', budgetCategory: 'wants', merchant: 'Figma', date: '2026-05-04' }),
    item('f3', 'FINANCE', 'Transfer to desk fund', 'done', 0, { financeType: 'saving', amount: 250000, paymentMethod: 'bank-main', date: today, savingGoalId: 's2' }),
    item('n1', 'NOTE', 'Desktop container should start near the rail edge.', 'done', -1, { tags: ['layout'] }),
    item('n2', 'NOTE', 'Library should use a wider rail-aware masonry shell.', 'done', -1, { tags: ['library'] }),
    item('j1', 'JOURNAL', 'Checked wide desktop spacing across surfaces.', 'done', 0, { date: today }),
  ],
  budgetConfig: { monthlyIncome: 9500000, rules: [
    { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
    { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
    { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
  ]},
  wallets: [
    { id: 'bank-main', name: 'Main Bank', type: 'bank', initialBalance: 14000000, color: 'bg-blue-500' },
    { id: 'cash', name: 'Cash', type: 'cash', initialBalance: 550000, color: 'bg-emerald-500' },
    { id: 'cc-design', name: 'Design Card', type: 'cc', initialBalance: -450000, color: 'bg-pink-500' },
  ],
  skills: [],
  monthlyThemes: { '2026-05': 'Use width with discipline' },
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
      expression: `Boolean(document.querySelector('main > div[data-shell-variant]') && document.querySelector('aside.fixed'))`,
      returnByValue: true,
    });
    if (res.result?.value) return;
    await wait(150);
  }
  const debug = await page.send('Runtime.evaluate', {
    expression: `({
      readyState: document.readyState,
      text: document.body.innerText.slice(0, 600),
      html: document.body.innerHTML.slice(0, 600)
    })`,
    returnByValue: true,
  });
  throw new Error(`Timed out waiting for app shell: ${JSON.stringify(debug.result?.value)}`);
}

async function navigate(page, width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const loadP = page.waitFor('Page.loadEventFired', null, 12000).catch(() => null);
  await page.send('Page.navigate', { url: 'http://127.0.0.1:4174' });
  await loadP;
  await waitForAppShell(page);
  await wait(700);
}

async function clickText(page, text) {
  const expr = `(() => {
    const wanted = ${JSON.stringify(text)};
    const nodes = [...document.querySelectorAll('button, [role="button"], a')];
    const exact = nodes.find(n => (n.innerText || n.textContent || '').trim() === wanted);
    const el = exact || nodes.find(n => (n.innerText || n.textContent || '').trim().includes(wanted));
    if (!el) return { clicked: false, wanted, available: nodes.slice(0, 50).map(n => (n.innerText || n.textContent || '').trim()).filter(Boolean) };
    el.click();
    return { clicked: true, label: (el.innerText || el.textContent || '').trim() };
  })()`;
  const res = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  await wait(900);
  return res.result.value;
}

async function screenshot(page, name) {
  const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  const file = path.join(outDir, `${name}.png`);
  await writeFile(file, Buffer.from(shot.data, 'base64'));
}

async function collectMetrics(page, label, width, height) {
  const res = await page.send('Runtime.evaluate', {
    expression: `(() => {
      const rail = document.querySelector('aside.fixed');
      const content = document.querySelector('main > div[data-shell-variant]');
      const main = document.querySelector('main');
      const railRect = rail?.getBoundingClientRect();
      const contentRect = content?.getBoundingClientRect();
      const mainRect = main?.getBoundingClientRect();
      return {
        label: ${JSON.stringify(label)},
        viewport: { width: window.innerWidth, height: window.innerHeight },
        variant: content?.getAttribute('data-shell-variant') || null,
        railRight: railRect ? Number(railRect.right.toFixed(1)) : null,
        contentLeft: contentRect ? Number(contentRect.left.toFixed(1)) : null,
        contentWidth: contentRect ? Number(contentRect.width.toFixed(1)) : null,
        mainWidth: mainRect ? Number(mainRect.width.toFixed(1)) : null,
      };
    })()`,
    returnByValue: true,
  });
  return res.result.value;
}

const { browser, page } = await createPage();
const metrics = [];

try {
  for (const width of [1280, 1440, 1680, 1920]) {
    await navigate(page, width, 900);
    await screenshot(page, `summary-${width}x900`);
    metrics.push(await collectMetrics(page, `summary-${width}x900`, width, 900));
  }

  await navigate(page, 1680, 900);
  await clickText(page, 'Focus');
  await screenshot(page, 'plan-focus-1680x900');
  metrics.push(await collectMetrics(page, 'plan-focus-1680x900', 1680, 900));

  await clickText(page, 'Notes');
  await screenshot(page, 'library-notes-1680x900');
  metrics.push(await collectMetrics(page, 'library-notes-1680x900', 1680, 900));

  await clickText(page, 'Money');
  await screenshot(page, 'money-transactions-1680x900');
  metrics.push(await collectMetrics(page, 'money-transactions-1680x900', 1680, 900));

  await clickText(page, 'Budget');
  await screenshot(page, 'money-budget-1680x900');
  metrics.push(await collectMetrics(page, 'money-budget-1680x900', 1680, 900));

  await writeFile(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
} finally {
  page.close();
  browser.close();
  chrome.kill('SIGKILL');
}
