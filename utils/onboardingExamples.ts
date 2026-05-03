import { v4 as uuidv4 } from 'uuid';
import { BrainDumpItem, ItemType, Wallet } from '../types';

const isoFrom = (date: Date) => date.toISOString();

export const ONBOARDING_DEFAULT_INPUT = 'Expense: Lunch at McDonald 50k from Main Bank';

export const createOnboardingSampleItems = (wallet: Wallet | null, now = new Date()): BrainDumpItem[] => {
  const today = isoFrom(now);
  const tomorrow = isoFrom(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const oneHourAgo = isoFrom(new Date(now.getTime() - 60 * 60 * 1000));

  return [
    {
      id: uuidv4(),
      type: ItemType.FINANCE,
      content: 'Groceries at supermarket',
      status: 'done',
      created_at: today,
      completed_at: today,
      meta: {
        date: today,
        tags: ['sample'],
        amount: 150000,
        financeType: 'expense',
        paymentMethod: wallet?.id || wallet?.name,
        budgetCategory: 'needs',
        commodity: 'food',
        subcommodity: 'groceries',
        merchant: 'supermarket',
      },
    },
    {
      id: uuidv4(),
      type: ItemType.NOTE,
      content: 'Project idea: build a weekly habit dashboard',
      status: 'pending',
      created_at: oneHourAgo,
      meta: {
        tags: ['sample', 'idea'],
      },
    },
    {
      id: uuidv4(),
      type: ItemType.TODO,
      content: 'Review monthly budget',
      status: 'pending',
      created_at: oneHourAgo,
      meta: {
        date: tomorrow,
        when: 'tomorrow',
        priority: 'normal',
        tags: ['sample'],
        progress: 0,
      },
    },
  ];
};
