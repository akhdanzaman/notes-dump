import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import TransactionLedger from '../TransactionLedger';
import { BrainDumpItem, ItemType } from '../../types';

const transaction: BrainDumpItem = { id: 'receipt', type: ItemType.FINANCE, content: 'Office supplies', status: 'pending', created_at: '2026-09-25', meta: { amount: 999999, paymentMethod: 'cash', financeType: 'expense', transactionLineItems: [{ id: 'a', name: 'Pen', amount: 12000, budgetCategory: 'work' }, { id: 'b', name: 'Book', amount: 23000, budgetCategory: 'work' }] } };
const render = (showAmounts: boolean) => renderToStaticMarkup(<TransactionLedger groups={[{label:'Today',date:new Date('2026-09-25'),items:[transaction]}]} wallets={[{id:'cash',name:'Cash',balance:0} as any]} budgetConfig={{monthlyIncome:0,rules:[{id:'work',name:'Work',percentage:100,color:'green'}]}} typeLabels={{expense:'Expense'}} formatAmount={amount => String(amount)} showAmounts={showAmounts} language="en" onOpen={() => {}} />);

test('ledger uses line-item totals, resolves labels and retains planned state and detail access', () => {
  const html = render(true);
  for (const value of ['35000', 'Work', 'Cash', 'Planned', '2', 'item', 'Open transaction: Office supplies']) assert.ok(html.includes(value), value);
  assert.doesNotMatch(html, /999999/);
  assert.match(html, /<table/);
});
test('ledger privacy removes financial amounts from all rendered markup', () => {
  const html = render(false);
  assert.doesNotMatch(html, /35000|999999|12000|23000/);
  assert.match(html, /••••/);
});
