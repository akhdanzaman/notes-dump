import test from 'node:test';
import assert from 'node:assert/strict';

import { BrainDumpItem, BudgetConfig, ItemType } from '../../types';
import { getFinanceItems } from '../selectors';

const budgetConfig: BudgetConfig = {
  monthlyIncome: 5_200_000,
  rules: [
    { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-emerald-500' },
  ],
};

const finance = (id: string, amount: number, date: string): BrainDumpItem => ({
  id,
  type: ItemType.FINANCE,
  content: id,
  status: 'done',
  created_at: date,
  completed_at: date,
  meta: {
    date,
    amount,
    financeType: 'expense',
    budgetCategory: 'needs',
  },
});

const plannedShopping = (id: string, amount: number, date: string): BrainDumpItem => ({
  id,
  type: ItemType.SHOPPING,
  content: id,
  status: 'pending',
  created_at: '2026-05-01T00:00:00.000Z',
  meta: {
    date,
    amount,
    shoppingCategory: 'urgent',
    budgetCategory: 'needs',
  },
});

test('weekly finance selector scopes actual and planned budget calculations to selected week', () => {
  const result = getFinanceItems(
    [
      finance('inside-week', 100_000, '2026-05-06T08:00:00.000Z'),
      finance('outside-week', 250_000, '2026-05-13T08:00:00.000Z'),
      plannedShopping('planned-inside-week', 50_000, '2026-05-08T08:00:00.000Z'),
      plannedShopping('planned-outside-week', 75_000, '2026-05-16T08:00:00.000Z'),
    ],
    new Date('2026-05-08T00:00:00.000Z'),
    budgetConfig,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'newest',
    'weekly',
    []
  );

  assert.deepEqual(result.list.map(item => item.id), ['inside-week']);
  assert.equal(result.totalExpense, 100_000);
  assert.equal(result.projectedExpense, 50_000);
  assert.equal(result.budgetMap.get('needs'), 100_000);
  assert.equal(result.plannedBudgetMap.get('needs'), 50_000);
});
