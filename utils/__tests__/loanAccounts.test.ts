import assert from 'node:assert/strict';
import test from 'node:test';
import { BrainDumpItem, ItemType } from '../../types';
import { getLoanAccounts, getLoanSummary } from '../loanAccounts';

const tx = (id: string, financeType: BrainDumpItem['meta']['financeType'], amount: number, counterparty: string, date: string, extra: Partial<BrainDumpItem['meta']> = {}): BrainDumpItem => ({
  id,
  type: ItemType.FINANCE,
  content: id,
  status: 'done',
  created_at: date,
  completed_at: date,
  meta: { financeType, amount, loanCounterparty: counterparty, date, ...extra },
});

test('groups explicit loan account and calculates partial repayment', () => {
  const accounts = getLoanAccounts([
    tx('repay', 'loan_repayment_in', 250_000, 'Budi', '2026-07-10T00:00:00.000Z', { loanAccountId: 'loan-1' }),
    tx('open', 'loan_out', 1_000_000, 'Budi', '2026-07-01T00:00:00.000Z', { loanAccountId: 'loan-1', loanDueDate: '2026-07-30T00:00:00.000Z' }),
  ], new Date('2026-07-20T00:00:00.000Z'));

  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].originalAmount, 1_000_000);
  assert.equal(accounts[0].repaidAmount, 250_000);
  assert.equal(accounts[0].remainingAmount, 750_000);
  assert.equal(accounts[0].direction, 'receivable');
});

test('legacy repayments are matched FIFO by counterparty and direction', () => {
  const accounts = getLoanAccounts([
    tx('open-1', 'loan_out', 300_000, 'Budi', '2026-06-01T00:00:00.000Z'),
    tx('open-2', 'loan_out', 500_000, 'Budi', '2026-06-10T00:00:00.000Z'),
    tx('repay', 'loan_repayment_in', 200_000, 'Budi', '2026-06-20T00:00:00.000Z'),
  ]);

  assert.equal(accounts[0].remainingAmount, 100_000);
  assert.equal(accounts[1].remainingAmount, 500_000);
});

test('summary separates receivable and payable obligations', () => {
  const accounts = getLoanAccounts([
    tx('lent', 'loan_out', 500_000, 'Budi', '2026-07-01T00:00:00.000Z', { loanAccountId: 'a' }),
    tx('borrowed', 'loan_in', 900_000, 'Sari', '2026-07-02T00:00:00.000Z', { loanAccountId: 'b' }),
    tx('paid', 'loan_repayment_out', 300_000, 'Sari', '2026-07-03T00:00:00.000Z', { loanAccountId: 'b' }),
  ]);
  const summary = getLoanSummary(accounts);
  assert.equal(summary.receivable, 500_000);
  assert.equal(summary.payable, 600_000);
  assert.equal(summary.openCount, 2);
});

test('legacy repayment spills across multiple obligations without overstating the remaining balance', () => {
  const accounts = getLoanAccounts([
    tx('open-1', 'loan_out', 300_000, 'Budi', '2026-06-01T00:00:00.000Z'),
    tx('open-2', 'loan_out', 500_000, 'Budi', '2026-06-10T00:00:00.000Z'),
    tx('repay', 'loan_repayment_in', 450_000, 'Budi', '2026-06-20T00:00:00.000Z'),
  ]);

  const first = accounts.find((account) => account.id.endsWith('open-1'));
  const second = accounts.find((account) => account.id.endsWith('open-2'));
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.remainingAmount, 0);
  assert.equal(second.remainingAmount, 350_000);
  assert.equal(getLoanSummary(accounts).receivable, 350_000);
});
