import test from 'node:test';
import assert from 'node:assert/strict';

import { ItemType, BrainDumpItem } from '../../types';
import { getFinanceItems, getShoppingItems } from '../selectors';
import {
  getShoppingDueDate,
  getShoppingTimelineDate,
  getShoppingTransactionDate,
  shouldShoppingDateEditCompletion,
} from '../shoppingDateUtils';

const makeShopping = (overrides: Partial<BrainDumpItem>): BrainDumpItem => {
  const { meta, ...rest } = overrides;
  return {
    id: 'shop',
    type: ItemType.SHOPPING,
    content: 'shopping item',
    status: 'pending',
    created_at: '2026-01-01T00:00:00.000Z',
    ...rest,
    meta: {
      shoppingCategory: 'not_urgent',
      ...(meta || {}),
    },
  };
};

test('shopping date helpers keep due date separate from completed and created dates', () => {
  const item = makeShopping({
    status: 'done',
    created_at: '2026-01-01T00:00:00.000Z',
    completed_at: '2026-01-12T09:30:00.000Z',
    meta: {
      shoppingCategory: 'urgent',
      date: '2026-01-10T00:00:00.000Z',
      amount: 50_000,
    },
  });

  assert.equal(getShoppingDueDate(item), '2026-01-10T00:00:00.000Z');
  assert.equal(getShoppingTransactionDate(item), '2026-01-12T09:30:00.000Z');
  assert.equal(getShoppingTimelineDate(item), '2026-01-12T09:30:00.000Z');
  assert.equal(shouldShoppingDateEditCompletion(item), true);
});

test('shopping list sorting uses due date first and does not treat missing due dates as oldest', () => {
  const items = [
    makeShopping({ id: 'undated-old', created_at: '2026-01-01T00:00:00.000Z', meta: { shoppingCategory: 'not_urgent' } }),
    makeShopping({ id: 'dated-later', created_at: '2026-01-02T00:00:00.000Z', meta: { shoppingCategory: 'not_urgent', date: '2026-01-20T00:00:00.000Z' } }),
    makeShopping({ id: 'dated-sooner', created_at: '2026-01-03T00:00:00.000Z', meta: { shoppingCategory: 'not_urgent', date: '2026-01-10T00:00:00.000Z' } }),
    makeShopping({ id: 'undated-new', created_at: '2026-01-04T00:00:00.000Z', meta: { shoppingCategory: 'not_urgent' } }),
  ];

  const { normal } = getShoppingItems(items);

  assert.deepEqual(normal.map(item => item.id), ['dated-sooner', 'dated-later', 'undated-old', 'undated-new']);
});

test('money transaction filtering dates completed shopping by completed_at, not due date', () => {
  const completedInJanuary = makeShopping({
    id: 'completed-jan',
    status: 'done',
    created_at: '2025-12-01T00:00:00.000Z',
    completed_at: '2026-01-12T09:30:00.000Z',
    meta: {
      shoppingCategory: 'urgent',
      date: '2025-12-20T00:00:00.000Z',
      amount: 40_000,
    },
  });

  const dueInJanuaryButCompletedEarlier = makeShopping({
    id: 'due-jan-completed-dec',
    status: 'done',
    created_at: '2025-12-01T00:00:00.000Z',
    completed_at: '2025-12-28T09:30:00.000Z',
    meta: {
      shoppingCategory: 'urgent',
      date: '2026-01-15T00:00:00.000Z',
      amount: 90_000,
    },
  });

  const result = getFinanceItems(
    [completedInJanuary, dueInJanuaryButCompletedEarlier],
    new Date('2026-01-05T00:00:00.000Z'),
    { monthlyIncome: 0, rules: [] },
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

  assert.deepEqual(result.list.map(item => item.id), ['completed-jan']);
  assert.equal(result.totalExpense, 40_000);
});
