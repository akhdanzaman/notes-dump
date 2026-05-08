import test from 'node:test';
import assert from 'node:assert/strict';

import { BrainDumpItem, BudgetConfig, ItemType, Wallet } from '../../types';
import { identifyTransaction, summarizeTransactionIdentifications } from '../transactionIdentification';

const wallets: Wallet[] = [
  { id: 'bca-wallet', name: 'BCA', type: 'bank', initialBalance: 1_000_000, color: 'bg-blue-500' },
  { id: 'cash-wallet', name: 'Cash', type: 'cash', initialBalance: 200_000, color: 'bg-green-500' },
  { id: 'cc-wallet', name: 'Credit Card', type: 'cc', initialBalance: 0, color: 'bg-red-500' },
  { id: 'bibit-wallet', name: 'Bibit', type: 'investment', initialBalance: 0, color: 'bg-purple-500' },
];

const budgetConfig: BudgetConfig = {
  monthlyIncome: 10_000_000,
  rules: [
    { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-emerald-500' },
    { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-purple-500' },
  ],
};

const finance = (id: string, meta: BrainDumpItem['meta']): BrainDumpItem => ({
  id,
  type: ItemType.FINANCE,
  content: id,
  status: 'done',
  created_at: '2026-05-08T08:00:00.000Z',
  completed_at: '2026-05-08T08:00:00.000Z',
  meta: {
    date: '2026-05-08T08:00:00.000Z',
    ...meta,
  },
});

test('deep transaction identification separates spend analytics from wallet-only movement', () => {
  const transfer = finance('move cash to bca', {
    amount: 150_000,
    financeType: 'transfer',
    paymentMethod: 'cash-wallet',
    toWallet: 'bca-wallet',
  });

  const identity = identifyTransaction(transfer, { wallets, budgetConfig });

  assert.equal(identity.kind, 'transfer');
  assert.equal(identity.analytics.countsAsTransfer, true);
  assert.equal(identity.analytics.countsAsExpense, false);
  assert.equal(identity.analytics.countsAsSpendAnatomy, false);
  assert.deepEqual(identity.walletEffects.map(effect => [effect.walletName, effect.role, effect.direction, effect.amount]), [
    ['Cash', 'source', 'decrease', 150_000],
    ['BCA', 'destination', 'increase', 150_000],
  ]);
});

test('deep transaction identification flags weak commodity identities for spend analytics', () => {
  const expense = finance('mystery expense', {
    amount: 75_000,
    financeType: 'expense',
    paymentMethod: 'cc-wallet',
    budgetCategory: 'needs',
    canonical: {
      commodity: { value: 'others', confidence: 0.2, source: 'system_rule' },
      subcommodity: { value: 'others', confidence: 0.2, source: 'system_rule' },
    },
  });

  const identity = identifyTransaction(expense, { wallets, budgetConfig });

  assert.equal(identity.kind, 'expense');
  assert.equal(identity.analytics.countsAsBudgetActual, true);
  assert.equal(identity.analytics.countsAsSpendAnatomy, true);
  assert.deepEqual(identity.walletEffects.map(effect => [effect.walletName, effect.direction]), [['Credit Card', 'debt_increase']]);
  assert.ok(identity.qualityFlags.includes('weak_commodity_identity'));
  assert.ok(identity.qualityFlags.includes('weak_subcommodity_identity'));
});

test('transaction identification summary powers analytics totals and quality drilldowns', () => {
  const items = [
    finance('salary', { amount: 1_000_000, financeType: 'income', paymentMethod: 'bca-wallet' }),
    finance('meal', {
      amount: 50_000,
      financeType: 'expense',
      paymentMethod: 'bca-wallet',
      budgetCategory: 'needs',
      commodity: 'food',
      subcommodity: 'lunch',
    }),
    finance('saving to investment', {
      amount: 250_000,
      financeType: 'saving',
      paymentMethod: 'bca-wallet',
      toWallet: 'bibit-wallet',
      savingGoalId: 'investment-goal',
    }),
    finance('transfer', { amount: 100_000, financeType: 'transfer', paymentMethod: 'bca-wallet', toWallet: 'cash-wallet' }),
  ];

  const summary = summarizeTransactionIdentifications(items.map(item => identifyTransaction(item, { wallets, budgetConfig })));

  assert.equal(summary.actualIncome, 1_000_000);
  assert.equal(summary.actualExpense, 300_000);
  assert.equal(summary.savings, 250_000);
  assert.equal(summary.transfers, 100_000);
  assert.equal(summary.netCashflow, 700_000);
  assert.equal(summary.spendAnatomyTotal, 50_000);
  assert.deepEqual(summary.byCommodity.map(row => row.name), ['food']);
});
