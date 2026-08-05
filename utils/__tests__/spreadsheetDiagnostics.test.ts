import test from 'node:test';
import assert from 'node:assert/strict';

import { BrainDumpItem, BudgetConfig, ItemType, Wallet } from '../../types';
import { buildDailyMoneyDriverSummary, buildDataQualityIssues } from '../spreadsheetDiagnostics';

const wallets: Wallet[] = [
  { id: 'bca', name: 'BCA', type: 'bank', initialBalance: 1_000_000, color: 'bg-blue-500' },
  { id: 'gopay', name: 'GoPay', type: 'ewallet', initialBalance: 100_000, color: 'bg-green-500' },
];

const budgetConfig: BudgetConfig = {
  monthlyIncome: 10_000_000,
  rules: [
    { id: 'food', name: 'Food', percentage: 20, color: 'bg-orange-500' },
    { id: 'transport', name: 'Transport', percentage: 10, color: 'bg-cyan-500' },
  ],
};

const makeFinance = (id: string, overrides: Partial<BrainDumpItem>): BrainDumpItem => {
  const { meta: metaOverrides, ...itemOverrides } = overrides;
  return {
    id,
    type: ItemType.FINANCE,
    content: 'same visible name must not drive meaning',
    status: 'done',
    created_at: '2026-05-04T03:00:00.000Z',
    completed_at: '2026-05-04T03:00:00.000Z',
    ...itemOverrides,
    meta: {
      date: '2026-05-04T03:00:00.000Z',
      financeType: 'expense',
      amount: 10_000,
      paymentMethod: 'bca',
      ...(metaOverrides || {}),
    },
  };
};

test('data quality reports duplicate IDs, wallet/category gaps, transfer target gaps, and deep-work linkage issues', () => {
  const items: BrainDumpItem[] = [
    makeFinance('dup-1', { meta: { budgetCategory: 'food', amount: 20_000 } }),
    makeFinance('dup-1', { meta: { budgetCategory: 'missing-category', paymentMethod: 'unknown-wallet', amount: 15_000 } }),
    makeFinance('transfer-1', { meta: { financeType: 'transfer', paymentMethod: 'bca', amount: 50_000 } }),
    makeFinance('missing-wallet-category', { meta: { amount: 30_000, paymentMethod: '', budgetCategory: '' } }),
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
  assert.match(reasons, /Expense has an uncategorized transaction line/);
  assert.match(reasons, /no paymentMethod\/wallet/);
});

test('daily money drivers use structured categories before names and exclude transfers from spend totals', () => {
  const items: BrainDumpItem[] = [
    makeFinance('today-food', {
      content: 'same-name purchase',
      meta: {
        date: '2026-05-04T04:00:00.000Z',
        amount: 80_000,
        budgetCategory: 'food',
        paymentMethod: 'bca',
        tags: ['lunch'],
        merchant: 'raw merchant support only',
        canonical: {
          merchant: { rawValue: 'raw merchant support only', value: 'Structured Merchant', confidence: 0.9, source: 'learned_rule' },
        },
      },
    }),
    makeFinance('today-transport-same-name', {
      content: 'same-name purchase',
      meta: {
        date: '2026-05-04T05:00:00.000Z',
        amount: 30_000,
        budgetCategory: 'transport',
        paymentMethod: 'gopay',
      },
    }),
    makeFinance('today-transfer', {
      content: 'move money',
      meta: {
        date: '2026-05-04T06:00:00.000Z',
        financeType: 'transfer',
        amount: 500_000,
        paymentMethod: 'bca',
        toWallet: 'gopay',
      },
    }),
    makeFinance('yesterday-food', {
      meta: {
        date: '2026-05-03T04:00:00.000Z',
        amount: 50_000,
        budgetCategory: 'food',
        paymentMethod: 'bca',
      },
    }),
  ];

  const summary = buildDailyMoneyDriverSummary(items, wallets, budgetConfig, new Date('2026-05-04T12:00:00.000Z'));

  assert.equal(summary.todayExpense, 110_000);
  assert.equal(summary.yesterdayExpense, 50_000);
  assert.match(summary.spendLine, /Today spend: .*110/);
  assert.match(summary.mainDriverLine, /Food \(category\)/);
  assert.doesNotMatch(summary.mainDriverLine, /same-name purchase/);
  assert.match(summary.walletMovementLine, /transfers\/savings excluded from spend totals/);
  assert.match(summary.walletMovementLine, /BCA/);
  assert.match(summary.walletMovementLine, /GoPay/);
});

test('data quality catches audit amount, To_Wallet, casing, and model-prose contamination examples', () => {
  const items: BrainDumpItem[] = [
    makeFinance('zero-expense', {
      content: 'jajan opak',
      meta: { financeType: 'expense', amount: 0, paymentMethod: 'bCa', budgetCategory: 'fOoD', toWallet: 'gopay' },
    }),
    makeFinance('leaked-transfer', {
      content: 'transfer from bca to bni',
      meta: {
        financeType: 'transfer',
        amount: 1_000_000,
        paymentMethod: 'bca',
        toWallet: 'bni shrewdness amount will be 1000000.0 with tags transfer, bank.',
        merchant: '{"merchant":"not a production value"}',
      },
    }),
  ];

  const reasons = buildDataQualityIssues(items, wallets, budgetConfig).map(issue => issue.reason).join('\n');

  assert.match(reasons, /Amount must be greater than zero/);
  assert.match(reasons, /To_Wallet is populated for non-transfer/);
  assert.match(reasons, /Wallet 'bCa'.*case normalization/);
  assert.match(reasons, /Category 'fOoD'.*case normalization/);
  assert.match(reasons, /To_Wallet contains overlong\/model\/prompt prose/);
  assert.match(reasons, /Merchant contains overlong\/model\/prompt prose/);
});

test('data quality keeps different-ID semantic duplicates as manual review issues', () => {
  const first = makeFinance('tx-a', {
    content: 'Send laundry',
    created_at: '2026-05-04T03:00:00.100Z',
    completed_at: '2026-05-04T03:00:00.100Z',
    meta: { date: '2026-05-04T03:00:00.100Z', amount: 25_000, paymentMethod: 'bca', budgetCategory: 'food' },
  });
  const second = makeFinance('tx-b', {
    content: ' send  laundry ',
    created_at: '2026-05-04T03:00:00.900Z',
    completed_at: '2026-05-04T03:00:00.900Z',
    meta: { date: '2026-05-04T03:00:00.900Z', amount: 25_000, paymentMethod: 'bca', budgetCategory: 'food' },
  });

  const issues = buildDataQualityIssues([first, second], wallets, budgetConfig);
  const duplicateIssue = issues.find(issue => /Possible duplicate content has different IDs/.test(issue.reason));

  assert.ok(duplicateIssue);
  assert.match(duplicateIssue.reason, /rows were retained for manual review/);
});

test('data quality surfaces bounded raw values retained by persistence quarantine', () => {
  const quarantined = makeFinance('quarantined-row', {
    meta: {
      amount: 50_000,
      paymentMethod: 'bca',
      budgetCategory: 'food',
      dataQualityQuarantine: [{
        field: 'meta.toWallet',
        rawValue: 'Cash立場: I am ready to output the JSON.',
        reason: 'model_or_prompt_leakage',
      }],
    },
  });

  const reasons = buildDataQualityIssues([quarantined], wallets, budgetConfig).map(issue => issue.reason).join('\n');
  assert.match(reasons, /meta\.toWallet is quarantined/);
  assert.match(reasons, /I am ready to output the JSON/);
});
