import assert from 'node:assert/strict';

import { SPREADSHEET_FETCH_RANGES } from '../services/spreadsheetService.ts';
import { ItemType } from '../types.ts';
import { DATA_QUALITY_SHEET_NAME, DASHBOARD_SHEET_NAME, generateExportData } from '../utils/exportUtils.ts';
import { buildDailyMoneyDriverSummary, buildDataQualityIssues } from '../utils/spreadsheetDiagnostics.ts';

const wallets = [
  { id: 'bca', name: 'BCA', type: 'bank', initialBalance: 1_000_000, color: 'bg-blue-500' },
  { id: 'gopay', name: 'GoPay', type: 'ewallet', initialBalance: 100_000, color: 'bg-green-500' },
];

const budgetConfig = {
  monthlyIncome: 10_000_000,
  rules: [
    { id: 'food', name: 'Food', percentage: 20, color: 'bg-orange-500' },
    { id: 'transport', name: 'Transport', percentage: 10, color: 'bg-cyan-500' },
  ],
};

const appSettings = { defaultCollapsed: false, hideMoney: false };

const finance = (id, meta, content = 'same visible name must not drive meaning') => ({
  id,
  type: ItemType.FINANCE,
  content,
  status: 'done',
  created_at: meta.date || '2026-05-04T03:00:00.000Z',
  completed_at: meta.date || '2026-05-04T03:00:00.000Z',
  meta: {
    financeType: 'expense',
    amount: 10_000,
    paymentMethod: 'bca',
    ...meta,
  },
});

const items = [
  finance('dup-1', { date: '2026-05-04T03:00:00.000Z', budgetCategory: 'food', amount: 20_000 }),
  finance('dup-1', { date: '2026-05-04T03:10:00.000Z', budgetCategory: 'missing-category', paymentMethod: 'unknown-wallet', amount: 15_000 }),
  finance('today-food', {
    date: '2026-05-04T04:00:00.000Z',
    amount: 80_000,
    budgetCategory: 'food',
    paymentMethod: 'bca',
    tags: ['lunch'],
    merchant: 'raw merchant support only',
    canonical: {
      merchant: { rawValue: 'raw merchant support only', value: 'Structured Merchant', confidence: 0.9, source: 'learned_rule' },
    },
  }, 'same-name purchase'),
  finance('today-transport-same-name', {
    date: '2026-05-04T05:00:00.000Z',
    amount: 30_000,
    budgetCategory: 'transport',
    paymentMethod: 'gopay',
  }, 'same-name purchase'),
  finance('today-transfer-missing-target', {
    date: '2026-05-04T06:00:00.000Z',
    financeType: 'transfer',
    amount: 500_000,
    paymentMethod: 'bca',
  }, 'move money'),
  finance('today-transfer-complete', {
    date: '2026-05-04T06:30:00.000Z',
    financeType: 'transfer',
    amount: 125_000,
    paymentMethod: 'bca',
    toWallet: 'gopay',
  }, 'move money'),
  finance('missing-wallet-category', { date: '2026-05-04T07:00:00.000Z', amount: 30_000, paymentMethod: '', budgetCategory: '' }),
  finance('yesterday-food', {
    date: '2026-05-03T04:00:00.000Z',
    amount: 50_000,
    budgetCategory: 'food',
    paymentMethod: 'bca',
  }),
  {
    id: 'deep-parent',
    type: ItemType.TODO,
    content: 'summary regulasi',
    status: 'pending',
    created_at: '2026-05-04T03:00:00.000Z',
    meta: { deepWorkParent: true, childTodoIds: ['missing-child'] },
  },
];

const issues = buildDataQualityIssues(items, wallets, budgetConfig);
const reasons = issues.map(issue => issue.reason).join('\n');
assert.match(reasons, /Duplicate item ID appears 2 times/);
assert.match(reasons, /wallet 'unknown-wallet' is not in Wallets Config/);
assert.match(reasons, /category 'missing-category' is not in Budget Rules/);
assert.match(reasons, /Transfer is missing To_Wallet/);
assert.match(reasons, /Deep-work parent points to missing child todo 'missing-child'/);

const drivers = buildDailyMoneyDriverSummary(items, wallets, budgetConfig, new Date('2026-05-04T12:00:00.000Z'));
assert.equal(drivers.todayExpense, 175_000);
assert.equal(drivers.yesterdayExpense, 50_000);
assert.match(drivers.spendLine, /Today spend:/);
assert.match(drivers.mainDriverLine, /Food \(category\)/);
assert.doesNotMatch(drivers.mainDriverLine, /same-name purchase/);
assert.match(drivers.walletMovementLine, /transfers\/savings excluded from spend totals/);

const validationNow = new Date('2026-05-04T12:00:00.000Z');
const sheets = generateExportData(items, [], wallets, budgetConfig, {}, appSettings, validationNow);
const dashboard = sheets.find(sheet => sheet.name === DASHBOARD_SHEET_NAME);
const dataQuality = sheets.find(sheet => sheet.name === DATA_QUALITY_SHEET_NAME);
const transactions = sheets.find(sheet => sheet.name === 'Transactions');
assert.ok(dashboard, 'Sheet1 dashboard should be generated');
assert.ok(dataQuality, 'Data Quality generated tab should be present');
assert.ok(transactions, 'Transactions sheet should remain present');
assert.equal(Object.prototype.hasOwnProperty.call(SPREADSHEET_FETCH_RANGES, DATA_QUALITY_SHEET_NAME), false);
assert.deepEqual(transactions.data[0], ['Date', 'Type', 'Category', 'Description', 'Amount', 'Wallet', 'To_Wallet', 'Tags', 'Canonical_Merchant', 'Canonical_Subcommodity', 'ID']);
assert.match(String(dashboard.data[2][0]), /Generated-only/);
assert.match(String(dashboard.data[3][0]), /SYNC HEALTH/);
assert.match(String(dashboard.data[12][1]), /Today spend:/);
assert.match(String(dashboard.data[13][1]), /Main driver:/);
assert.match(String(dashboard.data[14][1]), /transfers\/savings excluded from spend totals/);
assert.deepEqual(dataQuality.data[3], ['Severity', 'Item ID', 'Sheet/Tab', 'Reason', 'Suggested Fix']);

console.log(JSON.stringify({
  verdict: 'pass_spreadsheet_slice_1',
  issueCount: issues.length,
  todayExpense: drivers.todayExpense,
  yesterdayExpense: drivers.yesterdayExpense,
  dataQualityFetchRangePresent: Object.prototype.hasOwnProperty.call(SPREADSHEET_FETCH_RANGES, DATA_QUALITY_SHEET_NAME),
  generatedSheets: sheets.map(sheet => sheet.name).slice(0, 4),
  dashboardSampleRows: {
    guide: dashboard.data[2].slice(0, 2),
    syncHealth: dashboard.data[3].slice(0, 2),
    spendDriver: dashboard.data[12].slice(0, 2),
    mainDriver: dashboard.data[13].slice(0, 2),
    walletMovement: dashboard.data[14].slice(0, 2),
  },
  dataQualitySampleRows: dataQuality.data.slice(3, 8),
}, null, 2));
