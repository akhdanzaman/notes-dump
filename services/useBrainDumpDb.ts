import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrainDumpItem, BudgetConfig, DbSchema, Skill } from "../types";
import { fetchDb, normalizeDb, syncDb } from "./githubDb";

type SyncState = "idle" | "syncing" | "error" | "ok";

type UseBrainDumpDbOptions = {
  autoSync?: boolean; // default true
  allowEmptyOverwrite?: boolean; // default false (safety)
};

export function useBrainDumpDb(options: UseBrainDumpDbOptions = {}) {
  const { autoSync = true, allowEmptyOverwrite = false } = options;

  const [hydrated, setHydrated] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastSource, setLastSource] = useState<"cloud" | "local" | "empty">(
    "empty",
  );

  const [items, _setItems] = useState<BrainDumpItem[]>([]);
  const [budgetConfig, _setBudgetConfig] = useState<BudgetConfig | undefined>(
    undefined,
  );
  const [customPrompt, _setCustomPrompt] = useState<string | undefined>(
    undefined,
  );
  const [skills, _setSkills] = useState<Skill[] | undefined>(undefined);

  // Prevent autosync while we are applying initial load
  const applyingInitialLoadRef = useRef(false);

  const db: DbSchema = useMemo(
    () => normalizeDb({ data: items, budgetConfig, customPrompt, skills }),
    [items, budgetConfig, customPrompt, skills],
  );

  // --- setters that mark dirty (but NOT during initial hydration)
  const setItems = useCallback(
    (next: BrainDumpItem[] | ((prev: BrainDumpItem[]) => BrainDumpItem[])) => {
      _setItems((prev) => {
        const resolved =
          typeof next === "function" ? (next as any)(prev) : next;
        if (!applyingInitialLoadRef.current) setDirty(true);
        return resolved;
      });
    },
    [],
  );

  const setBudgetConfig = useCallback((next: BudgetConfig | undefined) => {
    _setBudgetConfig(next);
    if (!applyingInitialLoadRef.current) setDirty(true);
  }, []);

  const setCustomPrompt = useCallback((next: string | undefined) => {
    _setCustomPrompt(next);
    if (!applyingInitialLoadRef.current) setDirty(true);
  }, []);

  const setSkills = useCallback((next: Skill[] | undefined) => {
    _setSkills(next);
    if (!applyingInitialLoadRef.current) setDirty(true);
  }, []);

  // --- initial load
  useEffect(() => {
    let mounted = true;

    (async () => {
      applyingInitialLoadRef.current = true;
      try {
        const res = await fetchDb(false);
        if (!mounted) return;

        const loaded = normalizeDb(res.data);

        _setItems(loaded.data);
        _setBudgetConfig(loaded.budgetConfig);
        _setCustomPrompt(loaded.customPrompt);
        _setSkills(loaded.skills);

        setLastSource(res.source);
        setHydrated(true);
        setDirty(false);
      } catch (e) {
        console.error("Initial DB load failed:", e);
        if (!mounted) return;
        // still mark hydrated to avoid app stuck; but sync should not run until user edits
        setHydrated(true);
        setDirty(false);
        setSyncState("error");
      } finally {
        applyingInitialLoadRef.current = false;
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // --- manual sync
  const syncNow = useCallback(async () => {
    if (!hydrated) return { success: false, method: "error" as const };
    setSyncState("syncing");

    const result = await syncDb(db, { allowEmptyOverwrite });
    if (result.success) {
      setSyncState("ok");
      setDirty(false);
    } else {
      setSyncState("error");
    }
    return result;
  }, [db, hydrated, allowEmptyOverwrite]);

  // --- autosync (SAFE): only after hydrated + only if dirty
  useEffect(() => {
    if (!autoSync) return;
    if (!hydrated) return;
    if (!dirty) return;

    // Optional: debounce a little to avoid syncing on every keystroke
    const t = setTimeout(() => {
      syncNow();
    }, 600);

    return () => clearTimeout(t);
  }, [autoSync, hydrated, dirty, syncNow]);

  return {
    // state
    hydrated,
    dirty,
    syncState,
    lastSource,

    // data + setters
    items,
    setItems,
    budgetConfig,
    setBudgetConfig,
    customPrompt,
    setCustomPrompt,
    skills,
    setSkills,

    // actions
    syncNow,
  };
}
