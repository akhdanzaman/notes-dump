import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ReviewCenterPanel from '../ReviewCenterPanel';
import PendingReviewList from '../PendingReviewList';
import { ParserResultV2, ParsingTask } from '../../types';

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

test('Review Center success cards render structured local parser details instead of blank success noise', () => {
  const task: ParsingTask = {
    id: 'parser-task-1',
    text: 'bayar listrik 50000 BCA',
    status: 'success',
    stage: 'local',
    createdAt: 1,
    completedAt: 2,
    routerDecision: { route: 'review', intent: 'finance', confidenceScore: 0.68, reasonCodes: ['finance_intent_missing_amount'] },
    results: [localFinanceResult],
  };
  const html = renderToStaticMarkup(React.createElement(ReviewCenterPanel, { parsingTasks: [task] }));
  assert.match(html, /Money &gt; Transactions/);
  assert.match(html, /item type/);
  assert.match(html, /FINANCE/);
  assert.match(html, /amount/);
  assert.match(html, /50000/);
  assert.doesNotMatch(html, /Saved successfully\. No extra review details needed\./);
  assert.doesNotMatch(html, /No structured attributes returned\./);
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
  assert.match(html, /Rp 50,000/);
  assert.match(html, /paymentMethod/);
  assert.doesNotMatch(html, /system_rule/);
  assert.doesNotMatch(html, /No structured attributes returned\./);
});
