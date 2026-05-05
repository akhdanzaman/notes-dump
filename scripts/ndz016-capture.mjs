import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'docs', 'ndz-016-screenshots');
await mkdir(outDir, { recursive: true });

const previewUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:4176';
const userDataDir = '/tmp/ndz016-chrome-profile';
await rm(userDataDir, { recursive: true, force: true });

const port = 9230;
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
const now = new Date(`${today}T05:00:00.000Z`);
const iso = d => d.toISOString();
const note = (id, content, dayOffset = 0, tags = ['tablet']) => ({
  id,
  type: 'NOTE',
  content,
  status: 'pending',
  created_at: iso(new Date(now.getTime() + dayOffset * 86400000)),
  completed_at: undefined,
  meta: { tags },
});
const db = {
  data: [
    note('n1', 'Tablet baseline: keep two-column note masonry at sm widths.', -5),
    note('n2', 'Do not introduce the desktop rail before lg.', -4),
    note('n3', 'Existing sm modal centering remains the modal baseline.', -3),
    note('n4', 'Library should still feel bottom-stack-first on tablets.', -2),
    note('n5', 'Two-column cards are easier to scan on 820px tablets.', -1),
    note('n6', 'NDZ-016 acceptance gate covers 640 through 1023.', 0),
    { id: 't1', type: 'TODO', content: 'Keep tablet shell locked', status: 'pending', created_at: iso(now), meta: { date: today, priority: 'high' } },
  ],
  budgetConfig: { monthlyIncome: 9500000, rules: [
    { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
    { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
    { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
  ]},
  wallets: [
    { id: 'bank-main', name: 'Main Bank', type: 'bank', initialBalance: 14000000, color: 'bg-blue-500' },
  ],
  skills: [],
  monthlyThemes: { '2026-05': 'Lock tablet baseline' },
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

async function evaluate(page, expression) {
  const res = await page.send('Runtime.evaluate', { expression, returnByValue: true });
  if (res.exceptionDetails) throw new Error(JSON.stringify(res.exceptionDetails));
  return res.result?.value;
}

async function waitForAppShell(page, attempts = 80) {
  for (let i = 0; i < attempts; i++) {
    const ok = await evaluate(page, `Boolean(document.querySelector('[data-global-composer]') && document.querySelector('[data-mobile-bottom-nav="true"]'))`);
    if (ok) return;
    await wait(150);
  }
  throw new Error('Timed out waiting for app shell');
}

async function navigate(page, width, height, mobile = false) {
  await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile, screenWidth: width, screenHeight: height });
  await page.send('Page.navigate', { url: previewUrl });
  await wait(1500);
  await waitForAppShell(page);
  await wait(500);
}

async function clickSelector(page, selector) {
  const clicked = await evaluate(page, `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Missing clickable selector: ${selector}`);
  await wait(700);
}

async function screenshot(page, name) {
  const shot = await page.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  await writeFile(path.join(outDir, `${name}.png`), Buffer.from(shot.data, 'base64'));
}

async function collectMetrics(page, label) {
  return await evaluate(page, `(() => {
    const visible = el => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
    const rail = document.querySelector('[data-desktop-rail="true"]');
    const bottomNav = document.querySelector('[data-mobile-bottom-nav="true"]');
    const bottomStack = document.querySelector('[data-mobile-bottom-stack-wrap="true"]');
    const masonry = document.querySelector('[data-tablet-masonry="library-notes"]');
    const panel = document.querySelector('[data-tablet-modal-panel="add-note"]');
    const overlay = document.querySelector('[data-tablet-modal-overlay="add-note"]');
    const main = document.querySelector('main');
    const masonryStyles = masonry ? getComputedStyle(masonry) : null;
    const panelStyles = panel ? getComputedStyle(panel) : null;
    const overlayStyles = overlay ? getComputedStyle(overlay) : null;
    const panelRect = panel?.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    const panelCenterDelta = panelRect ? Math.abs((panelRect.top + panelRect.height / 2) - window.innerHeight / 2) : null;
    return {
      label: ${JSON.stringify(label)},
      viewport: { width: window.innerWidth, height: window.innerHeight },
      activeTab: document.querySelector('[data-active-tab]')?.getAttribute('data-active-tab') || null,
      railVisible: visible(rail),
      bottomNavVisible: visible(bottomNav),
      bottomStackVisible: visible(bottomStack),
      mainLeft: mainRect ? Number(mainRect.left.toFixed(1)) : null,
      mainMaxWidth: main ? getComputedStyle(main).maxWidth : null,
      masonryVisible: visible(masonry),
      masonryColumnCount: masonryStyles?.columnCount || null,
      masonryChildCount: masonry?.children.length || 0,
      modalVisible: visible(panel),
      modalOverlayAlignItems: overlayStyles?.alignItems || null,
      modalOverlayPadding: overlayStyles?.padding || null,
      modalPanelWidth: panelRect ? Number(panelRect.width.toFixed(1)) : null,
      modalPanelTop: panelRect ? Number(panelRect.top.toFixed(1)) : null,
      modalPanelBottomGap: panelRect ? Number((window.innerHeight - panelRect.bottom).toFixed(1)) : null,
      modalCenterDelta: panelCenterDelta == null ? null : Number(panelCenterDelta.toFixed(1)),
      modalPanelMaxWidth: panelStyles?.maxWidth || null,
    };
  })()`);
}

async function runStaticGate() {
  const contentSurface = await readFile(path.join(root, 'components/layout/contentSurface.ts'), 'utf8');
  const responsiveShell = await readFile(path.join(root, 'components/layout/responsiveShell.ts'), 'utf8');
  const libraryView = await readFile(path.join(root, 'components/views/LibraryView.tsx'), 'utf8');
  const addNoteModal = await readFile(path.join(root, 'components/AddNoteModal.tsx'), 'utf8');
  const checks = [
    ['tablet min width is explicit', /minWidth:\s*640/.test(contentSurface)],
    ['tablet max width is explicit', /maxWidth:\s*1023/.test(contentSurface)],
    ['tablet masonry keeps sm two columns', /columns-1 sm:columns-2 gap-4/.test(contentSurface)],
    ['library masonry only expands at lg desktop', /lg:columns-3/.test(contentSurface) && !/md:columns-3/.test(contentSurface)],
    ['modal overlay still centers at sm', /sm:items-center/.test(contentSurface) && /sm:p-4/.test(contentSurface)],
    ['desktop shell rail starts at lg', /desktopBreakpoint:\s*'lg'/.test(responsiveShell) && /lg:ml-72/.test(responsiveShell)],
    ['bottom nav stays active below lg', /bottomNavWrap:\s*'pointer-events-auto lg:hidden'/.test(responsiveShell)],
    ['runtime proof hook exists for library masonry', /data-tablet-masonry="library-notes"/.test(libraryView)],
    ['runtime proof hook exists for add-note modal', /data-tablet-modal-panel="add-note"/.test(addNoteModal)],
  ];
  const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`NDZ-016 static gate failed: ${failed.join(', ')}`);
  return checks.map(([name]) => ({ name, passed: true }));
}

const { browser, page } = await createPage();
const metrics = [];
const staticGate = await runStaticGate();

try {
  for (const vp of [
    { width: 640, height: 900, label: 'tablet-640x900', mobile: false },
    { width: 820, height: 1180, label: 'tablet-820x1180', mobile: true },
    { width: 1023, height: 900, label: 'tablet-1023x900', mobile: false },
  ]) {
    await navigate(page, vp.width, vp.height, vp.mobile);
    await clickSelector(page, '[data-mobile-nav-tab="library"]');
    await screenshot(page, `${vp.label}-library`);
    const libraryMetrics = await collectMetrics(page, `${vp.label}-library`);
    metrics.push(libraryMetrics);

    await clickSelector(page, '[data-library-add-button="true"]');
    await screenshot(page, `${vp.label}-add-note-modal`);
    const modalMetrics = await collectMetrics(page, `${vp.label}-add-note-modal`);
    metrics.push(modalMetrics);
  }

  await writeFile(path.join(outDir, 'metrics.json'), JSON.stringify({ staticGate, metrics }, null, 2));

  const failures = [];
  for (const entry of metrics) {
    if (!entry.label.includes('tablet-')) continue;
    if (entry.railVisible) failures.push(`${entry.label}: desktop rail visible inside tablet range`);
    if (!entry.bottomNavVisible || !entry.bottomStackVisible) failures.push(`${entry.label}: bottom-stack nav hidden inside tablet range`);
    if (!entry.label.includes('add-note-modal')) {
      if (entry.masonryColumnCount !== '2') failures.push(`${entry.label}: expected library masonry column-count 2, got ${entry.masonryColumnCount}`);
    }
    if (entry.label.includes('add-note-modal')) {
      if (!entry.modalVisible) failures.push(`${entry.label}: add-note modal not visible`);
      if (entry.modalOverlayAlignItems !== 'center') failures.push(`${entry.label}: expected centered sm modal align-items=center, got ${entry.modalOverlayAlignItems}`);
      if (entry.modalCenterDelta == null || entry.modalCenterDelta > 2) failures.push(`${entry.label}: modal not vertically centered, center delta ${entry.modalCenterDelta}`);
      if (entry.modalPanelWidth == null || entry.modalPanelWidth > 448) failures.push(`${entry.label}: expected sm max-w-md panel <=448px, got ${entry.modalPanelWidth}`);
    }
  }

  if (failures.length) {
    throw new Error(`NDZ-016 tablet baseline gate failed:\n- ${failures.join('\n- ')}`);
  }

  const runtimeProof = {
    task: 'NDZ-016',
    status: 'passed',
    generatedAt: new Date().toISOString(),
    command: `PREVIEW_URL=${previewUrl} node scripts/ndz016-capture.mjs`,
    previewUrl,
    deterministicSeedDate: today,
    viewports: metrics.map(entry => ({
      label: entry.label,
      viewport: entry.viewport,
      railVisible: entry.railVisible,
      bottomNavVisible: entry.bottomNavVisible,
      bottomStackVisible: entry.bottomStackVisible,
      masonryColumnCount: entry.masonryColumnCount,
      modalOverlayAlignItems: entry.modalOverlayAlignItems,
      modalPanelWidth: entry.modalPanelWidth,
      modalCenterDelta: entry.modalCenterDelta,
    })),
    staticGate,
    assertions: {
      railHiddenAcrossTablet: metrics.every(entry => entry.railVisible === false),
      bottomStackVisibleAcrossTablet: metrics.every(entry => entry.bottomNavVisible === true && entry.bottomStackVisible === true),
      libraryMasonryTwoColumnsAcrossTablet: metrics.filter(entry => !entry.label.includes('add-note-modal')).every(entry => entry.masonryColumnCount === '2'),
      smModalCenteredAcrossTablet: metrics.filter(entry => entry.label.includes('add-note-modal')).every(entry => entry.modalOverlayAlignItems === 'center' && entry.modalCenterDelta === 0 && entry.modalPanelWidth <= 448),
    },
  };

  await writeFile(path.join(outDir, 'runtime-proof.json'), JSON.stringify(runtimeProof, null, 2));
  console.log('NDZ-016 runtime gate passed');
  console.log(`Preview URL: ${previewUrl}`);
  console.log('Viewports: 640x900, 820x1180, 1023x900');
  console.log('Assertions: rail hidden; bottom stack visible; library masonry column-count=2; add-note modal centered at sm/max-w-md');
  console.log(`Proof: ${path.relative(root, path.join(outDir, 'runtime-proof.json'))}`);
  console.log(`Metrics: ${path.relative(root, path.join(outDir, 'metrics.json'))}`);
} finally {
  page.close();
  browser.close();
  chrome.kill('SIGTERM');
}
