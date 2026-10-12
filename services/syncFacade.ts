import { durableCapabilities, reconcileDurableReceipts, submitDurableOperations } from './durableSync';
import { persistLocalState, readLocalState, reconstructBaseline, changeOperationState, acknowledgeOperations, localScope, type DraftCompletion } from './localOutbox';
import { DbSchema, SyncProgressCallback, SyncResult } from "../types";
import { fetchSpreadsheetDb, syncSpreadsheetData, getSpreadsheetConfig, getSpreadsheetHistory, SpreadsheetHistoryEntry, getCachedSpreadsheetDb, cacheSpreadsheetDbForMigration, cachePendingSpreadsheetWrite, getPendingSpreadsheetWrite, clearPendingSpreadsheetWrite } from "./spreadsheetService";
import { mergeDbData } from "../utils/mergeUtils";
import { dedupeBrainDumpItems } from "../utils/itemDedupe";
import { sanitizeBrainDumpItemsForPersistence } from "./parserFieldValidator";

export const mergePendingSpreadsheetWrite = (remoteData: DbSchema, pendingData: DbSchema, baseData?: DbSchema) => {
  const merged = mergeDbData(pendingData, remoteData, baseData);
  const hasPendingChanges = JSON.stringify(merged) !== JSON.stringify(remoteData);
  return { merged, hasPendingChanges };
};

export const fetchDb = async (skipLocalStorage = false, onProgress?: SyncProgressCallback, changedTables?:string[]): Promise<{ data: DbSchema; sha: string; hasChanges: boolean }> => {
  if (!getSpreadsheetConfig()) {
    return {
      data: getCachedSpreadsheetDb() || { data: [] },
      sha: 'spreadsheet-not-connected',
      hasChanges: false,
    };
  }

  const scope = localScope(getSpreadsheetConfig()?.spreadsheetId);
  const durable = getSpreadsheetConfig()?.authMode !== 'oauth' && typeof indexedDB !== 'undefined' && (await durableCapabilities(scope)).enabled;
  if (durable) { const pending = await readLocalState(scope); await reconcileDurableReceipts(scope, pending.operations).catch(()=>{}); }
  const local = !skipLocalStorage && typeof indexedDB !== 'undefined' ? await readLocalState(scope) : undefined;
  const pendingWrite = !skipLocalStorage && local?.data && local.operations.length ? { id: 'indexeddb', data: local.data, base: reconstructBaseline(local.data, local.operations) } : (skipLocalStorage ? null : getPendingSpreadsheetWrite());
  onProgress?.({ phase: 'metadata', label: 'Reading spreadsheet data', detail: 'Fetching all sheets', updatedAt: Date.now() });
  const { data, sha, reconciled } = await fetchSpreadsheetDb(skipLocalStorage, onProgress,changedTables);

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
    if (durable) return { data: merged, sha, hasChanges: hasPendingChanges || !!local?.operations.length };
    if (pendingWrite.id === 'indexeddb') await acknowledgeOperations(scope, local!.operations.map(operation => operation.operationId));
    else clearPendingSpreadsheetWrite(pendingWrite.id);
  }

  return { data, sha, hasChanges: reconciled };
};

export type SyncDataRequest = DbSchema & { preparedLocal?: boolean; forceOverwrite?: boolean; onProgress?: SyncProgressCallback };
export const syncData = async ({ data: items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, monthlyThemeImages, appSettings, chatHistory, canonicalRules, preparedLocal = false, forceOverwrite = false, onProgress }: SyncDataRequest): Promise<SyncResult> => {
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

  const scope = localScope(getSpreadsheetConfig()?.spreadsheetId);
  const indexed = typeof indexedDB !== 'undefined';
  if (indexed && !preparedLocal) await persistLocalState(scope, outgoingDb, getPendingSpreadsheetWrite()?.base || getCachedSpreadsheetDb() || undefined);
  const local = indexed ? await readLocalState(scope) : undefined;
  const outgoingById = new Map(outgoingDb.data.map(item => [item.id, item]));
  const claimed = local?.operations.filter(operation => (operation.state === 'pending' || operation.state === 'sending') && JSON.stringify(operation.after) === JSON.stringify((operation.entityKind === 'item' ? outgoingById.get(operation.entityId) : (outgoingDb as any)[operation.entityId]) ?? null)) || [];
  const operationIds = claimed.map(operation => operation.operationId);
  if (indexed && getSpreadsheetConfig()?.authMode !== 'oauth') {
    const capabilities = await durableCapabilities(scope);
    if (capabilities.enabled) {
      if (!capabilities.ready) return { success: false, method: 'error', state: 'failed', error: 'Durable sync awaits schema migration and queue activation; changes remain local.' };
      if (forceOverwrite) return { success: false, method: 'error', error: 'Force overwrite is disabled during durable sync. Use entity changes and conflict review.' };
      await reconcileDurableReceipts(scope, local?.operations || []).catch(()=>{});
      const active = (await readLocalState(scope)).operations;
      await submitDurableOperations(scope, active.filter(operation => operation.state !== 'conflict'));
      if (active.some(operation => operation.state === 'conflict')) return { success: false, method: 'error', state: 'conflict', error: 'Perubahan bersamaan perlu ditinjau; salinan lokal tetap aman.' };
      return { success: true, method: 'cloud', state: active.length ? 'accepted' : 'committed' };
    }
  }
  if (indexed) await changeOperationState(scope, operationIds, 'sending');
  const pendingWriteId = indexed ? undefined : cachePendingSpreadsheetWrite(outgoingDb);
  onProgress?.({ phase: 'pending_local', label: 'Caching pending write', detail: 'Local safety copy stored before cloud sync' });
  const result = await syncSpreadsheetData({ db: outgoingDb, baseline: local?.data ? reconstructBaseline(outgoingDb, claimed) : undefined, forceOverwrite, onProgress });

  if (result.success) {
    if (indexed) await acknowledgeOperations(scope, operationIds);
    else clearPendingSpreadsheetWrite(pendingWriteId);
  }

  if (!result.success && indexed) await changeOperationState(scope, operationIds, 'pending', undefined, result.error);
  return result;
};

export const isUsingLocalStorage = () => !getSpreadsheetConfig();

export const getDatabaseHistory = async (): Promise<SpreadsheetHistoryEntry[]> => {
  if (!getSpreadsheetConfig()) return [];
  return await getSpreadsheetHistory();
};

export async function persistForSave(db: DbSchema, completedDraft?: DraftCompletion) {
  const scope = localScope(getSpreadsheetConfig()?.spreadsheetId);
  const sanitized = sanitizeBrainDumpItemsForPersistence(db.data, { availableWallets: db.wallets || [], availableBudgetRules: db.budgetConfig?.rules || [] });
  const snapshot = { ...db, data: dedupeBrainDumpItems(sanitized.items).items };
  if (typeof indexedDB !== 'undefined') await persistLocalState(scope, snapshot, getPendingSpreadsheetWrite()?.base || getCachedSpreadsheetDb() || undefined, true, completedDraft);
  else cachePendingSpreadsheetWrite(snapshot);
}
