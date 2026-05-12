import { BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, DbSchema, ChatMessage, CanonicalRule } from "../types";
import { fetchSpreadsheetDb, syncSpreadsheetData, getSpreadsheetConfig, getSpreadsheetHistory, SpreadsheetHistoryEntry, getCachedSpreadsheetDb, cacheSpreadsheetDbForMigration, cachePendingSpreadsheetWrite, getPendingSpreadsheetWrite, clearPendingSpreadsheetWrite } from "./spreadsheetService";
import { SyncResult } from "./syncTypes";
import { mergeDbData } from "../utils/mergeUtils";

export const getActiveSyncProviders = (): 'spreadsheet'[] => {
  return getSpreadsheetConfig() ? ['spreadsheet'] : [];
};

export const mergePendingSpreadsheetWrite = (remoteData: DbSchema, pendingData: DbSchema) => {
  const merged = mergeDbData(pendingData, remoteData);
  const hasPendingChanges = JSON.stringify(merged) !== JSON.stringify(remoteData);
  return { merged, hasPendingChanges };
};

export const fetchDb = async (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string; hasChanges: boolean }> => {
  if (!getSpreadsheetConfig()) {
    return {
      data: getCachedSpreadsheetDb() || { data: [] },
      sha: 'spreadsheet-not-connected',
      hasChanges: false,
    };
  }

  const pendingWrite = skipLocalStorage ? null : getPendingSpreadsheetWrite();
  const { data, sha, reconciled } = await fetchSpreadsheetDb(skipLocalStorage);

  if (pendingWrite) {
    const { merged, hasPendingChanges } = mergePendingSpreadsheetWrite(data, pendingWrite.data);
    if (hasPendingChanges) {
      return { data: merged, sha: `${sha}-pending-local`, hasChanges: true };
    }
    clearPendingSpreadsheetWrite(pendingWrite.id);
  }

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
  const outgoingDb = { data: items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory, canonicalRules };

  if (!getSpreadsheetConfig()) {
    cacheSpreadsheetDbForMigration(outgoingDb);
    return {
      success: false,
      method: 'error',
      error: 'Spreadsheet is not connected. Current data was kept as a temporary migration cache; connect Google Sheets to save it as the source of truth.',
    };
  }

  const pendingWriteId = cachePendingSpreadsheetWrite(outgoingDb);
  const result = await syncSpreadsheetData(
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

  if (result.success) {
    clearPendingSpreadsheetWrite(pendingWriteId);
  }

  return result;
};

export const isUsingLocalStorage = () => !getSpreadsheetConfig();

export const getDatabaseHistory = async (): Promise<SpreadsheetHistoryEntry[]> => {
  if (!getSpreadsheetConfig()) return [];
  return await getSpreadsheetHistory();
};
