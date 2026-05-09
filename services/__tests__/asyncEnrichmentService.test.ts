import test from 'node:test';
import assert from 'node:assert/strict';

import { queueCanonicalEnrichmentTasks, runCanonicalEnrichmentTasks } from '../asyncEnrichmentService';
import { BrainDumpItem, CanonicalRule, ItemType } from '../../types';

const paymentRules: CanonicalRule[] = [
  {
    id: 'wallet-bca',
    field: 'paymentMethod',
    canonicalValue: 'BCA',
    aliases: ['debit bca'],
    source: 'learned',
    approvalCount: 2,
    rejectionCount: 0,
    createdAt: '2026-05-02T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z',
  },
];

const ctx = (items: BrainDumpItem[] = [], rules: CanonicalRule[] = []) => ({
  existingItems: items,
  wallets: [],
  budgetRules: [],
  rules,
});

test('async canonical enrichment applies high-confidence fields idempotently after minimal save', () => {
  const items: BrainDumpItem[] = [
    {
      id: 'saved-fast',
      type: ItemType.FINANCE,
      content: 'sarapan 14000 cash',
      status: 'done',
      created_at: '2026-05-09T01:00:00.000Z',
      completed_at: '2026-05-09T01:00:00.000Z',
      meta: {
        amount: 14000,
        financeType: 'expense',
        parserTaskId: 'parse-1',
      },
    },
  ];

  const tasks = queueCanonicalEnrichmentTasks({ items, itemIds: ['saved-fast'], parserTaskId: 'parse-1', now: 1 });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].status, 'pending');

  const first = runCanonicalEnrichmentTasks({ items, tasks, ctx: ctx(items), now: 2 });
  assert.deepEqual(first.changedItemIds, ['saved-fast']);
  assert.equal(first.reviews.length, 0);
  assert.equal(first.items[0].meta.commodity, 'food');
  assert.equal(first.items[0].meta.subcommodity, 'breakfast');
  assert.equal(first.items[0].meta.canonical?.commodity?.value, 'food');
  assert.equal(first.items[0].meta.enrichment?.status, 'applied');
  assert.ok(first.taskResults[0].appliedFields?.includes('commodity'));

  const secondTasks = queueCanonicalEnrichmentTasks({ items: first.items, itemIds: ['saved-fast'], parserTaskId: 'parse-1-rerun', now: 3 });
  const second = runCanonicalEnrichmentTasks({ items: first.items, tasks: secondTasks, ctx: ctx(first.items), now: 4 });
  assert.deepEqual(second.changedItemIds, []);
  assert.deepEqual(second.items, first.items);
});

test('async canonical enrichment never overwrites manual fields changed after queueing', () => {
  const queuedItem: BrainDumpItem = {
    id: 'manual-after-queue',
    type: ItemType.FINANCE,
    content: 'sarapan 14000 cash',
    status: 'done',
    created_at: '2026-05-09T01:00:00.000Z',
    completed_at: '2026-05-09T01:00:00.000Z',
    meta: { amount: 14000, financeType: 'expense' },
  };

  const [task] = queueCanonicalEnrichmentTasks({ items: [queuedItem], itemIds: [queuedItem.id], parserTaskId: 'parse-2', now: 1 });
  const manuallyEdited: BrainDumpItem = {
    ...queuedItem,
    meta: {
      ...queuedItem.meta,
      commodity: 'health',
      canonical: {
        commodity: { rawValue: 'health', value: 'health', confidence: 1, source: 'manual_review', needsReview: false },
      },
    },
  };

  const result = runCanonicalEnrichmentTasks({ items: [manuallyEdited], tasks: [task], ctx: ctx([manuallyEdited]), now: 2 });

  assert.equal(result.items[0].meta.commodity, 'health');
  assert.equal(result.items[0].meta.canonical?.commodity?.value, 'health');
  assert.equal(result.items[0].meta.canonical?.commodity?.source, 'manual_review');
  assert.ok(!result.taskResults[0].appliedFields?.includes('commodity'));
});

test('ambiguous async canonical enrichment creates review items instead of auto-applying', () => {
  const items: BrainDumpItem[] = [
    {
      id: 'ambiguous-payment',
      type: ItemType.FINANCE,
      content: 'bayar pakai debit bca',
      status: 'done',
      created_at: '2026-05-09T01:00:00.000Z',
      completed_at: '2026-05-09T01:00:00.000Z',
      meta: { paymentMethod: 'debit bca', financeType: 'expense' },
    },
  ];

  const tasks = queueCanonicalEnrichmentTasks({ items, itemIds: ['ambiguous-payment'], parserTaskId: 'parse-3', now: 1 });
  const result = runCanonicalEnrichmentTasks({ items, tasks, ctx: ctx(items, paymentRules), now: 2 });

  assert.equal(result.items[0].meta.canonical?.paymentMethod, undefined);
  assert.equal(result.reviews.length, 1);
  assert.equal(result.reviews[0].id, 'canonical-enrichment-ambiguous-payment');
  assert.equal(result.reviews[0].originalResults[0].canonicalReview?.[0].suggestedValue, 'BCA');
  assert.equal(result.taskResults[0].status, 'review');
  assert.equal(result.taskResults[0].reviewCount, 1);
});
