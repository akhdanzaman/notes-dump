import { Type } from "@google/genai";
import {
  ItemType,
  BrainDumpItem,
  Wallet,
  Skill,
  BudgetRule,
  FinanceType,
  Priority,
  ParserResultV2,
  ParserAction,
  ParserEntityType,
  ParserConfidence,
  ParserEntityRefs,
  ParsedItemMetaV2,
  CreateItemPayload,
  UpdateItemPayload,
  CompleteItemPayload,
  DeleteItemPayload,
  CreateSkillPayload,
  CreateWalletPayload,
  ThemePayload,
  TransferMoneyPayload,
  AddSavingFundsPayload,
  ParsedWalletType,
  ParsedItemType
} from '../types';
import { DEFAULT_PROMPT } from './geminiService';
import { createGeminiClient, getGeminiKey, parseJsonResponse, withAiRetry, DEFAULT_PRO_MODEL } from './aiService';
import { enrichFinanceMetaFromText, PARSER_SIGNAL_GUIDANCE } from './parserSignalService';
import { parseLocalFinanceResults } from './localFinanceParser';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ParserContext {
  existingTags: string[];
  availableSkills: Skill[];
  availableWallets: Wallet[];
  availableBudgetRules: BudgetRule[];
  existingItems: BrainDumpItem[];
  currentDateISO: string;
  currentDayName: string;
  currentMonthKey: string;
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function lower(s?: string): string {
  return (s || '').toLowerCase().trim();
}

function sanitizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function safeArrayStrings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value
    .map(v => typeof v === 'string' ? normalizeWhitespace(v) : '')
    .filter(Boolean);
  return result.length > 0 ? result : undefined;
}

function safeArrayNumbers(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value
    .map(v => (typeof v === 'number' && Number.isFinite(v) ? v : undefined))
    .filter((v): v is number => v !== undefined);
  return result.length > 0 ? result : undefined;
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as T;
}

function isValidItemType(value: unknown): value is ParsedItemType {
  return typeof value === 'string' && [
    'TODO',
    'SHOPPING',
    'NOTE',
    'EVENT',
    'FINANCE',
    'JOURNAL'
  ].includes(value);
}

function isValidFinanceType(value: unknown): value is FinanceType {
  return typeof value === 'string' && ['expense', 'income', 'transfer', 'saving'].includes(value);
}

function isValidPriority(value: unknown): value is Priority {
  return typeof value === 'string' && ['low', 'normal', 'high'].includes(value);
}

function isValidShoppingCategory(value: unknown): value is 'urgent' | 'routine' | 'not_urgent' | 'saving' | 'investment' {
  return typeof value === 'string' && ['urgent', 'routine', 'not_urgent', 'saving', 'investment'].includes(value);
}

function isValidWalletType(value: unknown): value is ParsedWalletType {
  return typeof value === 'string' && ['cash', 'bank', 'ewallet', 'cc', 'investment', 'other'].includes(value);
}

function coerceConfidence(value: unknown): ParserConfidence {
  return value === 'high' || value === 'medium' || value === 'low' ? value : 'medium';
}

function sanitizeAction(value: unknown): ParserAction {
  const allowed: ParserAction[] = [
    'create_item',
    'update_item',
    'complete_item',
    'delete_item',
    'create_skill',
    'update_skill',
    'create_wallet',
    'update_wallet',
    'create_theme',
    'update_theme',
    'transfer_money',
    'add_saving_funds',
    'query_only',
    'unknown'
  ];
  return typeof value === 'string' && allowed.includes(value as ParserAction)
    ? value as ParserAction
    : 'unknown';
}

function sanitizeEntityType(value: unknown): ParserEntityType {
  const allowed: ParserEntityType[] = [
    'todo',
    'shopping',
    'note',
    'event',
    'finance',
    'journal',
    'skill_log',
    'skill',
    'wallet',
    'theme',
    'saving_goal',
    'unknown'
  ];
  return typeof value === 'string' && allowed.includes(value as ParserEntityType)
    ? value as ParserEntityType
    : 'unknown';
}

function mapEntityTypeToItemType(entityType: ParserEntityType, fallback: ParsedItemType = 'NOTE'): ParsedItemType {
  switch (entityType) {
    case 'todo': return 'TODO';
    case 'shopping': return 'SHOPPING';
    case 'note': return 'NOTE';
    case 'event': return 'EVENT';
    case 'finance': return 'FINANCE';
    case 'journal': return 'JOURNAL';
    case 'skill_log': return 'SKILL_LOG';
    case 'saving_goal': return 'SHOPPING';
    default: return fallback;
  }
}

function buildContext(
  existingTags: string[],
  availableSkills: Skill[],
  availableWallets: Wallet[],
  availableBudgetRules: BudgetRule[],
  existingItems: BrainDumpItem[]
): ParserContext {
  const now = new Date();
  return {
    existingTags,
    availableSkills,
    availableWallets,
    availableBudgetRules,
    existingItems,
    currentDateISO: now.toISOString(),
    currentDayName: now.toLocaleDateString('en-US', { weekday: 'long' }),
    currentMonthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  };
}

function buildContextText(ctx: ParserContext): string {
  const savingGoals = ctx.existingItems
    .filter(i => i.type === ItemType.SHOPPING && i.meta?.shoppingCategory === 'saving')
    .map(i => i.content);

  const pendingItems = ctx.existingItems
    .filter(i => i.status === 'pending')
    .slice(0, 120)
    .map(i => `${i.type}: ${i.content}`);

  return [
    `Current date: ${ctx.currentDateISO} (${ctx.currentDayName})`,
    `Current month key: ${ctx.currentMonthKey}`,
    ctx.existingTags.length ? `Existing tags: ${ctx.existingTags.join(', ')}` : `Existing tags: none`,
    ctx.availableSkills.length
      ? `Known skills: ${ctx.availableSkills.map(s => `${s.name} [${s.id}]`).join(', ')}`
      : `Known skills: none`,
    ctx.availableWallets.length
      ? `Known wallets: ${ctx.availableWallets.map(w => `${w.name} [${w.id}] type=${w.type}`).join(', ')}`
      : `Known wallets: none`,
    ctx.availableBudgetRules.length
      ? `Known budget categories: ${ctx.availableBudgetRules.map(b => `${b.name} [${b.id}]`).join(', ')}`
      : `Known budget categories: none`,
    savingGoals.length
      ? `Known saving goals: ${savingGoals.join(', ')}`
      : `Known saving goals: none`,
    pendingItems.length
      ? `Pending items: ${pendingItems.join(' | ')}`
      : `Pending items: none`,
  ].join('\n');
}

function findClosestMatch<T extends { id: string; name: string }>(query: string, items: T[]): string | undefined {
  if (!query || !items.length) return undefined;
  
  // Direct ID exact match
  const exactIdMatch = items.find(i => i.id === query);
  if (exactIdMatch) return exactIdMatch.id;

  const q = lower(query);
  if (!q) return undefined;

  let bestId: string | undefined;
  let bestScore = -1;

  for (const item of items) {
    const name = lower(item.name);
    if (!name) continue;

    if (name === q) return item.id;

    let score = 0;
    if (name.includes(q) || q.includes(name)) score += 100;

    const qWords = q.split(/\s+/).filter(Boolean);
    const nWords = name.split(/\s+/).filter(Boolean);
    const overlap = qWords.filter(w => nWords.includes(w)).length;
    score += overlap * 20;

    if (name.startsWith(q) || q.startsWith(name)) score += 25;
    score += Math.max(0, 20 - Math.abs(name.length - q.length));

    if (score > bestScore) {
      bestScore = score;
      bestId = item.id;
    }
  }

  return bestScore >= 20 ? bestId : undefined;
}

function findClosestItemMatch(query: string, items: BrainDumpItem[], pendingOnly = false): string | undefined {
  const candidates = pendingOnly ? items.filter(i => i.status === 'pending') : items;
  if (!query || !candidates.length) return undefined;

  const q = lower(query);
  let bestId: string | undefined;
  let bestScore = -1;

  for (const item of candidates) {
    const name = lower(item.content);
    if (!name) continue;

    if (name === q) return item.id;

    let score = 0;
    if (name.includes(q) || q.includes(name)) score += 100;

    const qWords = q.split(/\s+/).filter(Boolean);
    const iWords = name.split(/\s+/).filter(Boolean);
    const overlap = qWords.filter(w => iWords.includes(w)).length;
    score += overlap * 20;

    score += Math.max(0, 25 - Math.abs(name.length - q.length));

    if (score > bestScore) {
      bestScore = score;
      bestId = item.id;
    }
  }

  return bestScore >= 20 ? bestId : undefined;
}

function resolveMonthKey(input?: string, fallbackISO?: string): string {
  if (input && /^\d{4}-\d{2}$/.test(input)) return input;
  const date = fallbackISO ? new Date(fallbackISO) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function normalizeMeta(meta: any): ParsedItemMetaV2 {
  if (!meta || typeof meta !== 'object') return {};

  const normalized: ParsedItemMetaV2 = {
    title: typeof meta.title === 'string' ? normalizeWhitespace(meta.title) : undefined,
    date: typeof meta.date === 'string' ? meta.date : undefined,
    dateTime: typeof meta.dateTime === 'string' ? meta.dateTime : undefined,
    start: typeof meta.start === 'string' ? meta.start : undefined,
    end: typeof meta.end === 'string' ? meta.end : undefined,
    when: typeof meta.when === 'string' ? meta.when as ParsedItemMetaV2['when'] : undefined,

    tags: safeArrayStrings(meta.tags),
    quantity: typeof meta.quantity === 'string' ? normalizeWhitespace(meta.quantity) : undefined,
    priority: isValidPriority(meta.priority) ? meta.priority : undefined,
    hideFromCalendar: typeof meta.hideFromCalendar === 'boolean' ? meta.hideFromCalendar : undefined,

    shoppingCategory: isValidShoppingCategory(meta.shoppingCategory) ? meta.shoppingCategory : undefined,

    amount: sanitizeNumber(meta.amount),
    currency: typeof meta.currency === 'string' ? normalizeWhitespace(meta.currency) : undefined,

    financeType: isValidFinanceType(meta.financeType) ? meta.financeType : undefined,
    paymentMethod: typeof meta.paymentMethod === 'string' ? normalizeWhitespace(meta.paymentMethod) : undefined,
    toWallet: typeof meta.toWallet === 'string' ? normalizeWhitespace(meta.toWallet) : undefined,
    budgetCategory: typeof meta.budgetCategory === 'string' ? normalizeWhitespace(meta.budgetCategory) : undefined,
    commodity: typeof meta.commodity === 'string' ? normalizeWhitespace(meta.commodity) : undefined,
    subcommodity: typeof meta.subcommodity === 'string' ? normalizeWhitespace(meta.subcommodity) : undefined,
    merchant: typeof meta.merchant === 'string' ? normalizeWhitespace(meta.merchant) : undefined,

    durationMinutes: sanitizeNumber(meta.durationMinutes),
    skillName: typeof meta.skillName === 'string' ? normalizeWhitespace(meta.skillName) : undefined,
    skillId: typeof meta.skillId === 'string' ? normalizeWhitespace(meta.skillId) : undefined,

    progress: sanitizeNumber(meta.progress),
    progressNotes: typeof meta.progressNotes === 'string' ? normalizeWhitespace(meta.progressNotes) : undefined,

    parentTodoId: typeof meta.parentTodoId === 'string' ? normalizeWhitespace(meta.parentTodoId) : undefined,
    childTodoIds: safeArrayStrings(meta.childTodoIds),
    deepWorkParent: typeof meta.deepWorkParent === 'boolean' ? meta.deepWorkParent : undefined,
    deepWorkPlanId: typeof meta.deepWorkPlanId === 'string' ? normalizeWhitespace(meta.deepWorkPlanId) : undefined,
    deepWorkStatus: typeof meta.deepWorkStatus === 'string' ? normalizeWhitespace(meta.deepWorkStatus) as ParsedItemMetaV2['deepWorkStatus'] : undefined,
    deepWorkNextAction: typeof meta.deepWorkNextAction === 'string' ? normalizeWhitespace(meta.deepWorkNextAction) : undefined,
    deepWorkFinalOutput: typeof meta.deepWorkFinalOutput === 'string' ? normalizeWhitespace(meta.deepWorkFinalOutput) : undefined,
    deepWorkSessionEstimateMinutes: sanitizeNumber(meta.deepWorkSessionEstimateMinutes),
    deepWorkBlockerCheck: typeof meta.deepWorkBlockerCheck === 'string' ? normalizeWhitespace(meta.deepWorkBlockerCheck) : undefined,
    deepWorkBlockerStatus: typeof meta.deepWorkBlockerStatus === 'string' ? normalizeWhitespace(meta.deepWorkBlockerStatus) as ParsedItemMetaV2['deepWorkBlockerStatus'] : undefined,
    deepWorkCompletionMode: typeof meta.deepWorkCompletionMode === 'string' ? normalizeWhitespace(meta.deepWorkCompletionMode) as ParsedItemMetaV2['deepWorkCompletionMode'] : undefined,
    deepWorkStepIndex: sanitizeNumber(meta.deepWorkStepIndex),
    deepWorkStepCount: sanitizeNumber(meta.deepWorkStepCount),
    deepWorkGeneratedAt: typeof meta.deepWorkGeneratedAt === 'string' ? normalizeWhitespace(meta.deepWorkGeneratedAt) : undefined,
    deepWorkAcceptedAt: typeof meta.deepWorkAcceptedAt === 'string' ? normalizeWhitespace(meta.deepWorkAcceptedAt) : undefined,
    deepWorkDismissedAt: typeof meta.deepWorkDismissedAt === 'string' ? normalizeWhitespace(meta.deepWorkDismissedAt) : undefined,
    deepWorkReason: typeof meta.deepWorkReason === 'string' ? normalizeWhitespace(meta.deepWorkReason) : undefined,
    subtasks: safeArrayStrings(meta.subtasks),

    savingGoalId: typeof meta.savingGoalId === 'string' ? normalizeWhitespace(meta.savingGoalId) : undefined,
    savingGoalName: typeof meta.savingGoalName === 'string' ? normalizeWhitespace(meta.savingGoalName) : undefined,
    dedicatedWalletId: typeof meta.dedicatedWalletId === 'string' ? normalizeWhitespace(meta.dedicatedWalletId) : undefined,
    dedicatedWalletName: typeof meta.dedicatedWalletName === 'string' ? normalizeWhitespace(meta.dedicatedWalletName) : undefined,
    savedAmount: sanitizeNumber(meta.savedAmount),

    isRoutine: typeof meta.isRoutine === 'boolean' ? meta.isRoutine : undefined,
    routineInterval: typeof meta.routineInterval === 'string'
      ? meta.routineInterval as ParsedItemMetaV2['routineInterval']
      : undefined,
    routineDaysOfWeek: safeArrayNumbers(meta.routineDaysOfWeek),
    routineDaysOfMonth: safeArrayNumbers(meta.routineDaysOfMonth),
    routineMonthsOfYear: safeArrayNumbers(meta.routineMonthsOfYear),
    recurrenceDays: sanitizeNumber(meta.recurrenceDays),
    targetDay: typeof meta.targetDay === 'string' ? normalizeWhitespace(meta.targetDay) : undefined,
  };

  if (typeof normalized.progress === 'number') {
    normalized.progress = Math.max(0, Math.min(100, normalized.progress));
  }

  return stripUndefined(normalized);
}

const INTENT_PROMPT_V2 = `
You are STAGE 1 of a structured parser for a personal productivity + finance app.

Your task:
- infer the user's intended action(s)
- infer the target feature/entity
- produce a concise canonical summary for later extraction

Output MUST be a JSON ARRAY.

Allowed actions:
- create_item
- update_item
- complete_item
- delete_item
- create_skill
- update_skill
- create_wallet
- update_wallet
- create_theme
- update_theme
- transfer_money
- add_saving_funds
- query_only
- unknown

Allowed entityType:
- todo
- shopping
- note
- event
- finance
- journal
- skill_log
- skill
- wallet
- theme
- saving_goal
- unknown

Rules:
1. One action object per distinct action.
2. New task/note/shopping/finance/journal/skill log => create_item.
3. Mark existing task/routine done => complete_item.
4. Edit existing data => update_item / update_skill / update_wallet / update_theme.
5. Delete existing data => delete_item.
6. Create new skill target/master entry => create_skill.
7. Create new wallet/account => create_wallet.
8. Set monthly theme => create_theme.
9. Move money between own wallets/accounts => transfer_money.
10. Add money to existing saving goal => add_saving_funds.
11. Pure question only => query_only.
12. Never invent ids.
13. If ambiguous, set needsReview=true and lower confidence.
14. CRITICAL RULE FOR MULTIPLICITY: Return EXACTLY ONE object in the array for a single logical input. Do NOT split a single transaction or thought into multiple array elements. A single transaction must result in exactly 1 array item. Only return multiple objects if the user explicitly listed multiple separate things.

Entity hints:
- todo = focus/task/routine action
- shopping = planned purchase, errand, shopping list, saving goal target
- finance = already happened transaction, income, expense, transfer, saving funding
- journal = diary/feelings/recap
- skill_log = practice/training/study session entry with duration
- skill = skill master entry
- wallet = wallet/account master entry
- theme = monthly theme/focus
`;

const FEATURE_PROMPT_BASE = `
You are STAGE 2 of a structured parser.

You receive:
- original user text
- stage 1 classification
- app context

You must output a JSON ARRAY with detailed action payloads.

Global rules:
- amount must be number only
- date should be YYYY-MM-DD if day known
- monthKey should be YYYY-MM
- durationMinutes must be in minutes
- tags max 2
- never invent ids
- if unsure, set needsReview=true
- confidence must be low|medium|high
- output exactly one result for one atomic user entry; only return multiple results when the text clearly contains multiple distinct entries
- never repeat the same result to express certainty

Routine rules:
- Explicit recurring phrases should populate:
  isRoutine, routineInterval, routineDaysOfWeek, routineDaysOfMonth, routineMonthsOfYear, recurrenceDays
- recurring shopping => shoppingCategory=routine
- explicit saving target => shoppingCategory=saving

Finance rules:
- expense = already spent
- income = already received
- transfer = moving money between own wallets
- saving = adding money to an existing saving goal
- paymentMethod = source wallet
- toWallet = destination wallet
${PARSER_SIGNAL_GUIDANCE}

Journal rules:
- if no date is specified, default to today

Skill log rules:
- content should be cleaned summary, not raw sentence

Deep Work Transformer rules:
- If a TODO is abstract or multi-step (summary/research/plan/design/build/implement/audit/write/prepare), include payload.meta.subtasks with 3-5 concrete action steps.
- Do not add subtasks for concrete errands, payments, simple calls/messages, or already checklist-like input.
- Subtasks should be user-facing next actions, not generic placeholders.
`;

const stage1Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING },
      entityType: { type: Type.STRING },
      content: { type: Type.STRING },
      targetText: { type: Type.STRING },
      confidence: { type: Type.STRING },
      needsReview: { type: Type.BOOLEAN },
      reviewReason: { type: Type.STRING }
    },
    required: ['action', 'entityType', 'confidence', 'needsReview']
  }
};

const stage2Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING },
      entityType: { type: Type.STRING },
      content: { type: Type.STRING },
      targetText: { type: Type.STRING },
      confidence: { type: Type.STRING },
      needsReview: { type: Type.BOOLEAN },
      reviewReason: { type: Type.STRING },
      entityRefs: {
        type: Type.OBJECT,
        properties: {
          itemId: { type: Type.STRING },
          itemName: { type: Type.STRING },
          walletId: { type: Type.STRING },
          walletName: { type: Type.STRING },
          toWalletId: { type: Type.STRING },
          toWalletName: { type: Type.STRING },
          skillId: { type: Type.STRING },
          skillName: { type: Type.STRING },
          savingGoalId: { type: Type.STRING },
          savingGoalName: { type: Type.STRING },
          themeMonthKey: { type: Type.STRING }
        }
      },
      payload: {
        type: Type.OBJECT,
        properties: {
          itemType: { type: Type.STRING },
          status: { type: Type.STRING },
          content: { type: Type.STRING },

          name: { type: Type.STRING },
          walletType: { type: Type.STRING },
          initialBalance: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          isDebtAccount: { type: Type.BOOLEAN },

          period: { type: Type.STRING },
          targetHours: { type: Type.NUMBER },
          targetMinutes: { type: Type.NUMBER },
          monthKey: { type: Type.STRING },

          amount: { type: Type.NUMBER },
          fromWallet: { type: Type.STRING },
          toWallet: { type: Type.STRING },
          note: { type: Type.STRING },

          question: { type: Type.STRING },
          scope: { type: Type.STRING },

          match: {
            type: Type.OBJECT,
            properties: {
              itemId: { type: Type.STRING },
              itemName: { type: Type.STRING },
              skillId: { type: Type.STRING },
              skillName: { type: Type.STRING },
              walletId: { type: Type.STRING },
              walletName: { type: Type.STRING }
            }
          },

          changes: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              status: { type: Type.STRING },
              priority: { type: Type.STRING },
              date: { type: Type.STRING },
              start: { type: Type.STRING },
              end: { type: Type.STRING },
              hideFromCalendar: { type: Type.BOOLEAN },
              amount: { type: Type.NUMBER },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              shoppingCategory: { type: Type.STRING },
              financeType: { type: Type.STRING },
              paymentMethod: { type: Type.STRING },
              toWallet: { type: Type.STRING },
              budgetCategory: { type: Type.STRING },
              commodity: { type: Type.STRING },
              subcommodity: { type: Type.STRING },
              merchant: { type: Type.STRING },
              quantity: { type: Type.STRING },
              progress: { type: Type.NUMBER },
              progressNotes: { type: Type.STRING },
              parentTodoId: { type: Type.STRING },
              childTodoIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              deepWorkParent: { type: Type.BOOLEAN },
              deepWorkPlanId: { type: Type.STRING },
              deepWorkStatus: { type: Type.STRING },
              deepWorkNextAction: { type: Type.STRING },
              deepWorkFinalOutput: { type: Type.STRING },
              deepWorkSessionEstimateMinutes: { type: Type.NUMBER },
              deepWorkBlockerCheck: { type: Type.STRING },
              deepWorkBlockerStatus: { type: Type.STRING },
              deepWorkCompletionMode: { type: Type.STRING },
              deepWorkStepIndex: { type: Type.NUMBER },
              deepWorkStepCount: { type: Type.NUMBER },
              deepWorkGeneratedAt: { type: Type.STRING },
              deepWorkReason: { type: Type.STRING },
              subtasks: { type: Type.ARRAY, items: { type: Type.STRING } },
              isRoutine: { type: Type.BOOLEAN },
              routineInterval: { type: Type.STRING },
              routineDaysOfWeek: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              routineDaysOfMonth: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              routineMonthsOfYear: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              recurrenceDays: { type: Type.NUMBER },
              targetDay: { type: Type.STRING }
            }
          },

          meta: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              date: { type: Type.STRING },
              dateTime: { type: Type.STRING },
              start: { type: Type.STRING },
              end: { type: Type.STRING },
              when: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              quantity: { type: Type.STRING },
              priority: { type: Type.STRING },
              hideFromCalendar: { type: Type.BOOLEAN },

              shoppingCategory: { type: Type.STRING },

              amount: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              financeType: { type: Type.STRING },
              paymentMethod: { type: Type.STRING },
              toWallet: { type: Type.STRING },
              budgetCategory: { type: Type.STRING },
              commodity: { type: Type.STRING },
              subcommodity: { type: Type.STRING },
              merchant: { type: Type.STRING },

              progress: { type: Type.NUMBER },
              progressNotes: { type: Type.STRING },

              parentTodoId: { type: Type.STRING },
              childTodoIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              deepWorkParent: { type: Type.BOOLEAN },
              deepWorkPlanId: { type: Type.STRING },
              deepWorkStatus: { type: Type.STRING },
              deepWorkNextAction: { type: Type.STRING },
              deepWorkFinalOutput: { type: Type.STRING },
              deepWorkSessionEstimateMinutes: { type: Type.NUMBER },
              deepWorkBlockerCheck: { type: Type.STRING },
              deepWorkBlockerStatus: { type: Type.STRING },
              deepWorkCompletionMode: { type: Type.STRING },
              deepWorkStepIndex: { type: Type.NUMBER },
              deepWorkStepCount: { type: Type.NUMBER },
              deepWorkGeneratedAt: { type: Type.STRING },
              deepWorkReason: { type: Type.STRING },
              subtasks: { type: Type.ARRAY, items: { type: Type.STRING } },

              savingGoalId: { type: Type.STRING },
              savingGoalName: { type: Type.STRING },
              dedicatedWalletId: { type: Type.STRING },
              dedicatedWalletName: { type: Type.STRING },
              savedAmount: { type: Type.NUMBER },

              isRoutine: { type: Type.BOOLEAN },
              routineInterval: { type: Type.STRING },
              routineDaysOfWeek: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              routineDaysOfMonth: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              routineMonthsOfYear: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              recurrenceDays: { type: Type.NUMBER },
              targetDay: { type: Type.STRING }
            }
          }
        }
      }
    },
    required: ['action', 'entityType', 'confidence', 'needsReview']
  }
};

function safeParseJSON(text: string) {
  if (!text) throw new Error("Empty JSON response");
  const parsed = parseJsonResponse<any>(text, undefined as any);
  if (parsed === undefined) {
    throw new Error(`Failed to parse JSON response (length: ${text.length})`);
  }
  return parsed;
}

async function parseStage1(
  ai: NonNullable<ReturnType<typeof createGeminiClient>>,
  model: string,
  text: string,
  ctx: ParserContext
): Promise<ParserResultV2[]> {
  const response = await withAiRetry(() => ai.models.generateContent({
    model,
    contents: [
      INTENT_PROMPT_V2,
      `Context:\n${buildContextText(ctx)}`,
      `User input:\n${text}`,
      `Examples:
- "beli susu besok 12rb" => create_item + shopping
- "makan sahur 10rb cash" => create_item + finance
- "buat skill English target 5 jam per minggu" => create_skill + skill
- "buat wallet OVO saldo awal 15000" => create_wallet + wallet
- "tema bulan ini discipline" => create_theme + theme
- "selesaikan briefing weekly" => complete_item + todo
- "hapus note github token" => delete_item + note
- "ubah bayar parkiran jadi tiap senin jumat" => update_item
- "transfer 250rb dari BCA ke Cash" => transfer_money
- "tabung 500rb ke Emergency Savings dari BCA" => add_saving_funds`
    ].join('\n\n'),
    config: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: stage1Schema
    }
  }));

  const parsed = safeParseJSON(response.text);
  const arr = Array.isArray(parsed) ? parsed : [parsed];

  return arr.map((item: any): ParserResultV2 => ({
    action: sanitizeAction(item.action),
    entityType: sanitizeEntityType(item.entityType),
    content: typeof item.content === 'string' ? normalizeWhitespace(item.content) : undefined,
    targetText: typeof item.targetText === 'string' ? normalizeWhitespace(item.targetText) : undefined,
    confidence: coerceConfidence(item.confidence),
    needsReview: !!item.needsReview,
    reviewReason: typeof item.reviewReason === 'string' ? normalizeWhitespace(item.reviewReason) : undefined,
  }));
}

function buildFeaturePrompt(
  text: string,
  stage1Results: ParserResultV2[],
  ctx: ParserContext,
  customPrompt?: string
): string {
  return [
    FEATURE_PROMPT_BASE,
    DEFAULT_PROMPT ? `Legacy parser guidance:\n${DEFAULT_PROMPT}` : '',
    customPrompt ? `Custom parser guidance:\n${customPrompt}` : '',
    `Context:\n${buildContextText(ctx)}`,
    `Stage 1 results:\n${JSON.stringify(stage1Results, null, 2)}`,
    `Original user text:\n${text}`,
    `
Extraction rules by action:

Multiplicity rules:
- One atomic input should produce exactly one structured result.
- Return multiple results only for clearly separated distinct entries (new lines, semicolons, or explicit “and/dan” with separate amounts/actions).
- Never duplicate identical finance/transaction results; if the same expense is mentioned once, output it once.

1) create_item
- itemType must be one of TODO, SHOPPING, NOTE, EVENT, FINANCE, JOURNAL
- future unpaid purchase => SHOPPING
- completed expense/income => FINANCE
- diary/feeling/recap => JOURNAL
- saving target like "nabung buat laptop 15jt" => SHOPPING + shoppingCategory=saving
- IMPORTANT FOR FINANCE/SHOPPING: For 'budgetCategory', do NOT lazily default to "finance" or a generic term. Intelligently deduce the most appropriate category based on context (e.g., 'makan', 'kopi', 'gofood' -> Food; 'bensin', 'grab' -> Transportation) AND then strictly use the EXACT ID from the 'Known budget categories' list.
- For paymentMethod/toWallet find the exact ID too. Do not make up arbitrary wallets or categories.
- For abstract TODOs, include meta.subtasks with 3-5 concrete steps so the app can save an optional nested todo plan.

2) update_item
- fill payload.match.itemName if exact id unknown
- only include changed fields in payload.changes

3) complete_item
- identify the item to mark done
- use payload.match.itemName if id unknown

4) delete_item
- identify the item to delete
- use payload.match.itemName if id unknown

5) create_skill
- payload.name = skill name
- targetMinutes or targetHours = target
- period = daily|weekly|monthly

6) create_wallet
- payload.name = wallet name
- payload.walletType = cash|bank|ewallet|cc|investment|other
- payload.initialBalance when present

7) create_theme
- payload.monthKey = YYYY-MM
- payload.content = theme content only
- if month omitted use current month

8) transfer_money
- payload.amount
- payload.fromWallet
- payload.toWallet
- payload.date if specified
- payload.note optional

9) add_saving_funds
- payload.amount
- payload.savingGoalName
- payload.fromWallet
- payload.date if specified

Date rules:
- "today/hari ini" => today
- "tomorrow/besok" => tomorrow
- "yesterday/kemarin" => yesterday
- explicit weekday => next occurrence unless context strongly says past
- explicit date => specific_date

Routine rules:
- daily = every day / tiap hari / harian
- weekly = every monday / tiap senin / mon-fri
- monthly = tiap tanggal 1
- yearly = tiap maret / every march
- "setiap 3 hari" => recurrenceDays=3
`
  ].filter(Boolean).join('\n\n');
}

async function parseStage2(
  ai: NonNullable<ReturnType<typeof createGeminiClient>>,
  model: string,
  text: string,
  stage1Results: ParserResultV2[],
  ctx: ParserContext,
  customPrompt?: string
): Promise<ParserResultV2[]> {
  const response = await withAiRetry(() => ai.models.generateContent({
    model,
    contents: buildFeaturePrompt(text, stage1Results, ctx, customPrompt),
    config: {
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: stage2Schema
    }
  }));

  const parsed = safeParseJSON(response.text);
  const arr = Array.isArray(parsed) ? parsed : [parsed];

  return arr.map((item: any): ParserResultV2 => ({
    action: sanitizeAction(item.action),
    entityType: sanitizeEntityType(item.entityType),
    content: typeof item.content === 'string' ? normalizeWhitespace(item.content) : undefined,
    targetText: typeof item.targetText === 'string' ? normalizeWhitespace(item.targetText) : undefined,
    confidence: coerceConfidence(item.confidence),
    needsReview: !!item.needsReview,
    reviewReason: typeof item.reviewReason === 'string' ? normalizeWhitespace(item.reviewReason) : undefined,
    entityRefs: item.entityRefs && typeof item.entityRefs === 'object'
      ? stripUndefined({
          itemId: typeof item.entityRefs.itemId === 'string' ? normalizeWhitespace(item.entityRefs.itemId) : undefined,
          itemName: typeof item.entityRefs.itemName === 'string' ? normalizeWhitespace(item.entityRefs.itemName) : undefined,
          walletId: typeof item.entityRefs.walletId === 'string' ? normalizeWhitespace(item.entityRefs.walletId) : undefined,
          walletName: typeof item.entityRefs.walletName === 'string' ? normalizeWhitespace(item.entityRefs.walletName) : undefined,
          toWalletId: typeof item.entityRefs.toWalletId === 'string' ? normalizeWhitespace(item.entityRefs.toWalletId) : undefined,
          toWalletName: typeof item.entityRefs.toWalletName === 'string' ? normalizeWhitespace(item.entityRefs.toWalletName) : undefined,
          skillId: typeof item.entityRefs.skillId === 'string' ? normalizeWhitespace(item.entityRefs.skillId) : undefined,
          skillName: typeof item.entityRefs.skillName === 'string' ? normalizeWhitespace(item.entityRefs.skillName) : undefined,
          savingGoalId: typeof item.entityRefs.savingGoalId === 'string' ? normalizeWhitespace(item.entityRefs.savingGoalId) : undefined,
          savingGoalName: typeof item.entityRefs.savingGoalName === 'string' ? normalizeWhitespace(item.entityRefs.savingGoalName) : undefined,
          themeMonthKey: typeof item.entityRefs.themeMonthKey === 'string' ? normalizeWhitespace(item.entityRefs.themeMonthKey) : undefined,
        })
      : undefined,
    payload: item.payload && typeof item.payload === 'object' ? item.payload : undefined
  }));
}

function resolveAndValidateResults(stage2Results: ParserResultV2[], ctx: ParserContext, rawText = ''): ParserResultV2[] {
  return stage2Results.map((result) => {
    const resolved: ParserResultV2 = {
      ...result,
      action: sanitizeAction(result.action),
      entityType: sanitizeEntityType(result.entityType),
      confidence: coerceConfidence(result.confidence),
      needsReview: !!result.needsReview,
      entityRefs: { ...(result.entityRefs || {}) },
      payload: result.payload ? { ...(result.payload as any) } : undefined
    };

    if (resolved.action === 'create_item') {
      const payload = (resolved.payload || {}) as Partial<CreateItemPayload>;
      const itemType = isValidItemType(payload.itemType)
        ? payload.itemType
        : mapEntityTypeToItemType(resolved.entityType);

      let meta = normalizeMeta(payload.meta || {});
      const content = normalizeWhitespace(payload.content || resolved.content || '');

      meta = enrichFinanceMetaFromText({
        rawText,
        content,
        itemType,
        meta,
        availableWallets: ctx.availableWallets,
        availableBudgetRules: ctx.availableBudgetRules,
      });

      if (itemType === 'SHOPPING' && !meta.shoppingCategory) {
        meta.shoppingCategory = meta.isRoutine ? 'routine' : 'not_urgent';
      }
      if (itemType === 'JOURNAL' && !meta.date) {
        meta.date = ctx.currentDateISO;
      }
      if (itemType === 'FINANCE' && !meta.financeType) {
        meta.financeType = 'expense';
      }
      if ((itemType === 'TODO' || itemType === 'EVENT') && !meta.priority) {
        meta.priority = 'normal';
      }

      if (meta.paymentMethod) {
        const walletId = findClosestMatch(meta.paymentMethod, ctx.availableWallets);
        if (walletId) meta.paymentMethod = walletId;
      }
      if (meta.toWallet) {
        const walletId = findClosestMatch(meta.toWallet, ctx.availableWallets);
        if (walletId) meta.toWallet = walletId;
      }
      if (itemType === 'FINANCE' && meta.financeType !== 'transfer' && meta.financeType !== 'saving') {
        delete meta.toWallet;
      }
      if (meta.budgetCategory) {
        const bgId = findClosestMatch(meta.budgetCategory, ctx.availableBudgetRules);
        if (bgId) meta.budgetCategory = bgId;
      }
      if (meta.skillName && !meta.skillId) {
        const skillId = findClosestMatch(meta.skillName, ctx.availableSkills);
        if (skillId) meta.skillId = skillId;
      }
      if (meta.savingGoalName && !meta.savingGoalId) {
        const savingGoals = ctx.existingItems
          .filter(i => i.type === ItemType.SHOPPING && i.meta?.shoppingCategory === 'saving')
          .map(i => ({ id: i.id, name: i.content }));
        const goalId = findClosestMatch(meta.savingGoalName, savingGoals);
        if (goalId) meta.savingGoalId = goalId;
      }

      resolved.payload = {
        itemType,
        content: content || 'Untitled',
        status: payload.status === 'done' || payload.status === 'pending' ? payload.status : undefined,
        meta
      } satisfies CreateItemPayload;

      resolved.content = content || 'Untitled';
      return resolved;
    }

    if (resolved.action === 'update_item') {
      const payload = (resolved.payload || {}) as UpdateItemPayload;
      const targetText = normalizeWhitespace(
        payload.match?.itemName ||
        resolved.targetText ||
        resolved.content ||
        resolved.entityRefs?.itemName ||
        ''
      );
      const targetId = payload.match?.itemId ||
        resolved.entityRefs?.itemId ||
        findClosestItemMatch(targetText, ctx.existingItems, false);

      const changes = payload.changes || {};
      const normalizedChanges = enrichFinanceMetaFromText({
        rawText,
        content: `${targetText} ${typeof changes.content === 'string' ? changes.content : ''}`,
        itemType: resolved.entityType === 'finance' ? 'FINANCE' : resolved.entityType === 'shopping' ? 'SHOPPING' : undefined,
        meta: stripUndefined({
          title: typeof changes.title === 'string' ? normalizeWhitespace(changes.title) : undefined,
          content: typeof changes.content === 'string' ? normalizeWhitespace(changes.content) : undefined,
          status: changes.status === 'done' || changes.status === 'pending' ? changes.status : undefined,
          priority: isValidPriority(changes.priority) ? changes.priority : undefined,
          date: typeof changes.date === 'string' ? changes.date : undefined,
          start: typeof changes.start === 'string' ? changes.start : undefined,
          end: typeof changes.end === 'string' ? changes.end : undefined,
          hideFromCalendar: typeof changes.hideFromCalendar === 'boolean' ? changes.hideFromCalendar : undefined,
          amount: sanitizeNumber(changes.amount),
          tags: safeArrayStrings(changes.tags),
          shoppingCategory: isValidShoppingCategory(changes.shoppingCategory) ? changes.shoppingCategory : undefined,
          financeType: isValidFinanceType(changes.financeType) ? changes.financeType : undefined,
          paymentMethod: typeof changes.paymentMethod === 'string' ? normalizeWhitespace(changes.paymentMethod) : undefined,
          toWallet: typeof changes.toWallet === 'string' ? normalizeWhitespace(changes.toWallet) : undefined,
          budgetCategory: typeof changes.budgetCategory === 'string' ? normalizeWhitespace(changes.budgetCategory) : undefined,
          commodity: typeof changes.commodity === 'string' ? normalizeWhitespace(changes.commodity) : undefined,
          subcommodity: typeof changes.subcommodity === 'string' ? normalizeWhitespace(changes.subcommodity) : undefined,
          merchant: typeof changes.merchant === 'string' ? normalizeWhitespace(changes.merchant) : undefined,
          quantity: typeof changes.quantity === 'string' ? normalizeWhitespace(changes.quantity) : undefined,
          durationMinutes: sanitizeNumber(changes.durationMinutes),
          skillName: typeof changes.skillName === 'string' ? normalizeWhitespace(changes.skillName) : undefined,
          progress: sanitizeNumber(changes.progress),
          progressNotes: typeof changes.progressNotes === 'string' ? normalizeWhitespace(changes.progressNotes) : undefined,
          parentTodoId: typeof changes.parentTodoId === 'string' ? normalizeWhitespace(changes.parentTodoId) : undefined,
          childTodoIds: safeArrayStrings(changes.childTodoIds),
          deepWorkParent: typeof changes.deepWorkParent === 'boolean' ? changes.deepWorkParent : undefined,
          deepWorkPlanId: typeof changes.deepWorkPlanId === 'string' ? normalizeWhitespace(changes.deepWorkPlanId) : undefined,
          deepWorkStatus: typeof changes.deepWorkStatus === 'string' ? normalizeWhitespace(changes.deepWorkStatus) as ParsedItemMetaV2['deepWorkStatus'] : undefined,
          deepWorkNextAction: typeof changes.deepWorkNextAction === 'string' ? normalizeWhitespace(changes.deepWorkNextAction) : undefined,
          deepWorkFinalOutput: typeof changes.deepWorkFinalOutput === 'string' ? normalizeWhitespace(changes.deepWorkFinalOutput) : undefined,
          deepWorkSessionEstimateMinutes: sanitizeNumber(changes.deepWorkSessionEstimateMinutes),
          deepWorkBlockerCheck: typeof changes.deepWorkBlockerCheck === 'string' ? normalizeWhitespace(changes.deepWorkBlockerCheck) : undefined,
          deepWorkBlockerStatus: typeof changes.deepWorkBlockerStatus === 'string' ? normalizeWhitespace(changes.deepWorkBlockerStatus) as ParsedItemMetaV2['deepWorkBlockerStatus'] : undefined,
          deepWorkCompletionMode: typeof changes.deepWorkCompletionMode === 'string' ? normalizeWhitespace(changes.deepWorkCompletionMode) as ParsedItemMetaV2['deepWorkCompletionMode'] : undefined,
          deepWorkStepIndex: sanitizeNumber(changes.deepWorkStepIndex),
          deepWorkStepCount: sanitizeNumber(changes.deepWorkStepCount),
          deepWorkGeneratedAt: typeof changes.deepWorkGeneratedAt === 'string' ? normalizeWhitespace(changes.deepWorkGeneratedAt) : undefined,
          deepWorkReason: typeof changes.deepWorkReason === 'string' ? normalizeWhitespace(changes.deepWorkReason) : undefined,
          isRoutine: typeof changes.isRoutine === 'boolean' ? changes.isRoutine : undefined,
          routineInterval: typeof changes.routineInterval === 'string' ? changes.routineInterval as any : undefined,
          routineDaysOfWeek: safeArrayNumbers(changes.routineDaysOfWeek),
          routineDaysOfMonth: safeArrayNumbers(changes.routineDaysOfMonth),
          routineMonthsOfYear: safeArrayNumbers(changes.routineMonthsOfYear),
          recurrenceDays: sanitizeNumber(changes.recurrenceDays),
          targetDay: typeof changes.targetDay === 'string' ? normalizeWhitespace(changes.targetDay) : undefined
        }) as ParsedItemMetaV2,
        availableWallets: ctx.availableWallets,
        availableBudgetRules: ctx.availableBudgetRules,
      });

      if (normalizedChanges.paymentMethod) {
        const walletId = findClosestMatch(normalizedChanges.paymentMethod, ctx.availableWallets);
        if (walletId) normalizedChanges.paymentMethod = walletId;
      }
      if (normalizedChanges.toWallet) {
        const walletId = findClosestMatch(normalizedChanges.toWallet, ctx.availableWallets);
        if (walletId) normalizedChanges.toWallet = walletId;
      }
      if (normalizedChanges.budgetCategory) {
        const bgId = findClosestMatch(normalizedChanges.budgetCategory, ctx.availableBudgetRules);
        if (bgId) normalizedChanges.budgetCategory = bgId;
      }

      resolved.entityRefs = stripUndefined({
        ...(resolved.entityRefs || {}),
        itemId: targetId,
        itemName: targetText || undefined
      });

      resolved.payload = {
        match: {
          itemId: targetId,
          itemName: targetText || undefined
        },
        changes: normalizedChanges
      } satisfies UpdateItemPayload;

      if (!targetId) {
        resolved.needsReview = true;
        resolved.reviewReason = resolved.reviewReason || 'Could not confidently match the target item to update.';
        resolved.confidence = 'low';
      }

      return resolved;
    }

    if (resolved.action === 'complete_item') {
      const payload = (resolved.payload || {}) as CompleteItemPayload;
      const targetText = normalizeWhitespace(
        payload.match?.itemName ||
        resolved.targetText ||
        resolved.content ||
        resolved.entityRefs?.itemName ||
        ''
      );
      const targetId = payload.match?.itemId ||
        resolved.entityRefs?.itemId ||
        findClosestItemMatch(targetText, ctx.existingItems, true);

      resolved.entityRefs = stripUndefined({
        ...(resolved.entityRefs || {}),
        itemId: targetId,
        itemName: targetText || undefined
      });

      resolved.payload = {
        match: { itemId: targetId, itemName: targetText || undefined },
        completedAt: payload.completedAt || ctx.currentDateISO
      } satisfies CompleteItemPayload;

      if (!targetId) {
        resolved.needsReview = true;
        resolved.reviewReason = resolved.reviewReason || 'Could not confidently match the pending item to complete.';
        resolved.confidence = 'low';
      }

      return resolved;
    }

    if (resolved.action === 'delete_item') {
      const payload = (resolved.payload || {}) as DeleteItemPayload;
      const targetText = normalizeWhitespace(
        payload.match?.itemName ||
        resolved.targetText ||
        resolved.content ||
        resolved.entityRefs?.itemName ||
        ''
      );
      const targetId = payload.match?.itemId ||
        resolved.entityRefs?.itemId ||
        findClosestItemMatch(targetText, ctx.existingItems, false);

      resolved.entityRefs = stripUndefined({
        ...(resolved.entityRefs || {}),
        itemId: targetId,
        itemName: targetText || undefined
      });

      resolved.payload = {
        match: { itemId: targetId, itemName: targetText || undefined }
      } satisfies DeleteItemPayload;

      if (!targetId) {
        resolved.needsReview = true;
        resolved.reviewReason = resolved.reviewReason || 'Could not confidently match the target item to delete.';
        resolved.confidence = 'low';
      }

      return resolved;
    }

    if (resolved.action === 'create_skill') {
      const payload = (resolved.payload || {}) as CreateSkillPayload;
      const name = normalizeWhitespace(payload.name || resolved.content || '');
      const targetMinutes =
        sanitizeNumber(payload.targetMinutes) ??
        ((sanitizeNumber(payload.targetHours) || 0) > 0 ? sanitizeNumber(payload.targetHours)! * 60 : undefined);

      resolved.payload = stripUndefined({
        name: name || undefined,
        targetMinutes,
        targetHours: undefined,
        period: payload.period || 'weekly',
        tags: safeArrayStrings(payload.tags),
        notes: typeof payload.notes === 'string' ? normalizeWhitespace(payload.notes) : undefined
      }) as CreateSkillPayload;

      resolved.content = name || 'New Skill';

      if (!name) {
        resolved.needsReview = true;
        resolved.reviewReason = resolved.reviewReason || 'Skill name is missing.';
        resolved.confidence = 'low';
      }

      return resolved;
    }

    if (resolved.action === 'create_wallet') {
      const payload = (resolved.payload || {}) as CreateWalletPayload;
      const name = normalizeWhitespace(payload.name || resolved.content || '');
      const walletType = isValidWalletType(payload.walletType) ? payload.walletType : 'cash';

      resolved.payload = stripUndefined({
        name: name || undefined,
        walletType,
        initialBalance: sanitizeNumber(payload.initialBalance),
        currency: typeof payload.currency === 'string' ? normalizeWhitespace(payload.currency) : undefined,
        isDebtAccount: typeof payload.isDebtAccount === 'boolean' ? payload.isDebtAccount : undefined,
        notes: typeof payload.notes === 'string' ? normalizeWhitespace(payload.notes) : undefined
      }) as CreateWalletPayload;

      resolved.content = name || 'New Wallet';

      if (!name) {
        resolved.needsReview = true;
        resolved.reviewReason = resolved.reviewReason || 'Wallet name is missing.';
        resolved.confidence = 'low';
      }

      return resolved;
    }

    if (resolved.action === 'create_theme' || resolved.action === 'update_theme') {
      const payload = (resolved.payload || {}) as ThemePayload;
      const monthKey = resolveMonthKey(payload.monthKey || resolved.entityRefs?.themeMonthKey, ctx.currentDateISO);
      const content = normalizeWhitespace(payload.content || resolved.content || '');

      resolved.payload = {
        monthKey,
        content
      } satisfies ThemePayload;

      resolved.entityRefs = {
        ...(resolved.entityRefs || {}),
        themeMonthKey: monthKey
      };

      resolved.content = content || 'Untitled Theme';

      if (!content) {
        resolved.needsReview = true;
        resolved.reviewReason = resolved.reviewReason || 'Theme content is missing.';
        resolved.confidence = 'low';
      }

      return resolved;
    }

    if (resolved.action === 'transfer_money') {
      const payload = (resolved.payload || {}) as TransferMoneyPayload;
      const fromWallet = normalizeWhitespace(payload.fromWallet || resolved.entityRefs?.walletName || '');
      const toWallet = normalizeWhitespace(payload.toWallet || resolved.entityRefs?.toWalletName || '');
      const amount = sanitizeNumber(payload.amount);

      const fromWalletId = findClosestMatch(fromWallet, ctx.availableWallets);
      const toWalletId = findClosestMatch(toWallet, ctx.availableWallets);

      resolved.entityRefs = stripUndefined({
        ...(resolved.entityRefs || {}),
        walletId: fromWalletId,
        walletName: fromWallet || undefined,
        toWalletId,
        toWalletName: toWallet || undefined
      });

      resolved.payload = {
        amount,
        fromWallet: fromWalletId || fromWallet || undefined,
        toWallet: toWalletId || toWallet || undefined,
        date: typeof payload.date === 'string' ? payload.date : undefined,
        note: typeof payload.note === 'string' ? normalizeWhitespace(payload.note) : undefined
      } satisfies TransferMoneyPayload;

      if (!amount || !fromWallet || !toWallet) {
        resolved.needsReview = true;
        resolved.reviewReason = resolved.reviewReason || 'Transfer is missing amount, source wallet, or destination wallet.';
        resolved.confidence = 'low';
      }

      return resolved;
    }

    if (resolved.action === 'add_saving_funds') {
      const payload = (resolved.payload || {}) as AddSavingFundsPayload;
      const goalName = normalizeWhitespace(
        payload.savingGoalName ||
        resolved.entityRefs?.savingGoalName ||
        ''
      );
      const savingGoals = ctx.existingItems
        .filter(i => i.type === ItemType.SHOPPING && i.meta?.shoppingCategory === 'saving')
        .map(i => ({ id: i.id, name: i.content }));
      const goalId = payload.savingGoalId ||
        resolved.entityRefs?.savingGoalId ||
        findClosestMatch(goalName, savingGoals);

      const fromWallet = normalizeWhitespace(payload.fromWallet || resolved.entityRefs?.walletName || '');
      const fromWalletId = findClosestMatch(fromWallet, ctx.availableWallets);
      const amount = sanitizeNumber(payload.amount);

      resolved.entityRefs = stripUndefined({
        ...(resolved.entityRefs || {}),
        savingGoalId: goalId,
        savingGoalName: goalName || undefined,
        walletId: fromWalletId,
        walletName: fromWallet || undefined
      });

      resolved.payload = {
        savingGoalId: goalId,
        savingGoalName: goalName || undefined,
        amount,
        fromWallet: fromWalletId || fromWallet || undefined,
        date: typeof payload.date === 'string' ? payload.date : undefined,
        note: typeof payload.note === 'string' ? normalizeWhitespace(payload.note) : undefined,
        budgetCategory: typeof payload.budgetCategory === 'string' ? normalizeWhitespace(payload.budgetCategory) : undefined
      } satisfies AddSavingFundsPayload;

      if (resolved.payload.budgetCategory) {
        const bgId = findClosestMatch(resolved.payload.budgetCategory, ctx.availableBudgetRules);
        if (bgId) resolved.payload.budgetCategory = bgId;
      }

      if (!amount || !goalName) {
        resolved.needsReview = true;
        resolved.reviewReason = resolved.reviewReason || 'Saving fund action is missing amount or saving goal.';
        resolved.confidence = 'low';
      }

      return resolved;
    }

    return resolved;
  });
}

export const parsePro = async (
  text: string,
  existingTags: string[] = [],
  availableSkills: Skill[] = [],
  availableWallets: Wallet[] = [],
  availableBudgetRules: BudgetRule[] = [],
  existingItems: BrainDumpItem[] = [],
  customPrompt?: string,
  parsingModel?: string,
  retryCount = 0,
  onProgress?: (stage: 'stage1' | 'stage2') => void
): Promise<ParserResultV2[]> => {
  const localFinanceResults = parseLocalFinanceResults(text, {
    availableWallets,
    availableBudgetRules,
    existingItems,
  });
  if (localFinanceResults) {
    return localFinanceResults;
  }

  const apiKey = getGeminiKey();

  if (!apiKey) {
    return [{
      action: 'unknown',
      entityType: 'note',
      content: text,
      confidence: 'low',
      needsReview: true,
      reviewReason: 'Missing Gemini API key'
    }];
  }

  const ai = createGeminiClient(apiKey);
  if (!ai) {
    return [{
      action: 'unknown',
      entityType: 'note',
      content: text,
      confidence: 'low',
      needsReview: true,
      reviewReason: 'Missing Gemini API key'
    }];
  }
  const activeModel = parsingModel || DEFAULT_PRO_MODEL;
  const ctx = buildContext(existingTags, availableSkills, availableWallets, availableBudgetRules, existingItems);

  try {
    onProgress?.('stage1');
    const stage1 = await parseStage1(ai, activeModel, text, ctx);
    onProgress?.('stage2');
    const stage2 = await parseStage2(ai, activeModel, text, stage1, ctx, customPrompt);
    const resolved = resolveAndValidateResults(stage2, ctx, text);
    return resolved;
  } catch (error: any) {
    const status = error?.status || error?.response?.status;

    const isJsonError = error?.message?.includes('Failed to parse JSON') || error?.message?.includes('Empty JSON response');

    if (retryCount < 2 && (status === 429 || status >= 500 || isJsonError)) {
      const delay = Math.pow(2, retryCount) * 1000;
      await wait(delay);
      return parsePro(
        text,
        existingTags,
        availableSkills,
        availableWallets,
        availableBudgetRules,
        existingItems,
        customPrompt,
        parsingModel,
        retryCount + 1,
        onProgress
      );
    }

    console.error("Gemini Pro parsing failed:", error);

    return [{
      action: 'unknown',
      entityType: 'note',
      content: text,
      confidence: 'low',
      needsReview: true,
      reviewReason: error?.message || 'Unknown error occurred during pro parsing'
    }];
  }
};

export default parsePro;
