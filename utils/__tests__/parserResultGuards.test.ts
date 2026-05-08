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

test('single expense variants collapse even when parser disagrees on optional metadata', () => {
  const guarded = guardParserResultMultiplicity([
    expenseResult({
      confidence: 'medium',
      payload: {
        itemType: 'FINANCE',
        content: 'makan bebek goreng',
        meta: {
          amount: 37_500,
          financeType: 'expense',
          paymentMethod: 'gopay-wallet',
          toWallet: 'Gopay is usually just source wallet for expenses',
          commodity: 'food',
          subcommodity: 'lunch',
        },
      } as any,
    }),
    expenseResult({
      confidence: 'medium',
      payload: {
        itemType: 'FINANCE',
        content: 'makan bebek goreng',
        meta: {
          amount: 37_500,
          financeType: 'expense',
          paymentMethod: 'gopay-wallet',
          date: '2026-05-09T01:06:17.000+07:00',
          commodity: 'food',
          subcommodity: 'dinner',
        },
      } as any,
    }),
  ], 'Expense: makan bebek goreng 37500 gopay');

  assert.equal(guarded.results.length, 1);
  assert.equal(guarded.removedCount, 1);
  assert.equal(guarded.reason, 'single_finance_duplicate_guard');
  assert.equal((guarded.results[0].payload as any).meta.toWallet, undefined);
  assert.equal((guarded.results[0].payload as any).meta.date, '2026-05-09T01:06:17.000+07:00');
});
