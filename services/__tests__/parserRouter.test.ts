import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyLocalIntent, PARSER_ROUTER_THRESHOLDS, routeParserInput } from '../parserRouter';
import { BrainDumpItem, BudgetRule, ItemType, Wallet } from '../../types';

const wallets: Wallet[] = [
  { id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, color: 'bg-green-500' },
  { id: 'bca', name: 'BCA', type: 'bank', initialBalance: 0, color: 'bg-blue-500' },
  { id: 'gopay', name: 'Gopay', type: 'ewallet', initialBalance: 0, color: 'bg-cyan-500' },
];

const budgetRules: BudgetRule[] = [
  { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
  { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
  { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
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

test('router thresholds are explicit and ordered', () => {
  assert.equal(PARSER_ROUTER_THRESHOLDS.localSave, 0.85);
  assert.equal(PARSER_ROUTER_THRESHOLDS.review, 0.6);
  assert.ok(PARSER_ROUTER_THRESHOLDS.localSave > PARSER_ROUTER_THRESHOLDS.review);
});

test('router uses local finance parser for explicit transfers without deep AI', async () => {
  let deepCalls = 0;
  const routed = await routeParserInput('transfer 250rb dari bca ke cash', ctx, async () => {
    deepCalls += 1;
    return [];
  });

  assert.equal(deepCalls, 0);
  assert.equal(routed.decision.route, 'local_save');
  assert.equal(routed.results[0].action, 'transfer_money');
  assert.equal((routed.results[0].payload as any).amount, 250_000);
  assert.equal((routed.results[0].payload as any).fromWallet, 'bca');
  assert.equal((routed.results[0].payload as any).toWallet, 'cash');
});

test('router keeps future buy wording as shopping instead of paid finance', async () => {
  const routed = await routeParserInput('beli susu besok 12rb', ctx, async () => []);

  assert.equal(routed.decision.route, 'local_save');
  assert.equal(routed.decision.intent, 'shopping');
  assert.equal(routed.results[0].action, 'create_item');
  assert.equal((routed.results[0].payload as any).itemType, ItemType.SHOPPING);
});

test('router sends local saving fund with unmatched goal to Review Center', async () => {
  const routed = await routeParserInput('saving 500rb vacation dari bca', ctx, async () => []);

  assert.equal(routed.decision.route, 'review');
  assert.equal(routed.results[0].action, 'add_saving_funds');
  assert.equal(routed.results[0].needsReview, true);
  assert.match(routed.results[0].reviewReason || '', /savingGoal:notMatched/);
});

test('router falls back to deep AI for mixed multi-action input', async () => {
  let deepCalls = 0;
  const routed = await routeParserInput('expense sarapan 14000 cash; beli susu besok 12rb', ctx, async () => {
    deepCalls += 1;
    return [{ action: 'unknown', entityType: 'unknown', confidence: 'low', needsReview: true }];
  });

  assert.equal(deepCalls, 1);
  assert.equal(routed.decision.route, 'deep_ai');
  assert.equal(routed.decision.intent, 'mixed');
  assert.ok(routed.decision.reasonCodes.includes('mixed_or_complex_input'));
});

test('query-only input is classified without creating a save payload', () => {
  const classified = classifyLocalIntent('berapa pengeluaran hari ini?', ctx);

  assert.equal(classified.route, 'local_save');
  assert.equal(classified.intent, 'query_only');
  assert.equal(classified.result?.action, 'query_only');
  assert.equal((classified.result?.payload as any)?.question, 'berapa pengeluaran hari ini?');
});
