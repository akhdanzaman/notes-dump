import {
  BrainDumpItem,
  BudgetRule,
  FinanceType,
  ItemType,
  ParserQuarantineReason,
  ParserQuarantinedField,
  ParserResultV2,
  Wallet,
} from '../types';
import {
  inspectStructuredFinanceField,
  referenceMatch,
  StructuredFinanceField,
} from '../utils/structuredFieldValidation';

export type ParserValidationContext = {
  availableWallets: Array<Pick<Wallet, 'id' | 'name'>>;
  availableBudgetRules: Array<Pick<BudgetRule, 'id' | 'name'>>;
};

export interface PersistenceSanitizationResult {
  items: BrainDumpItem[];
  quarantinedItemCount: number;
  rejectedFieldCount: number;
}

type SanitizeMode = 'parser-create' | 'parser-update' | 'persistence';

const FINANCE_TYPES: FinanceType[] = ['expense', 'income', 'transfer', 'saving', 'saving_withdrawal', 'loan_out', 'loan_in', 'loan_repayment_in', 'loan_repayment_out', 'achieved_goal'];
const REQUIRED_NORMAL_FINANCE_TYPES = new Set<FinanceType>(['expense', 'income', 'transfer']);
const WALLET_TRANSFER_FINANCE_TYPES = new Set<FinanceType>(['transfer', 'saving', 'saving_withdrawal']);
const RAW_QUARANTINE_LIMIT = 240;

const normalizeWhitespace = (input: string) => input.normalize('NFKC').replace(/\s+/g, ' ').trim();

const appendReviewReason = (result: ParserResultV2, reason: string) => {
  const reasons = result.reviewReason
    ? result.reviewReason.split(/\s*;\s*/).map(value => value.trim()).filter(Boolean)
    : [];
  if (!reasons.includes(reason)) reasons.push(reason);
  result.reviewReason = reasons.join('; ');
  result.needsReview = true;
  if (result.confidence === 'high') result.confidence = 'medium';
};

const quarantineValue = (value: unknown): Pick<ParserQuarantinedField, 'rawValue' | 'truncated'> => {
  if (value === null) return { rawValue: null };
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { rawValue: value };
  }

  let raw: string;
  if (typeof value === 'string') raw = value;
  else {
    try {
      raw = JSON.stringify(value);
    } catch {
      raw = String(value);
    }
  }

  if (raw.length <= RAW_QUARANTINE_LIMIT) return { rawValue: raw };
  return { rawValue: `${raw.slice(0, RAW_QUARANTINE_LIMIT)}…`, truncated: true };
};

const rawPreview = (value: unknown): string => {
  const quarantined = quarantineValue(value);
  const rendered = typeof quarantined.rawValue === 'string'
    ? quarantined.rawValue
    : String(quarantined.rawValue);
  const preview = rendered.length > 80 ? `${rendered.slice(0, 80)}…` : rendered;
  return JSON.stringify(preview);
};

const rejectField = (
  result: ParserResultV2,
  field: string,
  rawValue: unknown,
  reason: ParserQuarantineReason,
  reviewMessage: string,
) => {
  const quarantined = { field, reason, ...quarantineValue(rawValue) } satisfies ParserQuarantinedField;
  const existing = result.quarantinedFields || [];
  if (!existing.some(entry => entry.field === quarantined.field && entry.reason === quarantined.reason && entry.rawValue === quarantined.rawValue)) {
    result.quarantinedFields = [...existing, quarantined];
  }
  appendReviewReason(result, `${reviewMessage} Rejected ${field}=${rawPreview(rawValue)}.`);
};

const validDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const normalizeDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = normalizeWhitespace(value);
  if (validDateOnly(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return undefined;
};

const normalizeFinanceType = (value: unknown): FinanceType | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = normalizeWhitespace(value).toLocaleLowerCase('en-US') as FinanceType;
  return FINANCE_TYPES.includes(normalized) ? normalized : undefined;
};

const sanitizeStructuredValue = (
  result: ParserResultV2,
  field: StructuredFinanceField,
  path: string,
  value: unknown,
): string | undefined => {
  const inspected = inspectStructuredFinanceField(field, value);
  if (!inspected.rejectionReason) return inspected.cleaned;
  const reviewMessage = field === 'paymentMethod'
    ? 'Unmatched payment wallet contained invalid, overlong, or model-generated prose and was quarantined.'
    : field === 'toWallet'
      ? 'Unmatched destination wallet contained invalid, overlong, or model-generated prose and was quarantined.'
      : `${field} contained invalid, overlong, or model-generated prose and was quarantined.`;
  rejectField(
    result,
    path,
    value,
    inspected.rejectionReason,
    reviewMessage,
  );
  return undefined;
};

const sanitizeWalletReference = (
  result: ParserResultV2,
  field: 'paymentMethod' | 'toWallet',
  path: string,
  value: unknown,
  wallets: ParserValidationContext['availableWallets'],
): string | undefined => {
  const cleaned = sanitizeStructuredValue(result, field, path, value);
  if (!cleaned) return undefined;
  const wallet = referenceMatch(cleaned, wallets);
  if (wallet) return wallet.id;
  rejectField(result, path, value, 'invalid_reference', `Unmatched ${field === 'paymentMethod' ? 'payment wallet' : 'destination wallet'} was quarantined.`);
  return undefined;
};

const sanitizeBudgetReference = (
  result: ParserResultV2,
  path: string,
  value: unknown,
  rules: ParserValidationContext['availableBudgetRules'],
): string | undefined => {
  const cleaned = sanitizeStructuredValue(result, 'budgetCategory', path, value);
  if (!cleaned) return undefined;
  if (rules.length === 0) return cleaned;
  const rule = referenceMatch(cleaned, rules);
  if (rule) return rule.id;
  rejectField(result, path, value, 'invalid_reference', 'Unmatched budget category was quarantined.');
  return undefined;
};

const sanitizePositiveAmount = (
  result: ParserResultV2,
  path: string,
  value: unknown,
): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) {
    rejectField(result, path, value, 'invalid_type', 'Invalid amount was quarantined.');
    return undefined;
  }
  if (amount <= 0) {
    rejectField(result, path, value, 'non_positive_amount', 'Amount must be greater than zero and was quarantined.');
    return undefined;
  }
  return amount;
};

const sanitizeEntityWalletRefs = (result: ParserResultV2, ctx: ParserValidationContext) => {
  if (!result.entityRefs) return;
  const refs = { ...result.entityRefs };
  const rawSource = refs.walletId || refs.walletName;
  const rawDestination = refs.toWalletId || refs.toWalletName;

  if (rawSource) {
    const sourceId = sanitizeWalletReference(result, 'paymentMethod', 'entityRefs.wallet', rawSource, ctx.availableWallets);
    if (sourceId) {
      refs.walletId = sourceId;
      refs.walletName = ctx.availableWallets.find(wallet => wallet.id === sourceId)?.name;
    } else {
      delete refs.walletId;
      delete refs.walletName;
    }
  }

  if (rawDestination) {
    const destinationId = sanitizeWalletReference(result, 'toWallet', 'entityRefs.toWallet', rawDestination, ctx.availableWallets);
    if (destinationId) {
      refs.toWalletId = destinationId;
      refs.toWalletName = ctx.availableWallets.find(wallet => wallet.id === destinationId)?.name;
    } else {
      delete refs.toWalletId;
      delete refs.toWalletName;
    }
  }

  result.entityRefs = refs;
};

const sanitizeMeta = (
  result: ParserResultV2,
  meta: any,
  ctx: ParserValidationContext,
  itemType: string | undefined,
  mode: SanitizeMode,
) => {
  if (!meta || typeof meta !== 'object') return meta;
  const next = { ...meta };
  const financeItem = itemType === 'FINANCE';

  if (next.financeType !== undefined) {
    const financeType = normalizeFinanceType(next.financeType);
    if (financeType) next.financeType = financeType;
    else {
      rejectField(result, 'meta.financeType', next.financeType, 'invalid_type', 'Invalid financeType was quarantined.');
      delete next.financeType;
    }
  }

  if (mode !== 'persistence' && next.date !== undefined) {
    const date = normalizeDate(next.date);
    if (date) next.date = date;
    else {
      rejectField(result, 'meta.date', next.date, 'invalid_type', 'Invalid date was quarantined.');
      delete next.date;
    }
  }

  if (next.paymentMethod !== undefined) {
    const walletId = sanitizeWalletReference(result, 'paymentMethod', 'meta.paymentMethod', next.paymentMethod, ctx.availableWallets);
    if (walletId) next.paymentMethod = walletId;
    else delete next.paymentMethod;
  }

  if (next.budgetCategory !== undefined) {
    const budgetId = sanitizeBudgetReference(result, 'meta.budgetCategory', next.budgetCategory, ctx.availableBudgetRules);
    if (budgetId) next.budgetCategory = budgetId;
    else delete next.budgetCategory;
  }

  if (next.toWallet !== undefined) {
    const allowed = WALLET_TRANSFER_FINANCE_TYPES.has(next.financeType as FinanceType);
    if (!allowed) {
      rejectField(result, 'meta.toWallet', next.toWallet, 'not_allowed_for_transaction_type', 'Destination wallet is only valid for wallet-transfer flows and was quarantined.');
      delete next.toWallet;
    } else {
      const toWalletId = sanitizeWalletReference(result, 'toWallet', 'meta.toWallet', next.toWallet, ctx.availableWallets);
      if (toWalletId) next.toWallet = toWalletId;
      else delete next.toWallet;
    }
  }

  for (const field of ['commodity', 'subcommodity', 'merchant'] as const) {
    if (next[field] !== undefined) {
      const cleaned = sanitizeStructuredValue(result, field, `meta.${field}`, next[field]);
      if (cleaned) next[field] = cleaned;
      else delete next[field];
    }

    if (field !== 'merchant') {
      const canonical = next.canonical?.[field];
      if (canonical && typeof canonical === 'object') {
        const confidence = typeof canonical.confidence === 'number' ? canonical.confidence : undefined;
        if (canonical.needsReview === true || (confidence !== undefined && confidence < 0.75)) {
          if (next[field] !== undefined) {
            rejectField(result, `meta.${field}`, next[field], 'invalid_reference', `Low-confidence ${field} classification was quarantined.`);
          } else {
            appendReviewReason(result, `Low-confidence ${field} classification needs review.`);
          }
          delete next[field];
        }
      }
    }
  }

  const financeType = next.financeType as FinanceType | undefined;
  if (financeItem && next.amount !== undefined) {
    const amount = sanitizePositiveAmount(result, 'meta.amount', next.amount);
    if (amount !== undefined) next.amount = amount;
    else delete next.amount;
  }

  const enforceRequired = financeItem
    && mode !== 'parser-update'
    && REQUIRED_NORMAL_FINANCE_TYPES.has(financeType || 'expense');
  if (enforceRequired && next.amount === undefined) {
    appendReviewReason(result, 'Normal expense, income, and transfer transactions require Amount > 0.');
  }
  if (enforceRequired && !next.paymentMethod) {
    appendReviewReason(result, 'Transaction requires a registered source wallet.');
  }
  if (enforceRequired && financeType === 'transfer' && !next.toWallet) {
    appendReviewReason(result, 'Transfer requires a registered destination wallet.');
  }
  if (financeType === 'transfer' && next.paymentMethod && next.toWallet && next.paymentMethod === next.toWallet) {
    rejectField(result, 'meta.toWallet', next.toWallet, 'invalid_reference', 'Transfer source and destination wallets must differ; destination was quarantined.');
    delete next.toWallet;
  }

  if (mode !== 'persistence') delete next.canonical;
  return next;
};

const sanitizeActionPayload = (result: ParserResultV2, ctx: ParserValidationContext) => {
  const payload = result.payload as any;
  if (!payload || typeof payload !== 'object') return;

  if (['transfer_money', 'add_saving_funds', 'withdraw_saving_funds', 'record_loan_transaction'].includes(result.action)) {
    const amount = sanitizePositiveAmount(result, 'payload.amount', payload.amount);
    if (amount !== undefined) payload.amount = amount;
    else delete payload.amount;
  }

  if (result.action === 'transfer_money') {
    const fromWallet = sanitizeWalletReference(result, 'paymentMethod', 'payload.fromWallet', payload.fromWallet, ctx.availableWallets);
    const toWallet = sanitizeWalletReference(result, 'toWallet', 'payload.toWallet', payload.toWallet, ctx.availableWallets);
    if (fromWallet) payload.fromWallet = fromWallet;
    else delete payload.fromWallet;
    if (toWallet) payload.toWallet = toWallet;
    else delete payload.toWallet;
    if (!payload.amount) appendReviewReason(result, 'Transfer requires Amount > 0.');
    if (!payload.fromWallet) appendReviewReason(result, 'Transfer requires a registered source wallet.');
    if (!payload.toWallet) appendReviewReason(result, 'Transfer requires a registered destination wallet.');
    if (payload.fromWallet && payload.toWallet && payload.fromWallet === payload.toWallet) {
      rejectField(result, 'payload.toWallet', payload.toWallet, 'invalid_reference', 'Transfer source and destination wallets must differ; destination was quarantined.');
      delete payload.toWallet;
    }
  }

  if (result.action === 'add_saving_funds' || result.action === 'withdraw_saving_funds') {
    const fromWallet = sanitizeWalletReference(result, 'paymentMethod', 'payload.fromWallet', payload.fromWallet, ctx.availableWallets);
    if (fromWallet) payload.fromWallet = fromWallet;
    else delete payload.fromWallet;
    if (!payload.amount) appendReviewReason(result, 'Saving wallet movement requires Amount > 0.');
    if (!payload.fromWallet) appendReviewReason(result, 'Saving wallet movement requires a registered source wallet.');

    if (payload.toWallet !== undefined) {
      const toWallet = sanitizeWalletReference(result, 'toWallet', 'payload.toWallet', payload.toWallet, ctx.availableWallets);
      if (toWallet) payload.toWallet = toWallet;
      else delete payload.toWallet;
    }
    if (result.action === 'withdraw_saving_funds' && !payload.toWallet) {
      appendReviewReason(result, 'Saving withdrawal requires a registered destination wallet.');
    }
    if (payload.fromWallet && payload.toWallet && payload.fromWallet === payload.toWallet) {
      rejectField(result, 'payload.toWallet', payload.toWallet, 'invalid_reference', 'Saving source and destination wallets must differ; destination was quarantined.');
      delete payload.toWallet;
    }
  }

  if (result.action === 'add_saving_funds' && payload.budgetCategory !== undefined) {
    const budgetId = sanitizeBudgetReference(result, 'payload.budgetCategory', payload.budgetCategory, ctx.availableBudgetRules);
    if (budgetId) payload.budgetCategory = budgetId;
    else delete payload.budgetCategory;
  }

  if (result.action === 'record_loan_transaction') {
    const wallet = sanitizeWalletReference(result, 'paymentMethod', 'payload.wallet', payload.wallet, ctx.availableWallets);
    if (wallet) payload.wallet = wallet;
    else delete payload.wallet;
    if (!payload.amount) appendReviewReason(result, 'Loan transaction requires Amount > 0.');
    if (!payload.wallet) appendReviewReason(result, 'Loan transaction requires a registered wallet.');
    if (payload.counterparty !== undefined) {
      const counterparty = sanitizeStructuredValue(result, 'merchant', 'payload.counterparty', payload.counterparty);
      if (counterparty) payload.counterparty = counterparty;
      else delete payload.counterparty;
    }
  }

  if (['transfer_money', 'add_saving_funds', 'withdraw_saving_funds', 'record_loan_transaction'].includes(result.action) && payload.date !== undefined) {
    const date = normalizeDate(payload.date);
    if (date) payload.date = date;
    else {
      rejectField(result, 'payload.date', payload.date, 'invalid_type', 'Invalid date was quarantined.');
      delete payload.date;
    }
  }
};

export function sanitizeParserResultsBeforeResolve(
  results: ParserResultV2[],
  ctx: ParserValidationContext,
): ParserResultV2[] {
  return results.map(result => {
    const next: ParserResultV2 = {
      ...result,
      entityRefs: result.entityRefs ? { ...result.entityRefs } : result.entityRefs,
      payload: result.payload && typeof result.payload === 'object' ? { ...(result.payload as any) } : result.payload,
      quarantinedFields: result.quarantinedFields ? [...result.quarantinedFields] : undefined,
    };
    const payload = next.payload as any;

    sanitizeEntityWalletRefs(next, ctx);

    if (next.action === 'create_item' && payload?.meta) {
      payload.meta = sanitizeMeta(next, payload.meta, ctx, payload.itemType, 'parser-create');
    }

    if (next.action === 'update_item' && payload?.changes) {
      payload.changes = sanitizeMeta(next, payload.changes, ctx, next.entityType === 'finance' ? 'FINANCE' : undefined, 'parser-update');
    }

    sanitizeActionPayload(next, ctx);
    return next;
  });
}

const entityTypeForItem = (item: BrainDumpItem): ParserResultV2['entityType'] => {
  if (item.type === ItemType.FINANCE) return 'finance';
  if (item.type === ItemType.SHOPPING) return 'shopping';
  if (item.type === ItemType.TODO) return 'todo';
  if (item.type === ItemType.EVENT) return 'event';
  if (item.type === ItemType.JOURNAL) return 'journal';
  if (item.type === ItemType.SKILL_LOG) return 'skill_log';
  return 'note';
};

const appendExistingReason = (existing: string | undefined, added: string | undefined): string | undefined => {
  const reasons = [existing, added]
    .flatMap(value => value ? value.split(/\s*;\s*/) : [])
    .map(value => value.trim())
    .filter(Boolean);
  return reasons.length ? Array.from(new Set(reasons)).join('; ') : undefined;
};

export const sanitizeBrainDumpItemsForPersistence = (
  items: BrainDumpItem[],
  ctx: ParserValidationContext,
): PersistenceSanitizationResult => {
  let quarantinedItemCount = 0;
  let rejectedFieldCount = 0;

  const sanitizedItems = items.map(item => {
    const result: ParserResultV2 = {
      action: 'create_item',
      entityType: entityTypeForItem(item),
      content: item.content,
      confidence: item.meta.parserConfidence || 'high',
      needsReview: Boolean(item.meta.parserNeedsReview),
      reviewReason: item.meta.parserReviewReason,
      quarantinedFields: item.meta.dataQualityQuarantine ? [...item.meta.dataQualityQuarantine] : undefined,
    };
    const beforeCount = result.quarantinedFields?.length || 0;
    const cleanMeta = sanitizeMeta(result, item.meta, ctx, item.type, 'persistence');
    const afterCount = result.quarantinedFields?.length || 0;
    const newRejectedCount = Math.max(0, afterCount - beforeCount);

    if (newRejectedCount > 0 || (!item.meta.parserNeedsReview && result.needsReview)) quarantinedItemCount += 1;
    rejectedFieldCount += newRejectedCount;

    return {
      ...item,
      meta: {
        ...cleanMeta,
        parserNeedsReview: result.needsReview || undefined,
        parserReviewReason: appendExistingReason(item.meta.parserReviewReason, result.reviewReason),
        dataQualityQuarantine: result.quarantinedFields?.length ? result.quarantinedFields : undefined,
      },
    };
  });

  return { items: sanitizedItems, quarantinedItemCount, rejectedFieldCount };
};

export const sanitizeLegacyParsedItems = (
  items: Partial<BrainDumpItem>[],
  ctx: ParserValidationContext,
): Partial<BrainDumpItem>[] => items.map(item => {
  const result: ParserResultV2 = {
    action: 'create_item',
    entityType: item.type === ItemType.FINANCE ? 'finance' : item.type === ItemType.SHOPPING ? 'shopping' : 'note',
    content: item.content,
    confidence: 'medium',
    needsReview: Boolean(item.meta?.parsingError),
    reviewReason: item.meta?.parsingError,
  };
  const cleanMeta = sanitizeMeta(result, item.meta || {}, ctx, item.type, 'parser-create');

  return {
    ...item,
    meta: {
      ...cleanMeta,
      parsingError: appendExistingReason(item.meta?.parsingError, result.reviewReason),
      dataQualityQuarantine: result.quarantinedFields?.length ? result.quarantinedFields : undefined,
    },
  };
});
