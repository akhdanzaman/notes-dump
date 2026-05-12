import test from 'node:test';
import assert from 'node:assert/strict';

import { getActiveSyncProviders, mergePendingSpreadsheetWrite, syncData } from '../syncFacade';
import { DbSchema, ItemType } from '../../types';

test('sync facade no longer exposes GitHub/db.json as a runtime provider', async () => {
  assert.deepEqual(getActiveSyncProviders(), []);

  const result = await syncData([]);
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
