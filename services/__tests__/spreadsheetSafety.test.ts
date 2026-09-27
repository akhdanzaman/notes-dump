import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { __test__, saveSpreadsheetConfig, clearSpreadsheetConfig, cacheSpreadsheetDbForMigration, cachePendingSpreadsheetWrite } from '../spreadsheetService';
import { generateExportData } from '../../utils/exportUtils';
import { parseSpreadsheetBudget } from '../../utils/spreadsheetBudget';
import { ItemType, type DbSchema } from '../../types';

const base: DbSchema = {
  data: ['a', 'b'].map(id => ({ id, type: ItemType.NOTE, content: `old-${id}`, status: 'pending' as const, created_at: '2026-09-01T00:00:00Z', meta: {} })),
  budgetConfig: { monthlyIncome: 100, rules: [{ id: 'needs', name: 'Needs', percentage: 50, color: 'blue' }] },
  wallets: [], skills: [], monthlyThemes: {}, appSettings: { defaultCollapsed: false, hideMoney: false },
};
const exportDb = (db: DbSchema) => generateExportData(db.data, db.skills!, db.wallets!, db.budgetConfig!, db.monthlyThemes!, db.appSettings!);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const setup = (t: TestContext) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
  clearSpreadsheetConfig();
  saveSpreadsheetConfig({ spreadsheetId: 'synthetic-safety', spreadsheetUrl: 'https://example.invalid/synthetic-safety' });
  cacheSpreadsheetDbForMigration(structuredClone(base));
  t.after(() => {
    clearSpreadsheetConfig();
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
};

test('budget rejects missing IDs, duplicate IDs and invalid percentages instead of losing rows', () => {
  const header = ['ID', 'Name', 'Percentage', 'Color'];
  assert.throws(() => parseSpreadsheetBudget([header, ['', 'Food', 50]]), /ID and Name/);
  assert.throws(() => parseSpreadsheetBudget([header, ['x', 'Food', 50], ['x', 'Other', 50]]), /duplicate ID/);
  for (const value of [-1, 101, '', 'invalid', Infinity]) {
    assert.throws(() => parseSpreadsheetBudget([header, ['x', 'Food', value]]), /between 0 and 100/);
  }
  for (const [value, expected] of [['50%', 50], ['12,5%', 12.5], [0.5, 0.5], [0, 0]] as const) {
    assert.equal(parseSpreadsheetBudget([header, ['x', 'Food', value]]).rules![0].percentage, expected);
  }
});

test('incomplete API reads are rejected while an explicitly empty range is valid', () => {
  const ranges = ["'Budget Rules'!A:D"];
  assert.throws(() => __test__.assertCompleteValueRanges(ranges, []), /incomplete read/);
  assert.throws(() => __test__.assertCompleteValueRanges(ranges, [{ range: "'Other'!A:D" }]), /invalid range/);
  assert.doesNotThrow(() => __test__.assertCompleteValueRanges(ranges, [{ range: "'Budget Rules'!A:D" }]));
});

test('failed metadata or row reads stop saving before any spreadsheet write', async t => {
  setup(t);
  for (const failMetadata of [true, false]) {
    const writes: string[] = [];
    const mock = t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/session')) return json({ csrfToken: 'synthetic' });
      const path = new URL(url, 'http://synthetic').searchParams.get('path') || '';
      if (init?.method && init.method !== 'GET') writes.push(path);
      if (!path && !failMetadata) return json({ sheets: [{ properties: { title: 'Transactions', sheetId: 1 } }] });
      return json({ error: 'synthetic read failure' }, 403);
    });
    const result = await __test__.performSync({ db: structuredClone(base) });
    assert.equal(result.success, false);
    assert.deepEqual(writes, []);
    mock.mock.restore();
  }
});

test('failed atomic rewrite sends no separate clear request', async () => {
  const calls: string[] = [];
  await assert.rejects(__test__.rewriteSheetValuesInBulk(
    { spreadsheetId: 'synthetic', spreadsheetUrl: '' },
    { name: 'Notes & Journals', data: [['ID'], ['new']], previousRowCount: 10, previousColumnCount: 4 },
    0, 1, undefined, async (_id, path) => {
      calls.push(path);
      return json({ error: 'synthetic write failure' }, 400);
    },
  ), /Failed to rewrite/);
  assert.deepEqual(calls, ['/values:batchUpdate']);
});

test('snapshot checks detect row moves, edits and missing sheets', () => {
  const original = [{ name: 'Notes & Journals', data: [['ID', 'Content'], ['a', 'one'], ['b', 'two']] }];
  assert.deepEqual(__test__.findChangedSnapshotSheets(original, [{ ...original[0], data: [['ID', 'Content', ''], ['a', 'one'], ['b', 'two'], []] }]), []);
  assert.deepEqual(__test__.findChangedSnapshotSheets(original, [{ ...original[0], data: [original[0].data[0], original[0].data[2], original[0].data[1]] }]), ['Notes & Journals']);
  assert.deepEqual(__test__.findChangedSnapshotSheets(original, []), ['Notes & Journals']);
});

test('verification covers every kind of changed tab and supports full recovery checks', () => {
  const sheets = ['Notes', 'Todos', 'Shopping', 'Config', 'Unchanged'].map(name => ({ name, data: [['ID']] }));
  const plan = { canIncremental: true, updates: [{ range: "'Notes'!A2:A2", values: [['x']] }],
    deletions: [{ sheetName: 'Todos', rowNumber: 2 }],
    appends: [{ sheetName: 'Shopping', inputOption: 'RAW' as const, values: [['y']] }], rewrites: [sheets[3]] };
  assert.deepEqual(__test__.getVerificationSheets(sheets, plan, false).map(s => s.name), ['Notes', 'Todos', 'Shopping', 'Config']);
  assert.deepEqual(__test__.getVerificationSheets(sheets, plan, true), sheets);
});

for (const continuous of [false, true]) test(continuous
  ? 'continuous concurrent edits postpone saving without writing stale values'
  : 'concurrent sheet edit triggers a fresh merge before writing, preserving both edits', async t => {
  setup(t);
  const sheets = exportDb(base);
  const rows = new Map(sheets.map(sheet => [sheet.name, structuredClone(sheet.data)]));
  rows.set('Event Log', [['Timestamp', 'Level', 'Phase', 'Action', 'Detail', 'Save_ID']]);
  let metadataReads = 0;
  let conflictChecks = 0;
  const writes: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/session')) return json({ csrfToken: 'synthetic' });
    const path = new URL(url, 'http://synthetic').searchParams.get('path') || '';
    if (!path) {
      metadataReads++;
      return json({ sheets: [...rows.keys()].map((title, index) => ({
        properties: { title, sheetId: index, gridProperties: { rowCount: 10000, columnCount: 100 } },
        developerMetadata: [{ metadataKey: 'arkaiv.compact-presentation', metadataValue: title === 'Budget Rules' ? '3' : '1' }],
        charts: [{ chartId: 1 }],
      })) });
    }
    if (path.startsWith('/values:batchGet')) {
      const query = new URL(path, 'http://synthetic').searchParams;
      const ranges = query.getAll('ranges');
      const titles = ranges.map(range => range.split('!')[0].replace(/^'|'$/g, ''));
      if (!titles.includes('Sheet1') && titles.length > 1 && writes.length === 0) {
        conflictChecks++;
        if (continuous || conflictChecks === 1) {
          const noteRows = rows.get('Notes & Journals')!;
          const contentIndex = noteRows[0].indexOf('Content');
          const idIndex = noteRows[0].indexOf('ID');
          noteRows.find(row => row[idIndex] === 'b')![contentIndex] = `remote edit ${conflictChecks}`;
          rows.get('Themes & Settings')!.find(row => row[1] === 'Monthly Income')![2] = 200;
        }
      }
      return json({ valueRanges: titles.map((title, i) => ({ range: ranges[i], values: rows.get(title) || [] })) });
    }
    writes.push(path);
    if (path === '/values:batchUpdate') {
      for (const entry of JSON.parse(String(init?.body)).data) {
        const match = entry.range.match(/^'(.+)'!([A-Z]+)(\d+):/)!;
        const target = rows.get(match[1])!;
        const start = Number(match[3]) - 1;
        entry.values.forEach((row: (string | number | boolean | null)[], offset: number) => { target[start + offset] = row; });
      }
      return json({});
    }
    if (path.includes(':append')) return json({});
    if (path === ':batchUpdate') return json({});
    throw new Error(`Unexpected request ${path}`);
  });
  const local = structuredClone(base);
  local.data[0].content = 'local edit';
  cachePendingSpreadsheetWrite(local);
  const result = await __test__.performSync({ db: local });
  if (continuous) {
    assert.equal(result.success, false);
    assert.match(result.error || '', /keeps changing/);
    assert.equal(metadataReads, 3);
    assert.deepEqual(writes, []);
    return;
  }
  assert.equal(result.success, true, result.error);
  assert.equal(metadataReads, 2);
  assert.equal(conflictChecks, 2);
  assert.equal(result.mergedData?.data.find(item => item.id === 'a')?.content, 'local edit');
  assert.equal(result.mergedData?.data.find(item => item.id === 'b')?.content, 'remote edit 1');
  assert.equal(result.mergedData?.budgetConfig?.monthlyIncome, 200);
  assert.ok(writes.length > 0);
  assert.ok(writes.every(path => !path.includes(':clear')));
});

test('native percent formatting is parsed using displayed values without changing the raw conflict snapshot', async t => {
  setup(t);
  const sheets = exportDb(base);
  const budgetSheet = sheets.find(sheet => sheet.name === 'Budget Rules')!;
  budgetSheet.data[1][2] = 0.5;
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/session')) return json({ csrfToken: 'synthetic' });
    const path = new URL(url, 'http://synthetic').searchParams.get('path') || '';
    if (!path) return json({ sheets: sheets.map((sheet, sheetId) => ({ properties: { title: sheet.name, sheetId } })) });
    const query = new URL(path, 'http://synthetic').searchParams;
    const formatted = query.get('valueRenderOption') === 'FORMATTED_VALUE';
    return json({ valueRanges: query.getAll('ranges').map(range => {
      const title = range.split('!')[0].replace(/^'|'$/g, '');
      const values = structuredClone(sheets.find(sheet => sheet.name === title)!.data);
      if (formatted && title === 'Budget Rules') values[1][2] = '50%';
      return { range, values };
    }) });
  });
  const state = await __test__.fetchUserEditableSpreadsheetDb({ spreadsheetId: 'synthetic-safety', spreadsheetUrl: '' }, structuredClone(base));
  assert.equal(state.data.budgetConfig?.rules[0].percentage, 50);
  assert.equal(state.physicalSheetData.find(sheet => sheet.name === 'Budget Rules')!.data[1][2], 0.5);
});
