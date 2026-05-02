import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemType, BrainDumpItem } from '../../types';
import { getCanonicalOrRawItemValue, itemMatchesCanonicalSearch } from '../canonicalization/accessors';

const item: BrainDumpItem = {
  id: 'item-1',
  type: ItemType.FINANCE,
  content: 'jajan gacoan',
  status: 'done',
  created_at: '2026-05-01T00:00:00.000Z',
  meta: {
    amount: 25000,
    financeType: 'expense',
    merchant: 'gacoan jakal',
    subcommodity: 'sarapan',
    tags: ['food'],
    canonical: {
      merchant: { rawValue: 'gacoan jakal', value: 'Mie Gacoan', confidence: 0.94, source: 'learned_rule' },
      subcommodity: { rawValue: 'sarapan', value: 'breakfast', confidence: 0.9, source: 'system_rule' },
    },
  },
};

test('getCanonicalOrRawItemValue prefers canonical values without losing raw fallback', () => {
  assert.equal(getCanonicalOrRawItemValue(item, 'merchant'), 'Mie Gacoan');
  assert.equal(getCanonicalOrRawItemValue(item, 'subcommodity'), 'breakfast');
  assert.equal(getCanonicalOrRawItemValue(item, 'paymentMethod'), '');

  const rawOnly = { ...item, meta: { ...item.meta, canonical: undefined } };
  assert.equal(getCanonicalOrRawItemValue(rawOnly, 'merchant'), 'gacoan jakal');

  const needsReview = {
    ...item,
    meta: {
      ...item.meta,
      canonical: {
        merchant: { rawValue: 'gacoan jakal', value: 'Maybe Gacoan', confidence: 0.72, source: 'learned_rule' as const, needsReview: true },
      },
    },
  };
  assert.equal(getCanonicalOrRawItemValue(needsReview, 'merchant'), 'gacoan jakal');
});

test('itemMatchesCanonicalSearch matches both raw aliases and canonical clusters', () => {
  assert.equal(itemMatchesCanonicalSearch(item, 'mie gacoan'), true);
  assert.equal(itemMatchesCanonicalSearch(item, 'gacoan jakal'), true);
  assert.equal(itemMatchesCanonicalSearch(item, 'breakfast'), true);
  assert.equal(itemMatchesCanonicalSearch(item, 'sarapan'), true);
  assert.equal(itemMatchesCanonicalSearch(item, 'not-here'), false);
});
