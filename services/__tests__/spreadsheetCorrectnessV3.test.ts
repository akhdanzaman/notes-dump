import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemType, type DbSchema } from '../../types';
import { generateExportData } from '../../utils/exportUtils';
import { decodeSheetNumber } from '../../utils/spreadsheetCodec';
import { parseConfigSheets } from '../../utils/spreadsheetConfig';
import { reconcileSpreadsheetData } from '../spreadsheetReconciler';
import { __test__, saveSpreadsheetConfig, clearSpreadsheetConfig } from '../spreadsheetService';
const config = { data: [], wallets: [{ id: 'cash', name: 'Cash', type: 'cash', initialBalance: 100000, color: 'green' }], skills: [], budgetConfig: { monthlyIncome: 0, rules: [] }, monthlyThemes: {}, appSettings: { defaultCollapsed: false, hideMoney: false } } as DbSchema;
const tx = { id: 'one', type: ItemType.FINANCE, content: 'Lunch', status: 'done' as const, created_at: '2026-10-01T00:00:00.000Z', completed_at: '2026-10-01T00:00:00.000Z', meta: { date: '2026-10-01T00:00:00.000Z', amount: 20000, financeType: 'expense' as const, paymentMethod: 'cash', merchant: 'shop', tags: ['food'], currency: 'IDR', originalCurrency: 'USD', originalAmount: 1.25, exchangeRateToIdr: 16000, canonical: { merchant: { rawValue: 'shop', value: 'Shop', confidence: 0.95, source: 'manual_review' as const, reason: 'User approved', needsReview: false } } } };
function transactionRows() { return generateExportData([structuredClone(tx)], [], config.wallets!, config.budgetConfig!, {}, config.appSettings!).find(sheet => sheet.name === 'Transactions')!.data; }
test('cold reload retains currency, original amount/rate and canonical provenance', () => {
  const loaded = reconcileSpreadsheetData(structuredClone(config), [{ range: "'Transactions'!A:AC", values: transactionRows() }]);
  assert.equal(loaded.data.length, 1);
  for (const field of ['currency', 'originalCurrency', 'originalAmount', 'exchangeRateToIdr'] as const) assert.equal(loaded.data[0].meta[field], tx.meta[field]);
  assert.deepEqual(loaded.data[0].meta.canonical?.merchant, tx.meta.canonical.merchant);
});
test('legacy headers never read Tags/ID as new payment attributes', () => {
  const loaded = reconcileSpreadsheetData(structuredClone(config), [{ range: "'Transactions'!A:I", values: [['Date', 'Type', 'Category', 'Description', 'Amount', 'Wallet', 'To_Wallet', 'Tags', 'ID'], ['2026-10-01', 'expense', '', 'Lunch', 20000, 'Cash', '', 'food', 'legacy']] }]);
  assert.equal(loaded.data[0].meta.paymentMethod, 'cash');
  assert.equal(loaded.data[0].meta.canonical, undefined);
});
test('typed tags normalize without throwing and blank canonical cell clears an approved mapping', () => {
  const values = transactionRows(); const header = values[0];
  values[1][header.indexOf('Tags')] = 123;
  values[1][header.indexOf('Canonical_Merchant')] = '';
  const loaded = reconcileSpreadsheetData({ ...structuredClone(config), data: [structuredClone(tx)] }, [{ range: "'Transactions'!A:AC", values }]);
  assert.deepEqual(loaded.data[0].meta.tags, ['123']);
  assert.equal(loaded.data[0].meta.canonical?.merchant, undefined);
});
test('malformed structured cells stop safely with a row-specific error', () => {
  const values = transactionRows(); values[1][values[0].indexOf('Line_Items')] = '{bad-json';
  const base = { ...structuredClone(config), data: [structuredClone(tx)] }; const before = structuredClone(base);
  assert.throws(() => reconcileSpreadsheetData(base, [{ range: "'Transactions'!A:AC", values }]), /row 2 Line_Items: Malformed JSON/);
  assert.deepEqual(base, before);
});
test('currency formats parse without shrinking amounts; formula text is rejected', () => {
  for (const value of ['Rp 100.000', 'Rp 100,000']) assert.equal(decodeSheetNumber(value), 100000);
  assert.equal(decodeSheetNumber('Rp 20,000'), 20000);
  assert.equal(decodeSheetNumber('12.500,25'), 12500.25);
  assert.throws(() => decodeSheetNumber('=10000+20000'), /computed number/);
  assert.equal(parseConfigSheets([{ range: "'Wallets Config'!A:E", values: [['ID', 'Name', 'Type', 'Initial_Balance', 'Color'], ['cash', 'Cash', 'cash', 'Rp 100.000', 'green']] }]).wallets[0].initialBalance, 100000);
});
test('delete then update adjusts the range to the surviving row, preserving other IDs', async t => {
  const storage = new Map<string, string>();
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });
  saveSpreadsheetConfig({ spreadsheetId: 'synthetic', spreadsheetUrl: '' });
  t.after(() => { clearSpreadsheetConfig(); if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  const rows = [['ID', 'Content'], ['a', 'old-a'], ['b', 'old-b'], ['c', 'old-c']];
  t.mock.method(globalThis, 'fetch', async (input: any, init?: RequestInit) => {
    if (String(input).endsWith('/session')) return Response.json({ csrfToken: 'synthetic' });
    const path = new URL(String(input), 'https://synthetic').searchParams.get('path');
    const body = JSON.parse(String(init?.body || '{}'));
    if (path === ':batchUpdate') for (const request of body.requests) rows.splice(request.deleteDimension.range.startIndex, 1);
    if (path === '/values:batchUpdate') for (const entry of body.data) { const row = Number(entry.range.match(/!A(\d+)/)[1]); rows[row - 1] = entry.values[0]; }
    return Response.json({});
  });
  await __test__.writeIncrementalUserSheetPlan({ spreadsheetId: 'synthetic', spreadsheetUrl: '' }, { canIncremental: true, deletions: [{ sheetName: 'Notes & Journals', rowNumber: 2 }], updates: [{ range: "'Notes & Journals'!A3:B3", values: [['b', 'edited-b']] }], appends: [], rewrites: [] }, new Map([['Notes & Journals', 1]]));
  assert.deepEqual(rows, [['ID', 'Content'], ['b', 'edited-b'], ['c', 'old-c']]);
});
