import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__ } from '../spreadsheetService';

test('system sheet snapshot ignores stale trailing rows using metadata chunk count', () => {
  const rows = __test__.buildSystemSheetRows(JSON.stringify({ data: [{ id: '1' }] }), 'writing');
  rows.push(['stale-old-tail-that-must-be-ignored']);

  const snapshot = __test__.extractSystemSheetSnapshot({ values: rows });

  assert.equal(snapshot.status, 'writing');
  assert.equal(snapshot.format, 'v2');
  assert.deepEqual(JSON.parse(snapshot.jsonString), { data: [{ id: '1' }] });
});

test('legacy system sheet snapshot remains readable', () => {
  const legacyRows = [
    ['{"data":[' ],
    ['{"id":"legacy-1"}'],
    [']}'],
  ];

  const snapshot = __test__.extractSystemSheetSnapshot({ values: legacyRows });

  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.format, 'legacy');
  assert.deepEqual(JSON.parse(snapshot.jsonString), { data: [{ id: 'legacy-1' }] });
});
