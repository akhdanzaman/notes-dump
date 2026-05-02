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
