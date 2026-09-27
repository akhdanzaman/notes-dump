import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import RoutineScheduleEditor from '../../components/RoutineScheduleEditor';
import { createRoutineDraft } from '../../utils/routineDraft';
import { useAppSecurity } from '../useAppSecurity';
import { useReceiptWorkflow } from '../useReceiptWorkflow';
import { useReviewCenter } from '../useReviewCenter';
import { useAppOnboarding } from '../useAppOnboarding';
import { useBrowserIntegration } from '../useBrowserIntegration';
import { encryptSecurityPassword } from '../../services/spreadsheetService';
import { ItemType, type AppSettings, type BrainDumpItem, type ReceiptReviewDraft } from '../../types';

async function harness<T>(hook: () => T) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
  const values = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true };
  const originals = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  let current: T;
  function Host() { current = hook(); return null; }
  const root = createRoot(document.getElementById('root')!);
  await act(async () => root.render(<Host />));
  return {
    get current() { return current; },
    render: async (node: React.ReactNode) => { await act(async () => root.render(node)); },
    rerender: async () => { await act(async () => root.render(<Host />)); },
    close: async () => {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
const settings: AppSettings = { defaultCollapsed: false, hideMoney: false };
const draft: ReceiptReviewDraft = {
  id: 'review', createdAt: '2026-09-27T00:00:00Z', imageName: 'receipt.png', imageMimeType: 'image/png', imageSize: 10,
  date: '2026-09-27', walletId: 'cash', merchant: 'Shop', originalCurrency: 'USD', originalTotal: 2,
  exchangeRateToIdr: 15000, lineItems: [{ id: 'line', name: 'Tea', amount: 2 }], warnings: [],
};
const saved: BrainDumpItem = { id: 'saved', type: ItemType.FINANCE, content: 'Shop', created_at: draft.date, status: 'pending', meta: {} };
type ReceiptOptions = Parameters<typeof useReceiptWorkflow>[0];
function receiptOptions(handleAddTransaction: ReceiptOptions['handleAddTransaction']): ReceiptOptions {
  return { items: [], wallets: [], budgetConfig: { monthlyIncome: 0, rules: [] }, appSettings: settings,
    handleAddTransaction, showAppNotice: () => {}, revealReceiptTransaction: () => {} };
}

test('shared routine controls retain weekly, monthly and yearly selections without submitting forms', async () => {
  const h = await harness(() => undefined);
  try {
    const fields: string[] = [];
    function Editor() {
      const [value, setValue] = useState(createRoutineDraft({}));
      return <RoutineScheduleEditor value={value} onChange={(next, field) => { fields.push(field); setValue(next); }} />;
    }
    await h.render(<Editor />);
    const click = async (label: string) => {
      const button = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent) === label)!;
      assert.ok(button, label);
      assert.equal(button.type, 'button');
      await act(async () => button.click());
    };
    await click('weekly'); await click('Sunday'); await click('Monday'); await click('Sunday');
    await click('monthly'); await click('31');
    await click('yearly'); await click('Jan');
    assert.equal(document.querySelector('[aria-label="Jan"]')?.getAttribute('aria-pressed'), 'true');
    await click('weekly');
    assert.equal(document.querySelector('[aria-label="Monday"]')?.getAttribute('aria-pressed'), 'true');
    assert.equal(document.querySelector('[aria-label="Sunday"]')?.getAttribute('aria-pressed'), 'false');
    await click('monthly');
    assert.equal(document.querySelector('[aria-label="31"]')?.getAttribute('aria-pressed'), 'true');
    assert.ok(fields.includes('monthsOfYear'));
  } finally { await h.close(); }
});

test('security verification rejects wrong passwords and cancellation, accepts correct password', async () => {
  const notices: string[] = [];
  const h = await harness(() => useAppSecurity({ ...settings, securityPasswordHash: encryptSecurityPassword('secret') }, () => {}, message => notices.push(message)));
  try {
    for (const [password, expected] of [['wrong', false], [null, false], ['secret', true]] as const) {
      let result!: Promise<boolean>;
      await act(async () => { result = h.current.authorizeSecurityPassword(); });
      assert.equal(h.current.securityPasswordDialog?.mode, 'verify');
      await act(async () => h.current.closeSecurityPasswordDialog(password));
      assert.equal(await result, expected);
      assert.equal(h.current.securityPasswordDialog, null);
    }
    assert.ok(notices.includes('Password salah.'));
  } finally { await h.close(); }
});

test('replaced and unmounted security prompts settle as cancelled', async () => {
  const h = await harness(() => useAppSecurity({ ...settings, securityPasswordHash: encryptSecurityPassword('secret') }, () => {}, () => {}));
  let first!: Promise<boolean>, second!: Promise<boolean>;
  await act(async () => { first = h.current.authorizeSecurityPassword(); second = h.current.authorizeSecurityPassword(); });
  assert.equal(await first, false);
  await h.close();
  assert.equal(await second, false);
});

test('receipt approval converts currency and removes review only after successful commit', async () => {
  let fail = true;
  const calls: Parameters<ReceiptOptions['handleAddTransaction']>[] = [];
  const options = receiptOptions(async (...args) => { calls.push(args); if (fail) throw new Error('offline'); return saved; });
  const h = await harness(() => useReceiptWorkflow(options));
  try {
    localStorage.setItem('braindump_receipt_reviews', JSON.stringify([draft]));
    // Remount to exercise persisted queue hydration, not private state setters.
    await h.render(null); await h.rerender();
    assert.equal(h.current.receiptReviews.length, 1);
    await act(async () => { await assert.rejects(h.current.handleApproveReceiptReview(draft), /offline/); });
    assert.equal(h.current.receiptReviews.length, 1);
    fail = false;
    await act(async () => h.current.handleApproveReceiptReview(draft));
    assert.equal(calls[1][1], 30000);
    assert.equal(calls[1][7]?.[0].amount, 30000);
    assert.equal(calls[1][10], 'USD');
    assert.equal(h.current.receiptReviews.length, 0);
    assert.deepEqual(JSON.parse(localStorage.getItem('braindump_receipt_reviews')!), []);
  } finally { await h.close(); }
});

test('receipt review rejects missing wallet, invalid exchange rate and unapproved duplicate', async () => {
  let calls = 0;
  const options = receiptOptions(async () => { calls++; return saved; });
  const h = await harness(() => useReceiptWorkflow(options));
  try {
    await assert.rejects(h.current.handleApproveReceiptReview({ ...draft, walletId: undefined }), /wallet/);
    await assert.rejects(h.current.handleApproveReceiptReview({ ...draft, exchangeRateToIdr: 0 }), /Kurs/);
    options.items = [{ ...saved, meta: { financeType: 'expense', receiptCapture: { fingerprint: 'same' } } }];
    await h.rerender();
    await assert.rejects(h.current.handleApproveReceiptReview({ ...draft, fingerprint: 'same' }), /serupa/);
    assert.equal(calls, 0);
    await act(async () => h.current.handleApproveReceiptReview({ ...draft, fingerprint: 'same', allowDuplicate: true }));
    assert.equal(calls, 1);
  } finally { await h.close(); }
});

test('review center keeps unresolved badge but clears nudge after opening', async () => {
  const options: Parameters<typeof useReviewCenter>[0] = { parsingTasks: [], enrichmentTasks: [], pendingCount: 0,
    pendingReviews: [], saveStatus: 'synced', fetchStatus: 'synced', receiptTasks: [], receiptReviews: [{ ...draft, createdAt: new Date(Date.now() - 1000).toISOString() }] };
  const h = await harness(() => useReviewCenter(options));
  try {
    assert.equal(h.current.reviewCenterBadgeCount, 1);
    assert.equal(h.current.showReviewCenterNudge, true);
    await act(async () => h.current.openReviewCenterFromInput());
    assert.equal(h.current.showReviewCenterNudge, false);
    assert.equal(h.current.reviewCenterBadgeCount, 1);
    options.saveStatus = 'saving'; await h.rerender();
    assert.equal(h.current.hasRunningProcess, true);
    await act(async () => h.current.closeReviewCenterFromInput());
    assert.equal(h.current.isReviewCenterOpen, false);
  } finally { await h.close(); }
});

test('onboarding saves selected settings and preserves existing records', async () => {
  const changes: Parameters<Parameters<typeof useAppOnboarding>[0]['saveAndSync']>[0][] = [];
  const h = await harness(() => useAppOnboarding({ items: [saved], wallets: [], skills: [], budgetConfig: { monthlyIncome: 0, rules: [] },
    customPrompt: 'existing', monthlyThemes: {}, appSettings: settings, setAppSettings: () => {}, setWallets: () => {}, setBudgetConfig: () => {},
    saveAndSync: async change => { changes.push(change); }, activeTab: 'summary', planSubTab: 'tasks', librarySubTab: 'general', moneyView: 'transactions', isControlCenterOpen: false }));
  try {
    assert.equal(h.current.showOnboarding, true);
    const sample = { ...saved, id: 'sample' };
    await act(async () => h.current.handleOnboardingComplete({ ...settings, hideMoney: true }, null, null, [sample]));
    assert.equal(h.current.showOnboarding, false);
    assert.equal(localStorage.getItem('braindump_onboarding_completed'), 'true');
    assert.deepEqual(changes[0]?.data?.map(item => item.id), ['saved', 'sample']);
    assert.equal(changes[0]?.appSettings?.hideMoney, true);
    assert.equal(changes[0]?.forceOverwrite, true);
  } finally { await h.close(); }
});

test('browser integration consumes reply once, preserves URL filters and applies theme/language', async () => {
  const replies: string[] = [];
  let enabled = false;
  const h = await harness(() => {
    // Hook order is fixed; initial empty URL is replaced before remount below.
    useBrowserIntegration({ handleSend: async text => { replies.push(text); }, loadData: async () => {},
      appSettings: { ...settings, theme: enabled ? 'light' : 'dark', language: 'en' }, showAppNotice: () => {} });
  });
  try {
    await h.render(null);
    window.history.replaceState({}, '', '/?reply=Buy%20tea&view=money#today');
    enabled = true;
    await h.rerender();
    assert.deepEqual(replies, ['Buy tea']);
    assert.equal(window.location.search, '?view=money');
    assert.equal(window.location.hash, '#today');
    assert.equal(document.documentElement.lang, 'en');
    assert.equal(document.documentElement.classList.contains('dark'), false);
    await h.render(null); await h.rerender();
    assert.deepEqual(replies, ['Buy tea']);
  } finally { await h.close(); }
});
