import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'ndz-task-specs', 'artifacts');
await mkdir(outDir, { recursive: true });

const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4179';
const userDataDir = '/tmp/ndz019-chrome-profile';
await rm(userDataDir, { recursive: true, force: true });

const port = Number(process.env.NDZ019_CDP_PORT || 9233);
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
  if (text.includes('DevTools listening') || text.includes('DEPRECATED_ENDPOINT')) return;
  process.stderr.write(text);
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

const today = '2026-05-06';
const now = `${today}T02:00:00.000Z`;
const db = {
  data: [
    { id: 'finance-income', type: 'FINANCE', content: 'Client retainer income', status: 'done', created_at: now, completed_at: now, meta: { date: `${today}T09:00:00.000Z`, amount: 15000000, financeType: 'income', paymentMethod: 'wallet-bca', budgetCategory: 'income', tags: ['ndz'] } },
    { id: 'finance-rent', type: 'FINANCE', content: 'Studio rent', status: 'done', created_at: now, completed_at: now, meta: { date: `${today}T10:00:00.000Z`, amount: 3500000, financeType: 'expense', paymentMethod: 'wallet-bca', budgetCategory: 'needs', tags: ['fixed'] } },
    { id: 'finance-tools', type: 'FINANCE', content: 'Creative tools subscription', status: 'done', created_at: now, completed_at: now, meta: { date: `${today}T11:00:00.000Z`, amount: 850000, financeType: 'expense', paymentMethod: 'wallet-jago', budgetCategory: 'ops', tags: ['tools'] } },
    { id: 'finance-transfer', type: 'FINANCE', content: 'Move reserve to savings pocket', status: 'done', created_at: now, completed_at: now, meta: { date: `${today}T12:00:00.000Z`, amount: 2000000, financeType: 'transfer', paymentMethod: 'wallet-bca', toWallet: 'wallet-savings', budgetCategory: 'reserve', tags: ['reserve'] } },
    { id: 'finance-food', type: 'FINANCE', content: 'Team dinner', status: 'done', created_at: now, completed_at: now, meta: { date: `${today}T19:00:00.000Z`, amount: 420000, financeType: 'expense', paymentMethod: 'wallet-jago', budgetCategory: 'wants', tags: ['team'] } },
    { id: 'goal-camera', type: 'TODO', content: 'Camera upgrade fund', status: 'pending', created_at: now, meta: { amount: 12000000, savedAmount: 4000000, dedicatedWalletId: 'wallet-savings', tags: ['saving'] } },
  ],
  budgetConfig: {
    monthlyIncome: 15000000,
    rules: [
      { id: 'needs', name: 'Needs', percentage: 45, color: 'bg-emerald-500' },
      { id: 'ops', name: 'Ops', percentage: 20, color: 'bg-indigo-500' },
      { id: 'wants', name: 'Wants', percentage: 15, color: 'bg-amber-500' },
      { id: 'reserve', name: 'Reserve', percentage: 20, color: 'bg-blue-500' },
    ],
  },
  skills: [{ id: 'skill-1', name: 'General Learning', color: 'indigo-500', created_at: now }],
  wallets: [
    { id: 'wallet-bca', name: 'BCA Main', type: 'bank', initialBalance: 12000000, color: 'bg-blue-500' },
    { id: 'wallet-jago', name: 'Jago Ops', type: 'bank', initialBalance: 5000000, color: 'bg-amber-500' },
    { id: 'wallet-savings', name: 'Savings Pocket', type: 'ewallet', initialBalance: 3000000, color: 'bg-indigo-500' },
  ],
  monthlyThemes: { '2026-05': 'Make Money scan better on desktop' },
  appSettings: { defaultCollapsed: true, hideMoney: false, enableDailyInsight: false, enableDraftReview: false },
  chatHistory: [],
  canonicalRules: [],
};

const seedScript = `(() => {
  localStorage.clear();
  localStorage.setItem('braindump_onboarding_completed', 'true');
  localStorage.setItem('braindump_feature_tutorials_disabled', 'true');
  localStorage.setItem('braindump_seen_feature_tutorials_v1', JSON.stringify(['summary','plan','library','money','calendar']));
  localStorage.setItem('braindump_seen_changelog_version', 'v0.3.33');
  localStorage.removeItem('braindump_spreadsheet_config');
  localStorage.setItem('braindump_spreadsheet_cache', ${JSON.stringify(JSON.stringify(db))});
  localStorage.setItem('braindump_db', ${JSON.stringify(JSON.stringify(db))});
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

async function evaluate(page, expression) {
  const res = await page.send('Runtime.evaluate', { expression, returnByValue: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result?.value;
}

async function waitFor(page, expression, label, attempts = 90) {
  for (let i = 0; i < attempts; i++) {
    const ok = await evaluate(page, expression);
    if (ok) return;
    await wait(150);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function capture(width, height) {
  const { browser, page } = await createPage();
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height });
    await page.send('Page.navigate', { url: previewUrl });
    await wait(1800);
    await waitFor(page, `Boolean(document.querySelector('[data-active-tab="summary"]') && document.body.innerText.includes('Arkaiv'))`, 'seeded app');
    await evaluate(page, `Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Money'))?.click()`);
    await waitFor(page, `Boolean(document.querySelector('[data-active-tab]')?.getAttribute('data-active-tab') === 'money' && document.querySelector('[data-money-header-grid="true"]'))`, 'Money workspace');
    await evaluate(page, `Array.from(document.querySelectorAll('[data-money-tabs="true"] button')).find(b => b.textContent?.includes('Transactions'))?.click()`);
    await waitFor(page, `Boolean(document.querySelector('[data-money-workspace="transactions"]') && document.querySelector('[data-money-side-card="filters"]'))`, 'Money transaction split');
    await wait(350);

    const metrics = await evaluate(page, `(() => {
      const clean = r => r ? ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) }) : null;
      const visible = el => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
      const contentShell = document.querySelector('[data-shell-variant]');
      const headerGrid = document.querySelector('[data-money-header-grid="true"]');
      const metricGrid = document.querySelector('[data-money-metric-grid="true"]');
      const headerSide = document.querySelector('[data-money-header-side-card="true"]');
      const workspace = document.querySelector('[data-money-workspace="transactions"]');
      const primary = document.querySelector('[data-money-primary-column="true"]');
      const side = document.querySelector('[data-money-side-card="filters"]');
      const rail = document.querySelector('[data-desktop-rail="true"]');
      const postRailWidth = window.innerWidth - (rail?.getBoundingClientRect().width || 0) - 64;
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        activeTab: document.querySelector('[data-active-tab]')?.getAttribute('data-active-tab') || null,
        moneyView: document.querySelector('[data-money-view]')?.getAttribute('data-money-view') || null,
        shellVariant: contentShell?.getAttribute('data-shell-variant') || null,
        railVisible: visible(rail),
        postRailWidth: Math.round(postRailWidth),
        contentShell: clean(contentShell?.getBoundingClientRect()),
        headerGrid: clean(headerGrid?.getBoundingClientRect()),
        metricGrid: clean(metricGrid?.getBoundingClientRect()),
        headerSide: clean(headerSide?.getBoundingClientRect()),
        workspace: clean(workspace?.getBoundingClientRect()),
        primary: clean(primary?.getBoundingClientRect()),
        side: clean(side?.getBoundingClientRect()),
        workspaceClass: workspace ? String(workspace.className) : null,
        primaryClass: primary ? String(primary.className) : null,
        sideClass: side ? String(side.className) : null,
        headerGridClass: headerGrid ? String(headerGrid.className) : null,
        metricText: metricGrid ? metricGrid.innerText : null,
        filterText: side ? side.innerText : null,
      };
    })()`);
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
    await writeFile(path.join(outDir, `ndz-019-runtime-${width}.png`), Buffer.from(shot.data, 'base64'));
    await writeFile(path.join(outDir, `ndz-019-runtime-${width}.json`), JSON.stringify(metrics, null, 2));
    return metrics;
  } finally {
    page.close();
    browser.close();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertMetrics(metrics) {
  const width = metrics.viewport.width;
  assert(metrics.activeTab === 'money', `${width}: active tab is not Money`);
  assert(metrics.moneyView === 'transactions', `${width}: money view is not Transactions`);
  assert(metrics.shellVariant === 'workspace', `${width}: Money did not use workspace shell`);
  assert(metrics.railVisible === true, `${width}: desktop rail not visible`);
  assert(metrics.contentShell?.width > 1280, `${width}: content shell did not exceed old 80rem/1280px standard cap`);
  if (width >= 1900) assert(metrics.contentShell.width > 1440, `${width}: content shell did not exceed old 90rem/1440px wide cap`);
  assert(metrics.workspaceClass?.includes('lg:grid-cols-[minmax(0,1fr)_22rem]'), `${width}: Money workspace grid missing fixed 22rem side rail`);
  assert(metrics.headerGridClass?.includes('xl:grid-cols-[minmax(0,1fr)_24rem]'), `${width}: Money header grid missing fixed 24rem side rhythm`);
  assert(metrics.primary?.width >= 880, `${width}: primary transaction column is too narrow`);
  assert(metrics.side?.width >= 350 && metrics.side.width <= 410, `${width}: filter side card is not fixed-width/coherent`);
  assert(metrics.headerSide?.width >= 350 && metrics.headerSide.width <= 410, `${width}: header side card is not fixed-width/coherent`);
  const metricText = String(metrics.metricText || '').toLowerCase();
  const filterText = String(metrics.filterText || '').toLowerCase();
  assert(metricText.includes('income') && metricText.includes('expense') && metricText.includes('used'), `${width}: header stats are incomplete`);
  assert(filterText.includes('filters') && filterText.includes('wallet') && filterText.includes('type'), `${width}: filter context card missing active filter summary`);
}

const startedAt = new Date().toISOString();
let proof;
try {
  const metrics1680 = await capture(1680, 950);
  const metrics1920 = await capture(1920, 1000);
  assertMetrics(metrics1680);
  assertMetrics(metrics1920);

  proof = {
    status: 'pass',
    startedAt,
    completedAt: new Date().toISOString(),
    previewUrl,
    viewports: ['1680x950', '1920x1000'],
    assertions: [
      'Money renders in the workspace shell for the transactions surface',
      'content shell exceeds the old 80rem standard cap at 1680px and the old 90rem wide cap at 1920px',
      'transaction workspace keeps a fixed 22rem/24rem/25rem context rail instead of full-bleed finance rows',
      'primary transaction column remains broad while filter/context side card stays coherent and reachable',
      'header uses a two-zone rhythm with Income, Expense, and Used stats plus a fixed month/assets side card',
      'desktop rail remains visible during the Money proof',
    ],
    metrics: { '1680': metrics1680, '1920': metrics1920 },
  };
  await writeFile(path.join(outDir, 'ndz-019-runtime-proof.json'), JSON.stringify(proof, null, 2));
  await writeFile(path.join(outDir, 'ndz-019-runtime-proof.txt'), [
    'NDZ-019 runtime proof: PASS',
    `1680 content shell ${metrics1680.contentShell.width}px / post-rail ${metrics1680.postRailWidth}px; primary ${metrics1680.primary.width}px; side ${metrics1680.side.width}px`,
    `1920 content shell ${metrics1920.contentShell.width}px / post-rail ${metrics1920.postRailWidth}px; primary ${metrics1920.primary.width}px; side ${metrics1920.side.width}px`,
    'Money uses workspace shell with fixed context rail and denser header/stat rhythm.',
    `Completed: ${proof.completedAt}`,
  ].join('\n') + '\n');
  console.log(JSON.stringify(proof, null, 2));
} catch (error) {
  proof = { status: 'fail', startedAt, completedAt: new Date().toISOString(), previewUrl, error: String(error?.stack || error) };
  await writeFile(path.join(outDir, 'ndz-019-runtime-proof.json'), JSON.stringify(proof, null, 2));
  console.error(JSON.stringify(proof, null, 2));
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
  await wait(500);
  await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
}
