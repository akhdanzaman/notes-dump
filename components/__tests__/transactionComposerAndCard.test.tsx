import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Card from '../Card';
import InputBar from '../InputBar';
import AddExpenseModal from '../AddExpenseModal';
import { BrainDumpItem, ItemType } from '../../types';

const transaction: BrainDumpItem = {
  id: 'tx-receipt-1',
  type: ItemType.FINANCE,
  content: 'Mixed receipt',
  status: 'done',
  created_at: '2026-07-13T08:00:00.000Z',
  completed_at: '2026-07-13T08:00:00.000Z',
  meta: {
    financeType: 'expense',
    amount: 999999,
    budgetCategory: 'food',
    date: '2026-07-13T08:00:00.000Z',
    transactionLineItems: [
      { id: 'line-1', name: 'Lunch', amount: 60000, budgetCategory: 'food' },
      { id: 'line-2', name: 'Notebook', amount: 40000, budgetCategory: 'work' },
    ],
  },
};

const budgetRules = [
  { id: 'food', name: 'Food', percentage: 50 },
  { id: 'work', name: 'Work', percentage: 50 },
];

test('transaction card shows line items and their calculated total while collapsed', () => {
  const html = renderToStaticMarkup(React.createElement(Card, {
    item: transaction,
    enableCollapse: true,
    defaultCollapsed: true,
    budgetRules,
  }));

  assert.match(html, /Lunch/);
  assert.match(html, /Notebook/);
  assert.match(html, /60\.000/);
  assert.match(html, /40\.000/);
  assert.match(html, /100\.000/);
  assert.doesNotMatch(html, /999\.999/);
});

test('transaction card keeps line items visible and amount read-only while expanded', () => {
  const html = renderToStaticMarkup(React.createElement(Card, {
    item: transaction,
    enableCollapse: true,
    defaultCollapsed: false,
    budgetRules,
    onUpdate: () => undefined,
  }));

  assert.match(html, /Lunch/);
  assert.match(html, /Notebook/);
  assert.match(html, /value="100000"/);
  assert.match(html, /readOnly=""/);
});

test('image attachment control belongs to the global input bar, not Add Expense modal', () => {
  const inputHtml = renderToStaticMarkup(React.createElement(InputBar, {
    onSend: () => undefined,
  }));
  assert.match(inputHtml, /Tambahkan gambar nota atau invoice/);

  const modalHtml = renderToStaticMarkup(React.createElement(AddExpenseModal, {
    isOpen: true,
    onClose: () => undefined,
    onSave: () => undefined,
    wallets: [],
    budgetConfig: { monthlyIncome: 0, rules: [] },
    savingGoals: [],
  }));
  assert.doesNotMatch(modalHtml, /Scan nota \/ invoice/);
  assert.doesNotMatch(modalHtml, /Ekstrak transaksi/);
});
