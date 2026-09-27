import type { RoutineMeta } from '../types';
export type { RoutineMeta } from '../types';
export interface RoutineDraft {
  recurrence: string;
  interval: NonNullable<RoutineMeta['routineInterval']>;
  daysOfWeek: number[];
  daysOfMonth: number[];
  monthsOfYear: number[];
}
export function createRoutineDraft(meta: RoutineMeta, fallback = ''): RoutineDraft {
  return {
    recurrence: meta.recurrenceDays ? String(meta.recurrenceDays) : fallback,
    interval: meta.routineInterval || 'daily',
    daysOfWeek: [...(meta.routineDaysOfWeek || [])],
    daysOfMonth: [...(meta.routineDaysOfMonth || [])],
    monthsOfYear: [...(meta.routineMonthsOfYear || [])],
  };
}
export function routineDraftPatch(draft: RoutineDraft): RoutineMeta {
  const days = Number(draft.recurrence);
  return {
    recurrenceDays: Number.isInteger(days) && days > 0 ? days : undefined,
    routineInterval: draft.interval,
    routineDaysOfWeek: draft.daysOfWeek,
    routineDaysOfMonth: draft.daysOfMonth,
    routineMonthsOfYear: draft.monthsOfYear,
  };
}
