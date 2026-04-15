import test from 'node:test';
import assert from 'node:assert/strict';

import { formatBudgetRuleContext, resolveBudgetCategoryId } from '../budgetCategoryService';
import { BudgetConfig } from '../../types';

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
  assert.match(context, /Do not invent categories outside the configured list/);
});
