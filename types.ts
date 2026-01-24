export enum ItemType {
  TODO = 'TODO',
  SHOPPING = 'SHOPPING',
  NOTE = 'NOTE',
  EVENT = 'EVENT'
}

export type ShoppingCategory = 'urgent' | 'not_urgent' | 'routine';

export interface ItemMeta {
  date?: string;
  tags?: string[];
  quantity?: string; // specific for shopping
  shoppingCategory?: ShoppingCategory;
  recurrenceDays?: number; // Number of days for routine items
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
}

// For Github API responses
export interface GitHubFileResponse {
  content: string;
  sha: string;
  encoding: string;
}