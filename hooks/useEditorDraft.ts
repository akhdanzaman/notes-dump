import { useEffect, useRef } from 'react';
import { getSpreadsheetConfig } from '../services/spreadsheetService';

type DraftEntry = { key: string; initial: any; dirty: { current: boolean }; hydrating: boolean; latest: Record<string, unknown> };
/** UI drafts stay scoped to the spreadsheet and entity; they never become mutations. */
export function useEditorDraft(key: string, value: Record<string, unknown>, restore: (value: any) => void) {
  const storageKey = `arkaiv-editor:${getSpreadsheetConfig()?.spreadsheetId || 'local'}:${key}`;
  const ref = useRef<DraftEntry | null>(null);
  if (ref.current?.key !== storageKey) {
    let initial: any = null;
    try { initial = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}
    ref.current = { key: storageKey, initial, dirty: { current: Boolean(initial) }, hydrating: Boolean(initial), latest: value };
  }
  const entry = ref.current;
  entry.latest = value;
  useEffect(() => { if (entry.initial) restore(entry.initial); }, [storageKey]);
  useEffect(() => {
    if (entry.hydrating) { entry.hydrating = false; return; }
    if (entry.dirty.current) { try { localStorage.setItem(entry.key, JSON.stringify(value)); } catch {} }
  }, [value, storageKey]);
  useEffect(() => () => {
    if (entry.dirty.current) { try { localStorage.setItem(entry.key, JSON.stringify(entry.latest)); } catch {} }
  }, [storageKey]);
  return {
    dirty: entry.dirty,
    markDirty: () => { entry.dirty.current = true; },
    clear: () => { entry.dirty.current = false; entry.initial = null; try { localStorage.removeItem(entry.key); } catch {} },
  };
}
