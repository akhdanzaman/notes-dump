
export enum ItemType {
  TODO = 'TODO',
  SHOPPING = 'SHOPPING',
  NOTE = 'NOTE',
  EVENT = 'EVENT',
  FINANCE = 'FINANCE',
  SKILL_LOG = 'SKILL_LOG',
  JOURNAL = 'JOURNAL'
}

export type ShoppingCategory = 'urgent' | 'not_urgent' | 'routine' | 'saving';
export type FinanceType = 'expense' | 'income' | 'transfer' | 'saving';

export interface BudgetRule {
  id: string;
  name: string;
  percentage: number;
  color: string; // tailwind color class e.g. 'bg-blue-500'
}

export interface BudgetConfig {
  monthlyIncome: number;
  rules: BudgetRule[];
}

export interface AppSettings {
  defaultCollapsed: boolean;
  hideMoney: boolean;
  theme?: 'light' | 'dark';
}

export interface Skill {
  id: string;
  name: string;
  color: string;
  created_at: string;
  weeklyTargetMinutes?: number; // Target in minutes per week
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
  tags?: string[];
  quantity?: string; // specific for shopping
  shoppingCategory?: ShoppingCategory;
  recurrenceDays?: number; // Number of days for routine items
  targetDay?: string; // e.g. "Monday", "Sunday"
  
  // Routine Task specific
  isRoutine?: boolean;
  routineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  routineDaysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  routineDaysOfMonth?: number[]; // 1-31
  routineMonthsOfYear?: number[]; // 0-11
  
  // Finance specific
  amount?: number;
  currency?: string;
  financeType?: FinanceType;
  paymentMethod?: string; // e.g., 'cash', 'paylater', 'transfer', 'QRIS BNI'
  toWallet?: string; // Destination wallet for transfers
  budgetCategory?: string; // Custom category ID or Name

  // Skill Growth specific
  durationMinutes?: number;
  skillId?: string; // ID of the Skill
  skillName?: string; // Temporary field for AI matching

  // Task Progress specific
  progress?: number; // 0-100
  progressNotes?: string;

  // Savings specific
  savedAmount?: number;
  savingGoalId?: string;
  dedicatedWalletId?: string;

  // Routine History Tracking
  lastGeneratedHistoryId?: string;
}

export interface BrainDumpItem {
  id: string;
  type: ItemType;
  content: string;
  status: 'pending' | 'done';
  created_at: string;
  completed_at?: string;
  meta: ItemMeta;
  isOptimistic?: boolean; // For UI state only, not saved to DB
}

export interface DbSchema {
  data: BrainDumpItem[];
  budgetConfig?: BudgetConfig;
  appSettings?: AppSettings;
  customPrompt?: string;
  skills?: Skill[];
  wallets?: Wallet[];
  monthlyThemes?: Record<string, string>; // Key: "YYYY-MM", Value: "Theme Content"
}

// For Github API responses
export interface GitHubFileResponse {
  content: string;
  sha: string;
  encoding: string;
}

// --- UI Types moved from App.tsx ---
export type Tab = 'summary' | 'focus' | 'shopping' | 'notes' | 'money';
export type FocusSubTab = 'tasks' | 'skills';
export type NotesSubTab = 'general' | 'skills' | 'journal';
export type SyncStatus = 'synced' | 'syncing' | 'error' | 'local';
export type MoneyView = 'transactions' | 'budget' | 'wallets';
export type SortOrder = 'newest' | 'oldest' | 'highest_amount' | 'lowest_amount';