import { BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, DbSchema, ChatMessage, CanonicalRule, SyncProgressCallback, SyncResult } from "../types";
import { fetchSpreadsheetDb, syncSpreadsheetData, getSpreadsheetConfig, getSpreadsheetHistory, SpreadsheetHistoryEntry, getCachedSpreadsheetDb, cacheSpreadsheetDbForMigration, cachePendingSpreadsheetWrite, getPendingSpreadsheetWrite, clearPendingSpreadsheetWrite } from "./spreadsheetService";
import { mergeDbData } from "../utils/mergeUtils";
import { dedupeBrainDumpItems } from "../utils/itemDedupe";
import { sanitizeBrainDumpItemsForPersistence } from "./parserFieldValidator";

export const mergePendingSpreadsheetWrite = (remoteData: DbSchema, pendingData: DbSchema, baseData?: DbSchema) => {
  const merged = mergeDbData(pendingData, remoteData, baseData);
  const hasPendingChanges = JSON.stringify(merged) !== JSON.stringify(remoteData);
  return { merged, hasPendingChanges };
};

export const fetchDb = async (skipLocalStorage = false, onProgress?: SyncProgressCallback): Promise<{ data: DbSchema; sha: string; hasChanges: boolean }> => {
  if (!getSpreadsheetConfig()) {
    return {
      data: getCachedSpreadsheetDb() || { data: [] },
      sha: 'spreadsheet-not-connected',
      hasChanges: false,
    };
  }

  const pendingWrite = skipLocalStorage ? null : getPendingSpreadsheetWrite();
  onProgress?.({ phase: 'metadata', label: 'Reading spreadsheet data', detail: 'Fetching all sheets', updatedAt: Date.now() });
  const { data, sha, reconciled } = await fetchSpreadsheetDb(skipLocalStorage, onProgress);

  if (pendingWrite) {
    // A cache fallback is not a server acknowledgement. Keep the pending write
    // and its baseline so offline deletions can still be replayed on reconnect.
    if (sha === 'spreadsheet-cache-sha') {
      return { data: pendingWrite.data, sha: `${sha}-pending-local`, hasChanges: true };
    }
    const { merged, hasPendingChanges } = mergePendingSpreadsheetWrite(data, pendingWrite.data, pendingWrite.base);
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
  monthlyThemeImages?: Record<string, string>,
  appSettings?: AppSettings,
  chatHistory?: ChatMessage[],
  canonicalRules?: CanonicalRule[],
  forceOverwrite = false,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> => {
  const sanitized = sanitizeBrainDumpItemsForPersistence(items, {
    availableWallets: wallets || [],
    availableBudgetRules: budgetConfig?.rules || [],
  });
  const deduped = dedupeBrainDumpItems(sanitized.items);
  const outgoingItems = deduped.items;
  const outgoingDb = { data: outgoingItems, budgetConfig, customPrompt, skills, wallets, monthlyThemes, monthlyThemeImages, appSettings, chatHistory, canonicalRules };
  const qualityDetail = sanitized.quarantinedItemCount > 0
    ? `; ${sanitized.quarantinedItemCount} item(s) contain quarantined fields for review`
    : '';
  onProgress?.({ phase: 'prepare', label: 'Preparing data', detail: `${outgoingItems.length} items ready to save${qualityDetail}` });

  if (!getSpreadsheetConfig()) {
    onProgress?.({ phase: 'pending_local', label: 'Caching local data', detail: 'Spreadsheet is not connected' });
    cacheSpreadsheetDbForMigration(outgoingDb);
    return {
      success: false,
      method: 'error',
      error: 'Spreadsheet is not connected. Current data was kept as a temporary migration cache; connect Google Sheets to save it as the source of truth.',
    };
  }

  const pendingWriteId = cachePendingSpreadsheetWrite(outgoingDb);
  onProgress?.({ phase: 'pending_local', label: 'Caching pending write', detail: 'Local safety copy stored before cloud sync' });
  const result = await syncSpreadsheetData({ db: outgoingDb, forceOverwrite, onProgress });

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
