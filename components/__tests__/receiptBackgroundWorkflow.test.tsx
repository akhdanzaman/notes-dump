import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReviewCenterPanel from '../ReviewCenterPanel';
import { getAppNavigationItems } from '../navigationItems';
import { ReceiptProcessingTask } from '../../types';

const renderTask = (task: ReceiptProcessingTask) => renderToStaticMarkup(
  React.createElement(ReviewCenterPanel, {
    receiptTasks: [task],
    pendingReviews: [],
    receiptReviews: [],
    parsingTasks: [],
    enrichmentTasks: [],
  }),
);

test('receipt parsing progress is shown in Review Center independently from draft review', () => {
  const html = renderTask({
    id: 'receipt-job-1',
    createdAt: Date.now(),
    imageName: 'nota-makan.jpg',
    status: 'pending',
    stage: 'reading',
  });

  assert.match(html, /Pemrosesan nota/);
  assert.match(html, /nota-makan\.jpg/);
  assert.match(html, /Membaca nota/);
});

test('direct receipt save remains visible as recent Review Center activity', () => {
  const html = renderTask({
    id: 'receipt-job-2',
    createdAt: Date.now(),
    imageName: 'invoice.png',
    status: 'success',
    stage: 'ready',
    outcome: 'saved',
    transactionItemId: 'transaction-1',
    completedAt: Date.now(),
  });

  assert.match(html, /Tersimpan di Transactions/);
});

test('primary navigation labels stay stable when sub-tabs change', () => {
  const taskLabels = getAppNavigationItems('tasks', 'general').map((item) => item.label);
  const alternateLabels = getAppNavigationItems('shopping', 'journal').map((item) => item.label);

  assert.deepEqual(taskLabels, ['Home', 'Plan', 'Library', 'Money', 'Calendar']);
  assert.deepEqual(alternateLabels, taskLabels);
});
