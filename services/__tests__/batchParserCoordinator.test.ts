import test from 'node:test';
import assert from 'node:assert/strict';

import { routeBatchParserInput, splitParserBatchInput } from '../batchParserCoordinator';
import { BrainDumpItem, BudgetRule, ItemType, ParserResultV2, Wallet } from '../../types';

const wallets: Wallet[] = [
  { id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, color: 'bg-green-500' },
  { id: 'bca', name: 'BCA', type: 'bank', initialBalance: 0, color: 'bg-blue-500' },
  { id: 'gopay', name: 'Gopay', type: 'ewallet', initialBalance: 0, color: 'bg-cyan-500' },
];

const budgetRules: BudgetRule[] = [
  { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
  { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
];

const existingItems: BrainDumpItem[] = [
  {
    id: 'goal-emergency',
    type: ItemType.SHOPPING,
    content: 'Emergency fund',
    status: 'pending',
    created_at: '2026-05-09T00:00:00.000+07:00',
    meta: { shoppingCategory: 'saving', dedicatedWalletId: 'bca' },
  },
];

const ctx = {
  availableWallets: wallets,
  availableBudgetRules: budgetRules,
  existingItems,
  now: new Date('2026-05-09T01:21:00+07:00'),
};

const ambiguousAiResult = (content: string): ParserResultV2 => ({
  action: 'create_item',
  entityType: 'note',
  content,
  confidence: 'medium',
  needsReview: true,
  reviewReason: 'Ambiguous batch fallback result needs confirmation.',
  payload: {
    itemType: ItemType.NOTE,
    content,
    status: 'pending',
    meta: {},
  },
});

test('splitParserBatchInput detects bullets, newlines, and semicolon item dumps', () => {
  assert.deepEqual(
    splitParserBatchInput('- expense kopi 10rb cash\n- income gaji 5jt bca').map(item => item.sourceText),
    ['expense kopi 10rb cash', 'income gaji 5jt bca'],
  );
  assert.deepEqual(
    splitParserBatchInput('expense kopi 10rb cash; todo: send invoice').map(item => item.sourceText),
    ['expense kopi 10rb cash', 'todo: send invoice'],
  );
});

test('splitParserBatchInput preserves natural semicolon and newline notes as one source item', () => {
  assert.deepEqual(
    splitParserBatchInput('note: met Budi; paid attention to the Q3 budget 10rb variance; follow up later').map(item => item.sourceText),
    ['note: met Budi; paid attention to the Q3 budget 10rb variance; follow up later'],
  );
  assert.deepEqual(
    splitParserBatchInput('note: project recap\npaid attention to the Q3 budget 10rb variance\nfollow up with Maya').map(item => item.sourceText),
    ['note: project recap paid attention to the Q3 budget 10rb variance follow up with Maya'],
  );
});

test('splitParserBatchInput handles blank lines and mixed bullet styles without losing line traceability', () => {
  const items = splitParserBatchInput('expense kopi 10rb cash\n\n- todo: send invoice\n\n2. income gaji 5jt bca');
  assert.deepEqual(items.map(item => item.sourceText), [
    'expense kopi 10rb cash',
    'todo: send invoice',
    'income gaji 5jt bca',
  ]);
  assert.deepEqual(items.map(item => [item.startLine, item.endLine]), [[1, 1], [3, 3], [5, 5]]);
});

test('batch coordinator keeps ordered local results and avoids deep AI when every item is clear', async () => {
  let aiCalls = 0;
  const routed = await routeBatchParserInput(
    'expense kopi 10rb cash\nincome gaji 5jt bca\ntodo: send invoice',
    ctx,
    async () => {
      aiCalls += 1;
      return [];
    },
  );

  assert.equal(aiCalls, 0);
  assert.equal(routed.decision.route, 'local_save');
  assert.equal(routed.decision.batch?.itemCount, 3);
  assert.equal(routed.decision.batch?.aiCallCount, 0);
  assert.equal(routed.results.map(result => result.batchItem?.sourceText).join(' | '), 'expense kopi 10rb cash | income gaji 5jt bca | todo: send invoice');
  assert.equal((routed.results[0].payload as any).meta.amount, 10_000);
  assert.equal((routed.results[1].payload as any).meta.financeType, 'income');
  assert.equal((routed.results[2].payload as any).itemType, ItemType.TODO);
});

test('batch coordinator sends only ambiguous leftovers through one deep-AI batch call and preserves order', async () => {
  let aiCalls = 0;
  let aiBatchText = '';
  let aiCandidateCount = 0;

  const routed = await routeBatchParserInput(
    'expense kopi 10rb cash\nlunch with Maya maybe reimburse later\nincome gaji 5jt bca',
    ctx,
    async (batchText, candidates) => {
      aiCalls += 1;
      aiBatchText = batchText;
      aiCandidateCount = candidates.length;
      return [ambiguousAiResult('lunch with Maya maybe reimburse later')];
    },
  );

  assert.equal(aiCalls, 1);
  assert.equal(aiCandidateCount, 1);
  assert.match(aiBatchText, /^2\. lunch with Maya maybe reimburse later$/);
  assert.equal(routed.decision.route, 'deep_ai');
  assert.equal(routed.decision.batch?.itemCount, 3);
  assert.equal(routed.decision.batch?.localItemCount, 2);
  assert.equal(routed.decision.batch?.aiItemCount, 1);
  assert.equal(routed.decision.batch?.aiCallCount, 1);
  assert.deepEqual(routed.results.map(result => result.batchItem?.index), [0, 1, 2]);
  assert.equal((routed.results[0].payload as any).meta.amount, 10_000);
  assert.equal(routed.results[1].content, 'lunch with Maya maybe reimburse later');
  assert.equal((routed.results[2].payload as any).meta.amount, 5_000_000);
});

test('batch coordinator carries model-routing metadata and AI call count from fallback parser', async () => {
  const routed = await routeBatchParserInput(
    'expense kopi 10rb cash\nunclear project note',
    ctx,
    async (_batchText, candidates) => ({
      results: candidates.map(candidate => ambiguousAiResult(candidate.sourceText)),
      modelRouting: {
        enabled: true,
        policy: 'fast_then_deep_on_ambiguity',
        fastModel: 'gemini-2.5-flash',
        deepModel: 'gemini-2.5-pro',
        selectedTier: 'deep_parse',
        finalModel: 'gemini-2.5-pro',
        fastAttempted: true,
        deepAttempted: true,
        aiCallCount: 2,
        escalationReasonCodes: ['fast_unknown_result'],
      },
    }),
  );

  assert.equal(routed.decision.modelRouting?.selectedTier, 'deep_parse');
  assert.equal(routed.decision.batch?.modelRouting?.finalModel, 'gemini-2.5-pro');
  assert.equal(routed.decision.batch?.aiCallCount, 2);
});

test('batch coordinator isolates AI fallback failures per item without dropping local parses', async () => {
  let aiCalls = 0;
  const routed = await routeBatchParserInput(
    'expense kopi 10rb cash\nunclear project note\nanother vague capture',
    ctx,
    async () => {
      aiCalls += 1;
      throw new Error('mock batch AI outage');
    },
  );

  assert.equal(aiCalls, 1);
  assert.equal(routed.results.length, 3);
  assert.equal((routed.results[0].payload as any).meta.amount, 10_000);
  assert.equal(routed.results[1].action, 'unknown');
  assert.equal(routed.results[2].action, 'unknown');
  assert.match(routed.results[1].reviewReason || '', /mock batch AI outage/);
  assert.deepEqual(routed.results.map(result => result.batchItem?.index), [0, 1, 2]);
  assert.equal(routed.decision.batch?.failedItemCount, 2);
});

test('batch coordinator keeps large mixed batches ordered while using one AI fallback call', async () => {
  let aiCalls = 0;
  let aiCandidateCount = 0;
  const input = Array.from({ length: 60 }, (_, index) => (
    index % 2 === 0
      ? 'expense kopi 10rb cash'
      : `vague capture ${index + 1}`
  )).join('\n');

  const routed = await routeBatchParserInput(
    input,
    ctx,
    async (_batchText, candidates) => {
      aiCalls += 1;
      aiCandidateCount = candidates.length;
      return candidates.map(candidate => ambiguousAiResult(candidate.sourceText));
    },
  );

  assert.equal(aiCalls, 1);
  assert.equal(aiCandidateCount, 30);
  assert.equal(routed.results.length, 60);
  assert.equal(routed.decision.batch?.itemCount, 60);
  assert.equal(routed.decision.batch?.localItemCount, 30);
  assert.equal(routed.decision.batch?.aiItemCount, 30);
  assert.equal(routed.decision.batch?.aiCallCount, 1);
  assert.deepEqual(routed.results.map(result => result.batchItem?.index), Array.from({ length: 60 }, (_, index) => index));
  assert.equal((routed.results[0].payload as any).meta.amount, 10_000);
  assert.equal(routed.results[1].content, 'vague capture 2');
  assert.equal((routed.results[58].payload as any).meta.amount, 10_000);
  assert.equal(routed.results[59].content, 'vague capture 60');
});
