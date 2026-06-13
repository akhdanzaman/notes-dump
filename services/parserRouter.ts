import {
  BrainDumpItem,
  BudgetRule,
  ItemType,
  ParserIntent,
  ParserResultV2,
  ParserModelRoutingMetadata,
  ParserRouterDecisionMetadata,
  ParserRouterRoute,
  ParsedItemType,
  Skill,
  Wallet,
} from '../types';
import { parseLocalFinanceCommand } from './localFinanceParser';
import { enrichFinanceMetaFromText } from './parserSignalService';

export const PARSER_ROUTER_THRESHOLDS = {
  localSave: 0.85,
  review: 0.6,
} as const;

export type LocalClassifierContext = {
  existingTags?: string[];
  availableSkills?: Skill[];
  availableWallets?: Wallet[];
  availableBudgetRules?: BudgetRule[];
  existingItems?: BrainDumpItem[];
  now?: Date;
};

type LocalClassification = ParserRouterDecisionMetadata & { result?: ParserResultV2 };
export type ParserRouterOutput = { decision: ParserRouterDecisionMetadata; results: ParserResultV2[] };
export type DeepParserOutput = ParserResultV2[] | { results: ParserResultV2[]; modelRouting?: ParserModelRoutingMetadata };

type AmountParse = { amount: number; raw: string } | undefined;

const normalizeWhitespace = (input: string) => input.replace(/\s+/g, ' ').trim();
const lower = (input: string) => normalizeWhitespace(input).toLowerCase();

const confidenceLabel = (score: number): ParserResultV2['confidence'] => {
  if (score >= PARSER_ROUTER_THRESHOLDS.localSave) return 'high';
  if (score >= PARSER_ROUTER_THRESHOLDS.review) return 'medium';
  return 'low';
};

const routeForScore = (score: number, reasonCodes: string[]): ParserRouterRoute => {
  if (reasonCodes.includes('mixed_or_complex_input') || score < PARSER_ROUTER_THRESHOLDS.review) return 'deep_ai';
  return score >= PARSER_ROUTER_THRESHOLDS.localSave ? 'local_save' : 'review';
};

const decision = (intent: ParserIntent, confidenceScore: number, reasonCodes: string[], result?: ParserResultV2): LocalClassification => ({
  route: routeForScore(confidenceScore, reasonCodes),
  intent,
  confidenceScore,
  reasonCodes,
  result,
});

export const normalizeDeepParserOutput = (output: DeepParserOutput): { results: ParserResultV2[]; modelRouting?: ParserModelRoutingMetadata } => (
  Array.isArray(output) ? { results: output } : output
);

const intentToEntity = (intent: ParserIntent): ParserResultV2['entityType'] => {
  if (intent === 'finance' || intent === 'todo' || intent === 'shopping' || intent === 'note' || intent === 'journal' || intent === 'event') return intent;
  return 'unknown';
};

const countIntentSignals = (text: string) => {
  const signals = new Set<ParserIntent>();
  if (/\b(todo|task|tugas|remind me to|ingatkan|harus|perlu)\b/.test(text)) signals.add('todo');
  if (/\b(shopping|buy|beli|belanja|purchase list)\b/.test(text)) signals.add('shopping');
  if (/\b(note|catatan|idea|ide)\s*:/.test(text)) signals.add('note');
  if (/\b(journal|jurnal|diary|dear diary)\b/.test(text)) signals.add('journal');
  if (/\b(event|calendar|jadwal|schedule|meeting|rapat|appointment)\b/.test(text)) signals.add('event');
  if (/\b(expense|spent|paid|bayar|income|gaji|salary|transfer|topup|tarik tunai|setor|saved?\s+\d|saving funds?)\b/.test(text)) signals.add('finance');
  if (/\?$/.test(text) || /^(what|how|why|when|where|who|apa|berapa|kenapa|kapan|dimana|siapa)\b/.test(text)) signals.add('query_only');
  return signals;
};

const isLocalFinanceFallbackCandidate = (text: string): boolean => {
  if (!/^(expense|pengeluaran|keluar|bayar|beli|jajan|spent|spend|buy|paid|income|pemasukan|masuk|gaji|salary|bonus|refund|cashback|reimburse|reimbursement|transfer|tf|trf|pindah|mutasi|saving|savings|tabung|nabung|simpan|invest|investasi|investment)\b/.test(text)) return false;
  const tokenCount = text.split(/\s+/).length;
  const amountCount = [...text.matchAll(/\b(?:rp|idr)?\s*\d+(?:[.,]\d{3})*(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt|mio|m)?\b/gi)].length;
  return tokenCount > 14
    || text.length > 120
    || amountCount > 1
    || /\b(split|patungan|utang|hutang|pinjam|reimburse(?:ment)?|dibalikin|kayaknya|kayanya|mungkin|kurang lebih|approx|maybe)\b/i.test(text);
};

const isComplexInput = (rawText: string) => {
  const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length > 1) return true;
  if (/[;•]/.test(rawText)) return true;

  const text = lower(rawText);
  const signals = countIntentSignals(text);
  if (signals.size <= 1) return false;
  if (signals.size === 2 && signals.has('shopping') && signals.has('finance')) {
    return /\b(expense|spent|paid|bayar|income|gaji|salary|transfer|topup|tarik tunai|setor|saved?\s+\d|saving funds?)\b/.test(text);
  }
  return true;
};

const parseAmount = (rawText: string): AmountParse => {
  const text = rawText.replace(/,/g, '.');
  const matches = [...text.matchAll(/(?:rp\s*)?(\d+(?:\.\d+)?)(?:\s*(k|rb|ribu|jt|juta|mio|million|m))?\b/gi)];
  for (const match of matches) {
    const token = match[0];
    const numeric = Number(match[1]);
    if (!Number.isFinite(numeric)) continue;
    const suffix = (match[2] || '').toLowerCase();
    let multiplier = 1;
    if (['k', 'rb', 'ribu'].includes(suffix)) multiplier = 1_000;
    if (['jt', 'juta', 'mio', 'million', 'm'].includes(suffix)) multiplier = 1_000_000;
    const amount = Math.round(numeric * multiplier);
    if (amount >= 1_000 || suffix || /rp/i.test(token)) return { amount, raw: token.trim() };
  }
  return undefined;
};

const stripIntentPrefix = (text: string) => normalizeWhitespace(text.replace(/^(todo|task|tugas|shopping|belanja|note|catatan|journal|jurnal|event|calendar|jadwal|finance|expense|income)\s*[:\-]\s*/i, ''));
const stripAmount = (text: string, amount?: AmountParse) => normalizeWhitespace(amount ? text.replace(amount.raw, '') : text);

const createItemResult = (
  itemType: ItemType,
  entityType: ParserResultV2['entityType'],
  content: string,
  score: number,
  meta: Record<string, unknown> = {},
  reviewReason?: string,
): ParserResultV2 => ({
  action: 'create_item',
  entityType,
  content,
  confidence: confidenceLabel(score),
  needsReview: score < PARSER_ROUTER_THRESHOLDS.localSave,
  reviewReason,
  payload: {
    itemType: itemType as ParsedItemType,
    content,
    status: itemType === ItemType.FINANCE || itemType === ItemType.SKILL_LOG ? 'done' : 'pending',
    meta,
  },
});

const classifyFinance = (rawText: string, ctx: LocalClassifierContext, scoreOverride?: number, reasonOverride?: string[]): LocalClassification => {
  const text = lower(rawText);
  const amount = parseAmount(rawText);
  const financeType = /\b(income|gaji|salary|received|terima|pemasukan)\b/.test(text)
    ? 'income'
    : /\b(transfer|topup|tarik tunai|withdraw|setor|deposit|pindah)\b/.test(text)
      ? 'transfer'
      : /\b(saved|save|nab[uo]ng|saving funds?)\b/.test(text)
        ? 'saving'
        : 'expense';
  const score = scoreOverride ?? (amount ? 0.92 : 0.68);
  const reasonCodes = reasonOverride ?? (amount ? ['obvious_finance_with_amount'] : ['finance_intent_missing_amount']);
  const cleanedContent = stripAmount(stripIntentPrefix(rawText), amount) || rawText;
  const meta = enrichFinanceMetaFromText({
    rawText,
    content: cleanedContent,
    itemType: ItemType.FINANCE,
    meta: { amount: amount?.amount, financeType, date: (ctx.now || new Date()).toISOString() },
    availableWallets: ctx.availableWallets || [],
    availableBudgetRules: ctx.availableBudgetRules || [],
    existingItems: ctx.existingItems || [],
  });
  const reviewReason = score < PARSER_ROUTER_THRESHOLDS.localSave
    ? 'Local parser recognized a finance entry, but key transaction details need review before saving.'
    : undefined;
  return decision('finance', score, reasonCodes, createItemResult(ItemType.FINANCE, 'finance', cleanedContent, score, meta as unknown as Record<string, unknown>, reviewReason));
};

const classifyExplicitItem = (rawText: string, itemType: ItemType, intent: ParserIntent, reasonCode: string, ctx: LocalClassifierContext): LocalClassification => {
  const amount = parseAmount(rawText);
  const text = lower(rawText);
  const content = stripAmount(stripIntentPrefix(rawText), itemType === ItemType.SHOPPING ? amount : undefined) || rawText;
  const meta: Record<string, unknown> = {};
  if (itemType === ItemType.JOURNAL) meta.date = (ctx.now || new Date()).toISOString();
  if (itemType === ItemType.SHOPPING) {
    if (amount) meta.amount = amount.amount;
    meta.shoppingCategory = /\b(routine|rutin|weekly|monthly|setiap|tiap)\b/.test(text) ? 'routine' : 'not_urgent';
  }
  if (itemType === ItemType.TODO) meta.priority = /\b(urgent|penting|segera|today|hari ini)\b/.test(text) ? 'high' : 'normal';
  const score = 0.9;
  return decision(intent, score, [reasonCode], createItemResult(itemType, intentToEntity(intent), content, score, meta));
};

const classifyQueryOnly = (rawText: string): LocalClassification => {
  const question = normalizeWhitespace(rawText);
  return decision('query_only', 0.9, ['obvious_query_only'], {
    action: 'query_only',
    entityType: 'unknown',
    content: question,
    confidence: 'high',
    needsReview: false,
    payload: { question, scope: 'general' },
  });
};

export const classifyLocalIntent = (rawText: string, ctx: LocalClassifierContext = {}): LocalClassification => {
  const normalized = normalizeWhitespace(rawText);
  if (!normalized) return decision('unknown', 0, ['empty_input']);
  const text = lower(normalized);

  const localFinance = parseLocalFinanceCommand(normalized, ctx);
  if (localFinance) {
    const score = localFinance.result.needsReview ? Math.min(localFinance.confidenceScore, 0.72) : localFinance.confidenceScore;
    return decision(
      'finance',
      score,
      ['local_finance_fast_path', `local_finance_${localFinance.kind}`, ...localFinance.missingFields.map(field => `missing_${field}`)],
      localFinance.result,
    );
  }

  if (isComplexInput(rawText)) return decision('mixed', 0.45, ['mixed_or_complex_input']);
  if (isLocalFinanceFallbackCandidate(text)) return decision('finance', 0.45, ['finance_fast_path_fallback_to_ai', 'mixed_or_complex_input']);

  if (/^(note|catatan|idea|ide)\s*[:\-]/.test(text)) return classifyExplicitItem(normalized, ItemType.NOTE, 'note', 'explicit_note_prefix', ctx);
  if (/^(journal|jurnal|diary|dear diary)\b/.test(text)) return classifyExplicitItem(normalized, ItemType.JOURNAL, 'journal', 'explicit_journal_prefix', ctx);
  if (/^(todo|task|tugas)\s*[:\-]/.test(text) || /^(remind me to|ingatkan(?: saya)? untuk)\b/.test(text)) return classifyExplicitItem(normalized, ItemType.TODO, 'todo', 'explicit_todo_prefix', ctx);
  if (/^(event|calendar|jadwal|schedule)\s*[:\-]/.test(text)) return classifyExplicitItem(normalized, ItemType.EVENT, 'event', 'explicit_event_prefix', ctx);
  if (/\?$/.test(text) || /^(what|how|why|when|where|who|apa|berapa|kenapa|kapan|dimana|siapa)\b/.test(text)) return classifyQueryOnly(normalized);

  if (/^(shopping|belanja)\s*[:\-]/.test(text) || /^(buy|beli)\b/.test(text)) {
    const hasPaidSignal = /\b(expense|spent|paid|bayar|dibayar|sudah|done)\b/.test(text);
    if (!hasPaidSignal) return classifyExplicitItem(normalized, ItemType.SHOPPING, 'shopping', 'obvious_shopping_intent', ctx);
  }

  if (/\b(expense|spent|paid|bayar|income|gaji|salary|transfer|topup|tarik tunai|setor|saved?\s+\d|saving funds?)\b/.test(text)) return classifyFinance(normalized, ctx);
  if (parseAmount(normalized) && /\b(makan|sarapan|breakfast|lunch|dinner|kopi|coffee|parkir|parking|bensin|grab|gojek|token|listrik|laundry)\b/.test(text)) {
    return classifyFinance(normalized, ctx, 0.88, ['obvious_spend_phrase_with_amount']);
  }
  if (/^(note|catatan)\b/.test(text)) return classifyExplicitItem(normalized, ItemType.NOTE, 'note', 'note_word_prefix', ctx);
  if (/^(journal|jurnal|diary)\b/.test(text)) return classifyExplicitItem(normalized, ItemType.JOURNAL, 'journal', 'journal_word_prefix', ctx);
  return decision('unknown', 0.3, ['no_local_intent_match']);
};

export const routeParserInput = async (
  text: string,
  ctx: LocalClassifierContext,
  deepParser: () => Promise<DeepParserOutput>,
): Promise<ParserRouterOutput> => {
  const local = classifyLocalIntent(text, ctx);
  if (local.route === 'deep_ai') {
    const parsed = normalizeDeepParserOutput(await deepParser());
    const hasActionableDeepResult = parsed.results.some(result => result.action !== 'unknown');
    if (!hasActionableDeepResult && local.result) {
      return {
        decision: {
          route: 'review',
          intent: local.intent,
          confidenceScore: local.confidenceScore,
          reasonCodes: [...local.reasonCodes, 'ai_empty_used_local_fallback'],
          modelRouting: parsed.modelRouting,
        },
        results: [local.result],
      };
    }
    return { decision: { route: 'deep_ai', intent: local.intent, confidenceScore: local.confidenceScore, reasonCodes: local.reasonCodes, modelRouting: parsed.modelRouting }, results: parsed.results };
  }
  return { decision: { route: local.route, intent: local.intent, confidenceScore: local.confidenceScore, reasonCodes: local.reasonCodes }, results: local.result ? [local.result] : [] };
};
