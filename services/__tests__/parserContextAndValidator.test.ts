import test from 'node:test';
import assert from 'node:assert/strict';

import { buildContextTextForIntent, buildLegacyParserContextText, resolveParserContextIntent, type IntentParserContext } from '../parserContextBuilder';
import { sanitizeBrainDumpItemsForPersistence, sanitizeParserResultsBeforeResolve } from '../parserFieldValidator';
import { ItemType, type BrainDumpItem, type CreateItemPayload, type ParserResultV2 } from '../../types';

const item = (id: string, type: ItemType, content: string, status: 'pending' | 'done' = 'pending', meta: BrainDumpItem['meta'] = {}): BrainDumpItem => ({ id, type, content, status, created_at: '2026-05-01T00:00:00.000Z', meta });

const ctx: IntentParserContext = {
  existingTags: ['home', 'urgent'],
  availableSkills: [{ id: 'skill-english', name: 'English', color: '#fff', created_at: '2026-01-01T00:00:00.000Z' }],
  availableWallets: [
    { id: 'wallet-cash', name: 'Cash', type: 'cash', initialBalance: 0, color: '#fff' },
    { id: 'wallet-bca', name: 'BCA', type: 'bank', initialBalance: 0, color: '#fff' },
  ],
  availableBudgetRules: [
    { id: 'budget-food', name: 'Food', percentage: 40, color: '#f00' },
    { id: 'budget-transport', name: 'Transportation', percentage: 20, color: '#0f0' },
  ],
  existingItems: [
    item('todo-1', ItemType.TODO, 'send invoices'),
    item('event-1', ItemType.EVENT, 'team meeting'),
    item('shop-1', ItemType.SHOPPING, 'buy milk', 'pending', { shoppingCategory: 'not_urgent' }),
    item('goal-1', ItemType.SHOPPING, 'Emergency Fund', 'pending', { shoppingCategory: 'saving' }),
    item('finance-1', ItemType.FINANCE, 'coffee', 'done', { financeType: 'expense', paymentMethod: 'wallet-cash', budgetCategory: 'budget-food', commodity: 'food', subcommodity: 'coffee' }),
  ],
  currentDateISO: '2026-05-09T00:00:00.000Z',
  currentDayName: 'Saturday',
  currentMonthKey: '2026-05',
};

test('intent context builder sends only relevant context slices', () => {
  const financeContext = buildContextTextForIntent(ctx, 'finance');
  const taskContext = buildContextTextForIntent(ctx, 'task');
  const shoppingContext = buildContextTextForIntent(ctx, 'shopping');
  const stage1Context = buildContextTextForIntent(ctx, 'stage1');
  const legacyContext = buildLegacyParserContextText(ctx);
  assert.match(financeContext, /Known wallets/);
  assert.match(financeContext, /Known budget categories/);
  assert.match(financeContext, /Recent finance patterns/);
  assert.match(financeContext, /Spreadsheet budget category examples/);
  assert.doesNotMatch(financeContext, /Pending task\/event items/);
  assert.match(taskContext, /Pending task\/event items/);
  assert.doesNotMatch(taskContext, /Known wallets/);
  assert.match(shoppingContext, /Shopping patterns/);
  assert.doesNotMatch(shoppingContext, /Known budget categories/);
  assert.doesNotMatch(stage1Context, /Known wallets|Pending items|Known skills/);
  assert.ok(legacyContext.includes('Pending items'));
});

test('context intent resolver maps stage1 results to feature contexts', () => {
  assert.equal(resolveParserContextIntent([{ action: 'create_item', entityType: 'finance', confidence: 'high', needsReview: false }]), 'finance');
  assert.equal(resolveParserContextIntent([{ action: 'complete_item', entityType: 'todo', confidence: 'high', needsReview: false }]), 'task');
  assert.equal(resolveParserContextIntent([{ action: 'create_item', entityType: 'shopping', confidence: 'high', needsReview: false }]), 'shopping');
});

test('strict validator strips invalid finance refs/prose while preserving raw content', () => {
  const rawResult: ParserResultV2 = { action: 'create_item', entityType: 'finance', content: 'makan sahur 10rb cash', confidence: 'high', needsReview: false, payload: { itemType: 'FINANCE', content: 'makan sahur 10rb cash', status: 'done', meta: { amount: 10000, financeType: 'expense', paymentMethod: 'cash because user said cash', toWallet: 'BCA maybe destination wallet', budgetCategory: 'Food because this is eating', commodity: 'food because sahur is a meal', subcommodity: 'breakfast confidence low', date: 'today' } as any } };
  const [resolved] = sanitizeParserResultsBeforeResolve([rawResult], ctx);
  const payload = resolved.payload as CreateItemPayload;
  assert.equal(payload.content, 'makan sahur 10rb cash');
  assert.equal(payload.meta.amount, 10000);
  assert.equal(payload.meta.paymentMethod, undefined);
  assert.equal(payload.meta.toWallet, undefined);
  assert.equal(payload.meta.budgetCategory, undefined);
  assert.equal(payload.meta.commodity, undefined);
  assert.equal(payload.meta.subcommodity, undefined);
  assert.equal(payload.meta.date, undefined);
  assert.equal(resolved.needsReview, true);
  assert.match(resolved.reviewReason || '', /Unmatched payment wallet/);
  assert.match(resolved.reviewReason || '', /Destination wallet is only valid/);
});

test('strict validator normalizes exact wallet and budget references to ids', () => {
  const rawResult: ParserResultV2 = { action: 'create_item', entityType: 'finance', content: 'coffee 25k cash', confidence: 'high', needsReview: false, payload: { itemType: 'FINANCE', content: 'coffee 25k cash', status: 'done', meta: { amount: 25000, financeType: 'expense', paymentMethod: 'Cash', budgetCategory: 'Food', commodity: 'food', subcommodity: 'coffee', date: '2026-05-09' } } };
  const [resolved] = sanitizeParserResultsBeforeResolve([rawResult], ctx);
  const payload = resolved.payload as CreateItemPayload;
  assert.equal(payload.meta.paymentMethod, 'wallet-cash');
  assert.equal(payload.meta.budgetCategory, 'budget-food');
  assert.equal(payload.meta.commodity, 'food');
  assert.equal(payload.meta.subcommodity, 'coffee');
  assert.equal(payload.meta.date, '2026-05-09');
  assert.equal(resolved.needsReview, false);
});

test('mocked low-confidence commodity output is pushed to review instead of structured fields', () => {
  const rawResult: ParserResultV2 = { action: 'create_item', entityType: 'finance', content: 'grab 30k bca', confidence: 'high', needsReview: false, payload: { itemType: 'FINANCE', content: 'grab 30k bca', status: 'done', meta: { amount: 30000, financeType: 'expense', paymentMethod: 'BCA', budgetCategory: 'Transportation', commodity: 'transport', canonical: { commodity: { rawValue: 'grab', value: 'transport', confidence: 0.51, source: 'ai_assist', needsReview: true } } } as any } };
  const [resolved] = sanitizeParserResultsBeforeResolve([rawResult], ctx);
  const payload = resolved.payload as CreateItemPayload;
  assert.equal(payload.meta.paymentMethod, 'wallet-bca');
  assert.equal(payload.meta.budgetCategory, 'budget-transport');
  assert.equal(payload.meta.commodity, undefined);
  assert.equal(resolved.needsReview, true);
  assert.match(resolved.reviewReason || '', /Low-confidence commodity/);
});

test('audit model-reasoning leakage is removed and retained only in bounded quarantine metadata', () => {
  const leakedToWallet = 'Cash [ID: Cash] is not needed for expense, using paymentMethod Cash. Wait, strictly outputting JSON now without mistakes.';
  const rawResult: ParserResultV2 = {
    action: 'create_item',
    entityType: 'finance',
    content: 'Bayar parkir kantor 3 hari',
    confidence: 'high',
    needsReview: false,
    payload: {
      itemType: 'FINANCE',
      content: 'Bayar parkir kantor 3 hari',
      status: 'done',
      meta: {
        amount: 15_000,
        financeType: 'expense',
        paymentMethod: 'cash',
        toWallet: leakedToWallet,
        merchant: '{"merchant":"Office Parking"}',
      },
    },
  };

  const [resolved] = sanitizeParserResultsBeforeResolve([rawResult], ctx);
  const payload = resolved.payload as CreateItemPayload;

  assert.equal(payload.meta.paymentMethod, 'wallet-cash');
  assert.equal(payload.meta.toWallet, undefined);
  assert.equal(payload.meta.merchant, undefined);
  assert.equal(resolved.needsReview, true);
  assert.ok(resolved.quarantinedFields?.some(field => field.field === 'meta.toWallet' && String(field.rawValue).includes('strictly outputting JSON')));
  assert.ok(resolved.quarantinedFields?.some(field => field.field === 'meta.merchant'));
  assert.ok((resolved.quarantinedFields?.every(field => String(field.rawValue).length <= 241)));
});

test('normal finance transactions require positive amount and valid wallets by transaction type', () => {
  const rawResult: ParserResultV2 = {
    action: 'create_item',
    entityType: 'finance',
    content: 'transfer from bca to bni',
    confidence: 'high',
    needsReview: false,
    payload: {
      itemType: 'FINANCE',
      content: 'transfer from bca to bni',
      status: 'done',
      meta: {
        amount: 0,
        financeType: 'transfer',
        paymentMethod: 'bca',
        toWallet: 'bni shrewdness amount will be 1000000.0 with tags transfer, bank.',
      },
    },
  };

  const [resolved] = sanitizeParserResultsBeforeResolve([rawResult], ctx);
  const payload = resolved.payload as CreateItemPayload;

  assert.equal(payload.meta.amount, undefined);
  assert.equal(payload.meta.paymentMethod, 'wallet-bca');
  assert.equal(payload.meta.toWallet, undefined);
  assert.equal(resolved.needsReview, true);
  assert.match(resolved.reviewReason || '', /Amount must be greater than zero/);
  assert.match(resolved.reviewReason || '', /registered destination wallet/);
  assert.ok(resolved.quarantinedFields?.some(field => field.reason === 'non_positive_amount' && field.rawValue === 0));
});

test('persistence sanitizer canonicalizes wallet casing and moves bad production values to item quarantine', () => {
  const contaminated = item('audit-row-230', ItemType.FINANCE, 'Transfer from BCA to cash', 'done', {
    amount: 50_000,
    financeType: 'transfer',
    paymentMethod: 'bCa',
    toWallet: 'Cash立場: I am ready to output the JSON. The plan is sound.}},',
    budgetCategory: 'Food because this is eating',
  });

  const result = sanitizeBrainDumpItemsForPersistence([contaminated], ctx);
  const sanitized = result.items[0];

  assert.equal(sanitized.meta.paymentMethod, 'wallet-bca');
  assert.equal(sanitized.meta.toWallet, undefined);
  assert.equal(sanitized.meta.budgetCategory, undefined);
  assert.equal(sanitized.meta.parserNeedsReview, true);
  assert.equal(result.quarantinedItemCount, 1);
  assert.equal(result.rejectedFieldCount, 2);
  assert.ok(sanitized.meta.dataQualityQuarantine?.some(field => field.field === 'meta.toWallet'));
  assert.match(sanitized.meta.parserReviewReason || '', /I am ready to output the JSON/);
});

test('special transfer payload validates case-insensitive source and destination wallet references', () => {
  const rawResult: ParserResultV2 = {
    action: 'transfer_money',
    entityType: 'finance',
    confidence: 'high',
    needsReview: false,
    payload: { amount: 250_000, fromWallet: 'bca', toWallet: 'CASH' },
  };

  const [resolved] = sanitizeParserResultsBeforeResolve([rawResult], ctx);
  assert.deepEqual(resolved.payload, { amount: 250_000, fromWallet: 'wallet-bca', toWallet: 'wallet-cash' });
  assert.equal(resolved.needsReview, false);
});
