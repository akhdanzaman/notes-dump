import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__ } from '../spreadsheetService';
import { generateExportData } from '../../utils/exportUtils';
import { DbSchema, ItemType } from '../../types';

test('system sheet snapshot ignores stale trailing rows using metadata chunk count', () => {
  const rows = __test__.buildSystemSheetRows(JSON.stringify({ data: [{ id: '1' }] }), 'writing');
  rows.push(['stale-old-tail-that-must-be-ignored']);

  const snapshot = __test__.extractSystemSheetSnapshot({ values: rows });

  assert.equal(snapshot.status, 'writing');
  assert.equal(snapshot.format, 'v2');
  assert.deepEqual(JSON.parse(snapshot.jsonString), { data: [{ id: '1' }] });
});

test('legacy system sheet snapshot remains readable', () => {
  const legacyRows = [
    ['{"data":[' ],
    ['{"id":"legacy-1"}'],
    [']}'],
  ];

  const snapshot = __test__.extractSystemSheetSnapshot({ values: legacyRows });

  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.format, 'legacy');
  assert.deepEqual(JSON.parse(snapshot.jsonString), { data: [{ id: 'legacy-1' }] });
});

test('managed sheet formatting is limited to setup or newly-created sheets', () => {
  assert.equal(__test__.shouldApplyManagedSheetFormatting('Dashboard', new Set(), false), false);
  assert.equal(__test__.shouldApplyManagedSheetFormatting('Dashboard', new Set(['Dashboard']), false), true);
  assert.equal(__test__.shouldApplyManagedSheetFormatting('Dashboard', new Set(), true), true);
});

test('dashboard charts render only during setup or when charts are missing', () => {
  assert.equal(__test__.shouldRenderDashboardCharts(false, [101]), false);
  assert.equal(__test__.shouldRenderDashboardCharts(false, []), true);
  assert.equal(__test__.shouldRenderDashboardCharts(true, [101]), true);
});

const existingExportSheetTitles = new Set([
  'Sheet1',
  'Data Quality',
  'Transactions',
  'Todos',
  'Shopping',
  'Events',
  'Notes & Journals',
  'All Items (Raw)',
  'Wallets Config',
  'Skills Config',
  'Budget Rules',
  'Themes & Settings',
]);

const baseDb: DbSchema = {
  data: [
    {
      id: 'note-1',
      type: ItemType.NOTE,
      content: 'Old note',
      status: 'pending',
      created_at: '2026-05-10T00:00:00.000Z',
      meta: { title: 'Daily' },
    },
  ],
  budgetConfig: { monthlyIncome: 0, rules: [] },
  skills: [],
  wallets: [],
  monthlyThemes: {},
  appSettings: { defaultCollapsed: false, hideMoney: false },
};

test('incremental plan updates only item rows for edited existing items', () => {
  const nextDb: DbSchema = {
    ...baseDb,
    data: [{ ...baseDb.data[0], content: 'Updated note' }],
  };
  const plan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    nextDb,
    generateExportData(nextDb.data, [], [], nextDb.budgetConfig!, {}, nextDb.appSettings!),
    existingExportSheetTitles,
    new Set(),
    false,
  );

  assert.equal(plan.canIncremental, true);
  assert.deepEqual(plan.appends, []);
  assert.equal(plan.updates.length, 2);
  assert.ok(plan.updates.some(update => update.range === "'Notes & Journals'!A2:F2"));
  assert.ok(plan.updates.some(update => update.range === "'All Items (Raw)'!A2:AT2"));
});

test('incremental plan appends rows for new items without forcing full rebuild', () => {
  const nextDb: DbSchema = {
    ...baseDb,
    data: [
      ...baseDb.data,
      {
        id: 'finance-1',
        type: ItemType.FINANCE,
        content: 'Manual income',
        status: 'done',
        created_at: '2026-05-10T01:00:00.000Z',
        completed_at: '2026-05-10T01:00:00.000Z',
        meta: { date: '2026-05-10T01:00:00.000Z', amount: 100000, financeType: 'income' },
      },
    ],
  };
  const plan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    nextDb,
    generateExportData(nextDb.data, [], [], nextDb.budgetConfig!, {}, nextDb.appSettings!),
    existingExportSheetTitles,
    new Set(),
    false,
  );

  assert.equal(plan.canIncremental, true);
  assert.equal(plan.updates.length, 0);
  assert.deepEqual(plan.appends.map(append => append.sheetName).sort(), ['All Items (Raw)', 'Transactions']);
});

test('incremental plan falls back when rows are deleted or config changes', () => {
  const deletedPlan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    { ...baseDb, data: [] },
    generateExportData([], [], [], baseDb.budgetConfig!, {}, baseDb.appSettings!),
    existingExportSheetTitles,
    new Set(),
    false,
  );
  assert.equal(deletedPlan.canIncremental, false);
  assert.equal(deletedPlan.reason, 'deleted_items');

  const configPlan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    { ...baseDb, wallets: [{ id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, color: 'green-500' }] },
    generateExportData(baseDb.data, [], [{ id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, color: 'green-500' }], baseDb.budgetConfig!, {}, baseDb.appSettings!),
    existingExportSheetTitles,
    new Set(),
    false,
  );
  assert.equal(configPlan.canIncremental, false);
  assert.equal(configPlan.reason, 'config_changed');
});
