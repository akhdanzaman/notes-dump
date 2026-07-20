import { FinanceType, LoanTransactionKind } from '../types';

export const ACHIEVED_GOAL_FINANCE_TYPE: FinanceType = 'achieved_goal';
export const SAVING_WITHDRAWAL_FINANCE_TYPE: FinanceType = 'saving_withdrawal';

export const LOAN_FINANCE_TYPES: LoanTransactionKind[] = [
  'loan_out',
  'loan_in',
  'loan_repayment_in',
  'loan_repayment_out',
];

export const isLoanFinanceType = (value?: string | null): value is LoanTransactionKind =>
  !!value && LOAN_FINANCE_TYPES.includes(value as LoanTransactionKind);

export const isIncomingLoanFinanceType = (value?: string | null): value is 'loan_in' | 'loan_repayment_in' =>
  value === 'loan_in' || value === 'loan_repayment_in';

export const isOutgoingLoanFinanceType = (value?: string | null): value is 'loan_out' | 'loan_repayment_out' =>
  value === 'loan_out' || value === 'loan_repayment_out';

export const parseFinanceType = (value?: string | null): FinanceType | undefined => {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;

  if (
    normalized === 'expense' ||
    normalized === 'income' ||
    normalized === 'transfer' ||
    normalized === 'saving' ||
    normalized === SAVING_WITHDRAWAL_FINANCE_TYPE ||
    isLoanFinanceType(normalized)
  ) {
    return normalized as FinanceType;
  }

  if (normalized === 'achieved goals' || normalized === 'achieved goal' || normalized === 'achieved_goal') {
    return ACHIEVED_GOAL_FINANCE_TYPE;
  }

  return undefined;
};

export const formatFinanceTypeLabel = (value?: string | null): string => {
  const financeType = parseFinanceType(value);
  if (!financeType) return value || 'expense';

  switch (financeType) {
    case 'income':
      return 'Income';
    case 'transfer':
      return 'Transfer';
    case 'saving':
      return 'Saving';
    case 'saving_withdrawal':
      return 'Saving Withdrawal';
    case 'loan_out':
      return 'Money Lent';
    case 'loan_in':
      return 'Money Borrowed';
    case 'loan_repayment_in':
      return 'Loan Repayment Received';
    case 'loan_repayment_out':
      return 'Loan Repayment Paid';
    case 'achieved_goal':
      return 'Achieved Goals';
    case 'expense':
    default:
      return 'Expense';
  }
};

export const isLegacyCompletedGoalContent = (content?: string | null): boolean =>
  typeof content === 'string' && content.trim().toLowerCase().startsWith('completed goal:');

export const getAchievedGoalName = (content?: string | null): string => {
  if (!content) return '';
  return content.replace(/^Completed Goal:\s*/i, '').trim();
};
