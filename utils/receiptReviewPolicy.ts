import { AppSettings } from '../types';

export const shouldQueueReceiptReview = (settings: Pick<AppSettings, 'enableDraftReview'>): boolean =>
  settings.enableDraftReview ?? false;

export const getReceiptTransactionViewDate = (value: string): Date | undefined => {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};
