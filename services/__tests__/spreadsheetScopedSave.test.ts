import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemType, type DbSchema } from '../../types';
import { __test__ } from '../spreadsheetService';
import { generateExportData } from '../../utils/exportUtils';
import { splitSheetsBatch } from '../../utils/spreadsheetBatch';
import { reconcileSpreadsheetData } from '../spreadsheetReconciler';
const base: DbSchema = { data: [{ id: 'one', type: ItemType.NOTE, content: 'old', status: 'pending', created_at: '2026-10-01', meta: {} }] };
test('one note edit selects only its owning table; no derived sheets enter routine domain export', () => {
  const next = { data: [{ ...base.data[0], content: 'new' }] };
  assert.deepEqual([...__test__.dirtySheetNames(base, next)], ['Notes & Journals']);
  const sheets = generateExportData(next.data, [], [], { monthlyIncome: 0, rules: [] }, {}, { defaultCollapsed: false, hideMoney: false }, new Date(), { includeDerived: false });
  assert.equal(sheets.some(sheet => ['Sheet1', 'Data Quality'].includes(sheet.name)), false);
});
test('payload groups are byte bounded, preserving every range in order', () => {
  const entries = Array.from({ length: 7 }, (_, index) => ({ range: `A${index}`, values: [['x'.repeat(100)]] }));
  const groups = splitSheetsBatch(entries, 450);
  assert.deepEqual(groups.flat(), entries);
  assert.ok(groups.length > 1);
  for (const group of groups) assert.ok(new TextEncoder().encode(JSON.stringify(group)).length < 450);
});
test('complete header-only reads represent a real remote deletion; partial import retains its legacy protection', () => {
  const rows = [{ range: "'Notes & Journals'!A:I", values: [['Date', 'Type', 'Title', 'Content', 'Tags', 'Status', 'ID']] }];
  assert.deepEqual(reconcileSpreadsheetData(base, rows, { authoritativeEmpty: true }).data, []);
  assert.equal(reconcileSpreadsheetData(base, rows).data.length, 1);
});
