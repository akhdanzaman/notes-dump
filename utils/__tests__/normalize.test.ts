import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCanonicalText, normalizeMerchantText, normalizeWalletText, tokenizeCanonicalText } from '../canonicalization/normalize';

test('normalizeCanonicalText removes punctuation noise and compacts spaces', () => {
  assert.equal(normalizeCanonicalText('  Sarapan!!!   14rb  '), 'sarapan 14rb');
});

test('normalizeMerchantText removes common merchant boilerplate', () => {
  assert.equal(normalizeMerchantText('Toko Mie Gacoan Official Store'), 'mie gacoan');
});

test('normalizeWalletText removes payment method boilerplate', () => {
  assert.equal(normalizeWalletText('ATM Debit BCA'), 'bca');
});

test('tokenizeCanonicalText splits normalized tokens', () => {
  assert.deepEqual(tokenizeCanonicalText('Makan   pagi banget'), ['makan', 'pagi', 'banget']);
});
