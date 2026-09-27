import type { DbSchema } from '../types';
import { mergeDbData } from './mergeUtils';

export type SaveChanges = Partial<DbSchema> & { forceOverwrite?: boolean };

export function combineSaveChanges(previous: SaveChanges = {}, next: SaveChanges = {}): SaveChanges {
  const defined = Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
  return { ...previous, ...defined, forceOverwrite: previous.forceOverwrite || next.forceOverwrite };
}

/** Apply acknowledged remote data without discarding edits made while the request was in flight. */
export function applySaveResult(current: DbSchema, remote: DbSchema, before: DbSchema): DbSchema {
  const incoming = { ...before, ...Object.fromEntries(Object.entries(remote).filter(([, value]) => value !== undefined)), data: remote.data };
  const result = mergeDbData(current, incoming, before);
  // The entity collections use the existing ID-aware three-way merge. Scalar/config
  // fields take the server result only when the user has not edited them in flight.
  for (const key of ['customPrompt', 'chatHistory'] as const) {
    if (remote[key] !== undefined && JSON.stringify(current[key]) === JSON.stringify(before[key])) {
      Object.assign(result, { [key]: remote[key] });
    } else if (current[key] !== undefined) {
      Object.assign(result, { [key]: current[key] });
    }
  }
  for (const key of ['appSettings', 'monthlyThemes', 'monthlyThemeImages'] as const) {
    if (!remote[key]) continue;
    const base = before[key] || {};
    const local = current[key] || {};
    const incoming = remote[key] || {};
    const merged: Record<string, unknown> = {};
    for (const field of new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(incoming)])) {
      const value = JSON.stringify(local[field]) === JSON.stringify(base[field]) ? incoming[field] : local[field];
      if (value !== undefined) merged[field] = value;
    }
    Object.assign(result, { [key]: merged });
  }
  return result;
}
