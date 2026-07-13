import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemType, BrainDumpItem } from '../../types';
import {
  encodeTransactionLineItemsForSheet,
  getTransactionBudgetAllocations,
  parseTransactionLineItemsFromSheet,
  sanitizeTransactionLineItems,
  sumTransactionLineItems,
} from '../transactionLineItems';
import { getBudgetCategoryAnalytics } from '../budgetAnalytics';

test('transaction line items keep category per item and round-trip through sheet JSON', () => {
  const lineItems = sanitizeTransactionLineItems([
    { id: 'food', name: 'Nasi', amount: 20_000, budgetCategory: 'needs', commodity: 'food' },
    { id: 'gift', name: 'Kado', amount: 80_000, budgetCategory: 'wants', commodity: 'shopping' },
  ]);

  assert.equal(sumTransactionLineItems(lineItems), 100_000);
  assert.deepEqual(parseTransactionLineItemsFromSheet(encodeTransactionLineItemsForSheet(lineItems)), lineItems);
});

test('mixed receipt stays one transaction while budget analytics split its line items', () => {
  const item: BrainDumpItem = {
    id: 'receipt-1',
    type: ItemType.FINANCE,
    content: 'Supermarket receipt',
    status: 'done',
    created_at: '2026-07-10T10:00:00.000Z',
    completed_at: '2026-07-10T10:00:00.000Z',
    meta: {
      date: '2026-07-10T10:00:00.000Z',
      financeType: 'expense',
      amount: 100_000,
      paymentMethod: 'cash',
      transactionLineItems: [
        { id: 'food', name: 'Groceries', amount: 60_000, budgetCategory: 'needs', commodity: 'food' },
        { id: 'toy', name: 'Toy', amount: 40_000, budgetCategory: 'wants', commodity: 'shopping' },
      ],
    },
  };

  const allocations = getTransactionBudgetAllocations(item);
  assert.equal(allocations.length, 2);
  assert.equal(allocations.reduce((sum, allocation) => sum + allocation.amount, 0), item.meta.amount);

  const analytics = getBudgetCategoryAnalytics(
    [item],
    new Date('2026-07-15T00:00:00.000Z'),
    {
      monthlyIncome: 1_000_000,
      rules: [
        { id: 'needs', name: 'Needs', percentage: 60, color: 'bg-blue-500' },
        { id: 'wants', name: 'Wants', percentage: 40, color: 'bg-pink-500' },
      ],
    },
    'monthly',
  );

  assert.equal(analytics.find((category) => category.categoryId === 'needs')?.total, 60_000);
  assert.equal(analytics.find((category) => category.categoryId === 'wants')?.total, 40_000);
});
