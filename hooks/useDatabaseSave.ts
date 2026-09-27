import { useCallback, useRef, type MutableRefObject } from 'react';
import type { BrainDumpItem, DbSchema, SyncProgress, SyncStatus } from '../types';
import { syncData } from '../services/syncFacade';
import { syncItemsToGoogleCalendar } from '../services/googleCalendarService';
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
  const queue = useRef(Promise.resolve());

  const performSaveAndSync = useCallback((changes: SaveChanges = {}) => {
    const before = latest.current.read();
    const run = async () => {
      const ctx = latest.current;
      const { forceOverwrite = false, ...patch } = combineSaveChanges({}, changes);
      const outgoing = { ...ctx.read(), ...patch };
      const report = (progress: SyncProgress) => ctx.setSaveProgress({ ...progress, updatedAt: Date.now() });
      ctx.setSaveStatus('saving');
      try {
        const result = await syncData({ ...outgoing, forceOverwrite, onProgress: report });
        if (!result.success) throw new Error(result.error || 'Sync failed, preserving local state.');
        const acknowledged = result.mergedData || outgoing;
        ctx.apply(applySaveResult(ctx.read(), acknowledged, before));
        ctx.lastSyncedItemsRef.current = acknowledged.data;
        // Calendar receives the acknowledged data, never unsaved in-flight edits.
        if (acknowledged.appSettings?.googleCalendarSyncEnabled) {
          try {
            report({ phase: 'calendar', label: 'Syncing calendar', detail: 'Checking changed calendar events' });
            await syncItemsToGoogleCalendar(acknowledged.data, acknowledged.appSettings);
          } catch (error) {
            ctx.setError(`Data tersimpan, tapi sync Google Calendar gagal: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
        report({ phase: 'complete', label: 'Save complete', detail: 'Sheets and local cache are up to date' });
        ctx.setSaveStatus('synced');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        ctx.setSaveStatus('error');
        report({ phase: 'error', label: 'Save failed', detail: message });
        ctx.setError(`Gagal menyimpan data ke cloud: ${message}`);
      }
    };
    queue.current = queue.current.then(run, run);
    return queue.current;
  }, []);

  const saveAndSync = useCallback(async (changes: SaveChanges = {}) => {
    const ctx = latest.current;
    if (ctx.hasActiveParsing()) {
      ctx.pendingSaveAfterParsingRef.current = combineSaveChanges(ctx.pendingSaveAfterParsingRef.current || {}, changes);
      ctx.setSaveStatus('saving');
      ctx.setSaveProgress({ phase: 'deferred', label: 'Waiting for parser', detail: 'Save will start after current parsing finishes', updatedAt: Date.now() });
      return;
    }
    return performSaveAndSync(changes);
  }, [performSaveAndSync]);
  return { saveAndSync, performSaveAndSync };
}
