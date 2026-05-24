import { useCallback, useEffect, useRef } from 'react';
import { BrainDumpItem } from '../types';

type RoutineResetDeps = {
  itemsRef: { current: BrainDumpItem[] };
  setItems: (items: BrainDumpItem[]) => void;
  saveAndSync: (items: BrainDumpItem[], ...rest: any[]) => Promise<void>;
  checkRoutineResets: (items: BrainDumpItem[]) => BrainDumpItem[];
};

export const useRoutineReset = (deps: RoutineResetDeps) => {
  const { itemsRef, setItems, saveAndSync, checkRoutineResets } = deps;
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const runRoutineResetIfDue = useCallback(() => {
    const { itemsRef, setItems, saveAndSync, checkRoutineResets } = depsRef.current;
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) return;

    const updatedItems = checkRoutineResets(currentItems);
    if (JSON.stringify(updatedItems) === JSON.stringify(currentItems)) return;

    itemsRef.current = updatedItems;
    setItems(updatedItems);
    saveAndSync(updatedItems);
  }, []);

  useEffect(() => {
    const handleVisibleOrFocused = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      runRoutineResetIfDue();
    };

    const intervalId = window.setInterval(runRoutineResetIfDue, 60 * 1000);
    window.addEventListener('focus', handleVisibleOrFocused);
    document.addEventListener('visibilitychange', handleVisibleOrFocused);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibleOrFocused);
      document.removeEventListener('visibilitychange', handleVisibleOrFocused);
    };
  }, [runRoutineResetIfDue]);

  return { runRoutineResetIfDue };
};
