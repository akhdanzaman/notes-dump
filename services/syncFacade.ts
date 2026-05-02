import { BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, DbSchema, ChatMessage, CanonicalRule } from "../types";
import { fetchSpreadsheetDb, syncSpreadsheetData, getSpreadsheetConfig, getSpreadsheetHistory, SpreadsheetHistoryEntry, getCachedSpreadsheetDb, cacheSpreadsheetDbForMigration } from "./spreadsheetService";
import { SyncResult } from "./syncTypes";

export const getActiveSyncProviders = (): 'spreadsheet'[] => {
  return getSpreadsheetConfig() ? ['spreadsheet'] : [];
};

export const fetchDb = async (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string; hasChanges: boolean }> => {
  if (!getSpreadsheetConfig()) {
    return {
      data: getCachedSpreadsheetDb() || { data: [] },
      sha: 'spreadsheet-not-connected',
      hasChanges: false,
    };
  }

  const { data, sha, reconciled } = await fetchSpreadsheetDb(skipLocalStorage);
  return { data, sha, hasChanges: reconciled };
};

export const syncData = async (
  items: BrainDumpItem[],
  budgetConfig?: BudgetConfig,
  customPrompt?: string,
  skills?: Skill[],
  wallets?: Wallet[],
  monthlyThemes?: Record<string, string>,
  appSettings?: AppSettings,
  chatHistory?: ChatMessage[],
  canonicalRules?: CanonicalRule[],
  forceOverwrite = false
): Promise<SyncResult> => {
  if (!getSpreadsheetConfig()) {
    cacheSpreadsheetDbForMigration({ data: items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory, canonicalRules });
    return {
      success: false,
      method: 'error',
      error: 'Spreadsheet is not connected. Current data was kept as a temporary migration cache; connect Google Sheets to save it as the source of truth.',
    };
  }

  return syncSpreadsheetData(
    items,
    budgetConfig,
    customPrompt,
    skills,
    wallets,
    monthlyThemes,
    appSettings,
    chatHistory,
    canonicalRules,
    forceOverwrite
  );
};

export const isUsingLocalStorage = () => !getSpreadsheetConfig();

export const getDatabaseHistory = async (): Promise<SpreadsheetHistoryEntry[]> => {
  if (!getSpreadsheetConfig()) return [];
  return await getSpreadsheetHistory();
};
