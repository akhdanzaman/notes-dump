import test from 'node:test';
import assert from 'node:assert/strict';
import { BrainDumpItem, ItemType } from '../../types';
import {
  convertTransactionLineItemsToIdr,
  getTransactionCategorySummary,
  sumTransactionLineItems,
} from '../transactionLineItems';
import { findDuplicateReceiptTransaction } from '../receiptDuplicate';

const mixedReceipt: BrainDumpItem = {
  id: 'receipt-existing',
  type: ItemType.FINANCE,
  content: 'Toko Serba Ada',
  status: 'done',
  created_at: '2026-07-13T10:00:00.000Z',
  completed_at: '2026-07-13T10:00:00.000Z',
  meta: {
    financeType: 'expense',
    date: '2026-07-13T10:00:00.000Z',
    merchant: 'Toko Serba Ada',
    amount: 110_000,
    transactionLineItems: [
      { id: 'food', name: 'Makanan', amount: 60_000, budgetCategory: 'food', allocationMode: 'category' },
      { id: 'home', name: 'Peralatan rumah', amount: 40_000, budgetCategory: 'home', allocationMode: 'category' },
      { id: 'tax', name: 'Pajak', amount: 10_000, kind: 'tax', allocationMode: 'proportional' },
    ],
    receiptCapture: { fingerprint: 'receipt-fingerprint' },
  },
};

test('shared receipt fee is distributed proportionally across line-item budget categories', () => {
  assert.deepEqual(getTransactionCategorySummary(mixedReceipt), [
    { budgetCategory: 'food', amount: 66_000 },
    { budgetCategory: 'home', amount: 44_000 },
  ]);
});

test('foreign receipt conversion keeps original line values while budget total uses IDR', () => {
  const converted = convertTransactionLineItemsToIdr([
    { id: 'meal', name: 'Meal', quantity: '2', amount: 20, unitPrice: 10, budgetCategory: 'food' },
  ], 'USD', 16_250);

  assert.equal(sumTransactionLineItems(converted), 325_000);
  assert.equal(converted[0].originalAmount, 20);
  assert.equal(converted[0].originalUnitPrice, 10);
  assert.equal(converted[0].originalCurrency, 'USD');
});

test('duplicate receipt detection uses fingerprint and semantic merchant/date/line matching', () => {
  assert.equal(findDuplicateReceiptTransaction([mixedReceipt], {
    merchant: 'Anything',
    date: '2026-07-14',
    totalAmount: 1,
    lineItems: [{ id: 'x', name: 'Different', amount: 1 }],
    fingerprint: 'receipt-fingerprint',
  })?.id, mixedReceipt.id);

  assert.equal(findDuplicateReceiptTransaction([mixedReceipt], {
    merchant: 'toko serba ada',
    date: '2026-07-13',
    totalAmount: 110_000,
    lineItems: mixedReceipt.meta.transactionLineItems || [],
  })?.id, mixedReceipt.id);
});
