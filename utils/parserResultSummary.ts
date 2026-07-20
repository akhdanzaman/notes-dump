import {
  AddSavingFundsPayload,
  CompleteItemPayload,
  CreateItemPayload,
  CreateSkillPayload,
  CreateWalletPayload,
  DeleteItemPayload,
  ParserPayloadV2,
  ParserResultV2,
  ParsingTask,
  ThemePayload,
  TransferMoneyPayload,
  WithdrawSavingFundsPayload,
  RecordLoanTransactionPayload,
  UpdateItemPayload,
  UpdateSkillPayload,
  UpdateWalletPayload,
} from '../types';

export type ParserResultSummary = {
  title: string;
  destination: string;
  details: Array<[string, string]>;
  noop?: boolean;
};

const ITEM_DESTINATION: Record<string, string> = {
  FINANCE: 'Money > Transactions',
  TODO: 'Plan > Tasks',
  SHOPPING: 'Plan > Shopping',
  NOTE: 'Library > Notes',
  JOURNAL: 'Library > Journal',
  EVENT: 'Calendar',
  SKILL_LOG: 'Plan > Skills',
};

const ITEM_LABEL: Record<string, string> = {
  FINANCE: 'transaction',
  TODO: 'task',
  SHOPPING: 'shopping item',
  NOTE: 'note',
  JOURNAL: 'journal entry',
  EVENT: 'event',
  SKILL_LOG: 'skill log',
};

const INTERNAL_DETAIL_KEYS = new Set([
  'canonical',
  'enrichment',
  'parserTaskId',
  'parserAction',
  'parserEntityType',
  'parserConfidence',
  'parserNeedsReview',
  'parserReviewReason',
  'parsingError',
  'entityRefs',
  'ruleId',
  'source',
  'needsReview',
]);

const DETAIL_LABELS: Record<string, string> = {
  itemType: 'item type',
  content: 'content',
  status: 'status',
  amount: 'amount',
  currency: 'currency',
  financeType: 'finance type',
  paymentMethod: 'from wallet',
  fromWallet: 'from wallet',
  toWallet: 'to wallet',
  budgetCategory: 'budget',
  commodity: 'commodity',
  subcommodity: 'subcommodity',
  merchant: 'merchant',
  date: 'date',
  dateTime: 'date/time',
  start: 'start',
  end: 'end',
  tags: 'tags',
  quantity: 'quantity',
  priority: 'priority',
  shoppingCategory: 'shopping category',
  skillName: 'skill',
  skillId: 'skill id',
  name: 'name',
  walletType: 'wallet type',
  initialBalance: 'initial balance',
  isDebtAccount: 'debt account',
  monthKey: 'month',
  targetHours: 'target hours',
  targetMinutes: 'target minutes',
  period: 'period',
  notes: 'notes',
  note: 'note',
  savingGoalName: 'saving goal',
  savingGoalId: 'saving goal id',
  transactionKind: 'loan transaction',
  wallet: 'wallet',
  counterparty: 'counterparty',
  loanCounterparty: 'counterparty',
  dedicatedWalletName: 'dedicated wallet',
  dedicatedWalletId: 'dedicated wallet id',
  savedAmount: 'saved amount',
  itemId: 'matched id',
  itemName: 'matched item',
  walletId: 'wallet id',
  walletName: 'wallet',
  skillNameMatch: 'matched skill',
  themeMonthKey: 'month',
  progress: 'progress',
  progressNotes: 'progress notes',
  durationMinutes: 'duration',
  hideFromCalendar: 'hidden from calendar',
  isRoutine: 'routine',
  routineInterval: 'repeat',
};

export const parserActionDestination = (result: ParserResultV2): string => {
  const payload = result.payload as any;

  if (result.action === 'create_item') return ITEM_DESTINATION[payload?.itemType] || `${result.entityType || 'Item'} list`;
  if (result.action === 'update_item') return `Update ${result.entityType || 'item'}`;
  if (result.action === 'complete_item') return `Complete ${result.entityType || 'item'}`;
  if (result.action === 'delete_item') return `Delete ${result.entityType || 'item'}`;
  if (result.action === 'create_skill' || result.action === 'update_skill') return 'Plan > Skills';
  if (result.action === 'create_wallet' || result.action === 'update_wallet') return 'Money > Wallets';
  if (result.action === 'create_theme' || result.action === 'update_theme') return 'Summary > Monthly Theme';
  if (result.action === 'transfer_money') return 'Money > Wallet transfer';
  if (result.action === 'add_saving_funds' || result.action === 'withdraw_saving_funds') return 'Plan > Savings + Money';
  if (result.action === 'record_loan_transaction') return 'Money > Transactions';
  if (result.action === 'query_only') return 'No data saved';

  return result.entityType ? `${result.entityType}` : 'Needs review';
};

export const formatParserValue = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : undefined;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) {
    const parts = value.map(formatParserValue).filter(Boolean) as string[];
    return parts.length ? parts.join(', ') : undefined;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !INTERNAL_DETAIL_KEYS.has(key))
      .map(([key, nested]) => [DETAIL_LABELS[key] || key, formatParserValue(nested)] as [string, string | undefined])
      .filter(([, nested]) => !!nested) as Array<[string, string]>;
    return entries.length ? entries.map(([key, nested]) => `${key}: ${nested}`).join(' | ') : undefined;
  }
  return String(value);
};

const pushDetail = (details: Array<[string, string]>, key: string, value: unknown, label = DETAIL_LABELS[key] || key) => {
  if (INTERNAL_DETAIL_KEYS.has(key)) return;
  const formatted = formatParserValue(value);
  if (!formatted) return;
  if (details.some(([existingKey, existingValue]) => existingKey === label && existingValue === formatted)) return;
  details.push([label, formatted]);
};

const pushDetails = (details: Array<[string, string]>, source?: Record<string, unknown>, labels: Record<string, string> = {}) => {
  if (!source) return;
  Object.entries(source).forEach(([key, value]) => pushDetail(details, key, value, labels[key]));
};

const SUMMARY_SEPARATOR = ' | ';

const firstText = (...values: unknown[]) => values.map(formatParserValue).find(Boolean);

const amountPart = (amount: unknown) => {
  if (typeof amount === 'number' && Number.isFinite(amount)) return `Rp ${amount.toLocaleString('en-US')}`;
  const formatted = formatParserValue(amount);
  if (!formatted) return undefined;
  const numeric = Number(formatted.replace(/,/g, ''));
  return Number.isFinite(numeric) ? `Rp ${numeric.toLocaleString('en-US')}` : formatted;
};

const titleWithParts = (prefix: string, main?: string, parts: Array<string | undefined> = []) => {
  const suffix = parts.filter(Boolean).join(SUMMARY_SEPARATOR);
  return `${prefix}${main ? `: ${main}` : ''}${suffix ? `${SUMMARY_SEPARATOR}${suffix}` : ''}`;
};

export const getParserResultDetails = (result: ParserResultV2): Array<[string, string]> => {
  const payload = result.payload as ParserPayloadV2 | undefined;
  const details: Array<[string, string]> = [];

  if (result.content) pushDetail(details, 'parserContent', result.content, 'parser content');
  if (result.targetText) pushDetail(details, 'targetText', result.targetText, 'target');
  if (!payload) return details;

  if ('itemType' in payload) {
    const itemPayload = payload as CreateItemPayload;
    pushDetail(details, 'itemType', itemPayload.itemType);
    pushDetail(details, 'content', itemPayload.content);
    pushDetail(details, 'status', itemPayload.status);
    pushDetails(details, itemPayload.meta as Record<string, unknown>);
  } else if ('changes' in payload || 'match' in payload) {
    const updatePayload = payload as UpdateItemPayload;
    pushDetails(details, updatePayload.match as Record<string, unknown>);
    pushDetails(details, updatePayload.changes as Record<string, unknown>);
  } else if ('savingGoalName' in payload || 'savingGoalId' in payload) {
    pushDetails(details, payload as AddSavingFundsPayload | WithdrawSavingFundsPayload as Record<string, unknown>);
  } else if ('fromWallet' in payload || 'toWallet' in payload) {
    pushDetails(details, payload as TransferMoneyPayload as Record<string, unknown>);
  } else if ('walletType' in payload || 'initialBalance' in payload || 'isDebtAccount' in payload) {
    pushDetails(details, payload as CreateWalletPayload | UpdateWalletPayload as Record<string, unknown>);
  } else if ('targetHours' in payload || 'targetMinutes' in payload || 'period' in payload) {
    pushDetails(details, payload as CreateSkillPayload | UpdateSkillPayload as Record<string, unknown>);
  } else if ('monthKey' in payload) {
    pushDetails(details, payload as ThemePayload as Record<string, unknown>);
  } else {
    pushDetails(details, payload as Record<string, unknown>);
  }

  return details;
};

export const getParserResultSummary = (result: ParserResultV2): ParserResultSummary => {
  const payload = result.payload as any;
  const destination = parserActionDestination(result);
  const details = getParserResultDetails(result);

  switch (result.action) {
    case 'create_item': {
      const itemType = payload?.itemType || result.entityType;
      const itemLabel = ITEM_LABEL[itemType] || result.entityType || 'item';
      const amount = amountPart(payload?.meta?.amount);
      const wallet = firstText(payload?.meta?.paymentMethod);
      return {
        title: titleWithParts(`Saved ${itemLabel}`, firstText(payload?.content, result.content), [amount, wallet]),
        destination,
        details,
      };
    }
    case 'update_item': {
      const changedCount = Object.keys(payload?.changes || {}).filter(key => !INTERNAL_DETAIL_KEYS.has(key)).length;
      return {
        title: titleWithParts('Updated item', firstText(payload?.match?.itemName, result.targetText, result.content), [changedCount ? `${changedCount} field${changedCount === 1 ? '' : 's'} changed` : undefined]),
        destination,
        details,
      };
    }
    case 'complete_item':
      return { title: titleWithParts('Completed item', firstText(payload?.match?.itemName, result.targetText, result.content)), destination, details };
    case 'delete_item':
      return { title: titleWithParts('Deleted item', firstText(payload?.match?.itemName, result.targetText, result.content)), destination, details };
    case 'create_skill':
      return { title: titleWithParts('Saved skill', firstText(payload?.name, result.content), [payload?.targetMinutes ? `${payload.targetMinutes} min target` : undefined]), destination, details };
    case 'update_skill':
      return { title: titleWithParts('Updated skill', firstText(payload?.match?.skillName, result.targetText, result.content)), destination, details };
    case 'create_wallet':
      return { title: titleWithParts('Saved wallet', firstText(payload?.name, result.content), [payload?.walletType]), destination, details };
    case 'update_wallet':
      return { title: titleWithParts('Updated wallet', firstText(payload?.match?.walletName, result.targetText, result.content)), destination, details };
    case 'create_theme':
    case 'update_theme':
      return { title: titleWithParts('Updated monthly theme', firstText(payload?.monthKey), [firstText(payload?.content, result.content)]), destination, details };
    case 'transfer_money':
      return { title: titleWithParts('Saved transfer', `${payload?.fromWallet || 'wallet'} → ${payload?.toWallet || 'wallet'}`, [amountPart(payload?.amount)]), destination, details };
    case 'add_saving_funds':
      return { title: titleWithParts('Saved fund contribution', firstText(payload?.savingGoalName, result.content), [amountPart(payload?.amount), firstText(payload?.fromWallet)]), destination, details };
    case 'withdraw_saving_funds':
      return { title: titleWithParts('Saved fund withdrawal', firstText(payload?.savingGoalName, result.content), [amountPart(payload?.amount), firstText(payload?.toWallet)]), destination, details };
    case 'record_loan_transaction':
      return { title: titleWithParts('Saved loan transaction', firstText(payload?.counterparty, result.content), [firstText(payload?.transactionKind), amountPart(payload?.amount), firstText(payload?.wallet)]), destination, details };
    case 'query_only':
      return { title: 'No saved changes', destination, details, noop: true };
    case 'unknown':
    default:
      return { title: titleWithParts('Saved note for review', firstText(result.content)), destination, details };
  }
};

export const getParserTaskDuplicateSummary = (task: Pick<ParsingTask, 'duplicateGuardRemovedCount' | 'duplicateGuardReason' | 'results'>): string | undefined => {
  const removed = task.duplicateGuardRemovedCount || 0;
  if (removed <= 0) return undefined;
  const kept = (task.results || []).filter(result => !getParserResultSummary(result).noop).length;
  const duplicateWord = removed === 1 ? 'duplicate parser result' : 'duplicate parser results';
  if (kept > 0) return `Merged duplicate output: kept ${kept} saved result${kept === 1 ? '' : 's'} and suppressed ${removed} ${duplicateWord}.`;
  return `Suppressed ${removed} ${duplicateWord}; no extra Review Center card needed.`;
};

export const shouldShowParserTaskInReviewCenter = (task: ParsingTask): boolean => {
  if (task.status !== 'success') return true;
  if (task.undoStatus) return true;
  if ((task.duplicateGuardRemovedCount || 0) > 0) return true;
  return (task.results || []).some(result => {
    const summary = getParserResultSummary(result);
    return !summary.noop && (summary.details.length > 0 || !!summary.title);
  });
};
