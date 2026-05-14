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

test('system snapshot write batches keep proxy payloads bounded', () => {
  const rows = Array.from({ length: 45 }, (_, index) => [`row-${index + 1}`]);
  const batches = __test__.buildColumnWriteBatches('App_State_Do_Not_Edit', rows, 20);

  assert.deepEqual(batches.map(batch => batch.range), [
    "'App_State_Do_Not_Edit'!A1:A20",
    "'App_State_Do_Not_Edit'!A21:A40",
    "'App_State_Do_Not_Edit'!A41:A45",
  ]);
  assert.deepEqual(batches.map(batch => batch.values.length), [20, 20, 5]);
});

test('service-account proxy invocation failures are detected for OAuth fallback', async () => {
  assert.equal(
    await __test__.isServiceAccountProxyInvocationFailure(new Response('A server error has occurred FUNCTION_INVOCATION_FAILED sin1::abc', { status: 500 })),
    true,
  );
  assert.equal(
    await __test__.isServiceAccountProxyInvocationFailure(new Response('{"error":"bad request"}', { status: 400 })),
    false,
  );
});

const existingExportSheetTitles = new Set([
  'Sheet1',
  'Data Quality',
  'Transactions',
  'Todos',
  'Shopping',
  'Events',
  'Notes & Journals',
  'Skill Logs',
  'Wallets Config',
  'Skills Config',
  'Budget Rules',
  'Themes & Settings',
  'Chat History',
  'Canonical Rules',
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
  assert.equal(plan.updates.length, 1);
  assert.ok(plan.updates.some(update => update.range === "'Notes & Journals'!A2:F2"));
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
  assert.deepEqual(plan.appends.map(append => append.sheetName).sort(), ['Transactions']);
});

test('incremental plan rewrites only the affected item sheet when a new row is inserted above existing rows', () => {
  const nextDb: DbSchema = {
    ...baseDb,
    data: [
      {
        id: 'note-new-top',
        type: ItemType.NOTE,
        content: 'New top note',
        status: 'pending',
        created_at: '2026-05-10T01:00:00.000Z',
        meta: { title: 'Top' },
      },
      ...baseDb.data,
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
  assert.equal(plan.appends.some(append => append.sheetName === 'Notes & Journals'), false);
  assert.ok(plan.rewrites.some(sheet => sheet.name === 'Notes & Journals'));
});

test('incremental plan rewrites only affected sheets when rows are deleted or config changes', () => {
  const deletedPlan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    { ...baseDb, data: [] },
    generateExportData([], [], [], baseDb.budgetConfig!, {}, baseDb.appSettings!),
    existingExportSheetTitles,
    new Set(),
    false,
  );
  assert.equal(deletedPlan.canIncremental, true);
  assert.deepEqual(deletedPlan.rewrites.map(sheet => sheet.name).filter(name => name === 'Notes & Journals'), ['Notes & Journals']);

  const configPlan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    { ...baseDb, wallets: [{ id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, color: 'green-500' }] },
    generateExportData(baseDb.data, [], [{ id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, color: 'green-500' }], baseDb.budgetConfig!, {}, baseDb.appSettings!),
    existingExportSheetTitles,
    new Set(),
    false,
  );
  assert.equal(configPlan.canIncremental, true);
  assert.ok(configPlan.rewrites.some(sheet => sheet.name === 'Wallets Config'));
});

test('incremental plan does not write back remote-only spreadsheet edits', () => {
  const remoteOnlyDb: DbSchema = {
    ...baseDb,
    data: [{ ...baseDb.data[0], content: 'Remote manual edit' }],
  };
  const plan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    baseDb,
    generateExportData(remoteOnlyDb.data, [], [], remoteOnlyDb.budgetConfig!, {}, remoteOnlyDb.appSettings!),
    existingExportSheetTitles,
    new Set(),
    false,
    remoteOnlyDb,
  );

  assert.equal(plan.canIncremental, true);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.appends, []);
  assert.deepEqual(plan.rewrites, []);
});

test('incremental plan ignores generated dashboard sheet drift during routine saves', () => {
  const nextDb: DbSchema = {
    ...baseDb,
    data: [{ ...baseDb.data[0], content: 'Updated note' }],
  };
  const exportSheets = generateExportData(nextDb.data, [], [], nextDb.budgetConfig!, {}, nextDb.appSettings!);
  const dashboard = exportSheets.find(sheet => sheet.name === 'Sheet1');
  assert.ok(dashboard);
  dashboard!.data = [['changed dashboard generated content']];

  const plan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    nextDb,
    exportSheets,
    existingExportSheetTitles,
    new Set(),
    false,
  );

  assert.equal(plan.canIncremental, true);
  assert.equal(plan.rewrites.some(sheet => sheet.name === 'Sheet1'), false);
  assert.ok(plan.updates.some(update => update.range === "'Notes & Journals'!A2:F2"));
});
