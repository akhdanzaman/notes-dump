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

test('managed sheet formatting is limited to setup or newly-created sheets', () => {
  assert.equal(__test__.shouldApplyManagedSheetFormatting('Dashboard', new Set(), false), false);
  assert.equal(__test__.shouldApplyManagedSheetFormatting('Dashboard', new Set(['Dashboard']), false), true);
  assert.equal(__test__.shouldApplyManagedSheetFormatting('Dashboard', new Set(), true), true);
});

test('dashboard charts render only during setup or when charts are missing', () => {
  assert.equal(__test__.shouldRenderDashboardCharts(false, [101]), false);
  assert.equal(__test__.shouldRenderDashboardCharts(false, []), true);
  assert.equal(__test__.shouldRenderDashboardCharts(true, [101]), true);
});
