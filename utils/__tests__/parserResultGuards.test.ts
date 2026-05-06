import test from 'node:test';
import assert from 'node:assert/strict';

import { guardParserResultMultiplicity } from '../parserResultGuards';
import { ParserResultV2 } from '../../types';

const expenseResult = (overrides: Partial<ParserResultV2> = {}): ParserResultV2 => ({
  action: 'create_item',
  entityType: 'finance',
  content: 'beli calliper',
  confidence: 'high',
  needsReview: false,
  payload: {
    itemType: 'FINANCE',
    content: 'beli calliper',
    meta: {
      amount: 10_000,
      financeType: 'expense',
      paymentMethod: 'gopaylater-wallet',
      budgetCategory: 'wants',
    },
  },
  ...overrides,
});

test('single expense input cannot explode into duplicate transaction entries', () => {
  const duplicated = Array.from({ length: 100 }, () => expenseResult());

  const guarded = guardParserResultMultiplicity(duplicated, 'expense: beli calliper 10000 gopaylater');

  assert.equal(guarded.results.length, 1);
  assert.equal(guarded.removedCount, 99);
  assert.equal(guarded.reason, 'single_finance_duplicate_guard');
  assert.equal((guarded.results[0].payload as any).meta.amount, 10_000);
});

test('distinct multi-entry finance input is preserved', () => {
  const guarded = guardParserResultMultiplicity([
    expenseResult({ content: 'beli calliper', payload: { itemType: 'FINANCE', content: 'beli calliper', meta: { amount: 10_000, financeType: 'expense', paymentMethod: 'gopaylater-wallet' } } as any }),
    expenseResult({ content: 'beli baterai', payload: { itemType: 'FINANCE', content: 'beli baterai', meta: { amount: 15_000, financeType: 'expense', paymentMethod: 'gopaylater-wallet' } } as any }),
  ], 'expense beli calliper 10000 dan beli baterai 15000 gopaylater');

  assert.equal(guarded.results.length, 2);
  assert.equal(guarded.removedCount, 0);
});
