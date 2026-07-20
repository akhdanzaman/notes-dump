import test from 'node:test';
import assert from 'node:assert/strict';

import { parseLocalFinanceCommand } from '../localFinanceParser';
import { BrainDumpItem, ItemType, Wallet } from '../../types';

const wallets: Wallet[] = [
  { id: 'bca', name: 'BCA', type: 'bank', initialBalance: 1_000_000, color: 'bg-blue-500' },
  { id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, color: 'bg-green-500' },
  { id: 'bibit', name: 'Bibit', type: 'investment', initialBalance: 0, color: 'bg-emerald-500' },
];

const targets: BrainDumpItem[] = [
  {
    id: 'goal-emergency',
    type: ItemType.SHOPPING,
    content: 'Emergency fund',
    status: 'pending',
    created_at: '2026-07-01T00:00:00.000Z',
    meta: { shoppingCategory: 'saving', dedicatedWalletId: 'bca' },
  },
  {
    id: 'investment-bbca',
    type: ItemType.SHOPPING,
    content: 'BBCA',
    status: 'pending',
    created_at: '2026-07-01T00:00:00.000Z',
    meta: { shoppingCategory: 'investment', dedicatedWalletId: 'bibit' },
  },
];

const options = {
  availableWallets: wallets,
  existingItems: targets,
  now: new Date('2026-07-19T12:00:00+07:00'),
};

test('withdraw from an investment resolves target, dedicated source wallet, and receiving wallet', () => {
  const parsed = parseLocalFinanceCommand('tarik 100rb dari BBCA ke BCA', options);

  assert.ok(parsed);
  assert.equal(parsed.result.action, 'withdraw_saving_funds');
  assert.equal(parsed.result.needsReview, false);
  assert.equal((parsed.result.payload as any).savingGoalId, 'investment-bbca');
  assert.equal((parsed.result.payload as any).amount, 100_000);
  assert.equal((parsed.result.payload as any).fromWallet, 'bibit');
  assert.equal((parsed.result.payload as any).toWallet, 'bca');
});

test('withdraw from a regular saving goal uses its dedicated wallet when destination differs', () => {
  const parsed = parseLocalFinanceCommand('cairkan 50rb dari Emergency fund ke Cash', options);

  assert.ok(parsed);
  assert.equal(parsed.result.action, 'withdraw_saving_funds');
  assert.equal((parsed.result.payload as any).savingGoalId, 'goal-emergency');
  assert.equal((parsed.result.payload as any).fromWallet, 'bca');
  assert.equal((parsed.result.payload as any).toWallet, 'cash');
});

test('loan parser distinguishes lending, borrowing, incoming repayment, and outgoing repayment', () => {
  const samples = [
    ['pinjamkan 300rb ke Budi dari BCA', 'loan_out', 'Budi', 300_000],
    ['pinjam 1jt dari Sari masuk BCA', 'loan_in', 'Sari', 1_000_000],
    ['Budi mengembalikan 100rb ke BCA', 'loan_repayment_in', 'Budi', 100_000],
    ['bayar utang 200rb ke Sari dari BCA', 'loan_repayment_out', 'Sari', 200_000],
  ] as const;

  samples.forEach(([text, kind, counterparty, amount]) => {
    const parsed = parseLocalFinanceCommand(text, options);
    assert.ok(parsed, text);
    assert.equal(parsed.result.action, 'record_loan_transaction', text);
    assert.equal(parsed.result.needsReview, false, text);
    assert.equal((parsed.result.payload as any).transactionKind, kind, text);
    assert.equal((parsed.result.payload as any).counterparty, counterparty, text);
    assert.equal((parsed.result.payload as any).amount, amount, text);
    assert.equal((parsed.result.payload as any).wallet, 'bca', text);
  });
});
