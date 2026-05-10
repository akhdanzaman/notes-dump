export enum ItemType {
  TODO = 'TODO',
  SHOPPING = 'SHOPPING',
  NOTE = 'NOTE',
  EVENT = 'EVENT',
  FINANCE = 'FINANCE',
  JOURNAL = 'JOURNAL',
  SKILL_LOG = 'SKILL_LOG'
}

export type ShoppingCategory = 'urgent' | 'not_urgent' | 'routine' | 'saving' | 'investment';
export type InvestmentAssetType = 'gold' | 'stock' | 'mutual_fund' | 'crypto' | 'bond' | 'deposit' | 'other';
export type FinanceType = 'expense' | 'income' | 'transfer' | 'saving' | 'achieved_goal';
export type Priority = 'low' | 'normal' | 'high';
export type DeepWorkCompletionMode = 'manual' | 'all_subtasks' | 'final_output_check';
export type DeepWorkStatus = 'suggested' | 'accepted' | 'active' | 'dismissed' | 'done';
export type DeepWorkBlockerStatus = 'clear' | 'blocked' | 'needs_input' | 'unknown';
export type DeepWorkPattern = 'summary' | 'regulation' | 'research' | 'review' | 'continuation' | 'artifact' | 'decision';
export type DeepWorkConfidence = 'low' | 'medium' | 'high';
export type DeepWorkOutputFormat = 'bullet_summary' | 'brief' | 'table' | 'decision_memo' | 'slides' | 'email_draft' | 'notes' | 'unknown';

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

export type ParserRouterRoute = 'local_save' | 'review' | 'deep_ai';
export type ParserIntent = 'finance' | 'todo' | 'shopping' | 'note' | 'journal' | 'event' | 'query_only' | 'unknown' | 'mixed';
export type ParserAiModelTier = 'fast_extraction' | 'deep_parse' | 'not_applicable';

export interface ParserModelRoutingSettings {
  enabled?: boolean;
  fastModel?: string;
  deepModel?: string;
  minFastConfidence?: ParserConfidence;
  escalateOnNeedsReview?: boolean;
}

export interface ParserModelRoutingMetadata {
  enabled: boolean;
  policy: 'disabled_static_parser_choice' | 'fast_then_deep_on_ambiguity';
  fastModel?: string;
  deepModel?: string;
  selectedTier: ParserAiModelTier;
  finalModel?: string;
  fastAttempted: boolean;
  deepAttempted: boolean;
  aiCallCount: number;
  escalationReasonCodes: string[];
  warnings?: string[];
}

export type ParserBatchItemStatus = 'local_saved' | 'local_review' | 'ai_pending' | 'ai_saved' | 'ai_review' | 'failed';

export interface ParserBatchResultRef {
  id: string;
  index: number;
  sourceText: string;
  startLine?: number;
  endLine?: number;
}

export interface ParserBatchMetadata {
  id: string;
  itemCount: number;
  localItemCount: number;
  reviewItemCount: number;
  aiItemCount: number;
  failedItemCount: number;
  aiCallCount: number;
  modelRouting?: ParserModelRoutingMetadata;
  items: Array<ParserBatchResultRef & {
    status: ParserBatchItemStatus;
    route: ParserRouterRoute;
    intent: ParserIntent;
    reasonCodes: string[];
    resultCount: number;
    error?: string;
  }>;
}

export interface ParserRouterDecisionMetadata {
  route: ParserRouterRoute;
  intent: ParserIntent;
  confidenceScore: number;
  reasonCodes: string[];
  batch?: ParserBatchMetadata;
  modelRouting?: ParserModelRoutingMetadata;
}

export interface ParsingTask {
  id: string;
  text: string;
  status: 'pending' | 'failed' | 'success';
  stage?: 'router' | 'local' | 'stage1' | 'stage2' | 'legacy' | 'batch' | 'fast_extraction' | 'deep_parse';
  error?: string;
  results?: ParserResultV2[];
  routerDecision?: ParserRouterDecisionMetadata;
  batch?: ParserBatchMetadata;
  duplicateGuardRemovedCount?: number;
  duplicateGuardReason?: string;
  undoStatus?: 'undone' | 'deleted';
  createdAt: number;
  completedAt?: number;
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
  parserModelRouting?: ParserModelRoutingSettings;
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
  type: 'cash' | 'bank' | 'ewallet' | 'cc' | 'investment';
  initialBalance: number;
  color: string;
}

export interface ItemMeta {
  title?: string;
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

  parentTodoId?: string;
  childTodoIds?: string[];
  deepWorkParent?: boolean;
  deepWorkPlanId?: string;
  deepWorkStatus?: DeepWorkStatus;
  deepWorkTriggerPattern?: DeepWorkPattern;
  deepWorkTriggerEvidence?: string[];
  deepWorkConfidence?: DeepWorkConfidence;
  deepWorkNextAction?: string;
  deepWorkNextActionDurationMinutes?: number;
  deepWorkNextActionAcceptanceCheck?: string;
  deepWorkFinalOutputFormat?: DeepWorkOutputFormat;
  deepWorkFinalOutput?: string;
  deepWorkSessionEstimateMinutes?: number;
  deepWorkSessionEstimateConfidence?: DeepWorkConfidence;
  deepWorkSessionEstimateReason?: string;
  deepWorkBlockerCheck?: string;
  deepWorkBlockerStatus?: DeepWorkBlockerStatus;
  deepWorkMissingInputs?: string[];
  deepWorkCompletionMode?: DeepWorkCompletionMode;
  deepWorkStepIndex?: number;
  deepWorkStepCount?: number;
  deepWorkGeneratedAt?: string;
  deepWorkAcceptedAt?: string;
  deepWorkDismissedAt?: string;
  deepWorkReason?: string;
  subtasks?: string[];

  savedAmount?: number;
  savingGoalId?: string;
  dedicatedWalletId?: string;

  investmentAssetType?: InvestmentAssetType;
  investmentSymbol?: string;
  investmentUnits?: number;
  investmentAveragePrice?: number;
  investmentCurrentPrice?: number;
  investmentPlatform?: string;

  canonical?: ItemCanonicalMeta;
  enrichment?: EnrichmentMeta;

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
  parserTaskId?: string;
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
  canonicalRules?: CanonicalRule[];
}

export interface GitHubFileResponse {
  content: string;
  sha: string;
  encoding: string;
}

export type Tab = 'summary' | 'plan' | 'library' | 'money' | 'calendar';
export type PlanSubTab = 'tasks' | 'shopping' | 'savings';
export type FocusSubTab = 'tasks' | 'skills';
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
  | 'JOURNAL'
  | 'SKILL_LOG';

export type ParsedWalletType = 'cash' | 'bank' | 'ewallet' | 'cc' | 'investment' | 'other';

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
  | 'skill_log'
  | 'skill'
  | 'wallet'
  | 'theme'
  | 'saving_goal'
  | 'unknown';

export type ParserConfidence = 'low' | 'medium' | 'high';

export type CanonicalField =
  | 'merchant'
  | 'paymentMethod'
  | 'commodity'
  | 'subcommodity'
  | 'label'
  | 'family';

export type CanonicalSource =
  | 'system_rule'
  | 'learned_rule'
  | 'context_inference'
  | 'ai_assist'
  | 'manual_review';

export interface CanonicalValue {
  rawValue?: string;
  value?: string;
  confidence?: number;
  source?: CanonicalSource;
  ruleId?: string;
  needsReview?: boolean;
  reason?: string;
}

export interface ItemCanonicalMeta {
  merchant?: CanonicalValue;
  paymentMethod?: CanonicalValue;
  commodity?: CanonicalValue;
  subcommodity?: CanonicalValue;
  label?: CanonicalValue;
  family?: CanonicalValue;
}

export interface EnrichmentMeta {
  status: 'queued' | 'processing' | 'applied' | 'review' | 'skipped' | 'error';
  version: number;
  taskId?: string;
  parserTaskId?: string;
  updatedAt: string;
  appliedFields?: string[];
  reviewCount?: number;
  error?: string;
}

export interface EnrichmentTask {
  id: string;
  itemId: string;
  parserTaskId?: string;
  sourceText?: string;
  status: 'pending' | 'running' | 'success' | 'review' | 'skipped' | 'failed';
  baseMeta?: ItemMeta;
  attempts: number;
  createdAt: number;
  completedAt?: number;
  appliedFields?: string[];
  reviewCount?: number;
  error?: string;
}

export interface CanonicalRule {
  id: string;
  field: CanonicalField;
  canonicalValue: string;
  aliases: string[];
  source: 'system' | 'learned' | 'manual';
  confidenceBoost?: number;
  approvalCount: number;
  rejectionCount: number;
  conditions?: {
    financeType?: FinanceType[];
    budgetCategory?: string[];
    commodity?: string[];
    paymentMethod?: string[];
    amountMin?: number;
    amountMax?: number;
  };
  createdAt: string;
  updatedAt: string;
  lastApprovedAt?: string;
  lastRejectedAt?: string;
  autoApplyDisabled?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export interface CanonicalCandidate {
  field: CanonicalField;
  rawValue: string;
  canonicalValue: string;
  score: number;
  reason: string;
  ruleId?: string;
  source: CanonicalSource;
  autoApplyEligible?: boolean;
}

export interface CanonicalReviewSuggestion {
  field: CanonicalField;
  rawValue?: string;
  suggestedValue?: string;
  confidence: number;
  reason: string;
  source: CanonicalSource;
  ruleId?: string;
}

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
  title?: string;
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

  parentTodoId?: string;
  childTodoIds?: string[];
  deepWorkParent?: boolean;
  deepWorkPlanId?: string;
  deepWorkStatus?: DeepWorkStatus;
  deepWorkTriggerPattern?: DeepWorkPattern;
  deepWorkTriggerEvidence?: string[];
  deepWorkConfidence?: DeepWorkConfidence;
  deepWorkNextAction?: string;
  deepWorkNextActionDurationMinutes?: number;
  deepWorkNextActionAcceptanceCheck?: string;
  deepWorkFinalOutputFormat?: DeepWorkOutputFormat;
  deepWorkFinalOutput?: string;
  deepWorkSessionEstimateMinutes?: number;
  deepWorkSessionEstimateConfidence?: DeepWorkConfidence;
  deepWorkSessionEstimateReason?: string;
  deepWorkBlockerCheck?: string;
  deepWorkBlockerStatus?: DeepWorkBlockerStatus;
  deepWorkMissingInputs?: string[];
  deepWorkCompletionMode?: DeepWorkCompletionMode;
  deepWorkStepIndex?: number;
  deepWorkStepCount?: number;
  deepWorkGeneratedAt?: string;
  deepWorkAcceptedAt?: string;
  deepWorkDismissedAt?: string;
  deepWorkReason?: string;
  subtasks?: string[];

  savingGoalId?: string;
  savingGoalName?: string;
  dedicatedWalletId?: string;
  dedicatedWalletName?: string;
  savedAmount?: number;

  investmentAssetType?: InvestmentAssetType;
  investmentSymbol?: string;
  investmentUnits?: number;
  investmentAveragePrice?: number;
  investmentCurrentPrice?: number;
  investmentPlatform?: string;

  canonical?: ItemCanonicalMeta;

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
    title: string;
    content: string;
    status: 'pending' | 'done';
    priority: Priority;
    date: string;
    start: string;
    end: string;
    hideFromCalendar: boolean;
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
    canonical: ItemCanonicalMeta;
    quantity: string;
    durationMinutes: number;
    skillName: string;
    progress: number;
    progressNotes: string;
    parentTodoId: string;
    childTodoIds: string[];
    deepWorkParent: boolean;
    deepWorkPlanId: string;
    deepWorkStatus: DeepWorkStatus;
    deepWorkTriggerPattern: DeepWorkPattern;
    deepWorkTriggerEvidence: string[];
    deepWorkConfidence: DeepWorkConfidence;
    deepWorkNextAction: string;
    deepWorkNextActionDurationMinutes: number;
    deepWorkNextActionAcceptanceCheck: string;
    deepWorkFinalOutputFormat: DeepWorkOutputFormat;
    deepWorkFinalOutput: string;
    deepWorkSessionEstimateMinutes: number;
    deepWorkSessionEstimateConfidence: DeepWorkConfidence;
    deepWorkSessionEstimateReason: string;
    deepWorkBlockerCheck: string;
    deepWorkBlockerStatus: DeepWorkBlockerStatus;
    deepWorkMissingInputs: string[];
    deepWorkCompletionMode: DeepWorkCompletionMode;
    deepWorkStepIndex: number;
    deepWorkStepCount: number;
    deepWorkGeneratedAt: string;
    deepWorkAcceptedAt: string;
    deepWorkDismissedAt: string;
    deepWorkReason: string;
    subtasks: string[];
    isRoutine: boolean;
    routineInterval: 'daily' | 'weekly' | 'monthly' | 'yearly';
    routineDaysOfWeek: number[];
    routineDaysOfMonth: number[];
    routineMonthsOfYear: number[];
    recurrenceDays: number;
    targetDay: string;
    investmentAssetType: InvestmentAssetType;
    investmentSymbol: string;
    investmentUnits: number;
    investmentAveragePrice: number;
    investmentCurrentPrice: number;
    investmentPlatform: string;
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
  toWallet?: string;
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

export interface CanonicalizationResult {
  meta: ParsedItemMetaV2;
  suggestions: CanonicalReviewSuggestion[];
  autoApplied: CanonicalField[];
}

export interface ParserResultV2 {
  action: ParserAction;
  entityType: ParserEntityType;
  content?: string;
  targetText?: string;
  batchItem?: ParserBatchResultRef;
  confidence: ParserConfidence;
  needsReview: boolean;
  reviewReason?: string;
  entityRefs?: ParserEntityRefs;
  payload?: ParserPayloadV2;
  canonicalReview?: CanonicalReviewSuggestion[];
}
