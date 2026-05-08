import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalizeMeta, canonicalizeParserResults, learnCanonicalRulesFromReview, sweepHistoricalCanonicalMeta } from '../canonicalizerService';
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
      id: 'behavior-target',
      type: ItemType.FINANCE,
      content: 'kedai sore 30000',
      status: 'done',
      created_at: '2026-05-02T08:00:00.000Z',
      completed_at: '2026-05-02T08:00:00.000Z',
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
