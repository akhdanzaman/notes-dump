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

test('compact spreadsheet presentation is applied once to existing legacy sheets', () => {
  const legacySheet = { properties: { title: 'Transactions', sheetId: 3 } };
  const formattedSheet = {
    ...legacySheet,
    developerMetadata: [{ metadataKey: 'arkaiv.compact-presentation', metadataValue: '1' }],
  };

  assert.equal(__test__.hasCompactPresentationVersion(legacySheet), false);
  assert.equal(__test__.shouldApplyCompactSheetPresentation('Transactions', legacySheet, new Set(), false), true);
  assert.equal(__test__.hasCompactPresentationVersion(formattedSheet), true);
  assert.equal(__test__.shouldApplyCompactSheetPresentation('Transactions', formattedSheet, new Set(), false), false);
});

test('compact data sheets freeze and filter headers while hiding internal columns', () => {
  const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Wallet', 'To_Wallet', 'Payment_Method', 'Canonical_Payment_Method', 'Merchant', 'Canonical_Merchant', 'Commodity', 'Canonical_Commodity', 'Subcommodity', 'Canonical_Subcommodity', 'Tags', 'Created_At', 'Completed_At', 'ID'];
  const requests = __test__.buildCompactSheetFormattingRequests(3, headers, {
    name: 'Transactions',
    tabColor: '#2563EB',
    visibleHeaders: ['Date', 'Type', 'Category', 'Description', 'Amount', 'Wallet', 'To_Wallet', 'Merchant', 'Tags'],
    widths: { Description: 340, Amount: 135 },
    wrappedHeaders: ['Description', 'Tags'],
    currencyHeaders: ['Amount'],
    validationLists: { Type: ['expense', 'income', 'transfer'] },
    requiredHeaders: ['Date', 'Description', 'Amount', 'Wallet'],
    positiveAmountHeader: 'Amount',
  }, 2);

  assert.ok(requests.some(request => request.updateSheetProperties?.properties?.gridProperties?.frozenRowCount === 1));
  assert.ok(requests.some(request => request.setBasicFilter?.filter?.range?.endColumnIndex === headers.length));
  assert.ok(requests.some(request => request.updateDimensionProperties?.properties?.hiddenByUser === true));
  assert.ok(requests.some(request => request.updateDimensionProperties?.properties?.pixelSize === 340));
  assert.ok(requests.some(request => request.repeatCell?.cell?.userEnteredFormat?.numberFormat?.pattern?.includes('Rp')));
  assert.ok(requests.some(request => request.setDataValidation?.rule?.condition?.type === 'ONE_OF_LIST'));
  assert.ok(requests.some(request => request.addConditionalFormatRule?.rule?.booleanRule?.condition?.values?.[0]?.userEnteredValue?.includes('COUNTA')));
  assert.ok(requests.some(request => request.createDeveloperMetadata?.developerMetadata?.metadataKey === 'arkaiv.compact-presentation'));
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

test('canonical sheet rewrites clear the complete prior managed range before writing current rows', () => {
  const batches = __test__.buildSheetRewriteBatches({
    name: 'Transactions',
    inputOption: 'RAW',
    previousRowCount: 4,
    previousColumnCount: 3,
    data: [
      ['ID', 'Amount'],
      ['tx-1', 5000],
    ],
  }, 10);

  assert.equal(__test__.buildSheetClearRange({
    name: 'Transactions',
    inputOption: 'RAW',
    previousRowCount: 4,
    previousColumnCount: 3,
    data: [
      ['ID', 'Amount'],
      ['tx-1', 5000],
    ],
  }), "'Transactions'!A1:C4");
  assert.deepEqual(batches.map(batch => batch.range), ["'Transactions'!A1:B2"]);
  assert.deepEqual(batches[0].values, [
    ['ID', 'Amount'],
    ['tx-1', 5000],
  ]);
});

test('event log sheet exposes save activity and error rows for spreadsheet inspection', () => {
  const sheet = __test__.buildEventLogSheet();
  const row = __test__.buildEventLogRow('error', 'write_sheet', 'save_failed', 'proxy invocation failed', 'save-1');

  assert.equal(sheet.name, 'Event Log');
  assert.deepEqual(sheet.data[0], ['Timestamp', 'Level', 'Phase', 'Action', 'Detail', 'Save_ID', 'Version', 'User_Agent']);
  assert.equal(row[1], 'error');
  assert.equal(row[2], 'write_sheet');
  assert.equal(row[3], 'save_failed');
  assert.equal(row[5], 'save-1');
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
  assert.equal(
    await __test__.shouldUseOauthFallbackForServiceAccountResponse(new Response('A server error has occurred FUNCTION_INVOCATION_FAILED sin1::abc', { status: 500 })),
    true,
  );
  assert.equal(
    await __test__.shouldUseOauthFallbackForServiceAccountResponse(new Response('{"error":"Spreadsheet is not allowlisted"}', { status: 400 })),
    false,
  );
  assert.equal(
    await __test__.shouldUseOauthFallbackForServiceAccountResponse(new Response('{"error":"The caller does not have permission"}', { status: 403 })),
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
  assert.ok(plan.updates.some(update => update.range === "'Notes & Journals'!A2:G2"));
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

test('incremental plan appends rows for new items even when inserted above existing rows', () => {
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
  assert.ok(plan.appends.some(append => append.sheetName === 'Notes & Journals'));
  assert.equal(plan.deletions.length, 0);
});

test('incremental plan deletes rows for removed items and rewrites config changes only', () => {
  const deletedPlan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    { ...baseDb, data: [] },
    generateExportData([], [], [], baseDb.budgetConfig!, {}, baseDb.appSettings!),
    existingExportSheetTitles,
    new Set(),
    false,
  );
  assert.equal(deletedPlan.canIncremental, true);
  assert.equal(deletedPlan.deletions.length, 1);
  assert.equal(deletedPlan.deletions[0].sheetName, 'Notes & Journals');
  assert.equal(deletedPlan.rewrites.filter(s => s.name === 'Notes & Journals').length, 0);

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
  assert.equal(configPlan.deletions.length, 0);
});

test('incremental plan does not write back remote-only item rows outside generated sheet refreshes', () => {
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
  assert.deepEqual(plan.deletions, []);
  assert.deepEqual(plan.rewrites.map(sheet => sheet.name).sort(), ['Data Quality', 'Sheet1']);
});

test('incremental plan refreshes Dashboard and Data Quality during routine saves', () => {
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
  assert.equal(plan.rewrites.some(sheet => sheet.name === 'Sheet1'), true);
  assert.equal(plan.rewrites.some(sheet => sheet.name === 'Data Quality'), true);
  assert.equal(plan.deletions.length, 0);
  assert.ok(plan.updates.some(update => update.range === "'Notes & Journals'!A2:G2"));
});

test('incremental plan rewrites user sheets when physical headers are stale', () => {
  const exportSheets = generateExportData(baseDb.data, [], [], baseDb.budgetConfig!, {}, baseDb.appSettings!);
  const plan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    baseDb,
    exportSheets,
    existingExportSheetTitles,
    new Set(),
    false,
    baseDb,
    new Set(['Shopping']),
  );

  assert.equal(plan.canIncremental, true);
  assert.ok(plan.rewrites.some(sheet => sheet.name === 'Shopping'));
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.appends, []);
});

test('save merge keeps local items that are still present in the app when sheet read misses them', () => {
  const mergedAfterRemoteDelete: DbSchema = {
    ...baseDb,
    data: [],
  };

  const preserved = __test__.preserveLocalItemsStillPresentInApp(baseDb, mergedAfterRemoteDelete);

  assert.equal(preserved.data.length, 1);
  assert.equal(preserved.data[0].id, 'note-1');
});

test('write verification detects item ids missing from required destination sheets', () => {
  const db: DbSchema = {
    ...baseDb,
    data: [
      ...baseDb.data,
      {
        id: 'shopping-done-1',
        type: ItemType.SHOPPING,
        content: 'Bought rice',
        status: 'done',
        created_at: '2026-05-10T02:00:00.000Z',
        completed_at: '2026-05-10T02:05:00.000Z',
        meta: { shoppingCategory: 'urgent', amount: 25000 },
      },
    ],
  };

  const expected = __test__.getExpectedItemIdsBySheet(db.data);
  const actual = __test__.getItemIdsBySheetFromValueRanges([
    {
      range: "'Notes & Journals'!A:G",
      values: [
        ['Date', 'Type', 'Title', 'Content', 'Tags', 'ID'],
        ['2026-05-10', 'NOTE', 'Daily', 'Old note', '', 'note-1'],
      ],
    },
    {
      range: "'Shopping'!A:AA",
      values: [
        ['Item', 'Category', 'Amount', 'Status', 'Created_At', 'Completed_At', 'Tags', 'ID'],
        ['Bought rice', 'urgent', 25000, 'done', '2026-05-10', '2026-05-10', '', 'shopping-done-1'],
      ],
    },
    {
      range: "'Transactions'!A:V",
      values: [
        ['Date', 'Type', 'Category', 'Description', 'Amount', 'Wallet', 'To_Wallet', 'Payment_Method', 'ID'],
      ],
    },
  ]);

  const missing = __test__.findMissingExpectedItemRows(expected, actual);

  assert.deepEqual(missing, [{ sheetName: 'Transactions', itemId: 'shopping-done-1' }]);
});

test('physical row indexes retain every duplicate occurrence and delete all copies bottom-up', () => {
  const nextDb: DbSchema = { ...baseDb, data: [] };
  const previousNoteSheet = generateExportData(
    baseDb.data,
    [],
    [],
    baseDb.budgetConfig!,
    {},
    baseDb.appSettings!,
  ).find(sheet => sheet.name === 'Notes & Journals');
  assert.ok(previousNoteSheet);

  const physicalNoteSheet = {
    ...previousNoteSheet!,
    data: [
      previousNoteSheet!.data[0],
      previousNoteSheet!.data[1],
      previousNoteSheet!.data[1],
    ],
  };
  const indexes = __test__.buildSheetRowIndexes([physicalNoteSheet]);
  assert.deepEqual(indexes.get('Notes & Journals')?.rowNumbersById.get('note-1'), [2, 3]);

  const plan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    nextDb,
    generateExportData([], [], [], baseDb.budgetConfig!, {}, baseDb.appSettings!),
    existingExportSheetTitles,
    new Set(),
    false,
    baseDb,
    new Set(),
    [physicalNoteSheet],
  );

  assert.deepEqual(
    plan.deletions.filter(deletion => deletion.sheetName === 'Notes & Journals').map(deletion => deletion.rowNumber),
    [2, 3],
  );
});

test('moving an item deletes all physical old-sheet occurrences before appending the destination row', () => {
  const movedDb: DbSchema = {
    ...baseDb,
    data: [{ ...baseDb.data[0], type: ItemType.TODO, content: 'Now a todo' }],
  };
  const previousNoteSheet = generateExportData(
    baseDb.data,
    [],
    [],
    baseDb.budgetConfig!,
    {},
    baseDb.appSettings!,
  ).find(sheet => sheet.name === 'Notes & Journals');
  assert.ok(previousNoteSheet);
  const physicalNoteSheet = {
    ...previousNoteSheet!,
    data: [previousNoteSheet!.data[0], previousNoteSheet!.data[1], previousNoteSheet!.data[1]],
  };

  const plan = __test__.buildIncrementalUserSheetPlan(
    baseDb,
    movedDb,
    generateExportData(movedDb.data, [], [], movedDb.budgetConfig!, {}, movedDb.appSettings!),
    existingExportSheetTitles,
    new Set(),
    false,
    baseDb,
    new Set(),
    [physicalNoteSheet],
  );

  assert.deepEqual(
    plan.deletions.filter(deletion => deletion.sheetName === 'Notes & Journals').map(deletion => deletion.rowNumber),
    [2, 3],
  );
  assert.ok(plan.appends.some(append => append.sheetName === 'Todos'));
});

test('rewrite execution clears the actual prior range before sending canonical values', async () => {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  const fetcher = async (_spreadsheetId: string, path: string, init?: RequestInit) => {
    calls.push({ path, init });
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  await __test__.rewriteSheetValuesInBulk(
    { spreadsheetId: 'sheet-1', spreadsheetUrl: 'https://example.invalid/sheet-1' },
    {
      name: 'Transactions',
      inputOption: 'RAW',
      previousRowCount: 4,
      previousColumnCount: 3,
      data: [['ID', 'Amount'], ['tx-1', 5000]],
    },
    0,
    1,
    undefined,
    fetcher,
  );

  assert.equal(calls.length, 2);
  assert.match(decodeURIComponent(calls[0].path), /'Transactions'!A1:C4:clear$/);
  assert.equal(calls[1].path, '/values:batchUpdate');
  const updateBody = JSON.parse(String(calls[1].init?.body));
  assert.deepEqual(updateBody.data, [{
    range: "'Transactions'!A1:B2",
    values: [['ID', 'Amount'], ['tx-1', 5000]],
  }]);
});

test('sheet verification compares ID and row-signature multisets, not unique-ID sets', () => {
  const expected = [{
    name: 'Transactions',
    inputOption: 'RAW' as const,
    data: [['ID', 'Amount'], ['tx-1', 5000]],
  }];
  const duplicateActual = [{
    range: "'Transactions'!A:B",
    values: [['ID', 'Amount'], ['tx-1', 5000], ['tx-1', 5000]],
  }];

  const duplicateMismatch = __test__.compareSheetValueMultisets(expected, duplicateActual);
  assert.equal(duplicateMismatch.length, 1);
  assert.equal(duplicateMismatch[0].actualRowCount, 3);
  assert.deepEqual(duplicateMismatch[0].unexpectedIds, ['tx-1']);
  assert.equal(duplicateMismatch[0].unexpectedRowSignatures.length, 1);

  const signatureActual = [{
    range: "'Transactions'!A:B",
    values: [['ID', 'Amount'], ['tx-1', 6000]],
  }];
  const signatureMismatch = __test__.compareSheetValueMultisets(expected, signatureActual);
  assert.deepEqual(signatureMismatch[0].missingIds, []);
  assert.deepEqual(signatureMismatch[0].unexpectedIds, []);
  assert.equal(signatureMismatch[0].missingRowSignatures.length, 1);
  assert.equal(signatureMismatch[0].unexpectedRowSignatures.length, 1);
  assert.deepEqual([...__test__.detectPhysicalSheetDrift(expected, signatureActual)], ['Transactions']);
});

test('generated-sheet formatting and charts are wired for newly created managed sheets', () => {
  const requests = __test__.buildGeneratedSheetPresentationRequests({
    sheets: [
      { properties: { title: 'Sheet1', sheetId: 0 }, charts: [] },
      { properties: { title: 'Data Quality', sheetId: 7 } },
    ],
  }, new Set(['Sheet1', 'Data Quality']), false);

  assert.ok(requests.some(request => request.addChart));
  assert.ok(requests.some(request => request.repeatCell?.range?.sheetId === 0));
  assert.ok(requests.some(request => request.repeatCell?.range?.sheetId === 7));
});

test('spreadsheet presentation compacts user tabs and hides technical tabs without changing row schemas', () => {
  const requests = __test__.buildGeneratedSheetPresentationRequests({
    sheets: [
      { properties: { title: 'Transactions', sheetId: 3 } },
      { properties: { title: 'Chat History', sheetId: 20 } },
      {
        properties: { title: 'Canonical Rules', sheetId: 21 },
        developerMetadata: [{ metadataKey: 'arkaiv.compact-presentation', metadataValue: '1' }],
      },
    ],
  }, new Set(), false, [
    {
      name: 'Transactions',
      data: [
        ['Date', 'Type', 'Category', 'Description', 'Amount', 'Wallet', 'To_Wallet', 'Payment_Method', 'Merchant', 'Tags', 'ID'],
        ['2026-08-05', 'expense', 'Food', 'Lunch', 50000, 'Cash', '', 'cash', 'Warung', '', 'tx-1'],
      ],
    },
  ]);

  assert.ok(requests.some(request => request.setBasicFilter?.filter?.range?.sheetId === 3));
  assert.ok(requests.some(request => request.updateDimensionProperties?.range?.sheetId === 3 && request.updateDimensionProperties?.properties?.hiddenByUser === true));
  assert.ok(requests.some(request => request.updateSheetProperties?.properties?.sheetId === 20 && request.updateSheetProperties?.properties?.hidden === true));
  assert.equal(requests.some(request => request.updateSheetProperties?.properties?.sheetId === 21), false);
});
