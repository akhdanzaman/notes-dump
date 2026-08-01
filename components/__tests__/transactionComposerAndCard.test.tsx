import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Card from '../Card';
import ShoppingItem from '../ShoppingItem';
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
    items: [],
  }));
  assert.doesNotMatch(modalHtml, /Scan nota \/ invoice/);
  assert.doesNotMatch(modalHtml, /Ekstrak transaksi/);
});

test('global composer keeps three contextual modes and localized compact placeholder', () => {
  const indonesiaHtml = renderToStaticMarkup(React.createElement(InputBar, {
    onSend: () => undefined,
    language: 'id',
  }));
  assert.match(indonesiaHtml, /Catat sesuatu/);

  const englishHtml = renderToStaticMarkup(React.createElement(InputBar, {
    onSend: () => undefined,
    language: 'en',
  }));
  assert.match(englishHtml, /Capture something/);
  assert.match(englishHtml, /Quick input mode/);
});

test('manual transaction modal exposes loan and repayment flows', () => {
  const html = renderToStaticMarkup(React.createElement(AddExpenseModal, {
    isOpen: true,
    onClose: () => undefined,
    onSave: () => undefined,
    wallets: [{ id: 'bca', name: 'BCA', initialBalance: 1_000_000, type: 'bank', color: '#000000' }],
    budgetConfig: { monthlyIncome: 0, rules: [] },
    savingGoals: [],
    items: [],
    initialMode: 'loan',
  }));

  assert.match(html, /Pinjamkan uang/);
  assert.match(html, /Pinjam uang/);
  assert.match(html, /Terima pembayaran/);
  assert.match(html, /Bayar utang/);
  assert.match(html, /Pihak terkait/);
  assert.match(html, /Jatuh tempo/);
});

test('transaction card edit mode exposes loan directions and obligation fields', () => {
  const loanTransaction: BrainDumpItem = {
    id: 'loan-1',
    type: ItemType.FINANCE,
    content: 'Pinjaman kepada Budi',
    status: 'done',
    created_at: '2026-07-13T08:00:00.000Z',
    completed_at: '2026-07-13T08:00:00.000Z',
    meta: {
      financeType: 'loan_out',
      amount: 300_000,
      paymentMethod: 'BCA',
      loanCounterparty: 'Budi',
      loanAccountId: 'loan-account-1',
      loanDueDate: '2026-07-30T00:00:00.000Z',
      date: '2026-07-13T08:00:00.000Z',
    },
  };

  const html = renderToStaticMarkup(React.createElement(Card, {
    item: loanTransaction,
    enableCollapse: true,
    defaultCollapsed: false,
    wallets: [{ id: 'bca', name: 'BCA', initialBalance: 1_000_000, type: 'bank', color: '#000000' }],
    budgetRules,
    onUpdate: () => undefined,
  }));

  assert.match(html, /Pinjamkan uang/);
  assert.match(html, /Pinjam uang/);
  assert.match(html, /Terima pembayaran/);
  assert.match(html, /Bayar utang/);
  assert.match(html, /Pihak terkait/);
  assert.match(html, /Jatuh tempo/);
  assert.match(html, /value="Budi"/);
});

test('workspace cards expose a compact detail-panel trigger without rendering the editor inline', () => {
  const note: BrainDumpItem = {
    id: 'note-detail-1',
    type: ItemType.NOTE,
    content: 'Catatan strategi mingguan',
    status: 'pending',
    created_at: '2026-08-01T08:00:00.000Z',
    meta: { title: 'Strategi' },
  };

  const html = renderToStaticMarkup(React.createElement(Card, {
    item: note,
    enableCollapse: true,
    defaultCollapsed: true,
    onOpen: () => undefined,
    onUpdate: () => undefined,
  }));

  assert.match(html, /data-card-behavior="detail-panel"/);
  assert.match(html, /aria-label="Buka detail Catatan strategi mingguan"/);
  assert.doesNotMatch(html, /Simpan perubahan/);
});

test('shopping detail panel can render the existing editor expanded', () => {
  const shopping: BrainDumpItem = {
    id: 'shopping-detail-1',
    type: ItemType.SHOPPING,
    content: 'Belanja kebutuhan rumah',
    status: 'pending',
    created_at: '2026-08-01T08:00:00.000Z',
    meta: { amount: 150_000, shoppingCategory: 'not_urgent' },
  };

  const html = renderToStaticMarkup(React.createElement(ShoppingItem, {
    item: shopping,
    onToggleStatus: () => undefined,
    onDelete: () => undefined,
    onUpdate: () => undefined,
    defaultExpanded: true,
  }));

  assert.match(html, /data-card-behavior="inline"/);
  assert.match(html, /Save/);
  assert.match(html, /value="Belanja kebutuhan rumah"/);
});
