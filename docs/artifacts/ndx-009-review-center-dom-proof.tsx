import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReviewCenterPanel from '../../components/ReviewCenterPanel';
import { ParserResultV2, ParsingTask } from '../../types';

const results: ParserResultV2[] = [
  {
    action: 'create_item',
    entityType: 'finance',
    content: 'kopi',
    targetText: 'expense kopi 10rb cash',
    batchItem: { id: 'item-1', index: 0, sourceText: 'expense kopi 10rb cash', startLine: 1, endLine: 1 },
    confidence: 'high',
    needsReview: false,
    payload: { itemType: 'FINANCE', content: 'kopi', status: 'done', meta: { amount: 10000, financeType: 'expense', paymentMethod: 'cash' } },
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
  {
    action: 'create_item',
    entityType: 'finance',
    content: 'gaji',
    targetText: 'income gaji 5jt bca',
    batchItem: { id: 'item-3', index: 2, sourceText: 'income gaji 5jt bca', startLine: 3, endLine: 3 },
    confidence: 'high',
    needsReview: false,
    payload: { itemType: 'FINANCE', content: 'gaji', status: 'done', meta: { amount: 5000000, financeType: 'income', paymentMethod: 'bca' } },
  },
];

const batch = {
  id: 'batch-proof',
  itemCount: 3,
  localItemCount: 2,
  reviewItemCount: 1,
  aiItemCount: 1,
  failedItemCount: 0,
  aiCallCount: 1,
  items: [
    { id: 'item-1', index: 0, sourceText: 'expense kopi 10rb cash', startLine: 1, endLine: 1, status: 'local_saved' as const, route: 'local_save' as const, intent: 'finance' as const, reasonCodes: ['local_finance_fast_path'], resultCount: 1 },
    { id: 'item-2', index: 1, sourceText: 'lunch with Maya maybe reimburse later', startLine: 2, endLine: 2, status: 'ai_review' as const, route: 'deep_ai' as const, intent: 'unknown' as const, reasonCodes: ['no_local_intent_match'], resultCount: 1 },
    { id: 'item-3', index: 2, sourceText: 'income gaji 5jt bca', startLine: 3, endLine: 3, status: 'local_saved' as const, route: 'local_save' as const, intent: 'finance' as const, reasonCodes: ['local_finance_fast_path'], resultCount: 1 },
  ],
};

const task: ParsingTask = {
  id: 'ndx-009-proof',
  text: 'expense kopi 10rb cash\nlunch with Maya maybe reimburse later\nincome gaji 5jt bca',
  status: 'success',
  stage: 'batch',
  createdAt: 1,
  completedAt: 2,
  batch,
  routerDecision: { route: 'deep_ai', intent: 'mixed', confidenceScore: 0.65, reasonCodes: ['batch_input'], batch },
  results,
};

const html = renderToStaticMarkup(React.createElement(ReviewCenterPanel, { parsingTasks: [task] }));
console.log(html);
