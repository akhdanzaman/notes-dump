import { BrainDumpItem } from '../types';

const isValidDateString = (value?: string): value is string => {
  if (!value || value === 'null' || value === 'undefined') return false;
  return Number.isFinite(new Date(value).getTime());
};

export const getShoppingDueDate = (item: BrainDumpItem): string | undefined => {
  const raw = item.meta.date || item.meta.dateTime;
  return isValidDateString(raw) ? raw : undefined;
};

export const getShoppingCreatedDate = (item: BrainDumpItem): string => item.created_at;

export const getShoppingCompletedDate = (item: BrainDumpItem): string | undefined => (
  isValidDateString(item.completed_at) ? item.completed_at : undefined
);

export const getShoppingTransactionDate = (item: BrainDumpItem): string => (
  getShoppingCompletedDate(item) || getShoppingCreatedDate(item)
);

export const getShoppingTimelineDate = (item: BrainDumpItem): string | undefined => {
  if (item.status === 'done') return getShoppingTransactionDate(item);
  return getShoppingDueDate(item);
};

export const getShoppingDueSortTime = (item: BrainDumpItem): number => {
  const due = getShoppingDueDate(item);
  if (!due) return Infinity;
  const dueTime = new Date(due).getTime();
  return Number.isFinite(dueTime) ? dueTime : Infinity;
};

export const getShoppingCreatedSortTime = (item: BrainDumpItem): number => {
  const createdTime = new Date(item.created_at).getTime();
  return Number.isFinite(createdTime) ? createdTime : 0;
};

export const shouldShoppingDateEditCompletion = (item: BrainDumpItem): boolean => (
  item.status === 'done'
  && item.meta.shoppingCategory !== 'saving' && item.meta.shoppingCategory !== 'investment'
  && item.meta.shoppingCategory !== 'routine'
  && !item.meta.isRoutine
);
