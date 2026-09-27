import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchDb, mergePendingSpreadsheetWrite, syncData } from '../syncFacade';
import { DbSchema, ItemType } from '../../types';
import { cachePendingSpreadsheetWrite, cacheSpreadsheetDbForMigration, clearPendingSpreadsheetWrite, clearSpreadsheetConfig, getPendingSpreadsheetWrite, saveSpreadsheetConfig } from '../spreadsheetService';

test('sync facade no longer exposes GitHub/db.json as a runtime provider', async () => {
  const result = await syncData({ data: [] });
  assert.equal(result.success, false);
  assert.equal(result.method, 'error');
  assert.match(result.error || '', /Spreadsheet is not connected/i);
});

test('pending local spreadsheet writes survive a refresh fetch that is missing the new item', () => {
  const remoteData: DbSchema = {
    data: [{
      id: 'remote-existing',
      type: ItemType.NOTE,
      content: 'already synced',
      status: 'done',
      created_at: '2026-05-13T00:00:00.000Z',
      meta: {},
    }],
  };
  const pendingData: DbSchema = {
    data: [{
      id: 'local-new',
      type: ItemType.NOTE,
      content: 'typed locally before refresh',
      status: 'done',
      created_at: '2026-05-13T00:01:00.000Z',
      meta: {},
    }, ...remoteData.data],
  };

  const { merged, hasPendingChanges } = mergePendingSpreadsheetWrite(remoteData, pendingData);

  assert.equal(hasPendingChanges, true);
  assert.deepEqual(new Set(merged.data.map(item => item.id)), new Set(['remote-existing', 'local-new']));
});

test('persisted pending baseline preserves deletions across offline fetch, reload and repeated edits', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Synthetic offline test'); });
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
  try {
    clearSpreadsheetConfig();
    const base: DbSchema = {
      data: [{ id: 'deleted', type: ItemType.NOTE, content: 'delete me', status: 'done', created_at: '2026-09-01T00:00:00Z', meta: {} }],
      skills: [{ id: 'skill', name: 'Old skill', color: 'green', created_at: '2026-09-01T00:00:00Z' }],
      wallets: [{ id: 'wallet', name: 'Old wallet', color: 'green', type: 'cash', initialBalance: 0 }],
      budgetConfig: { monthlyIncome: 100, rules: [{ id: 'rule', name: 'Old category', color: 'green', percentage: 100 }] },
    };
    cacheSpreadsheetDbForMigration(base);
    const firstId = cachePendingSpreadsheetWrite({ data: [], skills: [], wallets: [], budgetConfig: { monthlyIncome: 100, rules: [] } });
    saveSpreadsheetConfig({ spreadsheetId: 'test-offline', spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/test-offline/edit' });
    const fallback = await fetchDb();
    assert.equal(fallback.hasChanges, true);
    assert.deepEqual(fallback.data.data, []);
    assert.equal(getPendingSpreadsheetWrite()?.id, firstId, 'a failed fetch must not acknowledge pending edits');
    // Reset in-memory hydration (as on reload), then make another edit.
    clearSpreadsheetConfig();
    const remoteAdded = { ...base.data[0], id: 'new-remote', content: 'added elsewhere' };
    const localAdded = { ...base.data[0], id: 'new-local', content: 'added offline' };
    const secondId = cachePendingSpreadsheetWrite({ data: [localAdded], skills: [], wallets: [], budgetConfig: { monthlyIncome: 100, rules: [] } });
    clearPendingSpreadsheetWrite(firstId);
    const pending = getPendingSpreadsheetWrite()!;
    assert.equal(pending.id, secondId, 'an older save must not clear a newer pending write');
    assert.deepEqual(pending.base?.data, base.data);
    const { merged, hasPendingChanges } = mergePendingSpreadsheetWrite({ ...base, data: [...base.data, remoteAdded] }, pending.data, pending.base);
    assert.equal(hasPendingChanges, true);
    assert.deepEqual(merged.data.map(item => item.id).sort(), ['new-local', 'new-remote']);
    assert.deepEqual(merged.skills, []);
    assert.deepEqual(merged.wallets, []);
    assert.deepEqual(merged.budgetConfig?.rules, []);
    clearPendingSpreadsheetWrite(secondId);
    assert.equal(getPendingSpreadsheetWrite(), null);
  } finally {
    clearSpreadsheetConfig();
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('legacy pending writes without a baseline remain non-destructive', () => {
  const remote: DbSchema = { data: [{ id: 'old', type: ItemType.NOTE, content: 'keep', status: 'done', created_at: '2026-09-01T00:00:00Z', meta: {} }] };
  assert.deepEqual(mergePendingSpreadsheetWrite(remote, { data: [] }).merged.data, remote.data);
});
