import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePro } from '../geminiProService';
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

const assertLocalDate = (isoDate: string | undefined, year: number, month: number, day: number) => {
  assert.ok(isoDate);
  const date = new Date(isoDate);
  assert.equal(date.getFullYear(), year);
  assert.equal(date.getMonth(), month - 1);
  assert.equal(date.getDate(), day);
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

test('router uses local finance parser for simple expenses without deep AI', async () => {
  let deepCalls = 0;
  const routed = await routeParserInput('expense makan 37500 gopay', ctx, async () => {
    deepCalls += 1;
    return [];
  });

  assert.equal(deepCalls, 0);
  assert.equal(routed.decision.route, 'local_save');
  assert.equal(routed.results[0].action, 'create_item');
  assert.equal((routed.results[0].payload as any).content, 'makan');
  assert.equal((routed.results[0].payload as any).meta.amount, 37_500);
  assert.equal((routed.results[0].payload as any).meta.financeType, 'expense');
  assert.equal((routed.results[0].payload as any).meta.paymentMethod, 'gopay');
  assert.equal((routed.results[0].payload as any).meta.toWallet, undefined);
});

test('local finance parser supports Indonesian currency forms and unknown-wallet review', async () => {
  const samples = [
    ['expense kopi 10rb cash', 10_000],
    ['expense belanja 100.000 bca', 100_000],
    ['income freelance rp10000 bca', 10_000],
  ] as const;

  for (const [input, amount] of samples) {
    const routed = await routeParserInput(input, ctx, async () => []);
    assert.equal((routed.results[0].payload as any).meta.amount, amount);
  }

  const unknownWallet = await routeParserInput('expense makan 37500 jenius', ctx, async () => []);
  assert.equal(unknownWallet.decision.route, 'deep_ai');
  assert.equal(unknownWallet.results.length, 0);
});

test('router uses local finance parser for income without deep AI', async () => {
  let deepCalls = 0;
  const routed = await routeParserInput('income gaji 5jt bca', ctx, async () => {
    deepCalls += 1;
    return [];
  });

  assert.equal(deepCalls, 0);
  assert.equal(routed.decision.route, 'local_save');
  assert.ok(routed.decision.reasonCodes.includes('local_finance_income'));
  assert.equal(routed.results[0].action, 'create_item');
  assert.equal((routed.results[0].payload as any).content, 'gaji');
  assert.equal((routed.results[0].payload as any).meta.amount, 5_000_000);
  assert.equal((routed.results[0].payload as any).meta.financeType, 'income');
  assert.equal((routed.results[0].payload as any).meta.paymentMethod, 'bca');
  assert.equal((routed.results[0].payload as any).meta.toWallet, undefined);
});

test('local finance parser extracts dated finance hints', async () => {
  const datedCtx = { ...ctx, now: new Date('2026-05-09T12:00:00.000Z') };

  const income = await routeParserInput('income gaji 5jt bca kemarin', datedCtx, async () => []);
  assert.equal(income.decision.route, 'local_save');
  assert.equal((income.results[0].payload as any).content, 'gaji');
  assert.equal((income.results[0].payload as any).meta.financeType, 'income');
  assertLocalDate((income.results[0].payload as any).meta.date, 2026, 5, 8);
  assert.equal((income.results[0].payload as any).meta.when, undefined);

  const expense = await routeParserInput('expense parkir 10k cash 2026-05-02', datedCtx, async () => []);
  assert.equal(expense.decision.route, 'local_save');
  assert.equal((expense.results[0].payload as any).content, 'parkir');
  assertLocalDate((expense.results[0].payload as any).meta.date, 2026, 5, 2);
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

test('parsePro returns explicit local finance before requiring Gemini API key', async () => {
  const previousGeminiKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const fast = await parsePro('expense makan 37500 gopay', [], [], wallets, budgetRules, existingItems);
    assert.equal(fast[0].action, 'create_item');
    assert.equal(fast[0].confidence, 'high');
    assert.equal((fast[0].payload as any).meta.paymentMethod, 'gopay');

    const fallback = await parsePro('makan 37500 gopay', [], [], wallets, budgetRules, existingItems);
    assert.equal(fallback[0].action, 'unknown');
    assert.match(fallback[0].reviewReason || '', /Missing Gemini API key/);
  } finally {
    if (previousGeminiKey !== undefined) process.env.GEMINI_API_KEY = previousGeminiKey;
  }
});

test('query-only input is classified without creating a save payload', () => {
  const classified = classifyLocalIntent('berapa pengeluaran hari ini?', ctx);

  assert.equal(classified.route, 'local_save');
  assert.equal(classified.intent, 'query_only');
  assert.equal(classified.result?.action, 'query_only');
  assert.equal((classified.result?.payload as any)?.question, 'berapa pengeluaran hari ini?');
});

test('router classifies every P1 local intent without calling deep AI', async () => {
  const cases = [
    {
      label: 'finance',
      input: 'expense kopi 10rb cash',
      intent: 'finance',
      action: 'create_item',
      entityType: 'finance',
      itemType: ItemType.FINANCE,
    },
    {
      label: 'todo',
      input: 'todo: follow up investor deck',
      intent: 'todo',
      action: 'create_item',
      entityType: 'todo',
      itemType: ItemType.TODO,
    },
    {
      label: 'shopping',
      input: 'shopping: oats and milk',
      intent: 'shopping',
      action: 'create_item',
      entityType: 'shopping',
      itemType: ItemType.SHOPPING,
    },
    {
      label: 'note',
      input: 'note: parser router should stay quiet',
      intent: 'note',
      action: 'create_item',
      entityType: 'note',
      itemType: ItemType.NOTE,
    },
    {
      label: 'journal',
      input: 'journal: feeling focused today',
      intent: 'journal',
      action: 'create_item',
      entityType: 'journal',
      itemType: ItemType.JOURNAL,
    },
    {
      label: 'event',
      input: 'event: strategy sync tomorrow 10am',
      intent: 'event',
      action: 'create_item',
      entityType: 'event',
      itemType: ItemType.EVENT,
    },
    {
      label: 'query-only',
      input: 'berapa pengeluaran hari ini?',
      intent: 'query_only',
      action: 'query_only',
      entityType: 'unknown',
    },
  ] as const;

  for (const expected of cases) {
    let deepCalls = 0;
    const routed = await routeParserInput(expected.input, ctx, async () => {
      deepCalls += 1;
      return [];
    });

    assert.equal(deepCalls, 0, expected.label);
    assert.equal(routed.decision.route, 'local_save', expected.label);
    assert.equal(routed.decision.intent, expected.intent, expected.label);
    assert.equal(routed.results[0].action, expected.action, expected.label);
    assert.equal(routed.results[0].entityType, expected.entityType, expected.label);
    if ('itemType' in expected) {
      assert.equal((routed.results[0].payload as any).itemType, expected.itemType, expected.label);
    } else {
      assert.equal((routed.results[0].payload as any).question, expected.input, expected.label);
    }
  }
});
