import { ShoppingLineItem } from '../types';

const cleanOptionalText = (value?: unknown) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed ? trimmed : undefined;
};

const toFiniteAmount = (value?: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const normalized = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(normalized) ? normalized : undefined;
  }
  return undefined;
};

export const createShoppingLineItemId = () => `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const sanitizeShoppingLineItems = (lineItems?: unknown): ShoppingLineItem[] => {
  if (!Array.isArray(lineItems)) return [];

  return lineItems
    .filter(line => line && typeof line === 'object')
    .map(line => {
      const raw = line as Partial<ShoppingLineItem>;
      return {
        id: cleanOptionalText(raw.id) || createShoppingLineItemId(),
        name: cleanOptionalText(raw.name) || '',
        quantity: cleanOptionalText(raw.quantity),
        amount: toFiniteAmount(raw.amount),
      };
    })
    .filter(line => line.name || line.quantity || line.amount !== undefined);
};

export const sumShoppingLineItems = (lineItems?: unknown) => sanitizeShoppingLineItems(lineItems)
  .reduce((total, line) => total + (line.amount || 0), 0);

export const hasShoppingLineItems = (lineItems?: unknown) => sanitizeShoppingLineItems(lineItems).length > 0;

export const encodeShoppingLineItemsForSheet = (lineItems?: unknown) => {
  const cleaned = sanitizeShoppingLineItems(lineItems);
  return cleaned.length > 0 ? JSON.stringify(cleaned) : '';
};

export const parseShoppingLineItemsFromSheet = (value: unknown): ShoppingLineItem[] | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;

  try {
    const parsed = JSON.parse(value);
    const cleaned = sanitizeShoppingLineItems(parsed);
    return cleaned.length > 0 ? cleaned : undefined;
  } catch {
    return undefined;
  }
};
