import test from 'node:test';
import assert from 'node:assert/strict';

import { CanonicalRule, ParsedItemMetaV2 } from '../../types';
import { buildRuleCandidates, findBestCanonicalCandidate } from '../canonicalization/ruleMatcher';

const meta: ParsedItemMetaV2 = {
  financeType: 'expense',
  budgetCategory: 'needs',
  commodity: 'food',
  amount: 18000,
};

test('findBestCanonicalCandidate prefers exact alias matches', () => {
  const rules: CanonicalRule[] = [
    {
      id: 'merchant-gacoan',
      field: 'merchant',
      canonicalValue: 'Mie Gacoan',
      aliases: ['gacoan', 'mie gacoan'],
      source: 'learned',
      approvalCount: 3,
      rejectionCount: 0,
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
  ];

  const candidate = findBestCanonicalCandidate('merchant', 'Gacoan', meta, rules);

  assert.ok(candidate);
  assert.equal(candidate?.canonicalValue, 'Mie Gacoan');
  assert.ok((candidate?.score || 0) >= 0.6);
});

test('buildRuleCandidates ignores disabled rules', () => {
  const rules: CanonicalRule[] = [
    {
      id: 'disabled-wallet',
      field: 'paymentMethod',
      canonicalValue: 'BCA',
      aliases: ['debit bca'],
      source: 'system',
      approvalCount: 10,
      rejectionCount: 0,
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
      disabled: true,
    },
  ];

  const candidates = buildRuleCandidates('paymentMethod', 'debit bca', meta, rules);
  assert.equal(candidates.length, 0);
});

test('context can break ties toward the more plausible rule', () => {
  const rules: CanonicalRule[] = [
    {
      id: 'sub-breakfast',
      field: 'subcommodity',
      canonicalValue: 'breakfast',
      aliases: ['makan pagi'],
      source: 'system',
      approvalCount: 1,
      rejectionCount: 0,
      conditions: { financeType: ['expense'], commodity: ['food'], budgetCategory: ['needs'] },
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
    {
      id: 'sub-snack',
      field: 'subcommodity',
      canonicalValue: 'snack',
      aliases: ['makan pagi'],
      source: 'system',
      approvalCount: 1,
      rejectionCount: 0,
      conditions: { financeType: ['expense'], commodity: ['shopping'] },
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
  ];

  const candidate = findBestCanonicalCandidate('subcommodity', 'makan pagi', meta, rules);

  assert.ok(candidate);
  assert.equal(candidate?.ruleId, 'sub-breakfast');
});

test('equal-score collisions resolve by source precedence then stable evidence', () => {
  const rules: CanonicalRule[] = [
    {
      id: 'learned-teh',
      field: 'subcommodity',
      canonicalValue: 'tea break',
      aliases: ['teh'],
      source: 'learned',
      approvalCount: 999,
      rejectionCount: 0,
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
    {
      id: 'system-teh',
      field: 'subcommodity',
      canonicalValue: 'tea',
      aliases: ['teh'],
      source: 'system',
      approvalCount: 999,
      rejectionCount: 0,
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    },
  ];

  const candidate = findBestCanonicalCandidate('subcommodity', 'teh', meta, rules);

  assert.equal(candidate?.ruleId, 'system-teh');
});

test('learned rules with rejection guardrails remain matchable but lose auto-apply eligibility', () => {
  const rules: CanonicalRule[] = [
    {
      id: 'learned-risky',
      field: 'merchant',
      canonicalValue: 'Risky Merchant',
      aliases: ['risky'],
      source: 'learned',
      approvalCount: 10,
      rejectionCount: 2,
      confidenceBoost: 0.15,
      conditions: { financeType: ['expense'], commodity: ['food'] },
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
      autoApplyDisabled: true,
    },
  ];

  const candidate = findBestCanonicalCandidate('merchant', 'risky', meta, rules);

  assert.ok(candidate);
  assert.equal(candidate?.autoApplyEligible, false);
});
