import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalizeMeta, canonicalizeParserResults, learnCanonicalRulesFromReview, sweepHistoricalCanonicalMeta } from '../canonicalizerService';
import { BEHAVIOR_CACHE_DEFAULT_MAX_RECENT_TRANSACTIONS, buildBehaviorCache } from '../behaviorCacheService';
import { BrainDumpItem, CanonicalRule, ItemType, ParserResultV2 } from '../../types';

const rules: CanonicalRule[] = [
  {
    id: 'merchant-gacoan',
    field: 'merchant',
    canonicalValue: 'Mie Gacoan',
    aliases: ['gacoan', 'mie gacoan'],
    source: 'system',
    confidenceBoost: 0.1,
    approvalCount: 999,
    rejectionCount: 0,
    conditions: { financeType: ['expense'], commodity: ['food'], budgetCategory: ['needs'] },
    createdAt: '2026-05-02T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z',
  },
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

const ctx = {
  existingItems: [],
  wallets: [],
  budgetRules: [],
  rules,
};

test('canonicalizeMeta treats commodity as the primary canonical spend field without overwriting raw merchant', () => {
  const result = canonicalizeMeta({
    merchant: 'gacoan',
    financeType: 'expense',
    commodity: 'food',
    budgetCategory: 'needs',
  }, ctx);

  assert.equal(result.meta.merchant, 'gacoan');
  assert.equal(result.meta.canonical?.merchant, undefined);
  assert.equal(result.meta.canonical?.commodity?.value, 'food');
  assert.equal(result.meta.canonical?.commodity?.needsReview, false);
  assert.ok(result.autoApplied.includes('commodity'));
});

test('canonicalizeMeta suggests review for medium-confidence matches', () => {
  const result = canonicalizeMeta({
    paymentMethod: 'debit bca',
  }, ctx);

  assert.equal(result.meta.canonical?.paymentMethod?.value, 'BCA');
  assert.equal(result.meta.canonical?.paymentMethod?.needsReview, true);
  assert.equal(result.suggestions.length, 1);
});

test('canonicalizeMeta does not queue low-confidence fuzzy matches for review', () => {
  const result = canonicalizeMeta({
    paymentMethod: 'cash',
  }, ctx);

  assert.equal(result.meta.canonical?.paymentMethod, undefined);
  assert.equal(result.suggestions.length, 0);
  assert.equal(result.autoApplied.length, 0);
});

test('canonicalizeParserResults annotates create_item results with canonical review metadata', () => {
  const parsed: ParserResultV2[] = [
    {
      action: 'create_item',
      entityType: 'finance',
      confidence: 'high',
      needsReview: false,
      payload: {
        itemType: 'FINANCE',
        content: 'bayar makan',
        meta: {
          paymentMethod: 'debit bca',
        },
      },
    },
  ];

  const next = canonicalizeParserResults(parsed, ctx);

  assert.equal(next[0].needsReview, true);
  assert.ok(next[0].reviewReason?.includes('Canonical review suggested'));
  const payload = next[0].payload as any;
  assert.equal(payload.meta.canonical.paymentMethod.value, 'BCA');
  assert.equal(next[0].canonicalReview?.length, 1);
});

test('learnCanonicalRulesFromReview stores approved canonical mappings', () => {
  const approved: ParserResultV2[] = [
    {
      action: 'create_item',
      entityType: 'finance',
      confidence: 'medium',
      needsReview: false,
      payload: {
        itemType: 'FINANCE',
        content: 'kopken 28k',
        meta: {
          merchant: 'kopken',
          canonical: {
            merchant: {
              rawValue: 'kopken',
              value: 'Kopi Kenangan',
              confidence: 0.8,
              source: 'manual_review',
              needsReview: false,
            },
          },
        },
      },
    },
  ];

  const nextRules = learnCanonicalRulesFromReview({
    originalResults: [],
    approvedResults: approved,
    existingRules: [],
  });

  assert.equal(nextRules.length, 1);
  assert.equal(nextRules[0].field, 'merchant');
  assert.equal(nextRules[0].canonicalValue, 'Kopi Kenangan');
  assert.deepEqual(nextRules[0].aliases, ['kopken']);
  assert.equal(nextRules[0].approvalCount, 1);
});

test('learnCanonicalRulesFromReview increments rejection count when suggestion is removed', () => {
  const existingRules: CanonicalRule[] = [
    {
      id: 'merchant-wrong',
      field: 'merchant',
      canonicalValue: 'Wrong Merchant',
      aliases: ['orange'],
      source: 'learned',
      approvalCount: 2,
      rejectionCount: 0,
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
  ];

  const original: ParserResultV2[] = [
    {
      action: 'create_item',
      entityType: 'finance',
      confidence: 'medium',
      needsReview: true,
      payload: {
        itemType: 'FINANCE',
        content: 'orange 75k',
        meta: {
          merchant: 'orange',
          canonical: {
            merchant: {
              rawValue: 'orange',
              value: 'Wrong Merchant',
              confidence: 0.7,
              source: 'learned_rule',
              ruleId: 'merchant-wrong',
              needsReview: true,
            },
          },
        },
      },
    },
  ];

  const approved: ParserResultV2[] = [
    {
      ...original[0],
      payload: {
        itemType: 'FINANCE',
        content: 'orange 75k',
        meta: { merchant: 'orange' },
      },
    },
  ];

  const nextRules = learnCanonicalRulesFromReview({
    originalResults: original,
    approvedResults: approved,
    existingRules,
  });

  assert.equal(nextRules[0].rejectionCount, 1);
});

test('learnCanonicalRulesFromReview merges duplicate targets and moves conflicting aliases deterministically', () => {
  const existingRules: CanonicalRule[] = [
    {
      id: 'merchant-a',
      field: 'merchant',
      canonicalValue: 'Kopi Kenangan',
      aliases: ['kopken'],
      source: 'learned',
      approvalCount: 1,
      rejectionCount: 0,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'merchant-duplicate',
      field: 'merchant',
      canonicalValue: 'kopi kenangan',
      aliases: ['kopi kenangan official'],
      source: 'learned',
      approvalCount: 2,
      rejectionCount: 0,
      createdAt: '2026-05-01T01:00:00.000Z',
      updatedAt: '2026-05-01T01:00:00.000Z',
    },
    {
      id: 'merchant-wrong-target',
      field: 'merchant',
      canonicalValue: 'Kenangan Coffee',
      aliases: ['kopken'],
      source: 'learned',
      approvalCount: 2,
      rejectionCount: 0,
      createdAt: '2026-05-01T02:00:00.000Z',
      updatedAt: '2026-05-01T02:00:00.000Z',
    },
  ];

  const approved: ParserResultV2[] = [
    {
      action: 'create_item',
      entityType: 'finance',
      confidence: 'medium',
      needsReview: false,
      payload: {
        itemType: 'FINANCE',
        content: 'kopken 28k',
        meta: {
          merchant: 'kopken',
          canonical: {
            merchant: {
              rawValue: 'kopken',
              value: 'Kopi Kenangan',
              source: 'manual_review',
            },
          },
        },
      },
    },
  ];

  const nextRules = learnCanonicalRulesFromReview({
    originalResults: [],
    approvedResults: approved,
    existingRules,
  });

  const winner = nextRules.find(rule => rule.canonicalValue === 'kopi kenangan' || rule.canonicalValue === 'Kopi Kenangan');
  const loser = nextRules.find(rule => rule.canonicalValue === 'Kenangan Coffee');

  assert.equal(nextRules.filter(rule => rule.field === 'merchant' && rule.canonicalValue.toLowerCase().includes('kopi kenangan')).length, 1);
  assert.ok(winner?.aliases.includes('kopken'));
  assert.ok(winner?.aliases.includes('kopi kenangan official'));
  assert.equal(winner?.approvalCount, 4);
  assert.ok(!loser?.aliases.includes('kopken'));
  assert.equal(loser?.rejectionCount, 1);
});

test('repeated rejection degrades learned rules and blocks auto-application', () => {
  const existingRules: CanonicalRule[] = [
    {
      id: 'merchant-harmful',
      field: 'merchant',
      canonicalValue: 'Wrong Merchant',
      aliases: ['orange'],
      source: 'learned',
      approvalCount: 10,
      rejectionCount: 1,
      confidenceBoost: 0.15,
      conditions: { financeType: ['expense'], commodity: ['food'] },
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
  ];

  const original: ParserResultV2[] = [
    {
      action: 'create_item',
      entityType: 'finance',
      confidence: 'medium',
      needsReview: true,
      payload: {
        itemType: 'FINANCE',
        content: 'orange dinner',
        meta: {
          merchant: 'orange',
          canonical: {
            merchant: {
              rawValue: 'orange',
              value: 'Wrong Merchant',
              source: 'learned_rule',
              ruleId: 'merchant-harmful',
              needsReview: true,
            },
          },
        },
      },
    },
  ];

  const approved = [{
    ...original[0],
    payload: {
      itemType: 'FINANCE' as const,
      content: 'orange dinner',
      meta: { merchant: 'orange', financeType: 'expense' as const, commodity: 'food' },
    },
  }];

  const nextRules = learnCanonicalRulesFromReview({
    originalResults: original,
    approvedResults: approved,
    existingRules,
  });

  assert.equal(nextRules[0].rejectionCount, 2);
  assert.equal(nextRules[0].autoApplyDisabled, true);

  const canonicalized = canonicalizeMeta({ merchant: 'orange', financeType: 'expense', commodity: 'food' }, {
    existingItems: [],
    wallets: [],
    budgetRules: [],
    rules: nextRules,
  });

  assert.equal(canonicalized.meta.canonical?.merchant, undefined);
  assert.equal(canonicalized.meta.canonical?.commodity?.value, 'food');
  assert.equal(canonicalized.meta.canonical?.subcommodity?.value, 'others');
});

test('manual review canonical values take precedence over rule rematching', () => {
  const result = canonicalizeMeta({
    merchant: 'gacoan',
    canonical: {
      merchant: {
        rawValue: 'gacoan',
        value: 'Manual Merchant',
        source: 'manual_review',
        confidence: 1,
      },
    },
  }, ctx);

  assert.equal(result.meta.canonical?.merchant?.value, 'Manual Merchant');
  assert.deepEqual(result.autoApplied, []);
  assert.deepEqual(result.suggestions, []);
});

test('sweepHistoricalCanonicalMeta backfills high-confidence canonical metadata without changing raw content', () => {
  const items: BrainDumpItem[] = [
    {
      id: 'item-high-confidence',
      type: ItemType.FINANCE,
      content: 'makan di gacoan',
      status: 'done',
      created_at: '2026-05-01T08:00:00.000Z',
      completed_at: '2026-05-01T08:00:00.000Z',
      meta: {
        merchant: 'gacoan',
        financeType: 'expense',
        commodity: 'food',
        budgetCategory: 'needs',
      },
    },
  ];

  const sweep = sweepHistoricalCanonicalMeta(items, ctx);

  assert.equal(sweep.autoAppliedCount, 2);
  assert.deepEqual(sweep.changedItemIds, ['item-high-confidence']);
  assert.equal(sweep.reviews.length, 0);
  assert.equal(sweep.items[0].content, 'makan di gacoan');
  assert.equal(sweep.items[0].meta.merchant, 'gacoan');
  assert.equal(sweep.items[0].meta.canonical?.merchant, undefined);
  assert.equal(sweep.items[0].meta.canonical?.commodity?.value, 'food');
  assert.equal(sweep.items[0].meta.subcommodity, 'meal');
  assert.equal(sweep.items[0].meta.canonical?.subcommodity?.value, 'meal');
});

test('sweepHistoricalCanonicalMeta preserves raw merchant/content while adding structured finance metadata', () => {
  const items: BrainDumpItem[] = [
    {
      id: 'raw-preserved',
      type: ItemType.FINANCE,
      content: 'makan siang di Warung Bu Sari 18000 gopay',
      status: 'done',
      created_at: '2026-05-01T08:00:00.000Z',
      completed_at: '2026-05-01T08:00:00.000Z',
      meta: {
        financeType: 'expense',
      },
    },
  ];

  const sweep = sweepHistoricalCanonicalMeta(items, ctx);

  assert.deepEqual(sweep.changedItemIds, ['raw-preserved']);
  assert.equal(sweep.items[0].content, items[0].content);
  assert.equal(sweep.items[0].meta.merchant, undefined);
  assert.equal(sweep.items[0].meta.commodity, 'food');
  assert.equal(sweep.items[0].meta.subcommodity, 'lunch');
});

test('sweepHistoricalCanonicalMeta seeds ambiguous historical rows for review without applying them', () => {
  const items: BrainDumpItem[] = [
    {
      id: 'item-ambiguous',
      type: ItemType.FINANCE,
      content: 'bayar pakai debit bca',
      status: 'done',
      created_at: '2026-05-01T08:00:00.000Z',
      completed_at: '2026-05-01T08:00:00.000Z',
      meta: {
        paymentMethod: 'debit bca',
      },
    },
  ];

  const sweep = sweepHistoricalCanonicalMeta(items, ctx);

  assert.equal(sweep.autoAppliedCount, 0);
  assert.equal(sweep.changedItemIds.length, 0);
  assert.equal(sweep.items[0].meta.canonical?.paymentMethod, undefined);
  assert.equal(sweep.reviews.length, 1);
  assert.equal(sweep.reviews[0].id, 'canonical-backfill-item-ambiguous');
  assert.equal(sweep.reviews[0].results[0].action, 'update_item');
  assert.equal((sweep.reviews[0].results[0].payload as any).match.itemId, 'item-ambiguous');
  assert.equal((sweep.reviews[0].results[0].payload as any).changes.canonical, undefined);
  assert.equal(sweep.reviews[0].results[0].canonicalReview?.[0].suggestedValue, 'BCA');
  assert.equal((sweep.reviews[0].originalResults[0].payload as any).changes.canonical.paymentMethod.value, 'BCA');
});


test('sweepHistoricalCanonicalMeta fills commodity fields from current user behavior for repeated merchants', () => {
  const items: BrainDumpItem[] = [
    {
      id: 'behavior-source',
      type: ItemType.FINANCE,
      content: 'kopi langganan 28000',
      status: 'done',
      created_at: '2026-05-01T08:00:00.000Z',
      completed_at: '2026-05-01T08:00:00.000Z',
      meta: {
        merchant: 'Kedai Sore',
        financeType: 'expense',
        commodity: 'food',
        subcommodity: 'drink',
      },
    },
    {
      id: 'behavior-source-2',
      type: ItemType.FINANCE,
      content: 'kopi langganan 29000',
      status: 'done',
      created_at: '2026-05-02T08:00:00.000Z',
      completed_at: '2026-05-02T08:00:00.000Z',
      meta: {
        merchant: 'Kedai Sore',
        financeType: 'expense',
        commodity: 'food',
        subcommodity: 'drink',
      },
    },
    {
      id: 'behavior-target',
      type: ItemType.FINANCE,
      content: 'kedai sore 30000',
      status: 'done',
      created_at: '2026-05-03T08:00:00.000Z',
      completed_at: '2026-05-03T08:00:00.000Z',
      meta: {
        merchant: 'Kedai Sore',
        financeType: 'expense',
      },
    },
  ];

  const sweep = sweepHistoricalCanonicalMeta(items, ctx);
  const target = sweep.items.find(item => item.id === 'behavior-target')!;

  assert.equal(target.meta.commodity, 'food');
  assert.equal(target.meta.subcommodity, 'drink');
  assert.equal(target.meta.canonical?.commodity?.value, 'food');
  assert.equal(target.meta.canonical?.subcommodity?.value, 'drink');
});

test('canonicalizeParserResults fills commodity fields from transaction behavior signals', () => {
  const parsed: ParserResultV2[] = [
    {
      action: 'create_item',
      entityType: 'finance',
      content: 'sarapan 14000 cash',
      targetText: 'sarapan 14000 cash',
      confidence: 'high',
      needsReview: false,
      payload: {
        itemType: 'FINANCE',
        content: 'sarapan',
        meta: {
          amount: 14000,
          financeType: 'expense',
        },
      },
    },
  ];

  const next = canonicalizeParserResults(parsed, ctx);
  const meta = (next[0].payload as any).meta;

  assert.equal(meta.commodity, 'food');
  assert.equal(meta.subcommodity, 'breakfast');
  assert.equal(meta.canonical.commodity.value, 'food');
  assert.equal(meta.canonical.subcommodity.value, 'breakfast');
});

test('canonicalizeParserResults does not infer spend commodity for non-money notes', () => {
  const parsed: ParserResultV2[] = [
    {
      action: 'create_item',
      entityType: 'note',
      content: 'sarapan ideas for trip planning',
      targetText: 'sarapan ideas for trip planning',
      confidence: 'high',
      needsReview: false,
      payload: {
        itemType: 'NOTE',
        content: 'sarapan ideas for trip planning',
        meta: {
          tags: ['travel'],
        },
      },
    },
  ];

  const next = canonicalizeParserResults(parsed, ctx);
  const meta = (next[0].payload as any).meta;

  assert.equal(meta.commodity, undefined);
  assert.equal(meta.subcommodity, undefined);
  assert.deepEqual(meta.canonical || {}, {});
});

test('sweepHistoricalCanonicalMeta keeps non-money todos out of commodity backfill', () => {
  const items: BrainDumpItem[] = [
    {
      id: 'todo-non-money',
      type: ItemType.TODO,
      content: 'review makan siang event plan',
      status: 'pending',
      created_at: '2026-05-01T08:00:00.000Z',
      meta: {
        tags: ['planning'],
      },
    },
  ];

  const sweep = sweepHistoricalCanonicalMeta(items, ctx);

  assert.deepEqual(sweep.changedItemIds, []);
  assert.deepEqual(sweep.items, items);
});

test('sweepHistoricalCanonicalMeta reruns idempotently after auto-apply', () => {
  const items: BrainDumpItem[] = [
    {
      id: 'item-idempotent',
      type: ItemType.FINANCE,
      content: 'makan di gacoan',
      status: 'done',
      created_at: '2026-05-01T08:00:00.000Z',
      completed_at: '2026-05-01T08:00:00.000Z',
      meta: {
        merchant: 'gacoan',
        financeType: 'expense',
        commodity: 'food',
        budgetCategory: 'needs',
      },
    },
  ];

  const first = sweepHistoricalCanonicalMeta(items, ctx);
  const second = sweepHistoricalCanonicalMeta(first.items, ctx);

  assert.equal(first.autoAppliedCount, 2);
  assert.equal(second.autoAppliedCount, 0);
  assert.deepEqual(second.changedItemIds, []);
  assert.deepEqual(second.items, first.items);
});

test('repeated merchant approvals remain learnable but do not become primary spend canonical auto-apply', () => {
  const original: ParserResultV2[] = [
    {
      action: 'create_item',
      entityType: 'finance',
      confidence: 'medium',
      needsReview: true,
      payload: {
        itemType: 'FINANCE',
        content: 'jajan gacoan',
        meta: {
          merchant: 'gacoan jakal',
          canonical: {
            merchant: {
              rawValue: 'gacoan jakal',
              value: 'Mie Gacoan',
              confidence: 0.8,
              source: 'learned_rule',
              needsReview: true,
            },
          },
        },
      },
    } as any,
  ];

  let nextRules: CanonicalRule[] = [];
  for (let i = 0; i < 5; i += 1) {
    nextRules = learnCanonicalRulesFromReview({
      originalResults: original,
      approvedResults: original,
      existingRules: nextRules,
    });
  }

  const canonicalized = canonicalizeMeta({ merchant: 'gacoan jakal' }, {
    existingItems: [],
    wallets: [],
    budgetRules: [],
    rules: nextRules,
  });

  assert.equal(canonicalized.meta.canonical?.merchant, undefined);
  assert.deepEqual(canonicalized.autoApplied, []);
  assert.equal(canonicalized.suggestions.length, 0);
});

test('re-approval after edits rehabilitates degraded learned rules', () => {
  const existingRules: CanonicalRule[] = [
    {
      id: 'merchant-rehab',
      field: 'merchant',
      canonicalValue: 'Orange Coffee',
      aliases: ['orange'],
      source: 'learned',
      approvalCount: 2,
      rejectionCount: 2,
      autoApplyDisabled: true,
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
  ];

  const approved: ParserResultV2[] = [
    {
      action: 'create_item',
      entityType: 'finance',
      confidence: 'medium',
      needsReview: false,
      payload: {
        itemType: 'FINANCE',
        content: 'orange latte',
        meta: {
          merchant: 'orange',
          canonical: {
            merchant: {
              rawValue: 'orange',
              value: 'Orange Coffee',
              source: 'manual_review',
            },
          },
        },
      },
    },
  ];

  const nextRules = learnCanonicalRulesFromReview({
    originalResults: [],
    approvedResults: approved,
    existingRules,
  });

  assert.equal(nextRules[0].approvalCount, 3);
  assert.equal(nextRules[0].rejectionCount, 1);
  assert.equal(nextRules[0].autoApplyDisabled, false);
  assert.equal(nextRules[0].disabled, false);
});

test('canonicalizeParserResults reuses high-confidence behavior for wallet budget and commodity metadata', () => {
  const behaviorCtx = {
    existingItems: [
      {
        id: 'atelier-1',
        type: ItemType.FINANCE,
        content: 'atelier zeta 28000',
        status: 'done',
        created_at: '2026-05-07T08:00:00.000Z',
        completed_at: '2026-05-07T08:00:00.000Z',
        meta: {
          merchant: 'Atelier Zeta',
          financeType: 'expense' as const,
          paymentMethod: 'gopay-wallet',
          budgetCategory: 'budget-hobby',
          commodity: 'hobby',
          subcommodity: 'airbrush',
        },
      },
      {
        id: 'atelier-2',
        type: ItemType.FINANCE,
        content: 'atelier zeta 30000',
        status: 'done',
        created_at: '2026-05-08T08:00:00.000Z',
        completed_at: '2026-05-08T08:00:00.000Z',
        meta: {
          merchant: 'Atelier Zeta',
          financeType: 'expense' as const,
          paymentMethod: 'gopay-wallet',
          budgetCategory: 'budget-hobby',
          commodity: 'hobby',
          subcommodity: 'airbrush',
        },
      },
    ] as BrainDumpItem[],
    wallets: [{ id: 'gopay-wallet', name: 'Gopay', type: 'ewallet' as const, initialBalance: 0, color: 'bg-green-500' }],
    budgetRules: [{ id: 'budget-hobby', name: 'Hobby', percentage: 10, color: 'bg-purple-500' }],
    rules: [],
  };

  const parsed: ParserResultV2[] = [
    {
      action: 'create_item',
      entityType: 'finance',
      content: 'atelier zeta 32000',
      targetText: 'atelier zeta 32000',
      confidence: 'high',
      needsReview: false,
      payload: {
        itemType: 'FINANCE',
        content: 'atelier zeta',
        meta: {
          amount: 32000,
          merchant: 'Atelier Zeta',
          financeType: 'expense',
        },
      },
    },
  ];

  const next = canonicalizeParserResults(parsed, behaviorCtx);
  const payload = next[0].payload as any;
  assert.equal(payload.content, 'atelier zeta');
  assert.equal(payload.meta.merchant, 'Atelier Zeta');
  assert.equal(payload.meta.paymentMethod, 'gopay-wallet');
  assert.equal(payload.meta.budgetCategory, 'budget-hobby');
  assert.equal(payload.meta.commodity, 'hobby');
  assert.equal(payload.meta.subcommodity, 'airbrush');
  assert.equal(payload.meta.canonical.commodity.source, 'context_inference');
  assert.match(payload.meta.canonical.commodity.reason, /recent approved transactions/);
});

test('behavior cache source window uses recent approved finance rows only', () => {
  assert.equal(BEHAVIOR_CACHE_DEFAULT_MAX_RECENT_TRANSACTIONS, 120);

  const sourceRows: BrainDumpItem[] = [
    {
      id: 'excluded-pending',
      type: ItemType.FINANCE,
      content: 'nimbus 9000',
      status: 'pending',
      created_at: '2026-05-10T09:00:00.000Z',
      completed_at: '2026-05-10T09:00:00.000Z',
      meta: { merchant: 'Nimbus', financeType: 'expense', paymentMethod: 'old-wallet' },
    },
    {
      id: 'excluded-review',
      type: ItemType.FINANCE,
      content: 'nimbus 8500',
      status: 'done',
      created_at: '2026-05-10T08:00:00.000Z',
      completed_at: '2026-05-10T08:00:00.000Z',
      meta: { merchant: 'Nimbus', financeType: 'expense', paymentMethod: 'old-wallet', parserNeedsReview: true } as any,
    },
    {
      id: 'recent-1',
      type: ItemType.FINANCE,
      content: 'nimbus 8000',
      status: 'done',
      created_at: '2026-05-09T08:00:00.000Z',
      completed_at: '2026-05-09T08:00:00.000Z',
      meta: { merchant: 'Nimbus', financeType: 'expense', paymentMethod: 'new-wallet' },
    },
    {
      id: 'recent-2',
      type: ItemType.FINANCE,
      content: 'nimbus 7000',
      status: 'done',
      created_at: '2026-05-08T08:00:00.000Z',
      completed_at: '2026-05-08T08:00:00.000Z',
      meta: { merchant: 'Nimbus', financeType: 'expense', paymentMethod: 'new-wallet' },
    },
    {
      id: 'older-1',
      type: ItemType.FINANCE,
      content: 'nimbus 6000',
      status: 'done',
      created_at: '2026-05-07T08:00:00.000Z',
      completed_at: '2026-05-07T08:00:00.000Z',
      meta: { merchant: 'Nimbus', financeType: 'expense', paymentMethod: 'old-wallet' },
    },
    {
      id: 'older-2',
      type: ItemType.FINANCE,
      content: 'nimbus 5000',
      status: 'done',
      created_at: '2026-05-06T08:00:00.000Z',
      completed_at: '2026-05-06T08:00:00.000Z',
      meta: { merchant: 'Nimbus', financeType: 'expense', paymentMethod: 'old-wallet' },
    },
  ];

  const cache = buildBehaviorCache({
    existingItems: sourceRows,
    wallets: [
      { id: 'new-wallet', name: 'New Wallet', type: 'ewallet' as const, initialBalance: 0, color: 'bg-green-500' },
      { id: 'old-wallet', name: 'Old Wallet', type: 'bank' as const, initialBalance: 0, color: 'bg-blue-500' },
    ],
    budgetRules: [],
    maxRecentTransactions: 2,
  });

  const payment = cache.infer('nimbus 10000', { merchant: 'Nimbus', financeType: 'expense' })
    .find(inference => inference.field === 'paymentMethod');

  assert.equal(payment?.value, 'new-wallet');
  assert.equal(payment?.evidenceCount, 2);
  assert.equal(payment?.totalCount, 2);
  assert.equal(payment?.needsReview, false);
});

test('behavior cache ignores weak others defaults and conflicting low-agreement history', () => {
  const behaviorCtx = {
    existingItems: [
      {
        id: 'weak-1',
        type: ItemType.FINANCE,
        content: 'mystery shop 10000',
        status: 'done',
        created_at: '2026-05-07T08:00:00.000Z',
        completed_at: '2026-05-07T08:00:00.000Z',
        meta: { merchant: 'Mystery Shop', financeType: 'expense' as const, commodity: 'others', subcommodity: 'others' },
      },
      {
        id: 'weak-2',
        type: ItemType.FINANCE,
        content: 'mystery shop 12000',
        status: 'done',
        created_at: '2026-05-08T08:00:00.000Z',
        completed_at: '2026-05-08T08:00:00.000Z',
        meta: { merchant: 'Mystery Shop', financeType: 'expense' as const, commodity: 'unknown', subcommodity: 'unknown' },
      },
      {
        id: 'split-food',
        type: ItemType.FINANCE,
        content: 'pasar minggu 20000',
        status: 'done',
        created_at: '2026-05-07T08:00:00.000Z',
        completed_at: '2026-05-07T08:00:00.000Z',
        meta: { merchant: 'Pasar Minggu', financeType: 'expense' as const, paymentMethod: 'cash-wallet', budgetCategory: 'budget-food', commodity: 'food', subcommodity: 'groceries' },
      },
      {
        id: 'split-home',
        type: ItemType.FINANCE,
        content: 'pasar minggu 25000',
        status: 'done',
        created_at: '2026-05-08T08:00:00.000Z',
        completed_at: '2026-05-08T08:00:00.000Z',
        meta: { merchant: 'Pasar Minggu', financeType: 'expense' as const, paymentMethod: 'cash-wallet', budgetCategory: 'budget-home', commodity: 'home', subcommodity: 'kitchen_appliance' },
      },
    ] as BrainDumpItem[],
    wallets: [{ id: 'cash-wallet', name: 'Cash', type: 'cash' as const, initialBalance: 0, color: 'bg-gray-500' }],
    budgetRules: [
      { id: 'budget-food', name: 'Food', percentage: 50, color: 'bg-orange-500' },
      { id: 'budget-home', name: 'Home', percentage: 20, color: 'bg-blue-500' },
    ],
    rules: [],
  };

  const weakParsed = canonicalizeParserResults([{
    action: 'create_item',
    entityType: 'finance',
    content: 'mystery shop 15000',
    targetText: 'mystery shop 15000',
    confidence: 'high',
    needsReview: false,
    payload: { itemType: 'FINANCE', content: 'mystery shop', meta: { amount: 15000, merchant: 'Mystery Shop', financeType: 'expense' } },
  }], behaviorCtx);
  assert.equal((weakParsed[0].payload as any).meta.commodity, undefined);
  assert.equal((weakParsed[0].payload as any).meta.subcommodity, undefined);

  const splitParsed = canonicalizeParserResults([{
    action: 'create_item',
    entityType: 'finance',
    content: 'pasar minggu 30000',
    targetText: 'pasar minggu 30000',
    confidence: 'high',
    needsReview: false,
    payload: { itemType: 'FINANCE', content: 'pasar minggu', meta: { amount: 30000, merchant: 'Pasar Minggu', financeType: 'expense' } },
  }], behaviorCtx);
  const splitMeta = (splitParsed[0].payload as any).meta;
  // Budget category is now backfilled by canonicalizer fallback (first rule =
  // 'budget-food') when conflicting history makes the behavior cache uncertain.
  assert.equal(splitMeta.budgetCategory, 'budget-food');
  assert.equal(splitMeta.commodity, undefined);
  assert.equal(splitMeta.subcommodity, undefined);
});

test('manual review and explicit parser fields stay stronger than behavior inference', () => {
  const behaviorCtx = {
    existingItems: [
      {
        id: 'source-1',
        type: ItemType.FINANCE,
        content: 'kedai sore 28000',
        status: 'done',
        created_at: '2026-05-07T08:00:00.000Z',
        completed_at: '2026-05-07T08:00:00.000Z',
        meta: { merchant: 'Kedai Sore', financeType: 'expense' as const, paymentMethod: 'gopay-wallet', budgetCategory: 'budget-food', commodity: 'food', subcommodity: 'drink' },
      },
      {
        id: 'source-2',
        type: ItemType.FINANCE,
        content: 'kedai sore 30000',
        status: 'done',
        created_at: '2026-05-08T08:00:00.000Z',
        completed_at: '2026-05-08T08:00:00.000Z',
        meta: { merchant: 'Kedai Sore', financeType: 'expense' as const, paymentMethod: 'gopay-wallet', budgetCategory: 'budget-food', commodity: 'food', subcommodity: 'drink' },
      },
    ] as BrainDumpItem[],
    wallets: [
      { id: 'gopay-wallet', name: 'Gopay', type: 'ewallet' as const, initialBalance: 0, color: 'bg-green-500' },
      { id: 'cash-wallet', name: 'Cash', type: 'cash' as const, initialBalance: 0, color: 'bg-gray-500' },
    ],
    budgetRules: [
      { id: 'budget-food', name: 'Food', percentage: 50, color: 'bg-orange-500' },
      { id: 'budget-digital', name: 'Digital', percentage: 10, color: 'bg-violet-500' },
    ],
    rules: [],
  };

  const next = canonicalizeParserResults([{
    action: 'create_item',
    entityType: 'finance',
    content: 'kedai sore 99000',
    targetText: 'kedai sore 99000',
    confidence: 'high',
    needsReview: false,
    payload: {
      itemType: 'FINANCE',
      content: 'kedai sore subscription',
      meta: {
        amount: 99000,
        merchant: 'Kedai Sore',
        financeType: 'expense',
        paymentMethod: 'cash-wallet',
        budgetCategory: 'budget-digital',
        commodity: 'digital',
        subcommodity: 'subscription',
        canonical: {
          commodity: { rawValue: 'digital', value: 'digital', confidence: 1, source: 'manual_review', needsReview: false },
          subcommodity: { rawValue: 'subscription', value: 'subscription', confidence: 1, source: 'manual_review', needsReview: false },
        },
      },
    },
  }], behaviorCtx);

  const meta = (next[0].payload as any).meta;
  assert.equal(meta.paymentMethod, 'cash-wallet');
  assert.equal(meta.budgetCategory, 'budget-digital');
  assert.equal(meta.commodity, 'digital');
  assert.equal(meta.subcommodity, 'subscription');
  assert.equal(meta.canonical.commodity.source, 'manual_review');
});
