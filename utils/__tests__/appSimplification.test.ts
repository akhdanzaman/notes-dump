import test from 'node:test';
import assert from 'node:assert/strict';
import { combineSaveChanges, applySaveResult } from '../saveChanges';
import { createWalletLookup } from '../walletLookup';
import { createRoutineDraft, routineDraftPatch } from '../routineDraft';
import { parseConfigSheets } from '../spreadsheetConfig';
import { ItemType, type DbSchema, type Wallet } from '../../types';

const base: DbSchema = {
  data: [{ id: 'one', type: ItemType.NOTE, status: 'pending', content: 'before', created_at: '2026-09-01', meta: {} }],
  budgetConfig: { monthlyIncome: 100, rules: [{ id: 'needs', name: 'Needs', percentage: 50, color: 'blue' }] },
  appSettings: { defaultCollapsed: false, hideMoney: false },
  monthlyThemes: { '2026-09': 'before' }, customPrompt: 'before',
};

test('save changes omit undefined, retain explicit empty values, and preserve forced deferred saves', () => {
  const result = combineSaveChanges({ data: base.data, forceOverwrite: true, customPrompt: 'old' }, { data: undefined, customPrompt: '', skills: [] });
  assert.deepEqual(result.data, base.data);
  assert.equal(result.forceOverwrite, true);
  assert.equal(result.customPrompt, '');
  assert.deepEqual(result.skills, []);
});

test('save acknowledgement applies spreadsheet budget and settings, including cleared prompt', () => {
  const remote = { ...base, budgetConfig: { ...base.budgetConfig!, monthlyIncome: 500 }, customPrompt: '', appSettings: { defaultCollapsed: true, hideMoney: true } };
  const result = applySaveResult(base, remote, base);
  assert.equal(result.budgetConfig?.monthlyIncome, 500);
  assert.equal(result.appSettings?.hideMoney, true);
  assert.equal(result.customPrompt, '');
});

test('in-flight edits and independent remote budget/settings/theme edits both survive', () => {
  const current = { ...base, data: [{ ...base.data[0], content: 'local edit' }], budgetConfig: { ...base.budgetConfig!, monthlyIncome: 200 }, appSettings: { defaultCollapsed: true, hideMoney: false }, monthlyThemes: { ...base.monthlyThemes, '2026-10': 'new local' } };
  const remote = { ...base, budgetConfig: { ...base.budgetConfig!, rules: [{ ...base.budgetConfig!.rules[0], percentage: 60 }] }, appSettings: { defaultCollapsed: false, hideMoney: true }, monthlyThemes: { '2026-09': 'new remote' } };
  const result = applySaveResult(current, remote, base);
  assert.equal(result.data[0].content, 'local edit');
  assert.equal(result.budgetConfig?.monthlyIncome, 200);
  assert.equal(result.budgetConfig?.rules[0].percentage, 60);
  assert.deepEqual(result.appSettings, { defaultCollapsed: true, hideMoney: true });
  assert.deepEqual(result.monthlyThemes, { '2026-09': 'new remote', '2026-10': 'new local' });
});

test('acknowledgement respects remote deletions and local additions', () => {
  const added = { ...base.data[0], id: 'new' };
  assert.deepEqual(applySaveResult({ ...base, data: [...base.data, added] }, { ...base, data: [] }, base).data, [added]);
});

test('partial acknowledgements do not clear unrelated configuration', () => {
  const result = applySaveResult(base, { data: base.data }, base);
  assert.deepEqual(result.budgetConfig, base.budgetConfig);
  assert.deepEqual(result.monthlyThemes, base.monthlyThemes);
});

test('wallet index preserves legacy first alias match, name lookup, trimming and unknown fallback', () => {
  const wallets: Wallet[] = [
    { id: 'cash-id', name: 'Cash', type: 'cash', initialBalance: 0, color: '' },
    { id: 'cash', name: 'Bank', type: 'bank', initialBalance: 0, color: '' },
  ];
  const index = createWalletLookup(wallets);
  assert.equal(index.resolve(' CASH '), 'cash');
  assert.equal(index.resolve('cash-id'), 'cash');
  assert.equal(index.resolve(' BANK '), 'bank');
  assert.equal(index.resolve('unknown'), 'unknown');
  assert.equal(index.byName.get('bank'), wallets[1]);
});

test('routine drafts preserve all intervals and do not mutate saved arrays', () => {
  for (const interval of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
    const meta = { recurrenceDays: 7, routineInterval: interval, routineDaysOfWeek: [1], routineDaysOfMonth: [10], routineMonthsOfYear: [8] };
    const draft = createRoutineDraft(meta);
    assert.deepEqual(routineDraftPatch(draft), meta);
    draft.daysOfWeek.push(3);
    assert.deepEqual(meta.routineDaysOfWeek, [1]);
  }
  assert.equal(createRoutineDraft({}, '1').recurrence, '1');
  for (const recurrence of ['', 'NaN', '-1', '2.5']) assert.equal(routineDraftPatch({ ...createRoutineDraft({}), recurrence }).recurrenceDays, undefined);
});

test('shared config parser handles reordered wallet headers and native booleans', () => {
  const result = parseConfigSheets([
    { range: "'Wallets Config'!A:E", values: [['Name', 'ID', 'Color', 'Type', 'Initial_Balance'], ['Cash', 'w1', 'green', 'cash', 100]] },
    { range: "'Themes & Settings'!A:D", values: [['Type', 'Key', 'Value'], ['Setting', 'Hide Money', true], ['Setting', 'Custom Prompt', '']] },
  ]);
  assert.deepEqual(result.wallets[0], { id: 'w1', name: 'Cash', color: 'green', type: 'cash', initialBalance: 100 });
  assert.equal(result.appSettings?.hideMoney, true);
  assert.equal(result.customPrompt, '');
});

test('shared skill parser preserves explicitly disabled schedules and normalizes legacy time cells', () => {
  const result = parseConfigSheets([{ range: "'Skills Config'!A:N", values: [
    ['ID','Name','Description','Image_URL','Weekly_Target_Minutes','Schedule_Enabled','Schedule_Interval','Schedule_Days_Of_Week','Schedule_Days_Of_Month','Schedule_Months_Of_Year','Schedule_Start_Time','Schedule_End_Time','Created_At','Color'],
    ['s1','Reading','','',60,false,'weekly','1,3','','','9:30','10:30','2026-09-01','green'],
    ['','New skill'],
  ] }], { createSkillIds: true });
  assert.equal(result.skills[0].schedule?.enabled, false);
  assert.equal(result.skills[0].schedule?.startTime, '09:30');
  assert.deepEqual(result.skills[0].schedule?.daysOfWeek, [1,3]);
  assert.ok(result.skills[1].id);
  assert.equal(result.skills[1].schedule, undefined);
});
