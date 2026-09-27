import { useState, type SetStateAction } from 'react';
import { createRoutineDraft, routineDraftPatch, type RoutineDraft, type RoutineMeta } from '../utils/routineDraft';

export function useRoutineDraft(meta: RoutineMeta, fallback = '') {
  const [draft, setDraft] = useState(() => createRoutineDraft(meta, fallback));
  const field = <K extends keyof RoutineDraft>(key: K) => (value: SetStateAction<RoutineDraft[K]>) =>
    setDraft(previous => ({ ...previous, [key]: typeof value === 'function'
      ? (value as (old: RoutineDraft[K]) => RoutineDraft[K])(previous[key]) : value }));
  return {
    editRecurrenceDays: draft.recurrence, setEditRecurrenceDays: field('recurrence'),
    editRoutineInterval: draft.interval, setEditRoutineInterval: field('interval'),
    editRoutineDaysOfWeek: draft.daysOfWeek, setEditRoutineDaysOfWeek: field('daysOfWeek'),
    editRoutineDaysOfMonth: draft.daysOfMonth, setEditRoutineDaysOfMonth: field('daysOfMonth'),
    editRoutineMonthsOfYear: draft.monthsOfYear, setEditRoutineMonthsOfYear: field('monthsOfYear'),
    resetRoutine: (next: RoutineMeta) => setDraft(createRoutineDraft(next, fallback)),
    getRoutinePatch: () => routineDraftPatch(draft),
  };
}
