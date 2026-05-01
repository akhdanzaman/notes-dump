import { FinanceType } from '../types';

export const ACHIEVED_GOAL_FINANCE_TYPE: FinanceType = 'achieved_goal';

export const parseFinanceType = (value?: string | null): FinanceType | undefined => {
  if (!value) return undefined;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;

  if (normalized === 'expense' || normalized === 'income' || normalized === 'transfer' || normalized === 'saving') {
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
