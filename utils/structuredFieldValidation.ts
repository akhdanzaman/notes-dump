export type StructuredFinanceField =
  | 'paymentMethod'
  | 'toWallet'
  | 'budgetCategory'
  | 'commodity'
  | 'subcommodity'
  | 'merchant';

export type StructuredFieldRejectionReason =
  | 'invalid_type'
  | 'too_long'
  | 'model_or_prompt_leakage';

export interface StructuredFieldInspection {
  cleaned?: string;
  rejectionReason?: StructuredFieldRejectionReason;
}

export const STRUCTURED_FINANCE_FIELD_LIMITS: Record<StructuredFinanceField, number> = {
  paymentMethod: 96,
  toWallet: 96,
  budgetCategory: 96,
  commodity: 64,
  subcommodity: 64,
  merchant: 120,
};

const MODEL_OR_PROMPT_LEAKAGE = /(?:```|[{}\[\]]|\b(?:i am ready|ready to output|output(?:ting)?\s+(?:the\s+)?json|json\s+(?:array|object|response)|system prompt|prompt requirements?|strictly output|per\s+(?:the\s+)?prompt|as (?:requested|instructed)|shrewdness amount|confidence(?:\s+(?:is|low|high))?|correct(?:ing|ed)|actually|wait[,.:; ]|not needed|is invalid|not listed|from (?:the )?(?:wallet )?list|because|probably|maybe|i think|use(?:d|ing)?\s+.+\s+instead|amount(?:only|without)|currency\s*symbol)\b|\b(?:financeType|paymentMethod|toWallet|budgetCategory|commodity|subcommodity|amount|tags)\s*[:=])/i;

const WORD_LIMITS: Record<StructuredFinanceField, number> = {
  paymentMethod: 7,
  toWallet: 7,
  budgetCategory: 7,
  commodity: 5,
  subcommodity: 5,
  merchant: 12,
};

export const normalizeStructuredText = (value: string): string => value
  .normalize('NFKC')
  .replace(/\s+/g, ' ')
  .trim();

export const normalizeReferenceKey = (value: unknown): string => (
  typeof value === 'string'
    ? normalizeStructuredText(value).toLocaleLowerCase('en-US')
    : ''
);

export const compactReferenceKey = (value: unknown): string => normalizeReferenceKey(value)
  .replace(/[^a-z0-9]/g, '');

export const inspectStructuredFinanceField = (
  field: StructuredFinanceField,
  value: unknown,
): StructuredFieldInspection => {
  if (typeof value !== 'string') {
    return value === undefined || value === null
      ? {}
      : { rejectionReason: 'invalid_type' };
  }

  const cleaned = normalizeStructuredText(value);
  if (!cleaned) return {};
  if (cleaned.length > STRUCTURED_FINANCE_FIELD_LIMITS[field]) {
    return { rejectionReason: 'too_long' };
  }

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (MODEL_OR_PROMPT_LEAKAGE.test(value) || wordCount > WORD_LIMITS[field]) {
    return { rejectionReason: 'model_or_prompt_leakage' };
  }

  return { cleaned };
};

export const referenceMatch = <T extends { id: string; name: string }>(
  query: unknown,
  items: T[],
): T | undefined => {
  const normalized = normalizeReferenceKey(query);
  if (!normalized) return undefined;
  const compact = compactReferenceKey(query);

  return items.find(item => normalizeReferenceKey(item.id) === normalized)
    || items.find(item => normalizeReferenceKey(item.name) === normalized)
    || items.find(item => compact && compactReferenceKey(item.name) === compact);
};

