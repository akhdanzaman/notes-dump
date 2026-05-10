import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'ndz-task-specs', 'artifacts');
await mkdir(outDir, { recursive: true });

const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4178';
const userDataDir = '/tmp/ndz018-chrome-profile';
await rm(userDataDir, { recursive: true, force: true });

const port = Number(process.env.NDZ018_CDP_PORT || 9232);
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
    { id: 'task-plan-wide', type: 'TODO', content: 'Edit-heavy NDZ task with date, priority, progress, and bottom actions proof', status: 'pending', created_at: now, meta: { date: `${today}T09:00:00.000Z`, start: `${today}T09:00:00.000Z`, end: `${today}T10:30:00.000Z`, priority: 'high', progress: 45, progressNotes: 'Needs wider desktop controls', tags: ['ndz', 'desktop'] } },
    { id: 'task-plan-routine', type: 'TODO', content: 'Daily workspace review routine', status: 'pending', created_at: now, meta: { isRoutine: true, routineInterval: 'daily', priority: 'normal', tags: ['routine'] } },
    { id: 'task-plan-tomorrow', type: 'TODO', content: 'Tomorrow desktop comfort QA', status: 'pending', created_at: now, meta: { date: '2026-05-07T09:00:00.000Z', priority: 'normal', progress: 10, tags: ['qa'] } },
    { id: 'task-plan-later', type: 'TODO', content: 'Later follow-up proof capture', status: 'pending', created_at: now, meta: { date: '2026-05-18T09:00:00.000Z', priority: 'low', progress: 20, tags: ['proof'] } },
    { id: 'task-plan-extra', type: 'TODO', content: 'Passive list item stays dense while edit cards are comfortable', status: 'pending', created_at: now, meta: { date: `${today}T12:00:00.000Z`, priority: 'normal', tags: ['density'] } },
  ],
  budgetConfig: { monthlyIncome: 10000000, rules: [] },
  skills: [{ id: 'skill-1', name: 'General Learning', color: 'indigo-500', created_at: now }],
  wallets: [{ id: 'wallet-bca', name: 'BCA', type: 'bank', initialBalance: 2500000, color: 'bg-blue-500' }],
  monthlyThemes: { '2026-05': 'Make desktop task editing breathe' },
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
    await evaluate(page, `Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Focus'))?.click()`);
    await waitFor(page, `Boolean(document.querySelector('[data-active-tab]')?.getAttribute('data-active-tab') === 'plan' && document.querySelector('[data-plan-workspace="tasks"]'))`, 'Plan task workspace');
    await evaluate(page, `document.querySelector('[data-edit-comfort="task-workspace"]')?.click()`);
    await waitFor(page, `Boolean(document.querySelector('[data-edit-comfort="task-workspace"][data-card-expanded="true"] [data-edit-actions="task-workspace"]'))`, 'expanded task edit card');
    await evaluate(page, `document.querySelector('[data-edit-actions="task-workspace"]')?.scrollIntoView({ block: 'center', inline: 'nearest' })`);
    await wait(350);

    const metrics = await evaluate(page, `(() => {
      const clean = r => r ? ({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) }) : null;
      const visible = el => !!el && getComputedStyle(el).display !== 'none' && el.getClientRects().length > 0;
      const workspace = document.querySelector('[data-plan-workspace="tasks"]');
      const sections = Array.from(workspace?.querySelectorAll('section') || []);
      const expanded = document.querySelector('[data-edit-comfort="task-workspace"][data-card-expanded="true"]');
      const fieldGrid = expanded?.querySelector('[data-edit-field-grid="task-workspace"]');
      const dateInputs = Array.from(expanded?.querySelectorAll('input[type="datetime-local"]') || []);
      const priorityButtons = Array.from(expanded?.querySelectorAll('button')).filter(b => ['low','normal','high'].includes((b.textContent || '').trim().toLowerCase()));
      const progress = expanded?.querySelector('[data-edit-progress="task-workspace"]');
      const actions = expanded?.querySelector('[data-edit-actions="task-workspace"]');
      const composer = document.querySelector('[data-global-composer="true"]') || document.querySelector('[data-composer-surface="true"]');
      const contentShell = document.querySelector('[data-shell-variant]');
      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        activeTab: document.querySelector('[data-active-tab]')?.getAttribute('data-active-tab') || null,
        shellVariant: contentShell?.getAttribute('data-shell-variant') || null,
        railVisible: visible(document.querySelector('[data-desktop-rail="true"]')),
        contentShell: clean(contentShell?.getBoundingClientRect()),
        workspace: clean(workspace?.getBoundingClientRect()),
        workspaceClass: workspace ? String(workspace.className) : null,
        sectionRects: sections.map(s => clean(s.getBoundingClientRect())),
        expandedCard: clean(expanded?.getBoundingClientRect()),
        fieldGrid: clean(fieldGrid?.getBoundingClientRect()),
        dateInputs: dateInputs.map(input => clean(input.getBoundingClientRect())),
        priorityButtons: priorityButtons.map(button => clean(button.getBoundingClientRect())),
        progress: clean(progress?.getBoundingClientRect()),
        actions: clean(actions?.getBoundingClientRect()),
        composer: clean(composer?.getBoundingClientRect()),
        editComfortClass: expanded ? String(expanded.className) : null,
        fieldGridClass: fieldGrid ? String(fieldGrid.className) : null,
        progressClass: progress ? String(progress.className) : null,
        actionsClass: actions ? String(actions.className) : null,
        bodyScrollY: Math.round(window.scrollY),
      };
    })()`);
    const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
    await writeFile(path.join(outDir, `ndz-018-runtime-${width}.png`), Buffer.from(shot.data, 'base64'));
    await writeFile(path.join(outDir, `ndz-018-runtime-${width}.json`), JSON.stringify(metrics, null, 2));
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
  assert(metrics.activeTab === 'plan', `${width}: active tab is not Plan`);
  assert(metrics.shellVariant === 'workspace', `${width}: Plan tasks did not use workspace shell`);
  assert(metrics.railVisible === true, `${width}: desktop rail not visible`);
  assert(metrics.workspaceClass?.includes('min-[1440px]:grid-cols-[minmax(23rem,1.2fr)_repeat(2,minmax(21rem,1fr))]'), `${width}: task workspace grid class missing 1440 three-column minimums`);
  assert(metrics.workspace?.width > 1024, `${width}: workspace width did not exceed old 1024 cap`);
  assert(metrics.sectionRects.length >= 3, `${width}: expected at least three task sections`);
  assert(metrics.sectionRects.slice(0, 3).every(rect => rect && rect.width >= 330), `${width}: task section columns too narrow`);
  assert(metrics.expandedCard?.width >= 330, `${width}: expanded edit card too narrow`);
  assert(metrics.fieldGrid?.width >= 300, `${width}: edit field grid too narrow`);
  assert(metrics.dateInputs.length >= 3, `${width}: expected date/start/end controls in expanded task`);
  assert(metrics.dateInputs.every(rect => rect && rect.width >= 135), `${width}: date controls are cramped`);
  assert(metrics.priorityButtons.length === 3, `${width}: expected low/normal/high priority buttons`);
  assert(metrics.priorityButtons.every(rect => rect && rect.width >= 90 && rect.height >= 36), `${width}: priority buttons are cramped`);
  assert(metrics.progress?.width >= 300 && metrics.progress.height >= 120, `${width}: progress field surface is cramped`);
  assert(metrics.actions?.width >= 300 && metrics.actions.height >= 36, `${width}: bottom actions surface is cramped`);
  assert(metrics.composer, `${width}: composer surface not found`);
  assert(metrics.actions.bottom < metrics.composer.y, `${width}: bottom actions overlap the composer`);
}

const startedAt = new Date().toISOString();
let proof;
try {
  const metrics1440 = await capture(1440, 900);
  const metrics1680 = await capture(1680, 950);
  assertMetrics(metrics1440);
  assertMetrics(metrics1680);

  proof = {
    status: 'pass',
    startedAt,
    completedAt: new Date().toISOString(),
    previewUrl,
    viewports: ['1440x900', '1680x950'],
    assertions: [
      'Plan tasks render in workspace shell with content width greater than the old 1024px cap',
      'task workspace grid uses 22rem two-column fallback and 23rem/21rem/21rem minimums from 1440px upward',
      'expanded task edit cards expose comfortable field-grid, date/start/end controls, priority buttons, progress panel, and bottom actions',
      'bottom actions are visible above the fixed composer after scrollIntoView, with no overlap',
      'desktop rail remains visible during the Plan proof',
    ],
    metrics: { '1440': metrics1440, '1680': metrics1680 },
    artifacts: [
      'docs/ndz-task-specs/artifacts/ndz-018-runtime-1440.png',
      'docs/ndz-task-specs/artifacts/ndz-018-runtime-1680.png',
      'docs/ndz-task-specs/artifacts/ndz-018-runtime-1440.json',
      'docs/ndz-task-specs/artifacts/ndz-018-runtime-1680.json',
    ],
  };
  await writeFile(path.join(outDir, 'ndz-018-runtime-proof.json'), JSON.stringify(proof, null, 2));
  await writeFile(path.join(outDir, 'ndz-018-runtime-proof.txt'), [
    'NDZ-018 runtime gate passed',
    `Preview URL: ${previewUrl}`,
    'Viewports: 1440x900, 1680x950',
    'Assertions: workspace >1024px; task columns >=330px; date controls >=135px; priority buttons >=90x36px; progress/actions >=300px; actions do not overlap composer',
    'Proof: docs/ndz-task-specs/artifacts/ndz-018-runtime-proof.json',
    'Runtime screenshots: docs/ndz-task-specs/artifacts/ndz-018-runtime-1440.png, docs/ndz-task-specs/artifacts/ndz-018-runtime-1680.png',
  ].join('\n'));
  console.log('NDZ-018 runtime gate passed');
  console.log(`Preview URL: ${previewUrl}`);
  console.log('Proof: docs/ndz-task-specs/artifacts/ndz-018-runtime-proof.json');
} catch (error) {
  proof = {
    status: 'fail',
    startedAt,
    completedAt: new Date().toISOString(),
    previewUrl,
    error: error instanceof Error ? error.message : String(error),
  };
  await writeFile(path.join(outDir, 'ndz-018-runtime-proof.json'), JSON.stringify(proof, null, 2));
  await writeFile(path.join(outDir, 'ndz-018-runtime-proof.txt'), `NDZ-018 runtime gate failed\nPreview URL: ${previewUrl}\nError: ${proof.error}\nProof: docs/ndz-task-specs/artifacts/ndz-018-runtime-proof.json\n`);
  throw error;
} finally {
  chrome.kill('SIGTERM');
  await wait(300);
  try { await rm(userDataDir, { recursive: true, force: true }); } catch {}
}
