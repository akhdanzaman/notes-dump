import assert from 'node:assert/strict';
import test from 'node:test';
import { getReceiptTransactionViewDate, shouldQueueReceiptReview } from '../receiptReviewPolicy';

test('receipt Review Center routing follows Enable AI Draft Review exactly', () => {
  assert.equal(shouldQueueReceiptReview({ enableDraftReview: true }), true);
  assert.equal(shouldQueueReceiptReview({ enableDraftReview: false }), false);
  assert.equal(shouldQueueReceiptReview({}), false);
});

test('approved receipt selects the receipt transaction period using a local midday date', () => {
  const date = getReceiptTransactionViewDate('2026-06-03');
  assert.ok(date);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 5);
  assert.equal(date.getDate(), 3);
  assert.equal(date.getHours(), 12);
});
