import test from 'node:test';
import assert from 'node:assert/strict';

import { canonicalizeParserResults } from '../canonicalizerService';
import { enrichFinanceMetaFromText, PARSER_SIGNAL_GUIDANCE } from '../parserSignalService';
import { getSystemCanonicalRules } from '../../utils/canonicalization/systemRules';
import { BudgetRule, ParserResultV2, Wallet } from '../../types';

const wallets: Wallet[] = [
  { id: 'cash-wallet', name: 'Cash', type: 'cash', initialBalance: 0, color: 'bg-green-500' },
  { id: 'gopay-wallet', name: 'Gopay', type: 'ewallet', initialBalance: 0, color: 'bg-blue-500' },
  { id: 'bni-wallet', name: 'BNI', type: 'bank', initialBalance: 0, color: 'bg-orange-500' },
];

const budgetRules: BudgetRule[] = [
  { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
  { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
  { id: 'fixed', name: 'Fixed', percentage: 10, color: 'bg-gray-500' },
];

test('parser signal guidance contains anti-hallucination examples for finance metadata', () => {
  assert.match(PARSER_SIGNAL_GUIDANCE, /merchant is a vendor\/place only when the user explicitly names one/i);
  assert.match(PARSER_SIGNAL_GUIDANCE, /sarapan.*breakfast/is);
  assert.match(PARSER_SIGNAL_GUIDANCE, /parkir.*parking/is);
  assert.match(PARSER_SIGNAL_GUIDANCE, /bayar 12000 cash.*merchant blank/is);
});

test('enrichFinanceMetaFromText extracts breakfast and cash wallet without inventing merchant', () => {
  const meta = enrichFinanceMetaFromText({
    rawText: 'sarapan 14000 cash',
    itemType: 'FINANCE',
    meta: { amount: 14_000, financeType: 'expense' },
    availableWallets: wallets,
    availableBudgetRules: budgetRules,
  });

  assert.equal(meta.paymentMethod, 'cash-wallet');
  assert.equal(meta.commodity, 'food');
  assert.equal(meta.subcommodity, 'breakfast');
  assert.equal(meta.budgetCategory, 'needs');
  assert.equal(meta.merchant, undefined);
});

test('enrichFinanceMetaFromText extracts parking and BNI wallet without merchant hallucination', () => {
  const meta = enrichFinanceMetaFromText({
    rawText: 'parkir motor 3000 bni',
    itemType: 'FINANCE',
    meta: { amount: 3_000, financeType: 'expense' },
    availableWallets: wallets,
    availableBudgetRules: budgetRules,
  });

  assert.equal(meta.paymentMethod, 'bni-wallet');
  assert.equal(meta.commodity, 'transport');
  assert.equal(meta.subcommodity, 'parking');
  assert.equal(meta.budgetCategory, 'fixed');
  assert.equal(meta.merchant, undefined);
});

test('enrichFinanceMetaFromText extracts explicit merchant mention and Gopay wallet', () => {
  const meta = enrichFinanceMetaFromText({
    rawText: 'makan siang di Warung Bu Sari 18000 gopay',
    itemType: 'FINANCE',
    meta: { amount: 18_000, financeType: 'expense' },
    availableWallets: wallets,
    availableBudgetRules: budgetRules,
  });

  assert.equal(meta.paymentMethod, 'gopay-wallet');
  assert.equal(meta.commodity, 'food');
  assert.equal(meta.subcommodity, 'lunch');
  assert.equal(meta.merchant, 'Warung Bu Sari');
});

test('enrichFinanceMetaFromText leaves ambiguous amount plus wallet text uncategorized', () => {
  const meta = enrichFinanceMetaFromText({
    rawText: 'bayar 12000 cash',
    itemType: 'FINANCE',
    meta: { amount: 12_000, financeType: 'expense' },
    availableWallets: wallets,
    availableBudgetRules: budgetRules,
  });

  assert.equal(meta.paymentMethod, 'cash-wallet');
  assert.equal(meta.commodity, undefined);
  assert.equal(meta.subcommodity, undefined);
  assert.equal(meta.merchant, undefined);
});

test('canonicalizer can use enriched raw parser signal for auto-apply and review suggestions', () => {
  const enriched = enrichFinanceMetaFromText({
    rawText: 'sarapan di Gacoan 14000 cash',
    itemType: 'FINANCE',
    meta: { amount: 14_000, financeType: 'expense', merchant: 'gacoan' },
    availableWallets: wallets,
    availableBudgetRules: budgetRules,
  });

  const parsed: ParserResultV2[] = [{
    action: 'create_item',
    entityType: 'finance',
    confidence: 'high',
    needsReview: false,
    payload: {
      itemType: 'FINANCE',
      content: 'sarapan di Gacoan',
      meta: enriched,
    },
  }];

  const result = canonicalizeParserResults(parsed, {
    existingItems: [],
    wallets,
    budgetRules,
    rules: [
      ...getSystemCanonicalRules(wallets),
      {
        id: 'merchant-gacoan',
        field: 'merchant',
        canonicalValue: 'Mie Gacoan',
        aliases: ['gacoan'],
        source: 'learned',
        approvalCount: 5,
        rejectionCount: 0,
        conditions: { financeType: ['expense'], commodity: ['food'] },
        createdAt: '2026-05-02T00:00:00.000Z',
        updatedAt: '2026-05-02T00:00:00.000Z',
      },
    ],
  });

  const payload = result[0].payload as any;
  assert.equal(payload.meta.paymentMethod, 'cash-wallet');
  assert.equal(payload.meta.subcommodity, 'breakfast');
  assert.equal(payload.meta.canonical.paymentMethod.value, 'cash-wallet');
  assert.equal(payload.meta.canonical.subcommodity.value, 'breakfast');
  assert.equal(payload.meta.canonical.merchant.value, 'Mie Gacoan');
  assert.equal(result[0].canonicalReview?.length, 0);
});
