import type { DbSchema, BrainDumpItem } from '../types';
import { mergeMutation } from '../utils/syncProtocol';
export type MutationState = 'pending' | 'sending' | 'accepted' | 'conflict';
export interface LocalMutation {
  operationId: string; scope: string; deviceId: string; entityKind: 'item' | 'config'; entityId: string;
  before: unknown; after: unknown; state: MutationState; createdAt: number; attempts: number;
  batchId?: string; error?: string; parentOperationId?: string;
}
interface StateRecord { scope: string; order: string[]; config: Omit<DbSchema, 'data'>; }
interface EntityRecord { key: string; scope: string; item: BrainDumpItem; }
interface DraftRecord { id: string; scope: string; text: string; createdAt: number; }
let connection: Promise<IDBDatabase> | undefined;
let writing: Promise<unknown> = Promise.resolve();
const request = <T>(value: IDBRequest<T>) => new Promise<T>((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
const completion = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('Local persistence failed')); });
function open() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable'));
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    const opening = indexedDB.open('arkaiv-sync-v3', 1);
    opening.onupgradeneeded = () => {
      const db = opening.result;
      db.createObjectStore('states', { keyPath: 'scope' });
      for (const [name, keyPath] of [['entities', 'key'], ['outbox', 'operationId'], ['drafts', 'id']]) db.createObjectStore(name, { keyPath }).createIndex('scope', 'scope');
    };
    opening.onsuccess = () => { opening.result.onversionchange = () => { opening.result.close(); connection = undefined; }; resolve(opening.result); };
    opening.onerror = () => { connection = undefined; reject(opening.error); };
    opening.onblocked = () => reject(new Error('Close older app tabs to upgrade local storage'));
  });
  return connection;
}
export function localScope(spreadsheetId?: string) { return spreadsheetId || 'unconnected'; }
const equal = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let device = '';
function deviceId() { if (!device) { try { device = localStorage.getItem('arkaiv-device-id') || id(); localStorage.setItem('arkaiv-device-id', device); } catch { device = id(); } } return device; }
function assemble(state: StateRecord | undefined, entities: EntityRecord[]): DbSchema | undefined {
  if (!state) return undefined;
  const byId = new Map(entities.map(record => [record.item.id, record.item]));
  return { ...state.config, data: state.order.flatMap(entityId => byId.has(entityId) ? [byId.get(entityId)!] : []) };
}
export async function readLocalState(scope: string) {
  const db = await open(); const transaction = db.transaction(['states', 'entities', 'outbox'], 'readonly'); const done = completion(transaction);
  const [state, entities, operations] = await Promise.all([
    request(transaction.objectStore('states').get(scope)) as Promise<StateRecord | undefined>,
    request(transaction.objectStore('entities').index('scope').getAll(scope)) as Promise<EntityRecord[]>,
    request(transaction.objectStore('outbox').index('scope').getAll(scope)) as Promise<LocalMutation[]>,
  ]); await done;
  return { data: assemble(state, entities), operations: operations.sort((a, b) => a.createdAt - b.createdAt) };
}
/** The entity state and its pending mutations commit in ONE local transaction. */
export function persistLocalState(scope: string, next: DbSchema, baseline?: DbSchema, recordMutations = true): Promise<void> {
  const snapshot = structuredClone(next);
  const task = async () => {
    const db = await open(); const transaction = db.transaction(['states', 'entities', 'outbox'], 'readwrite'); const done = completion(transaction);
    const stateStore = transaction.objectStore('states'); const entityStore = transaction.objectStore('entities'); const outbox = transaction.objectStore('outbox');
    try {
      const [state, entities, pending] = await Promise.all([
        request(stateStore.get(scope)) as Promise<StateRecord | undefined>,
        request(entityStore.index('scope').getAll(scope)) as Promise<EntityRecord[]>,
        request(outbox.index('scope').getAll(scope)) as Promise<LocalMutation[]>,
      ]);
      const previous = assemble(state, entities) || baseline || { data: [] };
      const beforeById = new Map(previous.data.map(item => [item.id, item])); const afterById = new Map(snapshot.data.map(item => [item.id, item]));
      const changes: Array<{ entityKind: 'item' | 'config'; entityId: string; before: unknown; after: unknown }> = [];
      for (const entityId of new Set([...beforeById.keys(), ...afterById.keys()])) {
        const before = beforeById.get(entityId); const after = afterById.get(entityId);
        if (!equal(before, after)) changes.push({ entityKind: 'item', entityId, before: before ?? null, after: after ?? null });
        if (after) entityStore.put({ key: `${scope}|${entityId}`, scope, item: after }); else entityStore.delete(`${scope}|${entityId}`);
      }
      for (const field of new Set([...Object.keys(previous), ...Object.keys(snapshot)])) {
        if (field === 'data') continue;
        const before = (previous as any)[field]; const after = (snapshot as any)[field];
        if (!equal(before, after)) changes.push({ entityKind: 'config', entityId: field, before: before ?? null, after: after ?? null });
      }
      let mutationAt = pending.reduce((latest, operation) => Math.max(latest, operation.createdAt), Date.now());
      if (recordMutations) for (const change of changes) {
        const existing = pending.find(operation => operation.state === 'pending' && operation.entityKind === change.entityKind && operation.entityId === change.entityId);
        const mutation: LocalMutation = existing ? { ...existing, after: change.after } : { ...change, scope, operationId: id(), deviceId: deviceId(), state: 'pending', createdAt: ++mutationAt, attempts: 0 };
        if (!existing) mutation.parentOperationId = [...pending].reverse().find(operation => operation.entityKind === change.entityKind && operation.entityId === change.entityId && operation.state !== 'pending')?.operationId;
        if (equal(mutation.before, mutation.after)) outbox.delete(mutation.operationId); else outbox.put(mutation);
      }
      const { data: _items, ...config } = snapshot;
      stateStore.put({ scope, order: snapshot.data.map(item => item.id), config });
      // Populate unmodified baseline entities on the first write as well.
      if (!state) for (const item of snapshot.data) entityStore.put({ key: `${scope}|${item.id}`, scope, item });
      await done;
    } catch (error) { try { transaction.abort(); } catch {} await done.catch(() => {}); throw error; }
  };
  const result = writing.then(task, task); writing = result.catch(() => {}); return result;
}
export async function changeOperationState(scope: string, operationIds: string[], state: MutationState, batchId?: string, error?: string) {
  const db = await open(); const transaction = db.transaction('outbox', 'readwrite'); const done = completion(transaction); const store = transaction.objectStore('outbox');
  for (const operationId of operationIds) { const operation = await request(store.get(operationId)) as LocalMutation | undefined; if (operation?.scope === scope) store.put({ ...operation, state, batchId, error, attempts: operation.attempts + (state === 'sending' ? 1 : 0) }); }
  await done;
}
export async function claimOperations(scope: string, operationIds: string[]): Promise<LocalMutation[]> {
  const db = await open(); const transaction = db.transaction('outbox', 'readwrite'); const done = completion(transaction);
  const store = transaction.objectStore('outbox'); const claimed: LocalMutation[] = [];
  for (const operationId of operationIds) {
    const operation = await request(store.get(operationId)) as LocalMutation | undefined;
    if (operation?.scope === scope && operation.state !== 'conflict') {
      const next = { ...operation, state: 'sending' as const, attempts: operation.attempts + 1 };
      store.put(next); claimed.push(next);
    }
  }
  await done; return claimed;
}
export async function acknowledgeOperations(scope: string, operationIds: string[]) {
  const db = await open(); const transaction = db.transaction('outbox', 'readwrite'); const done = completion(transaction); const store = transaction.objectStore('outbox');
  for (const operationId of operationIds) { const operation = await request(store.get(operationId)) as LocalMutation | undefined; if (operation?.scope === scope) store.delete(operationId); }
  await done;
}
export function reconstructBaseline(data: DbSchema, operations: LocalMutation[]): DbSchema {
  const base = structuredClone(data); const items = new Map(base.data.map(item => [item.id, item]));
  for (const operation of [...operations].reverse()) {
    if (operation.entityKind === 'item') { if (operation.before) items.set(operation.entityId, operation.before as BrainDumpItem); else items.delete(operation.entityId); }
    else { if (operation.before === null) delete (base as any)[operation.entityId]; else (base as any)[operation.entityId] = operation.before; }
  }
  base.data = [...items.values()]; return base;
}
export async function persistDraft(scope: string, draftId: string, text: string) { const db = await open(); const transaction = db.transaction('drafts', 'readwrite'); const done = completion(transaction); transaction.objectStore('drafts').put({ id: draftId, scope, text, createdAt: Date.now() }); await done; }
export async function readDrafts(scope: string): Promise<DraftRecord[]> { const db = await open(); return request(db.transaction('drafts').objectStore('drafts').index('scope').getAll(scope)); }
export async function removeDraft(draftId: string) { const db = await open(); const transaction = db.transaction('drafts', 'readwrite'); const done = completion(transaction); transaction.objectStore('drafts').delete(draftId); await done; }
export function closeLocalStore() { void connection?.then(db => db.close()); connection = undefined; device = ''; }

/** Review replaces conflict IDs with new operations, atomically with the rebased local state. */
export async function resolveLocalConflicts(scope: string, remote: DbSchema, preferLocal: boolean) {
  const db = await open(); const tx = db.transaction(['states', 'entities', 'outbox'], 'readwrite'); const done = completion(tx);
  const states = tx.objectStore('states'); const entities = tx.objectStore('entities'); const outbox = tx.objectStore('outbox');
  try {
    const [state, records, operations] = await Promise.all([
      request(states.get(scope)) as Promise<StateRecord | undefined>, request(entities.index('scope').getAll(scope)) as Promise<EntityRecord[]>,
      request(outbox.index('scope').getAll(scope)) as Promise<LocalMutation[]>,
    ]);
    if (!operations.length || operations.some(operation => operation.state !== 'conflict')) throw new Error('Wait for outstanding operations to settle before reviewing conflicts');
    const local = assemble(state, records)!; const base = reconstructBaseline(local, operations.sort((a, b) => a.createdAt - b.createdAt));
    const next = structuredClone(remote); const items = new Map(next.data.map(item => [item.id, item]));
    const unique = new Map(operations.map(operation => [`${operation.entityKind}:${operation.entityId}`, operation]));
    let createdAt = Date.now();
    for (const operation of unique.values()) {
      const value = (db: DbSchema) => operation.entityKind === 'item' ? db.data.find(item => item.id === operation.entityId) ?? null : (db as any)[operation.entityId] ?? null;
      const before = value(remote); const after = mergeMutation(value(base), value(local), before, 'entity', (localValue, remoteValue) => preferLocal ? localValue : remoteValue);
      if (operation.entityKind === 'item') { if (after) items.set(operation.entityId, after as BrainDumpItem); else items.delete(operation.entityId); }
      else (next as any)[operation.entityId] = after;
      if (!equal(before, after)) outbox.put({ operationId: id(), scope, deviceId: deviceId(), entityKind: operation.entityKind,
        entityId: operation.entityId, before, after: after ?? null, state: 'pending', createdAt: ++createdAt, attempts: 0 });
    }
    for (const operation of operations) outbox.delete(operation.operationId);
    next.data = [...items.values()]; const { data, ...config } = next;
    for (const record of records) entities.delete(record.key);
    for (const item of data) entities.put({ key: `${scope}|${item.id}`, scope, item });
    states.put({ scope, order: data.map(item => item.id), config });
    await done; return next;
  } catch (error) { try { tx.abort(); } catch {} await done.catch(() => {}); throw error; }
}
