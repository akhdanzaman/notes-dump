import { BrainDumpItem, ItemType, LoanTransactionKind } from '../types';
import { isLoanFinanceType } from './financeTypeUtils';

export type LoanAccountDirection = 'receivable' | 'payable';
export type LoanAccountStatus = 'open' | 'due_soon' | 'overdue' | 'paid';

export interface LoanAccount {
  id: string;
  direction: LoanAccountDirection;
  counterparty: string;
  originalAmount: number;
  repaidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  openedAt: string;
  lastActivityAt: string;
  preferredWalletId?: string;
  status: LoanAccountStatus;
  transactions: BrainDumpItem[];
  legacyMatched: boolean;
}

const normalizeCounterparty = (value?: string): string =>
  (value || '').trim().toLocaleLowerCase('id-ID').replace(/\s+/g, ' ');

const transactionDate = (item: BrainDumpItem): string =>
  item.meta.date || item.completed_at || item.created_at;

const amountOf = (item: BrainDumpItem): number => {
  const amount = Number(item.meta.amount || 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const directionForKind = (kind: LoanTransactionKind): LoanAccountDirection =>
  kind === 'loan_out' || kind === 'loan_repayment_in' ? 'receivable' : 'payable';

const isOpeningKind = (kind: LoanTransactionKind): boolean =>
  kind === 'loan_out' || kind === 'loan_in';

const isRepaymentKind = (kind: LoanTransactionKind): boolean =>
  kind === 'loan_repayment_in' || kind === 'loan_repayment_out';

const dateValue = (value?: string): number => {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const getStatus = (remainingAmount: number, dueDate: string | undefined, now: Date): LoanAccountStatus => {
  if (remainingAmount <= 0) return 'paid';
  if (!dueDate) return 'open';

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 'open';

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  if (dueDay < today) return 'overdue';
  if (dueDay - today <= 7 * 24 * 60 * 60 * 1000) return 'due_soon';
  return 'open';
};

interface MutableLoanAccount extends Omit<LoanAccount, 'status' | 'remainingAmount'> {
  remainingAmount: number;
  status?: LoanAccountStatus;
}

const makeAccount = (
  item: BrainDumpItem,
  direction: LoanAccountDirection,
  id: string,
  legacyMatched: boolean,
): MutableLoanAccount => {
  const date = transactionDate(item);
  const amount = amountOf(item);
  return {
    id,
    direction,
    counterparty: item.meta.loanCounterparty?.trim() || 'Pihak belum ditentukan',
    originalAmount: amount,
    repaidAmount: 0,
    remainingAmount: amount,
    dueDate: item.meta.loanDueDate,
    openedAt: date,
    lastActivityAt: date,
    preferredWalletId: item.meta.paymentMethod,
    transactions: [item],
    legacyMatched,
  };
};

const canReceiveLegacyRepayment = (
  account: MutableLoanAccount,
  direction: LoanAccountDirection,
  counterpartyKey: string,
): boolean => account.direction === direction
  && normalizeCounterparty(account.counterparty) === counterpartyKey
  && account.remainingAmount > 0;

export const getLoanAccounts = (items: BrainDumpItem[], now = new Date()): LoanAccount[] => {
  const loanTransactions = items
    .filter((item) => item.type === ItemType.FINANCE && isLoanFinanceType(item.meta.financeType) && amountOf(item) > 0)
    .sort((a, b) => dateValue(transactionDate(a)) - dateValue(transactionDate(b)));

  const accounts = new Map<string, MutableLoanAccount>();
  const accountOrder: string[] = [];

  for (const item of loanTransactions) {
    const kind = item.meta.financeType as LoanTransactionKind;
    const direction = directionForKind(kind);
    const explicitId = item.meta.loanAccountId?.trim();
    const counterpartyKey = normalizeCounterparty(item.meta.loanCounterparty);
    const amount = amountOf(item);
    const date = transactionDate(item);

    if (isOpeningKind(kind)) {
      const accountId = explicitId || `legacy:${direction}:${item.id}`;
      const existing = accounts.get(accountId);
      if (existing) {
        existing.originalAmount += amount;
        existing.remainingAmount += amount;
        existing.transactions.push(item);
        existing.lastActivityAt = date;
        existing.counterparty = item.meta.loanCounterparty?.trim() || existing.counterparty;
        existing.dueDate = item.meta.loanDueDate || existing.dueDate;
        existing.preferredWalletId = item.meta.paymentMethod || existing.preferredWalletId;
      } else {
        accounts.set(accountId, makeAccount(item, direction, accountId, !explicitId));
        accountOrder.push(accountId);
      }
      continue;
    }

    if (!isRepaymentKind(kind)) continue;

    const applyRepayment = (account: MutableLoanAccount, allocatedAmount: number, allocationIndex?: number) => {
      const allocatedItem = allocatedAmount === amount && allocationIndex === undefined
        ? item
        : {
            ...item,
            id: `${item.id}:allocation:${allocationIndex ?? 0}:${account.id}`,
            meta: {
              ...item.meta,
              amount: allocatedAmount,
              loanAccountId: account.id,
            },
          };
      account.repaidAmount += allocatedAmount;
      account.remainingAmount = Math.max(0, account.originalAmount - account.repaidAmount);
      account.transactions.push(allocatedItem);
      account.lastActivityAt = date;
      account.preferredWalletId = item.meta.paymentMethod || account.preferredWalletId;
    };

    if (explicitId) {
      const account = accounts.get(explicitId);
      if (account) {
        applyRepayment(account, amount);
        continue;
      }
    }

    if (!explicitId && counterpartyKey) {
      const candidates = accountOrder
        .map((id) => accounts.get(id))
        .filter((candidate): candidate is MutableLoanAccount => !!candidate)
        .filter((candidate) => canReceiveLegacyRepayment(candidate, direction, counterpartyKey))
        .sort((a, b) => dateValue(a.openedAt) - dateValue(b.openedAt));

      let unallocatedAmount = amount;
      candidates.forEach((candidate, index) => {
        if (unallocatedAmount <= 0) return;
        const allocatedAmount = Math.min(unallocatedAmount, candidate.remainingAmount);
        if (allocatedAmount <= 0) return;
        applyRepayment(candidate, allocatedAmount, candidates.length > 1 || allocatedAmount !== amount ? index : undefined);
        unallocatedAmount -= allocatedAmount;
      });

      if (unallocatedAmount <= 0) continue;

      const orphanId = `orphan:${direction}:${item.id}`;
      const orphanItem = unallocatedAmount === amount
        ? item
        : {
            ...item,
            id: `${item.id}:allocation:orphan`,
            meta: { ...item.meta, amount: unallocatedAmount },
          };
      accounts.set(orphanId, {
        id: orphanId,
        direction,
        counterparty: item.meta.loanCounterparty?.trim() || 'Pihak belum ditentukan',
        originalAmount: 0,
        repaidAmount: unallocatedAmount,
        remainingAmount: 0,
        dueDate: item.meta.loanDueDate,
        openedAt: date,
        lastActivityAt: date,
        preferredWalletId: item.meta.paymentMethod,
        transactions: [orphanItem],
        legacyMatched: true,
      });
      accountOrder.push(orphanId);
      continue;
    }

    const orphanId = explicitId || `orphan:${direction}:${item.id}`;
    accounts.set(orphanId, {
      id: orphanId,
      direction,
      counterparty: item.meta.loanCounterparty?.trim() || 'Pihak belum ditentukan',
      originalAmount: 0,
      repaidAmount: amount,
      remainingAmount: 0,
      dueDate: item.meta.loanDueDate,
      openedAt: date,
      lastActivityAt: date,
      preferredWalletId: item.meta.paymentMethod,
      transactions: [item],
      legacyMatched: !explicitId,
    });
    accountOrder.push(orphanId);
  }

  return accountOrder
    .map((id) => accounts.get(id))
    .filter((account): account is MutableLoanAccount => !!account)
    .map((account) => ({
      ...account,
      remainingAmount: Math.max(0, account.originalAmount - account.repaidAmount),
      status: getStatus(Math.max(0, account.originalAmount - account.repaidAmount), account.dueDate, now),
      transactions: [...account.transactions].sort((a, b) => dateValue(transactionDate(b)) - dateValue(transactionDate(a))),
    }))
    .sort((a, b) => {
      const statusRank: Record<LoanAccountStatus, number> = { overdue: 0, due_soon: 1, open: 2, paid: 3 };
      const statusDiff = statusRank[a.status] - statusRank[b.status];
      if (statusDiff !== 0) return statusDiff;
      const dueDiff = dateValue(a.dueDate) - dateValue(b.dueDate);
      if (dueDiff !== 0) return dueDiff;
      return dateValue(b.lastActivityAt) - dateValue(a.lastActivityAt);
    });
};

export const getLoanSummary = (accounts: LoanAccount[]) => {
  const openAccounts = accounts.filter((account) => account.remainingAmount > 0);
  return {
    receivable: openAccounts
      .filter((account) => account.direction === 'receivable')
      .reduce((sum, account) => sum + account.remainingAmount, 0),
    payable: openAccounts
      .filter((account) => account.direction === 'payable')
      .reduce((sum, account) => sum + account.remainingAmount, 0),
    overdueCount: openAccounts.filter((account) => account.status === 'overdue').length,
    dueSoonCount: openAccounts.filter((account) => account.status === 'due_soon').length,
    openCount: openAccounts.length,
    paidCount: accounts.filter((account) => account.status === 'paid' && account.originalAmount > 0).length,
  };
};
