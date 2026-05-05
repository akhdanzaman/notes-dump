import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'ndz-task-specs', 'artifacts');
await mkdir(outDir, { recursive: true });

const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4177';
const userDataDir = '/tmp/ndz017-chrome-profile';
await rm(userDataDir, { recursive: true, force: true });

const port = Number(process.env.NDZ017_CDP_PORT || 9231);
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

const today = '2026-05-05';
const now = `${today}T09:00:00.000Z`;
const db = {
  data: [
    { id: 'task-1', type: 'TODO', content: 'Review NDZ desktop spacing and capture visual proof', status: 'pending', created_at: now, meta: { date: today, tags: ['ndz'], priority: 'high' } },
    { id: 'task-2', type: 'TODO', content: 'Tighten Summary rhythm without adding filler widgets', status: 'pending', created_at: now, meta: { date: today, tags: ['responsive-ux'] } },
    { id: 'task-3', type: 'TODO', content: 'Validate wide dashboard at 1680 and 1920', status: 'pending', created_at: now, meta: { date: today, tags: ['desktop'] } },
    { id: 'task-4', type: 'TODO', content: 'Ship rollback-safe branch after build passes', status: 'pending', created_at: now, meta: { date: today, tags: ['release'] } },
    { id: 'shop-1', type: 'SHOPPING', content: 'Printer paper for desk', status: 'pending', created_at: now, meta: { shoppingCategory: 'urgent', amount: 65000, tags: ['office'] } },
    { id: 'routine-1', type: 'TODO', content: 'Daily review', status: 'pending', created_at: now, meta: { isRoutine: true, routineInterval: 'daily', tags: ['ritual'] } },
    { id: 'routine-2', type: 'TODO', content: 'Water plants', status: 'pending', created_at: now, meta: { isRoutine: true, routineInterval: 'daily', tags: ['ritual'] } },
    { id: 'expense-1', type: 'FINANCE', content: 'Coffee meeting', status: 'done', created_at: now, completed_at: now, meta: { financeType: 'expense', amount: 85000, budgetCategory: 'wants', paymentMethod: 'BCA', date: today, tags: ['meeting'] } },
    { id: 'income-1', type: 'FINANCE', content: 'Monthly income', status: 'done', created_at: now, completed_at: now, meta: { financeType: 'income', amount: 10000000, paymentMethod: 'BCA', date: today, tags: ['income'] } },
  ],
  budgetConfig: { monthlyIncome: 10000000, rules: [
    { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
    { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
    { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
  ]},
  skills: [{ id: 'skill-1', name: 'General Learning', color: 'indigo-500', created_at: now }],
  wallets: [{ id: 'wallet-bca', name: 'BCA', type: 'bank', initialBalance: 2500000, color: 'bg-blue-500' }],
  monthlyThemes: { '2026-05': 'Make desktop rhythm feel intentional' },
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

async function waitForSummary(page, attempts = 90) {
  for (let i = 0; i < attempts; i++) {
    const ok = await evaluate(page, `Boolean(document.querySelector('[data-active-tab="summary"]') && document.body.innerText.includes("Today's Focus") && document.body.innerText.includes('Financials'))`);
    if (ok) return;
    await wait(150);
  }
  throw new Error('Timed out waiting for seeded Summary view');
}

async function capture(width, height) {
  const { browser, page } = await createPage();
  try {
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height });
    await page.send('Page.navigate', { url: previewUrl });
    await wait(1800);
    await waitForSummary(page);
    await evaluate(page, 'window.scrollTo(0,0)');
    await wait(400);
    const metrics = await evaluate(page, `(() => {
      const clean = r => r ? ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }) : null;
      const dashboard = Array.from(document.querySelectorAll('div')).find(el => String(el.className).includes('lg:grid-cols-[minmax(0,1fr)_'));
      const content = dashboard?.parentElement?.parentElement;
      const sections = Array.from(document.querySelectorAll('section'));
      const primary = sections.find(s => s.textContent?.includes("Today's Focus"));
      const quickAdd = sections.find(s => s.textContent?.includes('Quick add'));
      const rituals = sections.find(s => s.textContent?.includes('Rituals'));
      const financials = sections.find(s => s.textContent?.includes('Financials'));
      const rail = document.querySelector('[data-desktop-rail="true"]');
      const visible = el => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        activeTab: document.querySelector('[data-active-tab]')?.getAttribute('data-active-tab') || null,
        railVisible: visible(rail),
        content: clean(content?.getBoundingClientRect()),
        dashboard: clean(dashboard?.getBoundingClientRect()),
        primary: clean(primary?.getBoundingClientRect()),
        quickAdd: clean(quickAdd?.getBoundingClientRect()),
        rituals: clean(rituals?.getBoundingClientRect()),
        financials: clean(financials?.getBoundingClientRect()),
        dashboardClass: dashboard ? String(dashboard.className) : null,
        sectionHeadings: sections.map(s => s.querySelector('h2')?.textContent?.trim()).filter(Boolean),
      };
    })()`);
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
    await writeFile(path.join(outDir, `ndz-017-runtime-${width}.png`), Buffer.from(shot.data, 'base64'));
    await writeFile(path.join(outDir, `ndz-017-runtime-${width}.json`), JSON.stringify(metrics, null, 2));
    return metrics;
  } finally {
    page.close();
    browser.close();
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compare(metrics, before) {
  assert(metrics.activeTab === 'summary', `${metrics.viewport.width}: active tab is not Summary`);
  assert(metrics.railVisible === true, `${metrics.viewport.width}: desktop rail not visible`);
  assert(metrics.dashboardClass?.includes('lg:grid-cols-[minmax(0,1fr)_21rem]'), `${metrics.viewport.width}: dashboard lg side column not retuned to 21rem`);
  assert(metrics.dashboardClass?.includes('xl:grid-cols-[minmax(0,1fr)_23rem]'), `${metrics.viewport.width}: dashboard xl side column not retuned to 23rem`);
  assert(metrics.dashboardClass?.includes('2xl:grid-cols-[minmax(0,1fr)_25rem]'), `${metrics.viewport.width}: dashboard 2xl side column not retuned to 25rem`);
  assert(metrics.primary?.width > before.primary.width, `${metrics.viewport.width}: primary column did not widen over before`);
  assert(metrics.quickAdd?.width <= before.quickAdd.width, `${metrics.viewport.width}: right context was not retuned narrower/equal`);
  assert(metrics.financials?.width <= before.financials.width, `${metrics.viewport.width}: financials context was not retuned narrower/equal`);
  assert(metrics.sectionHeadings.includes("Today's Focus"), `${metrics.viewport.width}: focus card missing`);
  assert(metrics.sectionHeadings.includes('Rituals'), `${metrics.viewport.width}: rituals card missing`);
  assert(metrics.sectionHeadings.includes('Financials'), `${metrics.viewport.width}: financials card missing`);
  assert(!metrics.sectionHeadings.some(h => /placeholder|filler|widget/i.test(h)), `${metrics.viewport.width}: filler-like heading detected`);
}

const startedAt = new Date().toISOString();
const before1680 = JSON.parse(await readFile(path.join(outDir, 'ndz-017-before-1680.json'), 'utf8'));
const before1920 = JSON.parse(await readFile(path.join(outDir, 'ndz-017-before-1920.json'), 'utf8'));

let proof;
try {
  const metrics1680 = await capture(1680, 1050);
  const metrics1920 = await capture(1920, 1080);
  compare(metrics1680, before1680);
  compare(metrics1920, before1920);

  proof = {
    status: 'pass',
    startedAt,
    completedAt: new Date().toISOString(),
    previewUrl,
    viewports: ['1680x1050', '1920x1080'],
    assertions: [
      'seeded Summary route rendered under desktop rail',
      'Summary dashboard class uses 21rem/23rem/25rem side-column rhythm',
      'primary scan column is wider than checked-in before metrics at 1680 and 1920',
      'existing right-side context columns are retuned narrower/equal than before',
      'existing headings remain Today\'s Focus, Rituals, and Financials with no filler heading detected',
    ],
    metrics: { '1680': metrics1680, '1920': metrics1920 },
    beforeMetrics: { '1680': before1680, '1920': before1920 },
  };
  await writeFile(path.join(outDir, 'ndz-017-runtime-proof.json'), JSON.stringify(proof, null, 2));
  await writeFile(path.join(outDir, 'ndz-017-runtime-proof.txt'), [
    'NDZ-017 runtime gate passed',
    `Preview URL: ${previewUrl}`,
    'Viewports: 1680x1050, 1920x1080',
    'Assertions: seeded Summary rendered; dashboard side rhythm is 21rem/23rem/25rem; primary column widened over before metrics; right context retuned; no filler heading detected',
    'Proof: docs/ndz-task-specs/artifacts/ndz-017-runtime-proof.json',
    'Runtime screenshots: docs/ndz-task-specs/artifacts/ndz-017-runtime-1680.png, docs/ndz-task-specs/artifacts/ndz-017-runtime-1920.png',
  ].join('\n'));
  console.log('NDZ-017 runtime gate passed');
  console.log(`Preview URL: ${previewUrl}`);
  console.log('Proof: docs/ndz-task-specs/artifacts/ndz-017-runtime-proof.json');
} catch (error) {
  proof = {
    status: 'fail',
    startedAt,
    completedAt: new Date().toISOString(),
    previewUrl,
    error: error instanceof Error ? error.message : String(error),
  };
  await writeFile(path.join(outDir, 'ndz-017-runtime-proof.json'), JSON.stringify(proof, null, 2));
  await writeFile(path.join(outDir, 'ndz-017-runtime-proof.txt'), `NDZ-017 runtime gate failed\nPreview URL: ${previewUrl}\nError: ${proof.error}\nProof: docs/ndz-task-specs/artifacts/ndz-017-runtime-proof.json\n`);
  throw error;
} finally {
  chrome.kill('SIGTERM');
  await wait(300);
  try {
    await rm(userDataDir, { recursive: true, force: true });
  } catch {}
}
