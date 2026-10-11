import test from 'node:test';
import assert from 'node:assert/strict';
import { isSpreadsheetMaintenanceRequestAllowed } from '../../api/_lib/googleServiceAccount';
test('maintenance writes require a separate strong secret; normal app sessions do not unlock them', () => {
  const previous = process.env.SPREADSHEET_MIGRATION_SECRET;
  try {
    delete process.env.SPREADSHEET_MIGRATION_SECRET;
    assert.equal(isSpreadsheetMaintenanceRequestAllowed({ 'x-arkaiv-migration': 'a'.repeat(48) }), false);
    process.env.SPREADSHEET_MIGRATION_SECRET = 'short';
    assert.equal(isSpreadsheetMaintenanceRequestAllowed({ 'x-arkaiv-migration': 'short' }), false);
    process.env.SPREADSHEET_MIGRATION_SECRET = 'a'.repeat(48);
    assert.equal(isSpreadsheetMaintenanceRequestAllowed({}), false);
    assert.equal(isSpreadsheetMaintenanceRequestAllowed({ 'x-arkaiv-migration': 'b'.repeat(48) }), false);
    assert.equal(isSpreadsheetMaintenanceRequestAllowed({ 'x-arkaiv-migration': 'a'.repeat(48) }), true);
  } finally { if (previous === undefined) delete process.env.SPREADSHEET_MIGRATION_SECRET; else process.env.SPREADSHEET_MIGRATION_SECRET = previous; }
});
