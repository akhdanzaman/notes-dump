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

const plannedShopping = (id: string, amount: number, date: string, shoppingCategory: 'urgent' | 'not_urgent' = 'urgent'): BrainDumpItem => ({
  id,
  type: ItemType.SHOPPING,
  content: id,
  status: 'pending',
  created_at: '2026-05-01T00:00:00.000Z',
  meta: {
    date,
    amount,
    shoppingCategory,
    budgetCategory: 'needs',
  },
});

const plannedTodo = (id: string, amount: number, date: string): BrainDumpItem => ({
  id,
  type: ItemType.TODO,
  content: id,
  status: 'pending',
  created_at: date,
  meta: {
    date,
    amount,
    budgetCategory: 'needs',
  },
});

const routineShopping = (
  id: string,
  amount: number,
  createdAt: string,
  routine: Pick<NonNullable<BrainDumpItem['meta']>, 'routineInterval' | 'routineDaysOfWeek' | 'routineDaysOfMonth' | 'routineMonthsOfYear'>
): BrainDumpItem => ({
  id,
  type: ItemType.SHOPPING,
  content: id,
  status: 'pending',
  created_at: createdAt,
  meta: {
    date: createdAt,
    amount,
    shoppingCategory: 'routine',
    isRoutine: true,
    budgetCategory: 'needs',
    ...routine,
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

test('planned budget only includes pending urgent shopping and routine shopping', () => {
  const result = getFinanceItems(
    [
      plannedShopping('urgent-plan', 50_000, '2026-05-08T08:00:00.000Z', 'urgent'),
      plannedShopping('not-urgent-plan', 75_000, '2026-05-08T08:00:00.000Z', 'not_urgent'),
      plannedTodo('todo-plan', 125_000, '2026-05-08T08:00:00.000Z'),
      routineShopping('routine-mon-wed-fri', 10_000, '2026-05-01T00:00:00.000Z', {
        routineInterval: 'weekly',
        routineDaysOfWeek: [1, 3, 5],
      }),
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

  assert.equal(result.projectedExpense, 80_000);
  assert.equal(result.plannedBudgetMap.get('needs'), 80_000);
});

test('routine shopping recurrence follows weekly, monthly, and yearly budget slicers', () => {
  const weekly = getFinanceItems(
    [
      routineShopping('weekly-routine', 10_000, '2026-05-01T00:00:00.000Z', {
        routineInterval: 'weekly',
        routineDaysOfWeek: [1, 3, 5],
      }),
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

  const monthly = getFinanceItems(
    [
      routineShopping('monthly-routine', 20_000, '2026-05-01T00:00:00.000Z', {
        routineInterval: 'monthly',
        routineDaysOfMonth: [1, 15, 31],
      }),
    ],
    new Date('2026-05-20T00:00:00.000Z'),
    budgetConfig,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'newest',
    'monthly',
    []
  );

  const yearly = getFinanceItems(
    [
      routineShopping('yearly-routine', 100_000, '2026-01-01T00:00:00.000Z', {
        routineInterval: 'yearly',
        routineDaysOfMonth: [10],
        routineMonthsOfYear: [0, 5, 11],
      }),
      finance('yearly-routine', 100_000, '2026-01-10T08:00:00.000Z'),
    ],
    new Date('2026-07-01T00:00:00.000Z'),
    budgetConfig,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'newest',
    'yearly',
    []
  );

  assert.equal(weekly.projectedExpense, 30_000);
  assert.equal(monthly.projectedExpense, 60_000);
  assert.equal(yearly.totalExpense, 100_000);
  assert.equal(yearly.projectedExpense, 200_000);
});
