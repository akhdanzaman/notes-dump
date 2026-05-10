import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ReviewCenterPanel from '../ReviewCenterPanel';
import PendingReviewList from '../PendingReviewList';
import { EnrichmentTask, ParserResultV2, ParsingTask } from '../../types';

const localFinanceResult: ParserResultV2 = {
  action: 'create_item',
  entityType: 'finance',
  content: 'bayar listrik',
  confidence: 'medium',
  needsReview: true,
  reviewReason: 'Local parser recognized a finance entry, but key transaction details need review before saving.',
  payload: {
    itemType: 'FINANCE',
    content: 'bayar listrik',
    status: 'done',
    meta: {
      amount: 50_000,
      financeType: 'expense',
      paymentMethod: 'BCA',
      budgetCategory: 'fixed',
      canonical: {
        paymentMethod: { rawValue: 'BCA', value: 'bca-wallet', confidence: 0.9, source: 'system_rule' },
      },
    },
  },
};

const successfulTask = (overrides: Partial<ParsingTask> = {}): ParsingTask => ({
  id: 'parser-task-1',
  text: 'bayar listrik 50000 BCA',
  status: 'success',
  stage: 'local',
  createdAt: 1,
  completedAt: 2,
  routerDecision: { route: 'review', intent: 'finance', confidenceScore: 0.68, reasonCodes: ['finance_intent_missing_amount'] },
  results: [localFinanceResult],
  ...overrides,
});

test('Review Center success cards render structured local parser details instead of blank success noise', () => {
  const html = renderToStaticMarkup(React.createElement(ReviewCenterPanel, { parsingTasks: [successfulTask()] }));
  assert.match(html, /Money &gt; Transactions/);
  assert.match(html, /Result summary/);
  assert.match(html, /Saved transaction: bayar listrik/);
  assert.match(html, /item type/);
  assert.match(html, /FINANCE/);
  assert.match(html, /amount/);
  assert.match(html, /50000/);
  assert.doesNotMatch(html, /Saved successfully\. No extra review details needed\./);
  assert.doesNotMatch(html, /No structured attributes returned\./);
  assert.doesNotMatch(html, /system_rule/);
});

test('Review Center suppresses no-op successful query tasks with no saved evidence', () => {
  const html = renderToStaticMarkup(React.createElement(ReviewCenterPanel, {
    parsingTasks: [successfulTask({
      id: 'query-task',
      text: 'berapa pengeluaran hari ini?',
      results: [{
        action: 'query_only',
        entityType: 'unknown',
        confidence: 'high',
        needsReview: false,
        payload: { question: 'berapa pengeluaran hari ini?', scope: 'money' },
      }],
    })],
  }));

  assert.match(html, /All caught up!/);
  assert.doesNotMatch(html, /Parsing Queue/);
  assert.doesNotMatch(html, /No saved changes/);
  assert.doesNotMatch(html, /berapa pengeluaran hari ini/);
  assert.doesNotMatch(html, /No structured attributes returned\./);
});

test('Review Center keeps duplicate evidence without rendering a no-op query result card', () => {
  const html = renderToStaticMarkup(React.createElement(ReviewCenterPanel, {
    parsingTasks: [successfulTask({
      id: 'query-duplicate-task',
      text: 'berapa pengeluaran hari ini?',
      duplicateGuardRemovedCount: 1,
      duplicateGuardReason: 'query_duplicate_guard',
      results: [{
        action: 'query_only',
        entityType: 'unknown',
        confidence: 'high',
        needsReview: false,
        payload: { question: 'berapa pengeluaran hari ini?', scope: 'money' },
      }],
    })],
  }));

  assert.match(html, /Suppressed 1 duplicate parser result; no extra Review Center card needed\./);
  assert.doesNotMatch(html, /Result summary/);
  assert.doesNotMatch(html, /No saved changes/);
  assert.doesNotMatch(html, /query_duplicate_guard/);
});

test('Review Center explains collapsed duplicate parser output only when duplicate guard removed results', () => {
  const html = renderToStaticMarkup(React.createElement(ReviewCenterPanel, {
    parsingTasks: [successfulTask({ duplicateGuardRemovedCount: 2, duplicateGuardReason: 'single_finance_duplicate_guard' })],
  }));

  assert.match(html, /Merged duplicate output: kept 1 saved result and suppressed 2 duplicate parser results\./);
  assert.doesNotMatch(html, /Blocked 2 duplicate parser results before saving\./);
  assert.doesNotMatch(html, /single_finance_duplicate_guard/);
});

test('Review Center successful update/delete results summarize changed target instead of empty details', () => {
  const updateResult: ParserResultV2 = {
    action: 'update_item',
    entityType: 'todo',
    confidence: 'high',
    needsReview: false,
    payload: {
      match: { itemId: 'todo-1', itemName: 'Write report' },
      changes: { status: 'done', canonical: { label: { value: 'internal', source: 'manual_review' } } as any },
    },
  };
  const deleteResult: ParserResultV2 = {
    action: 'delete_item',
    entityType: 'todo',
    confidence: 'high',
    needsReview: false,
    payload: { match: { itemId: 'todo-2', itemName: 'Old reminder' } },
  };

  const html = renderToStaticMarkup(React.createElement(ReviewCenterPanel, {
    parsingTasks: [successfulTask({ id: 'mutations', text: 'done report and delete old reminder', results: [updateResult, deleteResult] })],
  }));

  assert.ok(html.includes('Updated item: Write report | 1 field changed'));
  assert.match(html, /Deleted item: Old reminder/);
  assert.match(html, /matched item/);
  assert.doesNotMatch(html, /No structured attributes returned\./);
  assert.doesNotMatch(html, /manual_review/);
  assert.doesNotMatch(html, /canonical/);
});

test('Review Center covers deep-AI parser and async enrichment paths without empty success details', () => {
  const deepAiResult: ParserResultV2 = {
    action: 'create_item',
    entityType: 'event',
    confidence: 'high',
    needsReview: false,
    payload: {
      itemType: 'EVENT',
      content: 'Strategy sync',
      status: 'pending',
      meta: { dateTime: '2026-05-10T10:00:00+07:00' },
    },
  };
  const enrichmentTask: EnrichmentTask = {
    id: 'enrich-1',
    itemId: 'finance-1',
    parserTaskId: 'deep-ai-stage2',
    sourceText: 'makan bebek goreng',
    status: 'review',
    attempts: 1,
    createdAt: 3,
    completedAt: 4,
    appliedFields: ['commodity', 'subcommodity'],
    reviewCount: 1,
  };

  const html = renderToStaticMarkup(React.createElement(ReviewCenterPanel, {
    parsingTasks: [successfulTask({ id: 'deep-ai-stage2', text: 'event strategy sync tomorrow 10', stage: 'stage2', results: [deepAiResult] })],
    enrichmentTasks: [enrichmentTask],
  }));

  assert.match(html, /Calendar/);
  assert.match(html, /Saved event: Strategy sync/);
  assert.match(html, /Background Enrichment/);
  assert.match(html, /Needs review/);
  assert.match(html, /Applied: commodity, subcommodity/);
  assert.match(html, /1 ambiguous suggestion moved to Review Center\./);
  assert.doesNotMatch(html, /No structured attributes returned\./);
  assert.doesNotMatch(html, /Saved successfully\. No extra review details needed\./);
  assert.doesNotMatch(html, /system_rule/);
});

test('medium local review drafts expose parsed fields and hide noisy canonical internals', () => {
  const html = renderToStaticMarkup(React.createElement(PendingReviewList, {
    reviews: [{ id: 'review-1', text: 'bayar listrik 50000 BCA', results: [localFinanceResult] }],
    onApprove: () => {},
    onReject: () => {},
  }));
  assert.match(html, /Parser Draft/);
  assert.match(html, /Parsed Output/);
  assert.match(html, /Money &gt; Transactions/);
  assert.match(html, /Saved transaction: bayar listrik/);
  assert.match(html, /Rp 50,000/);
  assert.match(html, /from wallet/);
  assert.doesNotMatch(html, /paymentMethod/);
  assert.doesNotMatch(html, /system_rule/);
  assert.doesNotMatch(html, /No structured attributes returned\./);
});

test('Review Center groups successful batch parser results with per-item source traceability', () => {
  const batchResults: ParserResultV2[] = [
    {
      ...localFinanceResult,
      targetText: 'expense kopi 10rb cash',
      batchItem: { id: 'item-1', index: 0, sourceText: 'expense kopi 10rb cash', startLine: 1, endLine: 1 },
      payload: {
        itemType: 'FINANCE',
        content: 'kopi',
        status: 'done',
        meta: { amount: 10_000, financeType: 'expense', paymentMethod: 'cash' },
      },
    },
    {
      action: 'create_item',
      entityType: 'note',
      content: 'lunch with Maya maybe reimburse later',
      targetText: 'lunch with Maya maybe reimburse later',
      batchItem: { id: 'item-2', index: 1, sourceText: 'lunch with Maya maybe reimburse later', startLine: 2, endLine: 2 },
      confidence: 'medium',
      needsReview: true,
      reviewReason: 'Ambiguous batch fallback result needs confirmation.',
      payload: { itemType: 'NOTE', content: 'lunch with Maya maybe reimburse later', status: 'pending', meta: {} },
    },
  ];

  const batch = {
    id: 'batch-proof',
    itemCount: 2,
    localItemCount: 1,
    reviewItemCount: 1,
    aiItemCount: 1,
    failedItemCount: 0,
    aiCallCount: 1,
    items: [
      { id: 'item-1', index: 0, sourceText: 'expense kopi 10rb cash', startLine: 1, endLine: 1, status: 'local_saved' as const, route: 'local_save' as const, intent: 'finance' as const, reasonCodes: ['local_finance_fast_path'], resultCount: 1 },
      { id: 'item-2', index: 1, sourceText: 'lunch with Maya maybe reimburse later', startLine: 2, endLine: 2, status: 'ai_review' as const, route: 'deep_ai' as const, intent: 'unknown' as const, reasonCodes: ['no_local_intent_match'], resultCount: 1 },
    ],
  };

  const html = renderToStaticMarkup(React.createElement(ReviewCenterPanel, {
    parsingTasks: [successfulTask({
      id: 'batch-task',
      text: 'expense kopi 10rb cash\nlunch with Maya maybe reimburse later',
      stage: 'batch',
      batch,
      routerDecision: { route: 'deep_ai', intent: 'mixed', confidenceScore: 0.65, reasonCodes: ['batch_input'], batch },
      results: batchResults,
    })],
  }));

  assert.match(html, /Batch parse: 2 items · 1 local · 1 AI fallback · 1 AI batch call · 1 review/);
  assert.match(html, /Item 1 Money &gt; Transactions/);
  assert.match(html, /Item 2 Library &gt; Notes/);
  assert.match(html, /Batch source/);
  assert.match(html, /expense kopi 10rb cash/);
  assert.match(html, /lunch with Maya maybe reimburse later/);
});

test('Pending Review Center renders batch drafts as ordered per-item cards', () => {
  const html = renderToStaticMarkup(React.createElement(PendingReviewList, {
    reviews: [{
      id: 'batch-review',
      text: 'expense kopi 10rb cash\nlunch with Maya maybe reimburse later',
      results: [
        {
          ...localFinanceResult,
          batchItem: { id: 'item-1', index: 0, sourceText: 'expense kopi 10rb cash', startLine: 1, endLine: 1 },
          payload: { itemType: 'FINANCE', content: 'kopi', status: 'done', meta: { amount: 10_000, financeType: 'expense', paymentMethod: 'cash' } },
        },
        {
          action: 'create_item',
          entityType: 'note',
          content: 'lunch with Maya maybe reimburse later',
          batchItem: { id: 'item-2', index: 1, sourceText: 'lunch with Maya maybe reimburse later', startLine: 2, endLine: 2 },
          confidence: 'medium',
          needsReview: true,
          reviewReason: 'Ambiguous batch fallback result needs confirmation.',
          payload: { itemType: 'NOTE', content: 'lunch with Maya maybe reimburse later', status: 'pending', meta: {} },
        },
      ],
    }],
    onApprove: () => {},
    onReject: () => {},
  }));

  assert.match(html, /Parser Batch Draft/);
  assert.match(html, /Review each batch item below; approval saves the whole ordered batch/);
  assert.match(html, /Item 1/);
  assert.match(html, /Item 2/);
  assert.match(html, /Source/);
  assert.match(html, /expense kopi 10rb cash/);
  assert.match(html, /lunch with Maya maybe reimburse later/);
});
