import { ItemType } from '../types.js';
export interface SyncOperation {
  operationId: string; scope: string; deviceId: string;
  entityKind: 'item' | 'config'; entityId: string;
  before: unknown; after: unknown; parentOperationId?: string;
}
export interface SyncReceipt { operationId: string; state: 'committed' | 'conflict'; error?: string; }
const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).filter(key => (value as any)[key] !== undefined).sort().map(key => [key, normalize((value as any)[key])]));
  return value ?? null;
};
export const equivalent = (a: unknown, b: unknown) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
export class SyncConflict extends Error {}
export class DeferredDependency extends Error {}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
/** Three-way merge. A concurrent change to the same leaf must be reviewed. */
export function mergeMutation(before: unknown, after: unknown, current: unknown, path = 'entity', resolve?: (after: unknown, current: unknown) => unknown): unknown {
  if (equivalent(before, after)) return current;
  if (equivalent(current, before) || equivalent(current, after)) return after;
  if (object(before) && object(after) && object(current)) {
    const result: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(before), ...Object.keys(after), ...Object.keys(current)])) {
      const merged = mergeMutation(before[key], after[key], current[key], `${path}.${key}`, resolve);
      if (merged !== undefined && merged !== null) result[key] = merged;
      else if (after[key] === null && Object.hasOwn(after, key)) result[key] = null;
    }
    return result;
  }
  if ([before, after, current].every(value => Array.isArray(value) && value.every(entry => object(entry) && typeof entry.id === 'string')) &&
      [before, after, current].some(value => (value as any[]).length > 0)) {
    const [b, a, c] = [before, after, current].map(value => new Map((value as any[]).map(entry => [entry.id, entry])));
    const result: unknown[] = [];
    for (const id of new Set([...c.keys(), ...a.keys(), ...b.keys()])) {
      const merged = mergeMutation(b.get(id), a.get(id), c.get(id), `${path}[${id}]`, resolve);
      if (merged != null) result.push(merged);
    }
    return result;
  }
  if (resolve) return resolve(after, current);
  throw new SyncConflict(`Conflicting change at ${path}`);
}
const configFields = new Set(['wallets', 'skills', 'budgetConfig', 'appSettings', 'customPrompt', 'monthlyThemes', 'monthlyThemeImages', 'chatHistory', 'canonicalRules']);
export function validateOperation(value: any, scope: string): SyncOperation {
  if (!value || !/^[\w-]{8,128}$/.test(value.operationId) || value.scope !== scope ||
      !['item', 'config'].includes(value.entityKind) || typeof value.deviceId !== 'string' ||
      typeof value.entityId !== 'string' || !value.entityId || value.entityId.length > 200 ||
      !Object.hasOwn(value, 'before') || !Object.hasOwn(value, 'after')) throw new Error('Invalid sync operation');
  if (value.parentOperationId && !/^[\w-]{8,128}$/.test(value.parentOperationId)) throw new Error('Invalid dependency');
  if (value.entityKind === 'config' && !configFields.has(value.entityId)) throw new Error('Unsupported config field');
  if (value.entityKind === 'item') for (const entity of [value.before, value.after]) {
    if (entity !== null && (!object(entity) || entity.id !== value.entityId || typeof entity.content !== 'string' || !object(entity.meta) ||
      !Object.values(ItemType).includes(entity.type as ItemType) || !['pending', 'done'].includes(String(entity.status)) || typeof entity.created_at !== 'string')) throw new Error('Invalid entity');
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > 180_000) throw new Error('Operation exceeds 180 KB');
  return { operationId: value.operationId, scope, deviceId: value.deviceId, entityKind: value.entityKind,
    entityId: value.entityId, before: value.before, after: value.after, ...(value.parentOperationId ? { parentOperationId: value.parentOperationId } : {}) };
}
