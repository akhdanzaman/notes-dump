export enum ItemType {
  TODO = 'TODO',
  SHOPPING = 'SHOPPING',
  NOTE = 'NOTE',
  EVENT = 'EVENT',
  FINANCE = 'FINANCE',
  SKILL_LOG = 'SKILL_LOG'
}

export type ShoppingCategory = 'urgent' | 'not_urgent' | 'routine';
export type FinanceType = 'expense' | 'income' | 'lending' | 'reimbursement' | 'transfer';

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
  customPrompt?: string;
  skills?: Skill[];
  wallets?: Wallet[];
}

// For Github API responses
export interface GitHubFileResponse {
  content: string;
  sha: string;
  encoding: string;
}