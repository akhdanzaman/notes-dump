import { useCallback, useRef, type MutableRefObject } from 'react';
import type { BrainDumpItem, DbSchema, SyncProgress, SyncStatus, SyncResult } from '../types';
import { syncData, persistForSave } from '../services/syncFacade';
import { scheduleCalendarSync } from '../services/derivedSync';
import { persistLocalState, localScope } from '../services/localOutbox';
import { getSpreadsheetConfig } from '../services/spreadsheetService';
import { applySaveResult, combineSaveChanges, type SaveChanges } from '../utils/saveChanges';

interface DatabaseSaveBindings {
  read: () => DbSchema;
  apply: (db: DbSchema) => void;
  hasActiveParsing: () => boolean;
  pendingSaveAfterParsingRef: MutableRefObject<SaveChanges | null>;
  lastSyncedItemsRef: MutableRefObject<BrainDumpItem[]>;
  setSaveStatus: (status: SyncStatus) => void;
  setSaveProgress: (progress: SyncProgress) => void;
  setError: (message: string) => void;
}

/** Own the save lifecycle; the workspace owns state and supplies a fresh snapshot. */
export function useDatabaseSave(bindings: DatabaseSaveBindings) {
  const latest = useRef(bindings);
  latest.current = bindings;
  const queue = useRef<Promise<SyncResult>>(Promise.resolve({ success: true, method: 'local', state: 'local' }));
  const pending = useRef<SaveChanges>({});
  const persistence = useRef<Promise<void>>(Promise.resolve());

  const performSaveAndSync = useCallback((changes: SaveChanges = {}) => {
    pending.current = combineSaveChanges({ ...pending.current, data: latest.current.read().data }, changes);
    const snapshot = { ...latest.current.read(), ...pending.current };
    const localWrite = persistence.current.catch(() => {}).then(() => persistForSave(snapshot));
    persistence.current = localWrite;
    void localWrite.catch(() => {});
    const run = async (previousResult?: SyncResult): Promise<SyncResult> => {
      const ctx = latest.current;
      await localWrite;
      await persistence.current;
      const before = ctx.read();
      const { forceOverwrite = false, ...patch } = pending.current;
      if (Object.keys(patch).length === 0 && !forceOverwrite) return previousResult || { success: true, method: 'local', state: 'local' };
      pending.current = {};
      const outgoing = { ...before, ...patch };
      const report = (progress: SyncProgress) => ctx.setSaveProgress({ ...progress, updatedAt: Date.now() });
      ctx.setSaveStatus('saving');
      try {
        const result = await syncData({ ...outgoing, preparedLocal: true, forceOverwrite, onProgress: report });
        if (!result.success) throw new Error(result.error || 'Sync failed, preserving local state.');
        if (result.state === 'accepted') {
          report({ phase: 'pending_local', label: 'Diterima server', detail: 'Antrean akan menyimpan ke Sheets; menunggu bukti commit' });
          ctx.setSaveStatus('saving');
          return result;
        }
        const acknowledged = result.mergedData || outgoing;
        const applied = applySaveResult(ctx.read(), acknowledged, before);
        ctx.apply(applied);
        if (typeof indexedDB !== 'undefined') await persistLocalState(localScope(getSpreadsheetConfig()?.spreadsheetId), applied, undefined, false);
        ctx.lastSyncedItemsRef.current = acknowledged.data;
        if (acknowledged.appSettings?.googleCalendarSyncEnabled) scheduleCalendarSync(acknowledged, error => {
          ctx.setError(`Data tersimpan, tapi sync Google Calendar gagal: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });
        report({ phase: 'complete', label: 'Save complete', detail: 'Sheets and local cache are up to date' });
        ctx.setSaveStatus('synced');
        return { ...result, state: 'committed' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        ctx.setSaveStatus('error');
        report({ phase: 'error', label: 'Save failed', detail: message });
        ctx.setError(`Gagal menyimpan data ke cloud: ${message}`);
        return { success: false, method: 'error', state: 'failed', error: message };
      }
    };
    queue.current = queue.current.then(run, () => run()).catch(error => {
      const message = error instanceof Error ? error.message : 'Local persistence failed';
      latest.current.setSaveStatus('error'); latest.current.setError(message);
      return { success: false, method: 'error' as const, state: 'failed' as const, error: message };
    });
    return queue.current;
  }, []);

  const saveAndSync = useCallback(async (changes: SaveChanges = {}) => {
    const ctx = latest.current;
    if (ctx.hasActiveParsing()) {
      try { await persistForSave({ ...ctx.read(), ...changes }); }
      catch (error) { const message = error instanceof Error ? error.message : 'Local persistence failed'; ctx.setError(message); return { success: false, method: 'error' as const, state: 'failed' as const, error: message }; }
      ctx.pendingSaveAfterParsingRef.current = combineSaveChanges(ctx.pendingSaveAfterParsingRef.current || {}, changes);
      ctx.setSaveStatus('saving');
      ctx.setSaveProgress({ phase: 'deferred', label: 'Waiting for parser', detail: 'Save will start after current parsing finishes', updatedAt: Date.now() });
      return { success: true, method: 'local' as const, state: 'local' as const };
    }
    return performSaveAndSync(changes);
  }, [performSaveAndSync]);
  return { saveAndSync, performSaveAndSync };
}
