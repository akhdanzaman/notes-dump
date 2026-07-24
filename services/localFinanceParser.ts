import {
  AddSavingFundsPayload,
  LoanTransactionKind,
  RecordLoanTransactionPayload,
  BrainDumpItem,
  BudgetRule,
  CreateItemPayload,
  FinanceType,
  ItemType,
  ParserConfidence,
  ParserResultV2,
  TransferMoneyPayload,
  WithdrawSavingFundsPayload,
  Wallet,
} from '../types';
import { enrichFinanceMetaFromText } from './parserSignalService';

export type LocalFinanceFastPathKind = 'expense' | 'income' | 'transfer' | 'saving' | 'saving_withdrawal' | LoanTransactionKind;

export interface LocalFinanceParseOptions {
  availableWallets?: Wallet[];
  availableBudgetRules?: BudgetRule[];
  existingItems?: BrainDumpItem[];
  now?: Date;
}

export interface LocalFinanceParseTelemetry {
  elapsedMs: number;
  matchedFastPath: boolean;
  fallbackReason?: string;
}

export interface LocalFinanceParseResult {
  result: ParserResultV2;
  kind: LocalFinanceFastPathKind;
  confidenceScore: number;
  missingFields: string[];
  telemetry: LocalFinanceParseTelemetry;
}

type TriggerSpec = { kind: LocalFinanceFastPathKind; keyword: string };
type AmountMatch = { amount: number; raw: string; index: number };
type WalletMatch = { wallet: Wallet; alias: string; raw: string; index: number; end: number };
type DateHint = { date: string; raw: string };

const EXPENSE_KEYWORDS = ['expense', 'pengeluaran', 'keluar', 'bayar', 'jajan', 'spent', 'spend', 'paid'];
const PURCHASE_EXPENSE_KEYWORDS = ['beli', 'buy', 'belanja', 'purchase'];
const INCOME_KEYWORDS = ['income', 'pemasukan', 'masuk', 'gaji', 'salary', 'bonus', 'refund', 'cashback', 'reimburse', 'reimbursement'];
const TRANSFER_KEYWORDS = ['transfer', 'tf', 'trf', 'pindah', 'mutasi'];
const SAVING_KEYWORDS = ['saving', 'savings', 'tabung', 'nabung', 'simpan', 'invest', 'investasi', 'investment'];
const SAVING_WITHDRAWAL_KEYWORDS = ['withdraw', 'tarik', 'cair', 'cairkan', 'ambil'];
const ALL_KEYWORDS = [...EXPENSE_KEYWORDS, ...PURCHASE_EXPENSE_KEYWORDS, ...INCOME_KEYWORDS, ...TRANSFER_KEYWORDS, ...SAVING_KEYWORDS, ...SAVING_WITHDRAWAL_KEYWORDS];
const CONNECTOR_WORDS = ['dari', 'from', 'pakai', 'pake', 'via', 'with', 'ke', 'to', 'into', 'tujuan', 'buat', 'untuk', 'di', 'on'];
const UNKNOWN_WALLET_HINTS = ['cash', 'tunai', 'qris', 'gopay', 'go-pay', 'ovo', 'dana', 'shopeepay', 'shoppepay', 'spay', 'bca', 'bni', 'bri', 'mandiri', 'jago', 'blu', 'seabank', 'jenius', 'permata', 'cimb', 'bsi', 'bibit', 'ajaib'];
const AMBIGUOUS_FALLBACK_PATTERN = /\b(split|patungan|utang|hutang|pinjam|reimburse(?:ment)?|dibalikin|kayaknya|kayanya|mungkin|kurang lebih|approx|maybe)\b/i;
const TOKEN_STOP_WORDS = new Set([...CONNECTOR_WORDS, 'rp', 'idr', 'rupiah', 'hari', 'ini']);

const normalizeWhitespace = (input: string): string => input.replace(/\s+/g, ' ').trim();
const normalizeKey = (input: string): string => input.toLowerCase().replace(/[^a-z0-9]/g, '');
const escapeRegExp = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

const toLocalDateISOString = (date: Date): string => {
  const next = new Date(date);
  return new Date(Date.UTC(next.getFullYear(), next.getMonth(), next.getDate())).toISOString();
};

const parseAmountValue = (rawInput: string): number | undefined => {
  let raw = rawInput.toLowerCase().replace(/\s+/g, '').replace(/^rp/, '').replace(/^idr/, '');
  const suffixMatch = raw.match(/(ribu|rb|k|juta|jt|mio|m)$/i);
  const suffix = suffixMatch?.[1];
  if (suffix) raw = raw.slice(0, -suffix.length);

  let normalized = raw;
  if (suffix) {
    normalized = normalized.replace(',', '.').replace(/(?<=\d)\.(?=\d{3}(\D|$))/g, '');
  } else if (/^\d{1,3}([.]\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, '');
  } else if (/^\d{1,3}(,\d{3})+$/.test(raw)) {
    normalized = raw.replace(/,/g, '');
  } else if (raw.includes(',') && !raw.includes('.')) {
    normalized = raw.replace(',', '.');
  } else if ((raw.match(/\./g) || []).length > 1) {
    normalized = raw.replace(/\./g, '');
  }

  const base = Number(normalized);
  if (!Number.isFinite(base) || base <= 0) return undefined;
  const multiplier = suffix
    ? ['k', 'rb', 'ribu'].includes(suffix) ? 1_000 : ['jt', 'juta', 'mio', 'm'].includes(suffix) ? 1_000_000 : 1
    : 1;
  return Math.round(base * multiplier);
};

const findAmountMatches = (text: string): AmountMatch[] => {
  const matches: AmountMatch[] = [];
  const pattern = /\b(?:rp|idr)?\s*\d+(?:[.,]\d{3})*(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt|mio|m)?\b/gi;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const amount = parseAmountValue(raw);
    if (amount) matches.push({ amount, raw, index: match.index || 0 });
  }
  return matches;
};

const detectTrigger = (text: string): TriggerSpec | null => {
  const firstToken = text.toLowerCase().match(/^\s*([a-z]+)\b/)?.[1] || '';
  if (EXPENSE_KEYWORDS.includes(firstToken)) return { kind: 'expense', keyword: firstToken };
  if (PURCHASE_EXPENSE_KEYWORDS.includes(firstToken)) return { kind: 'expense', keyword: firstToken };
  if (INCOME_KEYWORDS.includes(firstToken)) return { kind: 'income', keyword: firstToken };
  if (TRANSFER_KEYWORDS.includes(firstToken)) return { kind: 'transfer', keyword: firstToken };
  if (SAVING_KEYWORDS.includes(firstToken)) return { kind: 'saving', keyword: firstToken };
  return null;
};

const isPurchaseExpenseTrigger = (trigger: TriggerSpec): boolean => PURCHASE_EXPENSE_KEYWORDS.includes(trigger.keyword);

const hasFutureOrShoppingListHint = (text: string): boolean => (
  /\b(besok|tomorrow|nanti|later|minggu depan|next week|bulan depan|next month|harus|perlu|need to|wishlist|list|daftar|setiap|tiap|routine|rutin|weekly|monthly)\b/i.test(text)
);

const buildWalletAliases = (wallets: Wallet[]): Array<{ wallet: Wallet; alias: string; normalized: string }> => {
  const ignoredTokens = new Set(['bank', 'wallet', 'ewallet', 'e-wallet', 'rekening', 'account', 'kartu', 'card', 'saldo']);
  const aliases = new Map<string, { wallet: Wallet; alias: string; normalized: string }>();
  wallets.forEach(wallet => {
    const candidates = new Set<string>();
    const name = wallet.name.toLowerCase();
    candidates.add(name);
    candidates.add(normalizeKey(name));
    name.split(/[^a-z0-9]+/i).forEach(token => {
      if (token.length >= 2 && !ignoredTokens.has(token)) candidates.add(token);
    });
    const words = name.split(/[^a-z0-9]+/i).filter(Boolean);
    if (words.length > 1) candidates.add(words.map(word => word[0]).join(''));
    UNKNOWN_WALLET_HINTS.forEach(alias => {
      if (normalizeKey(name).includes(normalizeKey(alias))) candidates.add(alias);
    });
    candidates.forEach(alias => {
      const normalized = normalizeKey(alias);
      if (normalized.length >= 2 && !aliases.has(normalized)) aliases.set(normalized, { wallet, alias, normalized });
    });
  });
  return [...aliases.values()].sort((a, b) => b.normalized.length - a.normalized.length);
};

const findWalletMatches = (text: string, wallets: Wallet[]): WalletMatch[] => {
  const lowerText = text.toLowerCase();
  const matches: WalletMatch[] = [];
  const occupied: Array<[number, number]> = [];
  buildWalletAliases(wallets).forEach(({ wallet, alias }) => {
    const regex = new RegExp(`\\b${escapeRegExp(alias).replace(/[\\ -]+/g, '[\\s-]*')}\\b`, 'gi');
    for (const match of lowerText.matchAll(regex)) {
      const index = match.index || 0;
      const raw = match[0];
      const end = index + raw.length;
      if (occupied.some(([start, finish]) => index < finish && end > start)) continue;
      occupied.push([index, end]);
      matches.push({ wallet, alias, raw, index, end });
    }
  });
  return matches.sort((a, b) => a.index - b.index);
};

const detectUnknownWalletHints = (text: string, knownMatches: WalletMatch[]): string[] => {
  const found = new Set<string>();
  const lowerText = text.toLowerCase();
  UNKNOWN_WALLET_HINTS.forEach(hint => {
    const regex = new RegExp(`\\b${escapeRegExp(hint).replace(/[\\ -]+/g, '[\\s-]*')}\\b`, 'i');
    const match = lowerText.match(regex);
    if (!match || match.index === undefined) return;
    const start = match.index;
    const end = start + match[0].length;
    if (!knownMatches.some(known => start >= known.index && end <= known.end)) found.add(hint);
  });
  return [...found];
};

const extractDateHint = (text: string, now: Date): DateHint | undefined => {
  const lowerText = text.toLowerCase();
  const relativeHints: Array<{ raw: RegExp; offset: number }> = [
    { raw: /\b(kemarin|yesterday)\b/i, offset: -1 },
    { raw: /\b(besok|tomorrow)\b/i, offset: 1 },
    { raw: /\b(hari ini|today)\b/i, offset: 0 },
  ];
  for (const hint of relativeHints) {
    const match = lowerText.match(hint.raw);
    if (match) {
      const date = new Date(now);
      date.setDate(date.getDate() + hint.offset);
      return { date: toLocalDateISOString(date), raw: match[0] };
    }
  }
  const iso = lowerText.match(/\b(20\d{2}-\d{1,2}-\d{1,2})\b/);
  if (iso) {
    const [year, month, day] = iso[1].split('-').map(Number);
    return { date: toLocalDateISOString(new Date(year, month - 1, day)), raw: iso[1] };
  }
  const slash = lowerText.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    const year = slash[3] ? Number(slash[3]) : now.getFullYear();
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) return { date: toLocalDateISOString(new Date(year, month - 1, day)), raw: slash[0] };
  }
  return undefined;
};

const extractLoanDueDateHint = (text: string, now: Date): DateHint | undefined => {
  const match = text.match(/\b(?:jatuh\s+tempo|tempo|due(?:\s+date)?)\s*(?:pada|tanggal|tgl)?\s*((?:besok|tomorrow|hari\s+ini|today)|(?:20\d{2}-\d{1,2}-\d{1,2})|(?:\d{1,2}[/-]\d{1,2}(?:[/-]20\d{2})?))/i);
  if (!match) return undefined;
  const parsed = extractDateHint(match[1], now);
  return parsed ? { date: parsed.date, raw: match[0] } : undefined;
};

const buildContentLabel = (originalText: string, trigger: TriggerSpec, amount?: AmountMatch, wallets: WalletMatch[] = [], dateHint?: DateHint): string => {
  let label = originalText;
  label = label.replace(new RegExp(`\\b${escapeRegExp(trigger.keyword)}\\b`, 'i'), ' ');
  if (amount) label = label.replace(amount.raw, ' ');
  wallets.forEach(wallet => {
    label = label.replace(new RegExp(`\\b${escapeRegExp(wallet.raw)}\\b`, 'ig'), ' ');
  });
  if (dateHint) label = label.replace(new RegExp(`\\b${escapeRegExp(dateHint.raw)}\\b`, 'i'), ' ');
  return normalizeWhitespace(label)
    .split(' ')
    .map(token => token.replace(/^[-:;,]+|[-:;,]+$/g, ''))
    .filter(Boolean)
    .filter(token => !TOKEN_STOP_WORDS.has(token.toLowerCase()))
    .join(' ')
    .trim();
};

const findClosestSavingGoal = (label: string, existingItems: BrainDumpItem[]): BrainDumpItem | undefined => {
  const normalizedLabel = normalizeKey(label);
  if (!normalizedLabel) return undefined;
  const goals = existingItems.filter(item => item.type === ItemType.SHOPPING && (item.meta.shoppingCategory === 'saving' || item.meta.shoppingCategory === 'investment'));
  return goals.find(goal => normalizeKey(goal.content) === normalizedLabel)
    || goals.find(goal => normalizeKey(goal.content).includes(normalizedLabel) || normalizedLabel.includes(normalizeKey(goal.content)));
};

const resolveWalletRoles = (kind: LocalFinanceFastPathKind, text: string, matches: WalletMatch[]) => {
  const lowerText = text.toLowerCase();
  const afterKe = matches.find(match => /\b(ke|to|into)\s*$/i.test(lowerText.slice(Math.max(0, match.index - 8), match.index)));
  const afterDari = matches.find(match => /\b(dari|from|pakai|pake|via|with)\s*$/i.test(lowerText.slice(Math.max(0, match.index - 14), match.index)));
  if (kind === 'transfer' || kind === 'saving') {
    const toWallet = afterKe || (matches.length >= 2 ? matches[matches.length - 1] : undefined);
    const fromWallet = afterDari || matches.find(match => match.wallet.id !== toWallet?.wallet.id) || (matches.length === 1 && kind === 'saving' ? matches[0] : undefined);
    return { fromWallet, toWallet };
  }
  return { fromWallet: matches[0], toWallet: undefined };
};

const confidenceFromMissing = (missingFields: string[]): ParserConfidence => missingFields.length >= 2 ? 'low' : missingFields.length === 1 ? 'medium' : 'high';
const reviewReasonFromMissing = (missingFields: string[]): string | undefined => missingFields.length ? `Local finance parser missing: ${missingFields.join(', ')}` : undefined;

const savingTargets = (items: BrainDumpItem[]): BrainDumpItem[] => items.filter(item =>
  item.type === ItemType.SHOPPING &&
  (item.meta.shoppingCategory === 'saving' || item.meta.shoppingCategory === 'investment')
);

const findSavingGoalMentionedInText = (text: string, items: BrainDumpItem[]): BrainDumpItem | undefined => {
  const normalizedText = normalizeKey(text);
  return savingTargets(items)
    .filter(goal => normalizeKey(goal.content).length >= 3 && normalizedText.includes(normalizeKey(goal.content)))
    .sort((a, b) => normalizeKey(b.content).length - normalizeKey(a.content).length)[0];
};

const parseSavingWithdrawalCommand = (
  normalizedText: string,
  options: LocalFinanceParseOptions,
  startedAt: number,
): LocalFinanceParseResult | null => {
  const triggerMatch = normalizedText.match(/^\s*(withdraw|tarik|cairkan?|ambil)\b/i);
  if (!triggerMatch) return null;

  const dateHint = extractDateHint(normalizedText, options.now || new Date());
  const textWithoutDateHint = dateHint
    ? normalizeWhitespace(normalizedText.replace(new RegExp(escapeRegExp(dateHint.raw), 'i'), ' '))
    : normalizedText;
  const amountMatches = findAmountMatches(textWithoutDateHint);
  if (amountMatches.length > 1) return null;

  const amount = amountMatches[0];
  const wallets = findWalletMatches(normalizedText, options.availableWallets || []);
  const trigger: TriggerSpec = { kind: 'saving_withdrawal', keyword: triggerMatch[1].toLowerCase() };
  const label = buildContentLabel(normalizedText, trigger, amount, wallets, dateHint)
    .replace(/\b(?:dari|from|ke|to|into)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const mentionedGoal = findSavingGoalMentionedInText(normalizedText, options.existingItems || []);
  const matchedGoal = mentionedGoal || findClosestSavingGoal(label, options.existingItems || []);
  const hasSavingHint = /\b(saving|savings|tabungan|goal|target|investasi|investment|invest)\b/i.test(normalizedText);
  if (!matchedGoal && !hasSavingHint) return null; // Keep generic "tarik tunai" as wallet transfer/deep parsing.

  const roles = resolveWalletRoles('transfer', normalizedText, wallets);
  const dedicatedWalletId = matchedGoal?.meta.dedicatedWalletId;
  const explicitSourceWalletId = roles.fromWallet?.wallet.id;
  const destinationWalletId = roles.toWallet?.wallet.id
    || wallets.find(match => match.wallet.id !== explicitSourceWalletId && match.wallet.id !== dedicatedWalletId)?.wallet.id;
  const inferredSourceWalletId = explicitSourceWalletId
    || (dedicatedWalletId && dedicatedWalletId !== destinationWalletId ? dedicatedWalletId : undefined);
  const sourceWallet = (options.availableWallets || []).find(wallet => wallet.id === inferredSourceWalletId);
  const destinationWallet = (options.availableWallets || []).find(wallet => wallet.id === destinationWalletId);
  const missingFields: string[] = [];

  if (!amount) missingFields.push('amount');
  if (!matchedGoal) missingFields.push(label ? 'savingGoal:notMatched' : 'savingGoal');
  if (inferredSourceWalletId && !destinationWalletId) missingFields.push('toWallet');

  const confidence = confidenceFromMissing(missingFields);
  const goalName = matchedGoal?.content || label || undefined;
  const payload: WithdrawSavingFundsPayload = {
    savingGoalId: matchedGoal?.id,
    savingGoalName: goalName,
    amount: amount?.amount,
    fromWallet: inferredSourceWalletId,
    toWallet: destinationWalletId,
    date: dateHint?.date,
    note: goalName ? `Withdraw from: ${goalName}` : undefined,
  };
  const result: ParserResultV2 = {
    action: 'withdraw_saving_funds',
    entityType: 'saving_goal',
    content: goalName ? `Withdraw from: ${goalName}` : normalizedText,
    confidence,
    needsReview: missingFields.length > 0,
    reviewReason: reviewReasonFromMissing(missingFields),
    entityRefs: {
      walletId: inferredSourceWalletId,
      walletName: sourceWallet?.name,
      toWalletId: destinationWalletId,
      toWalletName: destinationWallet?.name,
      savingGoalId: matchedGoal?.id,
      savingGoalName: goalName,
    },
    payload,
  };

  return {
    result,
    kind: 'saving_withdrawal',
    confidenceScore: confidence === 'high' ? 0.95 : confidence === 'medium' ? 0.72 : 0.45,
    missingFields,
    telemetry: { elapsedMs: nowMs() - startedAt, matchedFastPath: true },
  };
};

const detectLoanTransactionKind = (text: string): LoanTransactionKind | undefined => {
  const lowerText = text.toLowerCase();
  const userPronoun = '(?:saya|aku|gue|gw|user|me)';

  if (
    /\b(?:dikembalikan|dibalikin|dibayar\s+balik|pengembalian\s+pinjaman|loan\s+repayment)\b/i.test(lowerText) ||
    /^\s*[^\d]+?\s+(?:mengembalikan|balikin|membayar\s+balik|repaid?)\b/i.test(lowerText) ||
    new RegExp(`\\b(?:mengembalikan|balikin|membayar\\s+balik|repaid?)\\b.*\\b(?:ke|kepada|to)\\s+${userPronoun}\\b`, 'i').test(lowerText)
  ) return 'loan_repayment_in';

  if (/\b(?:kembalikan|balikin|bayar\s+(?:utang|hutang|pinjaman)|lunasi\s+(?:utang|hutang|pinjaman)|repay)\b/i.test(lowerText)) {
    return 'loan_repayment_out';
  }

  if (
    /\b(?:pinjamkan|meminjamkan|dipinjamkan|kasih\s+pinjaman|beri\s+pinjaman|lend|lent)\b/i.test(lowerText) ||
    new RegExp(`^\\s*[^\\d]+?\\s+(?:pinjam|borrow)\\b.*\\b(?:dari|from)\\s+${userPronoun}\\b`, 'i').test(lowerText)
  ) return 'loan_out';

  if (/\b(?:terima\s+pinjaman|pinjam|meminjam|borrow|borrowed)\b/i.test(lowerText)) return 'loan_in';
  return undefined;
};

const cleanLoanCounterparty = (value?: string): string | undefined => {
  if (!value) return undefined;
  const cleaned = normalizeWhitespace(value)
    .replace(/^[\s,:;-]+|[\s,:;-]+$/g, '')
    .replace(/\b(?:uang|dana|pinjaman|utang|hutang|saya|aku|gue|gw|user|me)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
};

const extractLoanCounterparty = (
  text: string,
  kind: LoanTransactionKind,
  amount: AmountMatch | undefined,
  wallets: WalletMatch[],
  dateHint?: DateHint,
): string | undefined => {
  let cleaned = text;
  if (amount) cleaned = cleaned.replace(amount.raw, ' ');
  wallets.forEach(wallet => {
    cleaned = cleaned.replace(new RegExp(`\\b${escapeRegExp(wallet.raw)}\\b`, 'ig'), ' ');
  });
  if (dateHint) cleaned = cleaned.replace(new RegExp(`\\b${escapeRegExp(dateHint.raw)}\\b`, 'i'), ' ');
  cleaned = normalizeWhitespace(cleaned);

  const outgoing = kind === 'loan_out' || kind === 'loan_repayment_out';
  const connectorPattern = outgoing
    ? /\b(?:ke|kepada|to)\s+(.+?)(?=\s+\b(?:dari|from|pakai|pake|via|with)\b|$)/i
    : /\b(?:dari|from|oleh|by)\s+(.+?)(?=\s+\b(?:ke|to|into|masuk|via|with)\b|$)/i;
  const connectorMatch = cleaned.match(connectorPattern);
  if (connectorMatch) return cleanLoanCounterparty(connectorMatch[1]);

  if (kind === 'loan_repayment_in') {
    const subjectMatch = cleaned.match(/^(.+?)\s+(?:mengembalikan|balikin|membayar\s+balik|repaid?)\b/i);
    if (subjectMatch) return cleanLoanCounterparty(subjectMatch[1]);
  }
  if (kind === 'loan_out') {
    const borrowerSubject = cleaned.match(/^(.+?)\s+(?:pinjam|borrow)\b.*\b(?:dari|from)\s+(?:saya|aku|gue|gw|user|me)\b/i);
    if (borrowerSubject) return cleanLoanCounterparty(borrowerSubject[1]);
  }
  return undefined;
};

const parseLoanTransactionCommand = (
  normalizedText: string,
  options: LocalFinanceParseOptions,
  startedAt: number,
): LocalFinanceParseResult | null => {
  const transactionKind = detectLoanTransactionKind(normalizedText);
  if (!transactionKind) return null;

  const tokenCount = normalizedText.split(/\s+/).length;
  if (tokenCount > 24 || normalizedText.length > 180) return null;
  const now = options.now || new Date();
  const dueDateHint = transactionKind === 'loan_out' || transactionKind === 'loan_in'
    ? extractLoanDueDateHint(normalizedText, now)
    : undefined;
  const textWithoutDueDate = dueDateHint
    ? normalizeWhitespace(normalizedText.replace(new RegExp(escapeRegExp(dueDateHint.raw), 'i'), ' '))
    : normalizedText;
  const dateHint = extractDateHint(textWithoutDueDate, now);
  const textWithoutDateHint = dateHint
    ? normalizeWhitespace(textWithoutDueDate.replace(new RegExp(escapeRegExp(dateHint.raw), 'i'), ' '))
    : textWithoutDueDate;
  const amountMatches = findAmountMatches(textWithoutDateHint);
  if (amountMatches.length > 1) return null;

  const amount = amountMatches[0];
  const wallets = findWalletMatches(textWithoutDateHint, options.availableWallets || []);
  const lowerText = textWithoutDateHint.toLowerCase();
  const incoming = transactionKind === 'loan_in' || transactionKind === 'loan_repayment_in';
  const wallet = incoming
    ? wallets.find(match => /\b(ke|to|into|masuk)\s*$/i.test(lowerText.slice(Math.max(0, match.index - 12), match.index))) || wallets[0]
    : wallets.find(match => /\b(dari|from|pakai|pake|via|with)\s*$/i.test(lowerText.slice(Math.max(0, match.index - 14), match.index))) || wallets[0];
  const counterparty = extractLoanCounterparty(textWithoutDateHint, transactionKind, amount, wallets, undefined);
  const missingFields: string[] = [];
  if (!amount) missingFields.push('amount');
  if (!wallet) missingFields.push('wallet');
  if (!counterparty) missingFields.push('counterparty');

  const labels: Record<LoanTransactionKind, string> = {
    loan_out: 'Money lent to',
    loan_in: 'Money borrowed from',
    loan_repayment_in: 'Loan repayment from',
    loan_repayment_out: 'Loan repayment to',
  };
  const content = counterparty ? `${labels[transactionKind]} ${counterparty}` : labels[transactionKind];
  const confidence = confidenceFromMissing(missingFields);
  const payload: RecordLoanTransactionPayload = {
    transactionKind,
    amount: amount?.amount,
    wallet: wallet?.wallet.id,
    counterparty,
    date: dateHint?.date,
    dueDate: dueDateHint?.date,
    note: content,
  };
  const result: ParserResultV2 = {
    action: 'record_loan_transaction',
    entityType: 'finance',
    content,
    confidence,
    needsReview: missingFields.length > 0,
    reviewReason: reviewReasonFromMissing(missingFields),
    entityRefs: { walletId: wallet?.wallet.id, walletName: wallet?.wallet.name },
    payload,
  };

  return {
    result,
    kind: transactionKind,
    confidenceScore: confidence === 'high' ? 0.95 : confidence === 'medium' ? 0.72 : 0.45,
    missingFields,
    telemetry: { elapsedMs: nowMs() - startedAt, matchedFastPath: true },
  };
};

export const parseLocalFinanceCommand = (text: string, options: LocalFinanceParseOptions = {}): LocalFinanceParseResult | null => {
  const startedAt = nowMs();
  const normalizedText = normalizeWhitespace(text);
  if (!normalizedText) return null;
  const savingWithdrawal = parseSavingWithdrawalCommand(normalizedText, options, startedAt);
  if (savingWithdrawal) return savingWithdrawal;
  const loanTransaction = parseLoanTransactionCommand(normalizedText, options, startedAt);
  if (loanTransaction) return loanTransaction;
  const trigger = detectTrigger(normalizedText);
  if (!trigger) return null;
  const tokenCount = normalizedText.split(/\s+/).length;
  if (tokenCount > 14 || normalizedText.length > 120 || AMBIGUOUS_FALLBACK_PATTERN.test(normalizedText)) return null;
  const dateHint = extractDateHint(normalizedText, options.now || new Date());
  const textWithoutDateHint = dateHint
    ? normalizeWhitespace(normalizedText.replace(new RegExp(escapeRegExp(dateHint.raw), 'i'), ' '))
    : normalizedText;
  const amountMatches = findAmountMatches(textWithoutDateHint);
  if (amountMatches.length > 1) return null;

  const amount = amountMatches[0];
  const wallets = findWalletMatches(normalizedText, options.availableWallets || []);
  const unknownWalletHints = detectUnknownWalletHints(normalizedText, wallets);
  const label = buildContentLabel(normalizedText, trigger, amount, wallets, dateHint);
  const roles = resolveWalletRoles(trigger.kind, normalizedText, wallets);
  const missingFields: string[] = [];

  if (isPurchaseExpenseTrigger(trigger) && (!amount || !roles.fromWallet || hasFutureOrShoppingListHint(normalizedText))) {
    return null;
  }

  if (!amount) missingFields.push('amount');
  if (trigger.kind === 'transfer') {
    if (!roles.fromWallet) missingFields.push('fromWallet');
    if (!roles.toWallet) missingFields.push('toWallet');
  } else if (trigger.kind === 'saving') {
    if (!roles.fromWallet) missingFields.push('fromWallet');
  } else if (!roles.fromWallet) {
    missingFields.push('paymentMethod');
  }
  if ((trigger.kind === 'expense' || trigger.kind === 'income') && !label) missingFields.push('content');
  if (unknownWalletHints.length > 0 && !roles.fromWallet && trigger.kind !== 'transfer') missingFields.push(`unrecognizedWallet:${unknownWalletHints.join('|')}`);

  if ((trigger.kind === 'expense' || trigger.kind === 'income') && !amount && !roles.fromWallet) return null;

  // Ensure paymentMethod is never empty for expense/income by defaulting to first available wallet
  if ((trigger.kind === 'expense' || trigger.kind === 'income') && !roles.fromWallet && (options.availableWallets || []).length > 0) {
    const defaultWallet = options.availableWallets![0];
    roles.fromWallet = { wallet: defaultWallet, alias: defaultWallet.name, raw: defaultWallet.name, index: 0, end: 0 };
    missingFields.splice(missingFields.indexOf('paymentMethod'), 1);
  }

  let result: ParserResultV2;
  if (trigger.kind === 'transfer') {
    const confidence = confidenceFromMissing(missingFields);
    const payload: TransferMoneyPayload = { amount: amount?.amount, fromWallet: roles.fromWallet?.wallet.id, toWallet: roles.toWallet?.wallet.id, date: dateHint?.date, note: label || undefined };
    result = {
      action: 'transfer_money', entityType: 'finance', content: label || `Transfer ${roles.fromWallet?.wallet.name || ''} ke ${roles.toWallet?.wallet.name || ''}`.trim(), confidence,
      needsReview: missingFields.length > 0, reviewReason: reviewReasonFromMissing(missingFields),
      entityRefs: { walletId: roles.fromWallet?.wallet.id, walletName: roles.fromWallet?.wallet.name, toWalletId: roles.toWallet?.wallet.id, toWalletName: roles.toWallet?.wallet.name }, payload,
    };
  } else if (trigger.kind === 'saving') {
    const matchedGoal = findClosestSavingGoal(label, options.existingItems || []);
    if (!matchedGoal) missingFields.push(label ? 'savingGoal:notMatched' : 'savingGoal');
    const confidence = confidenceFromMissing(missingFields);
    const payload: AddSavingFundsPayload = { savingGoalId: matchedGoal?.id, savingGoalName: matchedGoal?.content || label || undefined, amount: amount?.amount, fromWallet: roles.fromWallet?.wallet.id, toWallet: roles.toWallet?.wallet.id, date: dateHint?.date, note: label || undefined };
    result = {
      action: 'add_saving_funds', entityType: 'saving_goal', content: label || normalizedText, confidence,
      needsReview: missingFields.length > 0, reviewReason: reviewReasonFromMissing(missingFields),
      entityRefs: { walletId: roles.fromWallet?.wallet.id, walletName: roles.fromWallet?.wallet.name, toWalletId: roles.toWallet?.wallet.id, toWalletName: roles.toWallet?.wallet.name, savingGoalId: matchedGoal?.id, savingGoalName: matchedGoal?.content || label || undefined }, payload,
    };
  } else {
    const confidence = confidenceFromMissing(missingFields);
    const financeType: FinanceType = trigger.kind;
    const payload: CreateItemPayload = {
      itemType: 'FINANCE', content: label || normalizedText, status: 'done',
      meta: { amount: amount?.amount, currency: 'IDR', date: dateHint?.date, when: dateHint ? undefined : 'unspecified', financeType, paymentMethod: roles.fromWallet?.wallet.id },
    };
    payload.meta = enrichFinanceMetaFromText({
      rawText: normalizedText,
      content: payload.content,
      itemType: 'FINANCE',
      meta: payload.meta,
      availableWallets: options.availableWallets || [],
      availableBudgetRules: options.availableBudgetRules || [],
      existingItems: options.existingItems || [],
    });
    result = {
      action: 'create_item', entityType: 'finance', content: label || normalizedText, confidence,
      needsReview: missingFields.length > 0, reviewReason: reviewReasonFromMissing(missingFields),
      entityRefs: { walletId: roles.fromWallet?.wallet.id, walletName: roles.fromWallet?.wallet.name }, payload,
    };
  }

  return {
    result,
    kind: trigger.kind,
    confidenceScore: result.confidence === 'high' ? 0.95 : result.confidence === 'medium' ? 0.72 : 0.45,
    missingFields,
    telemetry: { elapsedMs: nowMs() - startedAt, matchedFastPath: true },
  };
};

export const parseLocalFinanceResults = (text: string, options: LocalFinanceParseOptions = {}): ParserResultV2[] | null => {
  const parsed = parseLocalFinanceCommand(text, options);
  return parsed ? [parsed.result] : null;
};
