import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSpreadsheetConfig,
  normalizeSpreadsheetConfig,
  saveSpreadsheetConfig,
  SERVICE_ACCOUNT_EMAIL,
  SPREADSHEET_FETCH_RANGES,
  __test__,
} from '../spreadsheetService';
import { generateExportData } from '../../utils/exportUtils';
import { DbSchema, ItemType } from '../../types';

test('spreadsheet fetch ranges include the expanded schema columns', () => {
  assert.equal(SPREADSHEET_FETCH_RANGES.Transactions, 'A:S');
  assert.equal(SPREADSHEET_FETCH_RANGES.Todos, 'A:AA');
  assert.equal(SPREADSHEET_FETCH_RANGES.Shopping, 'A:P');
  assert.equal(SPREADSHEET_FETCH_RANGES.Events, 'A:I');
  assert.equal(SPREADSHEET_FETCH_RANGES['Notes & Journals'], 'A:G');
  assert.equal(SPREADSHEET_FETCH_RANGES['Skill Logs'], 'A:I');
  assert.equal(SPREADSHEET_FETCH_RANGES['Canonical Rules'], 'A:U');
  assert.equal(Object.prototype.hasOwnProperty.call(SPREADSHEET_FETCH_RANGES, 'Data Quality'), false);
});

const installLocalStorage = () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
    },
  });
  return store;
};

test('spreadsheet config defaults legacy configs to service-account mode', () => {
  const normalized = normalizeSpreadsheetConfig({
    spreadsheetId: 'sheet-123',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-123/edit',
  });

  assert.equal(normalized?.authMode, 'service_account');
  assert.equal(normalized?.serviceAccountEmail, SERVICE_ACCOUNT_EMAIL);
});

test('getSpreadsheetConfig migrates stored spreadsheet configs without requiring OAuth', () => {
  const store = installLocalStorage();
  store.set('braindump_spreadsheet_config', JSON.stringify({
    spreadsheetId: 'sheet-456',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-456/edit',
  }));

  const config = getSpreadsheetConfig();
  assert.equal(config?.authMode, 'service_account');
  assert.equal(config?.serviceAccountEmail, SERVICE_ACCOUNT_EMAIL);

  const persisted = JSON.parse(store.get('braindump_spreadsheet_config') || '{}');
  assert.equal(persisted.authMode, 'service_account');
  assert.equal(persisted.serviceAccountEmail, SERVICE_ACCOUNT_EMAIL);
});

test('saveSpreadsheetConfig persists service-account identity for Sheets sync', () => {
  const store = installLocalStorage();

  saveSpreadsheetConfig({
    spreadsheetId: 'sheet-789',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sheet-789/edit',
  });

  const persisted = JSON.parse(store.get('braindump_spreadsheet_config') || '{}');
  assert.equal(persisted.authMode, 'service_account');
  assert.equal(persisted.serviceAccountEmail, SERVICE_ACCOUNT_EMAIL);
});

test('dedicated spreadsheet export sheets reload with config intact', () => {
  const sourceDb: DbSchema = {
    data: [{
      id: 'finance-1',
      type: ItemType.FINANCE,
      content: 'Lunch',
      status: 'done',
      created_at: '2026-05-12T01:00:00.000Z',
      completed_at: '2026-05-12T01:00:00.000Z',
      meta: {
        date: '2026-05-12T01:00:00.000Z',
        amount: 50000,
        financeType: 'expense',
        budgetCategory: 'food',
        paymentMethod: 'cash',
      },
    }],
    wallets: [{ id: 'cash', name: 'Cash', type: 'cash', initialBalance: 100000, color: 'bg-green-500' }],
    skills: [{ id: 'skill-1', name: 'Writing', weeklyTargetMinutes: 120, created_at: '2026-05-01T00:00:00.000Z', color: 'indigo-500' }],
    budgetConfig: { monthlyIncome: 1000000, rules: [{ id: 'food', name: 'Food', percentage: 50, color: 'bg-blue-500' }] },
    monthlyThemes: { '2026-05': 'Ship the migration' },
    appSettings: { defaultCollapsed: true, hideMoney: true, googleCalendarSyncEnabled: true, googleCalendarId: 'primary' },
  };

  const valueRanges = generateExportData(
    sourceDb.data,
    sourceDb.skills!,
    sourceDb.wallets!,
    sourceDb.budgetConfig!,
    sourceDb.monthlyThemes!,
    sourceDb.appSettings!,
  ).map(sheet => ({ range: `'${sheet.name}'!A1`, values: sheet.data }));

  const reloaded = __test__.buildDedicatedDbFromValueRanges(valueRanges);

  assert.equal(reloaded.data.length, 1);
  assert.equal(reloaded.data[0].id, 'finance-1');
  assert.equal(reloaded.data[0].meta.budgetCategory, 'food');
  assert.equal(reloaded.wallets?.[0].name, 'Cash');
  assert.equal(reloaded.skills?.[0].weeklyTargetMinutes, 120);
  assert.equal(reloaded.budgetConfig?.monthlyIncome, 1000000);
  assert.deepEqual(reloaded.budgetConfig?.rules, [{ id: 'food', name: 'Food', percentage: 50, color: 'bg-blue-500' }]);
  assert.equal(reloaded.monthlyThemes?.['2026-05'], 'Ship the migration');
  assert.equal(reloaded.appSettings?.defaultCollapsed, true);
  assert.equal(reloaded.appSettings?.hideMoney, true);
  assert.equal(reloaded.appSettings?.googleCalendarSyncEnabled, true);
  assert.equal(reloaded.appSettings?.googleCalendarId, 'primary');
});

test('dedicated event rows preserve sheet IDs across reloads', () => {
  const valueRanges = [{
    range: "'Events'!A1:H",
    values: [
      ['Type', 'Date', 'Start_Date', 'End_Date', 'Priority', 'Event', 'Tags', 'ID'],
      ['EVENT', '2026-05-02T00:00:00.000Z', '', '', 'normal', 'Event di SCBD buat bikin relasi', 'event, business', 'event-sheet-id'],
    ],
  }];

  const firstReload = __test__.buildDedicatedDbFromValueRanges(valueRanges);
  const secondReload = __test__.buildDedicatedDbFromValueRanges(valueRanges);

  assert.equal(firstReload.data.length, 1);
  assert.equal(firstReload.data[0].id, 'event-sheet-id');
  assert.equal(secondReload.data[0].id, 'event-sheet-id');
});

test('dedicated reload migrates legacy raw skill logs when Skill Logs sheet is absent', () => {
  const rawHeaders = [
    'ID', 'Type', 'Title', 'Content', 'Status', 'Created_At', 'Completed_At', 'Date', 'Amount', 'Tags',
    'Payment_Method', 'Canonical_Payment_Method', 'Merchant', 'Canonical_Merchant', 'Commodity', 'Canonical_Commodity',
    'Subcommodity', 'Canonical_Subcommodity', 'To_Wallet', 'Finance_Type', 'Budget_Category', 'Skill_Name', 'Skill_ID', 'Duration_Minutes'
  ];
  const valueRanges = [
    {
      range: "'Notes & Journals'!A1:F",
      values: [
        ['Date', 'Type', 'Title', 'Content', 'Tags', 'ID'],
        ['2026-05-12T01:00:00.000Z', 'NOTE', 'Note', 'Dedicated note', '', 'note-1'],
      ],
    },
    {
      range: "'All Items (Raw)'!A:AZ",
      values: [
        rawHeaders,
        ['skill-log-1', 'SKILL_LOG', '', 'Practice guitar', 'done', '2026-05-12T02:00:00.000Z', '2026-05-12T02:30:00.000Z', '2026-05-12T02:00:00.000Z', '', 'music', '', '', '', '', '', '', '', '', '', '', '', 'Guitar', 'skill-guitar', 30],
      ],
    },
  ];

  const reloaded = __test__.buildDedicatedDbFromValueRanges(valueRanges);

  assert.equal(reloaded.data.length, 2);
  const skillLog = reloaded.data.find(item => item.id === 'skill-log-1');
  assert.equal(skillLog?.type, ItemType.SKILL_LOG);
  assert.equal(skillLog?.meta.skillName, 'Guitar');
  assert.equal(skillLog?.meta.durationMinutes, 30);
});
