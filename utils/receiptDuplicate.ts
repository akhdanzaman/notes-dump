import { BrainDumpItem, ItemType, TransactionLineItem } from '../types';
import { sanitizeTransactionLineItems, sumTransactionLineItems } from './transactionLineItems';

const normalize = (value?: string) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const dateKey = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
};

const lineSignature = (lines: TransactionLineItem[]) => sanitizeTransactionLineItems(lines)
  .map((line) => `${normalize(line.name)}:${Math.round(line.amount * 100)}`)
  .sort()
  .join('|');

export interface ReceiptDuplicateInput {
  merchant?: string;
  date?: string;
  totalAmount: number;
  lineItems: TransactionLineItem[];
  fingerprint?: string;
}

export const findDuplicateReceiptTransaction = (
  items: BrainDumpItem[],
  input: ReceiptDuplicateInput,
): BrainDumpItem | undefined => {
  const merchant = normalize(input.merchant);
  const date = dateKey(input.date);
  const amount = Math.round(input.totalAmount * 100);
  const signature = lineSignature(input.lineItems);

  return items.find((item) => {
    if (item.type !== ItemType.FINANCE || item.meta.financeType !== 'expense') return false;
    if (input.fingerprint && item.meta.receiptCapture?.fingerprint === input.fingerprint) return true;

    const itemLines = sanitizeTransactionLineItems(item.meta.transactionLineItems);
    const sameMerchant = merchant && normalize(item.meta.merchant || item.content) === merchant;
    const sameDate = date && dateKey(item.meta.date || item.completed_at) === date;
    const sameAmount = Math.round((itemLines.length ? sumTransactionLineItems(itemLines) : (item.meta.amount || 0)) * 100) === amount;
    if (!sameMerchant || !sameDate || !sameAmount) return false;
    if (!signature || !itemLines.length) return true;
    return lineSignature(itemLines) === signature;
  });
};
