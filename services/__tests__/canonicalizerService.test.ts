import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalizeMeta, canonicalizeParserResults, learnCanonicalRulesFromReview } from '../canonicalizerService';
import { CanonicalRule, ParserResultV2 } from '../../types';

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

test('canonicalizeMeta auto-applies strong exact matches without overwriting raw field', () => {
  const result = canonicalizeMeta({
    merchant: 'gacoan',
    financeType: 'expense',
    commodity: 'food',
    budgetCategory: 'needs',
  }, ctx);

  assert.equal(result.meta.merchant, 'gacoan');
  assert.equal(result.meta.canonical?.merchant?.value, 'Mie Gacoan');
  assert.equal(result.meta.canonical?.merchant?.needsReview, false);
  assert.deepEqual(result.autoApplied, ['merchant']);
});

test('canonicalizeMeta suggests review for medium-confidence matches', () => {
  const result = canonicalizeMeta({
    paymentMethod: 'debit bca',
  }, ctx);

  assert.equal(result.meta.canonical?.paymentMethod?.value, 'BCA');
  assert.equal(result.meta.canonical?.paymentMethod?.needsReview, true);
  assert.equal(result.suggestions.length, 1);
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

  assert.equal(canonicalized.autoApplied.length, 0);
  assert.equal(canonicalized.meta.canonical?.merchant?.needsReview, true);
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
