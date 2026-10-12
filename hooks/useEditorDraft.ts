import { useEffect, useRef } from 'react';
import { getSpreadsheetConfig } from '../services/spreadsheetService';

/** UI drafts are separate from entities and never become spreadsheet mutations. */
export function useEditorDraft(key: string, value: Record<string, unknown>, restore: (value: any) => void) {
  const storageKey = `arkaiv-editor:${getSpreadsheetConfig()?.spreadsheetId || 'local'}:${key}`;
  const initial = useRef<any>(undefined);
  const loaded = useRef(false);
  if (!loaded.current) {
    loaded.current = true;
    try { initial.current = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch { initial.current = null; }
  }
  const dirty = useRef(Boolean(initial.current));
  const restored = useRef(false);
  const hydrating = useRef(Boolean(initial.current));
  const latest = useRef(value); latest.current = value;
  useEffect(() => {
    if (!restored.current) { restored.current = true; if (initial.current) restore(initial.current); }
  }, [storageKey]);
  useEffect(() => {
    if (hydrating.current) { hydrating.current = false; return; }
    if (dirty.current) { try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Entity persistence still reports storage failure on Save. */ } }
  }, [value, storageKey]);
  useEffect(() => () => {
    if (dirty.current) { try { localStorage.setItem(storageKey, JSON.stringify(latest.current)); } catch {} }
  }, [storageKey]);
  return {
    dirty,
    markDirty: () => { dirty.current = true; },
    clear: () => { dirty.current = false; initial.current = null; try { localStorage.removeItem(storageKey); } catch {} },
  };
}
