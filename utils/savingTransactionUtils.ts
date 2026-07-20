import { BrainDumpItem, ItemType } from '../types';
import { SAVING_WITHDRAWAL_FINANCE_TYPE } from './financeTypeUtils';

export const getSavingTransactionDelta = (item: BrainDumpItem): number => {
  if (item.type !== ItemType.FINANCE || item.status !== 'done') return 0;
  const amount = item.meta.amount || 0;
  if (item.meta.financeType === 'saving') return amount;
  if (item.meta.financeType === SAVING_WITHDRAWAL_FINANCE_TYPE) return -amount;
  return 0;
};

export const getSavedAmountForGoal = (items: BrainDumpItem[], savingGoalId: string): number =>
  Math.max(0, items
    .filter(item => item.meta.savingGoalId === savingGoalId)
    .reduce((sum, item) => sum + getSavingTransactionDelta(item), 0));
