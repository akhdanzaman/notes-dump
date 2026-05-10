import test from 'node:test';
import assert from 'node:assert/strict';

import { getParserResultSummary, shouldShowParserTaskInReviewCenter } from '../parserResultSummary';
import { ParserResultV2, ParsingTask } from '../../types';

const createFinance: ParserResultV2 = {
  action: 'create_item',
  entityType: 'finance',
  confidence: 'high',
  needsReview: false,
  payload: {
    itemType: 'FINANCE',
    content: 'kopi',
    status: 'done',
    meta: {
      amount: 18_000,
      financeType: 'expense',
      paymentMethod: 'cash',
      canonical: {
        paymentMethod: { rawValue: 'cash', value: 'cash-wallet', source: 'system_rule', confidence: 1 },
      },
    },
  },
};

test('result summary describes successful create actions and hides canonical internals', () => {
  const summary = getParserResultSummary(createFinance);

  assert.equal(summary.destination, 'Money > Transactions');
  assert.equal(summary.title, 'Saved transaction: kopi | Rp 18,000 | cash');
  assert.ok(summary.details.some(([key, value]) => key === 'from wallet' && value === 'cash'));
  assert.equal(summary.details.some(([key]) => key === 'canonical'), false);
  assert.equal(JSON.stringify(summary).includes('system_rule'), false);
});

test('result summary describes successful update and delete actions', () => {
  const update = getParserResultSummary({
    action: 'update_item',
    entityType: 'todo',
    confidence: 'high',
    needsReview: false,
    payload: { match: { itemId: 'todo-1', itemName: 'Deck' }, changes: { progress: 100 } },
  });
  const deleted = getParserResultSummary({
    action: 'delete_item',
    entityType: 'todo',
    confidence: 'high',
    needsReview: false,
    payload: { match: { itemId: 'todo-2', itemName: 'Duplicate deck task' } },
  });

  assert.equal(update.title, 'Updated item: Deck | 1 field changed');
  assert.equal(deleted.title, 'Deleted item: Duplicate deck task');
});

test('review center suppresses empty/no-op success tasks but keeps duplicate evidence', () => {
  const baseTask: ParsingTask = {
    id: 'task-1',
    text: 'berapa pengeluaran hari ini?',
    status: 'success',
    createdAt: 1,
    results: [{ action: 'query_only', entityType: 'unknown', confidence: 'high', needsReview: false, payload: { question: 'berapa pengeluaran hari ini?' } }],
  };

  assert.equal(shouldShowParserTaskInReviewCenter(baseTask), false);
  assert.equal(shouldShowParserTaskInReviewCenter({ ...baseTask, duplicateGuardRemovedCount: 1 }), true);
  assert.equal(shouldShowParserTaskInReviewCenter({ ...baseTask, results: [createFinance] }), true);
});
