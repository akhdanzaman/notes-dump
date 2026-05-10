import test from 'node:test';
import assert from 'node:assert/strict';

import { formatBudgetRuleContext, inferBudgetCategoryId, resolveBudgetCategoryId } from '../budgetCategoryService';
import { BudgetConfig, ItemType, type BrainDumpItem } from '../../types';

const budgetConfig: BudgetConfig = {
  monthlyIncome: 10000000,
  rules: [
    { id: 'pokok', name: 'Kebutuhan Pokok', percentage: 50, color: 'bg-blue-500' },
    { id: 'growth', name: 'Growth Bets', percentage: 20, color: 'bg-purple-500' },
    { id: 'social-giving', name: 'Social Giving', percentage: 10, color: 'bg-green-500' },
  ],
};

test('resolveBudgetCategoryId matches configured ids and names', () => {
  assert.equal(resolveBudgetCategoryId('pokok', budgetConfig), 'pokok');
  assert.equal(resolveBudgetCategoryId('Kebutuhan Pokok', budgetConfig), 'pokok');
  assert.equal(resolveBudgetCategoryId('social giving', budgetConfig), 'social-giving');
  assert.equal(resolveBudgetCategoryId('growth', budgetConfig), 'growth');
});

test('formatBudgetRuleContext lists canonical configured categories', () => {
  const context = formatBudgetRuleContext(budgetConfig);
  assert.match(context, /Kebutuhan Pokok \(id: pokok/);
  assert.match(context, /Growth Bets \(id: growth/);
  assert.match(context, /infer the closest configured category creatively/);
});

test('inferBudgetCategoryId learns category choices from spreadsheet transaction history', () => {
  const existingItems: BrainDumpItem[] = [
    {
      id: 'trx-1',
      type: ItemType.FINANCE,
      content: 'kopi tuku',
      status: 'done',
      created_at: '2026-05-01T00:00:00.000Z',
      completed_at: '2026-05-01T00:00:00.000Z',
      meta: { financeType: 'expense', budgetCategory: 'growth', commodity: 'food', subcommodity: 'drink', merchant: 'Tuku' },
    },
  ];

  assert.equal(inferBudgetCategoryId({
    text: 'kopi tuku 27000 cash',
    meta: { financeType: 'expense', commodity: 'food', subcommodity: 'drink', merchant: 'Tuku' },
    budgetRules: budgetConfig.rules,
    existingItems,
  }), 'growth');
});

test('inferBudgetCategoryId creatively maps commodity intent to custom configured categories', () => {
  assert.equal(inferBudgetCategoryId({
    text: 'sedekah masjid 10000 cash',
    meta: { financeType: 'expense', commodity: 'social', subcommodity: 'donation' },
    budgetRules: budgetConfig.rules,
  }), 'social-giving');

  assert.equal(inferBudgetCategoryId({
    text: 'sarapan 14000 cash',
    meta: { financeType: 'expense', commodity: 'food', subcommodity: 'breakfast' },
    budgetRules: budgetConfig.rules,
  }), 'pokok');
});
