import test from 'node:test';
import assert from 'node:assert/strict';

import { getActiveSyncProviders, syncData } from '../syncFacade';

test('sync facade no longer exposes GitHub/db.json as a runtime provider', async () => {
  assert.deepEqual(getActiveSyncProviders(), []);

  const result = await syncData([]);
  assert.equal(result.success, false);
  assert.equal(result.method, 'error');
  assert.match(result.error || '', /Spreadsheet is not connected/i);
});
