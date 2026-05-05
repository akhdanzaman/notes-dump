import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, '.mission-control-proof', 'ndz-010', 'viewports');
await mkdir(outDir, { recursive: true });
const appUrl = process.env.NDZ_APP_URL || 'http://127.0.0.1:5173';

const userDataDir = '/tmp/ndz010-chrome-profile';
await rm(userDataDir, { recursive: true, force: true });

const port = Number(process.env.NDZ_CDP_PORT || 9230);
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
    this.ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result || {});
      } else if (msg.method) {
        this.events.push(msg);
        const waiter = this.waiters?.find(w => w.method === msg.method && (!w.predicate || w.predicate(msg.params)));
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
    this.waiters ||= [];
    const existing = this.events.find(e => e.method === method && (!predicate || predicate(e.params)));
    if (existing) return Promise.resolve(existing.params);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = (this.waiters || []).filter(w => w.resolve !== resolve);
        reject(new Error(`Timeout waiting for ${method}`));
      }, timeout);
      this.waiters.push({ method, predicate, resolve: p => { clearTimeout(timer); resolve(p); } });
    });
  }
  close() { this.ws.close(); }
}

const now = new Date('2026-05-05T05:00:00.000Z');
const iso = (d) => d.toISOString();
const today = '2026-05-05';
const tomorrow = '2026-05-06';
const thisMonthKey = '2026-05';
const item = (id, type, content, status, dayOffset, meta = {}) => ({
  id, type, content, status, created_at: iso(new Date(now.getTime() + dayOffset * 86400000)), completed_at: status === 'done' ? iso(new Date(now.getTime() + dayOffset * 86400000 + 3600000)) : undefined, meta
});
const db = {
  data: [
    item('t1', 'TODO', 'Finalize NDZ desktop layout audit handoff', 'pending', 0, { date: today, priority: 'high', tags: ['ndz','desktop'], deepWorkStatus: 'suggested', deepWorkParent: true, deepWorkNextAction: 'Compare 1440 and 1680 dashboard density', deepWorkNextActionDurationMinutes: 45 }),
    item('t2', 'TODO', 'Review summary card grouping with product owner', 'pending', 0, { date: today, priority: 'normal', tags: ['review'] }),
    item('t3', 'TODO', 'Archive old responsive screenshots', 'done', -1, { date: '2026-05-04', priority: 'low', tags: ['cleanup'] }),
    item('t4', 'TODO', 'Prepare wide desktop QA checklist', 'pending', 1, { date: tomorrow, priority: 'normal', tags: ['qa'] }),
    item('s1', 'SHOPPING', 'USB-C hub for test desk', 'pending', 0, { shoppingCategory: 'urgent', quantity: '1', tags: ['gear'] }),
    item('s2', 'SHOPPING', 'External monitor arm', 'pending', 0, { shoppingCategory: 'saving', amount: 1200000, savedAmount: 420000, tags: ['workspace'] }),
    item('s3', 'SHOPPING', 'Coffee beans', 'done', -2, { shoppingCategory: 'routine', quantity: '500g' }),
    item('e1', 'EVENT', 'Desktop polish review', 'pending', 0, { date: today, dateTime: '2026-05-05T15:30:00+07:00', tags: ['meeting'] }),
    item('e2', 'EVENT', 'Calendar view QA', 'pending', 2, { date: '2026-05-07', dateTime: '2026-05-07T10:00:00+07:00', tags: ['qa'] }),
    item('f1', 'FINANCE', 'Client payment received', 'done', -1, { financeType: 'income', amount: 9500000, paymentMethod: 'bank-main', budgetCategory: 'income', date: '2026-05-04' }),
    item('f2', 'FINANCE', 'Figma subscription', 'done', -1, { financeType: 'expense', amount: 225000, paymentMethod: 'cc-design', budgetCategory: 'wants', merchant: 'Figma', date: '2026-05-04' }),
    item('f3', 'FINANCE', 'Rent and utilities', 'done', -3, { financeType: 'expense', amount: 3100000, paymentMethod: 'bank-main', budgetCategory: 'needs', merchant: 'Apartment', date: '2026-05-02' }),
    item('f4', 'FINANCE', 'Transfer to monitor fund', 'done', 0, { financeType: 'saving', amount: 250000, paymentMethod: 'bank-main', savingGoalId: 's2', date: today }),
    item('n1', 'NOTE', 'Desktop observation: shell origin feels constrained while rail consumes fixed 288px.', 'done', -1, { tags: ['desktop','layout'] }),
    item('n2', 'NOTE', 'Modal sheets still inherit mobile max-width in several create flows.', 'done', -1, { tags: ['forms','modal'] }),
    item('j1', 'JOURNAL', 'Today I compared desktop surfaces across common monitor widths and noted density mismatches.', 'done', 0, { date: today, tags: ['journal'] }),
    item('sk1', 'SKILL_LOG', 'Wireframe critique practice', 'done', -2, { skillId: 'ux', skillName: 'UX Review', durationMinutes: 75, date: '2026-05-03' }),
    item('sk2', 'SKILL_LOG', 'Responsive CSS refactor reading', 'done', -1, { skillId: 'frontend', skillName: 'Frontend Systems', durationMinutes: 45, date: '2026-05-04' })
  ],
  budgetConfig: { monthlyIncome: 9500000, rules: [
    { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
    { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
    { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' }
  ]},
  wallets: [
    { id: 'bank-main', name: 'Main Bank', type: 'bank', initialBalance: 14000000, color: 'bg-blue-500' },
    { id: 'cash', name: 'Cash', type: 'cash', initialBalance: 550000, color: 'bg-emerald-500' },
    { id: 'cc-design', name: 'Design Card', type: 'cc', initialBalance: -450000, color: 'bg-pink-500' }
  ],
  skills: [
    { id: 'ux', name: 'UX Review', color: 'bg-indigo-500', created_at: '2026-04-01T00:00:00.000Z', weeklyTargetMinutes: 240 },
    { id: 'frontend', name: 'Frontend Systems', color: 'bg-emerald-500', created_at: '2026-04-01T00:00:00.000Z', weeklyTargetMinutes: 180 }
  ],
  monthlyThemes: { [thisMonthKey]: 'Make desktop feel intentional, not stretched' },
  appSettings: { defaultCollapsed: false, hideMoney: false, theme: 'dark', enableDailyInsight: false, enableDraftReview: true, parsingModel: 'gemini-2.5-flash', chatModel: 'gemini-2.5-flash', insightModel: 'gemini-2.5-flash' },
  chatHistory: [],
  canonicalRules: []
};

const seedScript = `(() => {
  localStorage.setItem('braindump_onboarding_completed', 'true');
  localStorage.setItem('braindump_feature_tutorials_disabled', 'true');
  localStorage.setItem('braindump_seen_feature_tutorials_v1', JSON.stringify(['summary','plan','library','money','calendar']));
  localStorage.setItem('braindump_seen_changelog_version', 'v0.3.32');
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
  return { browser, page, targetId };
}

async function waitForAppShell(page, attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    const res = await page.send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('main > div') && document.querySelector('aside.fixed'))`,
      returnByValue: true
    });
    if (res.result?.value) return;
    await wait(150);
  }
  throw new Error('Timed out waiting for app shell');
}

async function navigate(page, width, height) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const loadP = page.waitFor('Page.loadEventFired', null, 12000).catch(() => null);
  await page.send('Page.navigate', { url: appUrl });
  await loadP;
  await waitForAppShell(page);
  await wait(600);
}

async function clickText(page, text) {
  const expr = `(() => {
    const wanted = ${JSON.stringify(text)};
    const nodes = [...document.querySelectorAll('button, [role="button"], a')];
    const el = nodes.find(n => (n.innerText || n.textContent || '').trim().includes(wanted));
    if (!el) return { clicked: false, text: wanted, available: nodes.slice(0,30).map(n => (n.innerText || n.textContent || '').trim()).filter(Boolean) };
    el.click();
    return { clicked: true, label: (el.innerText || el.textContent || '').trim() };
  })()`;
  const res = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  await wait(800);
  return res.result.value;
}

async function clickByAria(page, label) {
  const expr = `(() => {
    const wanted = ${JSON.stringify(label)};
    const nodes = [...document.querySelectorAll('button, [aria-label]')];
    const el = nodes.find(n => (n.getAttribute('aria-label') || '').includes(wanted));
    if (!el) return { clicked: false, label: wanted };
    el.click(); return { clicked: true, label: el.getAttribute('aria-label') };
  })()`;
  const res = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  await wait(800);
  return res.result.value;
}

async function clickMainText(page, text) {
  const expr = `(() => {
    const wanted = ${JSON.stringify(text)};
    const nodes = [...document.querySelectorAll('main button, main [role="button"], main a')];
    const exact = nodes.find(n => (n.innerText || n.textContent || '').trim() === wanted);
    const el = exact || nodes.find(n => (n.innerText || n.textContent || '').trim().includes(wanted));
    if (!el) return { clicked: false, text: wanted, available: nodes.slice(0,40).map(n => (n.innerText || n.textContent || '').trim()).filter(Boolean) };
    el.click();
    return { clicked: true, label: (el.innerText || el.textContent || '').trim() };
  })()`;
  const res = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  await wait(800);
  return res.result.value;
}

async function setMoneyView(page, viewText) {
  return clickText(page, viewText);
}

async function screenshot(page, name) {
  const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  const file = path.join(outDir, `${name}.png`);
  await writeFile(file, Buffer.from(shot.data, 'base64'));
  return file;
}

async function metrics(page) {
  const expression = `(() => {
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const text = (sel) => (document.querySelector(sel)?.innerText || '').trim().slice(0, 260);
    const cards = [...document.querySelectorAll('section, article, [class*="rounded"]')].map(el => ({ className: el.className?.toString().slice(0,120), rect: rect(el), text: (el.innerText || '').trim().replace(/\s+/g,' ').slice(0,80) })).filter(x => x.rect && x.rect.w > 120 && x.rect.h > 40).slice(0, 30);
    return {
      url: location.href,
      viewport: { w: innerWidth, h: innerHeight },
      bodyScroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, y: scrollY },
      rail: rect(document.querySelector('aside.fixed')),
      main: rect(document.querySelector('main')),
      content: rect(document.querySelector('main > div')),
      fixedBottom: rect(document.querySelector('[class*="fixed"][class*="bottom-0"]')),
      h1: text('h1'), h2: text('h2'), h3: text('h3'),
      cards,
      modalPanels: [...document.querySelectorAll('[class*=\"max-w-2xl\"], [class*=\"max-w-3xl\"], [class*=\"max-w-md\"]')].map(el => ({ className: el.className?.toString().slice(0,180), rect: rect(el), text: (el.innerText || '').trim().replace(/\s+/g,' ').slice(0,100) })).filter(x => x.rect && x.rect.w > 100)
    };
  })()`;
  const res = await page.send('Runtime.evaluate', { expression, returnByValue: true });
  if (res.exceptionDetails) return { error: res.exceptionDetails.text, details: res.exceptionDetails.exception?.description };
  return res.result.value;
}

const { browser, page, targetId } = await createPage();
const report = [];
try {
  for (const width of [390, 820, 1440, 1680, 1920]) {
    await navigate(page, width, 900);
    const name = `summary-${width}x900`;
    const file = await screenshot(page, name);
    report.push({ surface: 'Summary/Home', viewport: `${width}x900`, file: path.relative(root, file), metrics: await metrics(page) });
  }

  await navigate(page, 1440, 900);
  for (const [surface, action] of [
    ['Add Task modal', async () => clickMainText(page, 'Task')],
    ['Add Shopping modal', async () => clickMainText(page, 'Buy')],
    ['Add Note modal', async () => clickMainText(page, 'Note')],
    ['Add Expense modal', async () => clickMainText(page, 'Expense')],
  ]) {
    await navigate(page, 1440, 900);
    const actionResult = await action();
    const safe = surface.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const file = await screenshot(page, `${safe}-1440x900`);
    report.push({ surface, viewport: '1440x900', actionResult, file: path.relative(root, file), metrics: await metrics(page) });
  }

  await navigate(page, 1680, 900);
  for (const [surface, action] of [
    ['Add Task modal wide', async () => clickMainText(page, 'Task')],
    ['Add Expense modal wide', async () => clickMainText(page, 'Expense')],
  ]) {
    await navigate(page, 1680, 900);
    const actionResult = await action();
    const safe = surface.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const file = await screenshot(page, `${safe}-1680x900`);
    report.push({ surface, viewport: '1680x900', actionResult, file: path.relative(root, file), metrics: await metrics(page) });
  }

  await navigate(page, 1440, 900);
  for (const [surface, action] of [
    ['Plan/Focus', async () => clickText(page, 'Focus')],
    ['Money/Transactions', async () => clickText(page, 'Money')],
    ['Library/Notes', async () => clickText(page, 'Notes')],
    ['Calendar', async () => clickText(page, 'Calendar')],
    ['Control Center', async () => clickText(page, 'Control Center')],
  ]) {
    const actionResult = await action();
    const safe = surface.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const file = await screenshot(page, `${safe}-1440x900`);
    report.push({ surface, viewport: '1440x900', actionResult, file: path.relative(root, file), metrics: await metrics(page) });
    if (surface === 'Control Center') await clickByAria(page, 'Close');
  }

  await navigate(page, 1680, 900);
  for (const [surface, action] of [
    ['Plan/Focus wide', async () => clickText(page, 'Focus')],
    ['Money/Transactions wide', async () => clickText(page, 'Money')],
    ['Library/Notes wide', async () => clickText(page, 'Notes')],
    ['Calendar wide', async () => clickText(page, 'Calendar')],
  ]) {
    await action();
    const safe = surface.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const file = await screenshot(page, `${safe}-1680x900`);
    report.push({ surface, viewport: '1680x900', file: path.relative(root, file), metrics: await metrics(page) });
  }

  
  const failures = [];
  for (const entry of report) {
    const m = entry.metrics || {};
    const vw = m.viewport?.w || 0;
    if (m.error) failures.push(`${entry.surface} ${entry.viewport}: metrics error ${m.error}`);
    if (m.bodyScroll && m.bodyScroll.w > vw + 2) failures.push(`${entry.surface} ${entry.viewport}: horizontal overflow ${m.bodyScroll.w} > ${vw}`);
    if (vw >= 1024 && entry.surface.includes('Summary') && m.content && m.content.x !== 320) failures.push(`${entry.surface} ${entry.viewport}: desktop content origin ${m.content.x} != 320`);
    if (vw >= 1440 && entry.surface.includes('Summary') && m.content && m.content.w < 1070) failures.push(`${entry.surface} ${entry.viewport}: summary content too narrow ${m.content.w}`);
    if (vw >= 1680 && entry.surface.includes('Summary') && m.content && m.content.w < 1270) failures.push(`${entry.surface} ${entry.viewport}: wide summary content too narrow ${m.content.w}`);
    if (vw >= 1440 && /(Plan|Money|Library)/.test(entry.surface) && m.content && m.content.x !== 320) failures.push(`${entry.surface} ${entry.viewport}: content origin ${m.content.x} != 320`);
  }
  const modalEntries = report.filter(r => r.surface.includes('modal'));
  for (const entry of modalEntries) {
    const panels = entry.metrics?.modalPanels || [];
    const panel = panels.find(c => /bg-surface/.test(c.className || '') && /max-w-(2xl|3xl)/.test(c.className || '') && c.rect?.w >= 600);
    if (entry.viewport.startsWith('1440') && !panel) failures.push(`${entry.surface}: expected desktop form panel >= 600px`);
  }
  const qaSummary = { failures, pass: failures.length === 0, captures: report.length };
  await writeFile(path.join(outDir, 'metrics.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(root, '.mission-control-proof', 'ndz-010', 'qa-summary.json'), JSON.stringify(qaSummary, null, 2));
  if (failures.length) {
    console.error(JSON.stringify(qaSummary, null, 2));
    process.exitCode = 1;
  }
  console.log(JSON.stringify({ outDir: path.relative(root, outDir), captures: report.map(r => ({ surface: r.surface, viewport: r.viewport, file: r.file, main: r.metrics?.main, content: r.metrics?.content, scroll: r.metrics?.bodyScroll, error: r.metrics?.error })) }, null, 2));
} finally {
  page.close();
  browser.close();
  chrome.kill('SIGTERM');
}
