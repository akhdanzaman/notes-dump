export enum ItemType {
  TODO = 'TODO',
  SHOPPING = 'SHOPPING',
  NOTE = 'NOTE',
  EVENT = 'EVENT',
  FINANCE = 'FINANCE',
  JOURNAL = 'JOURNAL'
}

export type ShoppingCategory = 'urgent' | 'not_urgent' | 'routine' | 'saving';
export type FinanceType = 'expense' | 'income' | 'transfer' | 'saving';
export type Priority = 'low' | 'normal' | 'high';

export interface BudgetRule {
  id: string;
  name: string;
  percentage: number;
  color: string;
}

export interface BudgetConfig {
  monthlyIncome: number;
  rules: BudgetRule[];
}

export interface ParsingTask {
  id: string;
  text: string;
  status: 'pending' | 'failed' | 'success';
  stage?: 'stage1' | 'stage2' | 'legacy';
  error?: string;
  createdAt: number;
}

export interface AppSettings {
  defaultCollapsed: boolean;
  hideMoney: boolean;
  theme?: 'light' | 'dark';
  enableDailyInsight?: boolean;
  enableDraftReview?: boolean;
  notifyBehavior?: boolean;
  notifyInsights?: boolean;
  notifyReminders?: boolean;
  notificationMode?: 'sound' | 'vibrate' | 'both' | 'silent';
  persistentNotification?: boolean;
  parsingModel?: string;
  chatModel?: string;
  insightModel?: string;
  useProParser?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  color: string;
  created_at: string;
  weeklyTargetMinutes?: number;
}

export interface Wallet {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'ewallet' | 'cc';
  initialBalance: number;
  color: string;
}

export interface ItemMeta {
  date?: string;
  dateTime?: string;
  start?: string;
  end?: string;
  when?: 'today' | 'tomorrow' | 'yesterday' | 'next_weekday' | 'specific_date' | 'unspecified';

  tags?: string[];
  quantity?: string;
  shoppingCategory?: ShoppingCategory;
  recurrenceDays?: number;
  targetDay?: string;

  isRoutine?: boolean;
  routineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  routineDaysOfWeek?: number[];
  routineDaysOfMonth?: number[];
  routineMonthsOfYear?: number[];

  amount?: number;
  currency?: string;
  financeType?: FinanceType;
  paymentMethod?: string;
  toWallet?: string;
  budgetCategory?: string;
  commodity?: string;
  subcommodity?: string;
  merchant?: string;

  durationMinutes?: number;
  skillId?: string;
  skillName?: string;

  progress?: number;
  progressNotes?: string;

  savedAmount?: number;
  savingGoalId?: string;
  dedicatedWalletId?: string;

  lastGeneratedHistoryId?: string;
  priority?: Priority;
  parsingError?: string;
  hideFromCalendar?: boolean;

  // legacy compat
  intent?: string;
  targetId?: string;

  // parser review
  parserAction?: ParserAction;
  parserEntityType?: ParserEntityType;
  parserConfidence?: ParserConfidence;
  parserNeedsReview?: boolean;
  parserReviewReason?: string;
}

export interface BrainDumpItem {
  id: string;
  type: ItemType;
  content: string;
  status: 'pending' | 'done';
  created_at: string;
  completed_at?: string;
  meta: ItemMeta;
  isOptimistic?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface DbSchema {
  data: BrainDumpItem[];
  budgetConfig?: BudgetConfig;
  appSettings?: AppSettings;
  customPrompt?: string;
  skills?: Skill[];
  wallets?: Wallet[];
  monthlyThemes?: Record<string, string>;
  chatHistory?: ChatMessage[];
}

export interface GitHubFileResponse {
  content: string;
  sha: string;
  encoding: string;
}

export type Tab = 'summary' | 'plan' | 'library' | 'money' | 'calendar';
export type PlanSubTab = 'tasks' | 'shopping' | 'savings';
export type FocusSubTab = PlanSubTab;
export type LibrarySubTab = 'general' | 'skills' | 'journal';
export type NotesSubTab = LibrarySubTab;
export type SyncStatus = 'synced' | 'syncing' | 'saving' | 'error' | 'local';
export type MoneyView = 'transactions' | 'budget' | 'wallets';
export type SortOrder = 'newest' | 'oldest' | 'highest_amount' | 'lowest_amount';

/* =========================================================
   Native Parser V2 Types
   ========================================================= */

export type ParsedItemType =
  | 'TODO'
  | 'SHOPPING'
  | 'NOTE'
  | 'EVENT'
  | 'FINANCE'
  | 'JOURNAL';

export type ParsedWalletType = 'cash' | 'bank' | 'ewallet' | 'cc' | 'other';

export type ParserAction =
  | 'create_item'
  | 'update_item'
  | 'complete_item'
  | 'delete_item'
  | 'create_skill'
  | 'update_skill'
  | 'create_wallet'
  | 'update_wallet'
  | 'create_theme'
  | 'update_theme'
  | 'transfer_money'
  | 'add_saving_funds'
  | 'query_only'
  | 'unknown';

export type ParserEntityType =
  | 'todo'
  | 'shopping'
  | 'note'
  | 'event'
  | 'finance'
  | 'journal'
  | 'skill'
  | 'wallet'
  | 'theme'
  | 'saving_goal'
  | 'unknown';

export type ParserConfidence = 'low' | 'medium' | 'high';

export interface ParserEntityRefs {
  itemId?: string;
  itemName?: string;
  walletId?: string;
  walletName?: string;
  toWalletId?: string;
  toWalletName?: string;
  skillId?: string;
  skillName?: string;
  savingGoalId?: string;
  savingGoalName?: string;
  themeMonthKey?: string;
}

export interface ParsedItemMetaV2 {
  date?: string;
  dateTime?: string;
  start?: string;
  end?: string;
  when?: 'today' | 'tomorrow' | 'yesterday' | 'next_weekday' | 'specific_date' | 'unspecified';

  tags?: string[];
  quantity?: string;
  priority?: Priority;
  hideFromCalendar?: boolean;

  shoppingCategory?: ShoppingCategory;

  amount?: number;
  currency?: string;

  financeType?: FinanceType;
  paymentMethod?: string;
  toWallet?: string;
  budgetCategory?: string;
  commodity?: string;
  subcommodity?: string;
  merchant?: string;

  durationMinutes?: number;
  skillName?: string;
  skillId?: string;

  progress?: number;
  progressNotes?: string;

  savingGoalId?: string;
  savingGoalName?: string;
  dedicatedWalletId?: string;
  dedicatedWalletName?: string;
  savedAmount?: number;

  isRoutine?: boolean;
  routineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  routineDaysOfWeek?: number[];
  routineDaysOfMonth?: number[];
  routineMonthsOfYear?: number[];
  recurrenceDays?: number;
  targetDay?: string;
}

export interface CreateItemPayload {
  itemType: ParsedItemType;
  content: string;
  status?: 'pending' | 'done';
  meta: ParsedItemMetaV2;
}

export interface UpdateItemPayload {
  match?: {
    itemId?: string;
    itemName?: string;
  };
  changes?: Partial<{
    content: string;
    status: 'pending' | 'done';
    priority: Priority;
    date: string;
    start: string;
    end: string;
    amount: number;
    tags: string[];
    shoppingCategory: ShoppingCategory;
    financeType: FinanceType;
    paymentMethod: string;
    toWallet: string;
    budgetCategory: string;
    commodity: string;
    subcommodity: string;
    merchant: string;
    quantity: string;
    durationMinutes: number;
    skillName: string;
    progress: number;
    progressNotes: string;
    isRoutine: boolean;
    routineInterval: 'daily' | 'weekly' | 'monthly' | 'yearly';
    routineDaysOfWeek: number[];
    routineDaysOfMonth: number[];
    routineMonthsOfYear: number[];
    recurrenceDays: number;
    targetDay: string;
  }>;
}

export interface CompleteItemPayload {
  match?: {
    itemId?: string;
    itemName?: string;
  };
  completedAt?: string;
}

export interface DeleteItemPayload {
  match?: {
    itemId?: string;
    itemName?: string;
  };
}

export interface CreateSkillPayload {
  name?: string;
  targetHours?: number;
  targetMinutes?: number;
  period?: 'daily' | 'weekly' | 'monthly';
  tags?: string[];
  notes?: string;
}

export interface UpdateSkillPayload {
  match?: {
    skillId?: string;
    skillName?: string;
  };
  changes?: Partial<{
    name: string;
    targetHours: number;
    targetMinutes: number;
    period: 'daily' | 'weekly' | 'monthly';
    tags: string[];
    notes: string;
  }>;
}

export interface CreateWalletPayload {
  name?: string;
  walletType?: ParsedWalletType;
  initialBalance?: number;
  currency?: string;
  isDebtAccount?: boolean;
  notes?: string;
}

export interface UpdateWalletPayload {
  match?: {
    walletId?: string;
    walletName?: string;
  };
  changes?: Partial<{
    name: string;
    walletType: ParsedWalletType;
    initialBalance: number;
    currency: string;
    isDebtAccount: boolean;
    notes: string;
  }>;
}

export interface ThemePayload {
  monthKey?: string;
  content?: string;
}

export interface TransferMoneyPayload {
  amount?: number;
  fromWallet?: string;
  toWallet?: string;
  date?: string;
  note?: string;
}

export interface AddSavingFundsPayload {
  savingGoalName?: string;
  savingGoalId?: string;
  amount?: number;
  fromWallet?: string;
  date?: string;
  note?: string;
  budgetCategory?: string;
}

export interface QueryOnlyPayload {
  question?: string;
  scope?: 'dashboard' | 'focus' | 'money' | 'notes' | 'shopping' | 'skills' | 'general';
}

export type ParserPayloadV2 =
  | CreateItemPayload
  | UpdateItemPayload
  | CompleteItemPayload
  | DeleteItemPayload
  | CreateSkillPayload
  | UpdateSkillPayload
  | CreateWalletPayload
  | UpdateWalletPayload
  | ThemePayload
  | TransferMoneyPayload
  | AddSavingFundsPayload
  | QueryOnlyPayload;

export interface ParserResultV2 {
  action: ParserAction;
  entityType: ParserEntityType;
  content?: string;
  targetText?: string;
  confidence: ParserConfidence;
  needsReview: boolean;
  reviewReason?: string;
  entityRefs?: ParserEntityRefs;
  payload?: ParserPayloadV2;
}