import test from 'node:test';
import assert from 'node:assert/strict';
import { __test__ } from '../spreadsheetService';
import { reconcileSpreadsheetData } from '../spreadsheetReconciler';
import { generateExportData } from '../../utils/exportUtils';
import type { DbSchema } from '../../types';

const budget = { monthlyIncome: 1234567, rules: [
  { id: 'needs', name: 'Kebutuhan', percentage: 62.5, color: 'bg-blue-500' },
  { id: 'Monthly Income', name: 'Cadangan', percentage: 0, color: 'bg-green-500' },
] };
const db: DbSchema = { data: [], budgetConfig: budget, appSettings: { defaultCollapsed: false, hideMoney: false } };
const exportDb = (value = db) => generateExportData(value.data, [], [], value.budgetConfig!, {}, value.appSettings!);
const ranges = (sheets: ReturnType<typeof exportDb>) => sheets.map(sheet => ({ range: `'${sheet.name}'!A1:ZZ1000`, values: sheet.data }));

test('structured budget round-trips through loading and reconciliation with typed values', () => {
  const sheets = exportDb();
  const rules = sheets.find(sheet => sheet.name === 'Budget Rules')!;
  assert.deepEqual(rules.data[0], ['ID', 'Name', 'Percentage', 'Color']);
  assert.equal(rules.data[1][2], 62.5);
  assert.equal(__test__.parseConfigSheets(ranges(sheets)).budgetConfig?.monthlyIncome, 1234567);
  assert.deepEqual(__test__.parseConfigSheets(ranges(sheets)).budgetConfig, budget);
  assert.deepEqual(__test__.parseConfigSheets(ranges(sheets).reverse()).budgetConfig, budget);
  assert.deepEqual(reconcileSpreadsheetData({ data: [] }, ranges(sheets)).budgetConfig, budget);
});

test('legacy budget remains readable, including decimal percentages and explicit zero income', () => {
  const input = [{ range: "'Budget Rules'!A:C", values: [
    ['Property', 'Value', 'Color'], ['Monthly Income', 0, ''],
    ['Rule: Kebutuhan', '62.5% (ID: needs)', 'bg-blue-500'],
  ] }];
  const expected = { monthlyIncome: 0, rules: [budget.rules[0]] };
  assert.deepEqual(__test__.parseConfigSheets(input).budgetConfig, expected);
  assert.deepEqual(reconcileSpreadsheetData({ data: [] }, input).budgetConfig, expected);
});

test('reordered budget columns preserve IDs that resemble legacy property names', () => {
  const input = [{ range: "'Budget Rules'!A:D", values: [
    ['Name', 'Color', 'Percentage', 'ID'], ['Cadangan', 'bg-green-500', 0, 'Monthly Income'],
  ] }];
  assert.deepEqual(__test__.parseConfigSheets(input).budgetConfig?.rules, [budget.rules[1]]);
  assert.deepEqual(reconcileSpreadsheetData({ data: [] }, input).budgetConfig?.rules, [budget.rules[1]]);
});

test('header-only budget removes all categories without discarding income in settings', () => {
  const sheets = exportDb({ ...db, budgetConfig: { monthlyIncome: budget.monthlyIncome, rules: [] } });
  const parsed = __test__.parseConfigSheets(ranges(sheets));
  assert.deepEqual(parsed.budgetConfig, { monthlyIncome: budget.monthlyIncome, rules: [] });
  const reconciled = reconcileSpreadsheetData(structuredClone(db), ranges(sheets));
  assert.deepEqual(reconciled.budgetConfig, parsed.budgetConfig);
});

test('unchanged physical projections skip rewrites, ignoring omitted trailing blank cells', () => {
  const sheets = exportDb();
  const physical = structuredClone(sheets);
  physical.forEach(sheet => {
    sheet.data.forEach(row => { while (row.length && row[row.length - 1] === '') row.pop(); });
    while (sheet.data.length && sheet.data[sheet.data.length - 1].length === 0) sheet.data.pop();
  });
  const plan = __test__.buildIncrementalUserSheetPlan(db, db, sheets, new Set(sheets.map(s => s.name)), new Set(), false, db, new Set(), physical);
  assert.equal(plan.reason, 'no_changes');
  assert.deepEqual(plan.rewrites, []);
  physical.find(s => s.name === 'Sheet1')!.data[0][0] = 'stale report';
  const changed = __test__.buildIncrementalUserSheetPlan(db, db, sheets, new Set(sheets.map(s => s.name)), new Set(), false, db, new Set(), physical);
  assert.deepEqual(changed.rewrites.map(s => s.name), ['Sheet1']);
});

test('income edits rewrite settings while keeping unchanged budget category rows', () => {
  const next = { ...db, budgetConfig: { ...budget, monthlyIncome: 0 } };
  const sheets = exportDb(next);
  const plan = __test__.buildIncrementalUserSheetPlan(db, next, sheets, new Set(sheets.map(s => s.name)), new Set(), false, db, new Set(), exportDb());
  assert.ok(plan.rewrites.some(s => s.name === 'Themes & Settings'));
  assert.ok(!plan.rewrites.some(s => s.name === 'Budget Rules'));
});

test('partial config reads preserve budget fields owned by absent tabs', () => {
  const rulesOnly = [{ range: "'Budget Rules'!A:D", values: [['ID', 'Name', 'Percentage', 'Color']] }];
  const noRules = __test__.applyConfigSheetsToBaseDb(db, rulesOnly);
  assert.deepEqual(noRules.budgetConfig, { monthlyIncome: budget.monthlyIncome, rules: [] });
  const settingsOnly = [{ range: "'Themes & Settings'!A:D", values: [
    ['Type', 'Key', 'Value', 'Hero_Image_URL'], ['Setting', 'Monthly Income', 0, ''],
  ] }];
  assert.deepEqual(__test__.applyConfigSheetsToBaseDb(db, settingsOnly).budgetConfig, { monthlyIncome: 0, rules: budget.rules });
});

test('elapsed seconds alone do not force a report rewrite', () => {
  const at = (time: string) => generateExportData([], [], [], budget, {}, db.appSettings!, new Date(time));
  const earlier = at('2026-09-26T09:00:00');
  const later = at('2026-09-26T09:01:00');
  const plan = __test__.buildIncrementalUserSheetPlan(db, db, later, new Set(later.map(s => s.name)), new Set(), false, db, new Set(), earlier);
  assert.deepEqual(plan.rewrites, []);
});

test('budget layout upgrades once without reformatting other tabs', () => {
  const old = { properties: { title: 'Budget Rules', sheetId: 4 }, developerMetadata: [
    { metadataKey: 'arkaiv.compact-presentation', metadataValue: '1' },
  ] };
  assert.equal(__test__.hasCompactPresentationVersion(old), false);
  assert.equal(__test__.hasCompactPresentationVersion({ ...old, properties: { title: 'Transactions' } }), true);
  assert.equal(__test__.hasCompactPresentationVersion({ ...old, developerMetadata: [
    { metadataKey: 'arkaiv.compact-presentation', metadataValue: '3' },
  ] }), true);
});
