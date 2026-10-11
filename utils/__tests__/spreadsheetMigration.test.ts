import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMigrationPlan, type WorkbookBackup } from '../spreadsheetMigration';
import { exportCore } from '../../api/_lib/durableSheets';
import { ItemType, type BrainDumpItem } from '../../types';
const item: BrainDumpItem = { id: 'shopping-done', type: ItemType.SHOPPING, content: 'Soap', status: 'done', created_at: '2026-10-01T00:00:00.000Z', completed_at: '2026-10-02T00:00:00.000Z', meta: { amount: 10000, shoppingCategory: 'routine', routineInterval: 'monthly' } };
function legacyBackup(): WorkbookBackup {
  const sheets = exportCore({ data: [item] });
  const oldShopping = exportCore({ data: [{ ...item, status: 'pending' }] }).find(sheet => sheet.name === 'Shopping')!;
  oldShopping.data[1][0] = 'done';
  sheets.find(sheet => sheet.name === 'Shopping')!.data.push(oldShopping.data[1]);
  for (const sheet of sheets) if (sheet.data[0].includes('_Entity_JSON')) sheet.data = sheet.data.map(row => row.slice(0, -2));
  const ranges = sheets.map(sheet => ({ range: `'${sheet.name}'!A:ZZ`, values: sheet.data }));
  return { spreadsheetId: 'original', spreadsheet: { sheets: sheets.map((sheet, index) => ({ properties: { title: sheet.name, sheetId: index + 1, gridProperties: { rowCount: 1000, columnCount: 60 } } })) }, valueRanges: structuredClone(ranges), computedRanges: structuredClone(ranges), formattedRanges: structuredClone(ranges) };
}
test('legacy completed-shopping mirror migrates to one owner, with a recoverable original-row archive', () => {
  const backup = legacyBackup(); const original = structuredClone(backup); const plan = buildMigrationPlan(backup);
  assert.deepEqual(backup, original); assert.equal(plan.entityCount, 1); assert.equal(plan.archivedRows.length, 1);
  assert.equal(plan.archivedRows[0].sheet, 'Shopping');
  assert.equal(plan.db.data[0].meta.routineInterval, 'monthly');
  assert.ok(plan.requests.some(request => request.addSheet?.properties.title === '_Sync_Migration_Archive'));
  const active = exportCore(plan.db).filter(sheet => sheet.data.slice(1).some(row => row.includes(item.id)) && sheet.data[0].includes('_Entity_JSON'));
  assert.deepEqual(active.map(sheet => sheet.name), ['Transactions']);
});
test('divergent mirror amounts stop before any migration request is issued', () => {
  const backup = legacyBackup(); const range = backup.computedRanges.find(range => range.range.includes("'Shopping'"));
  range.values[1][2] = 20000;
  assert.throws(() => buildMigrationPlan(backup), /Divergent completed-shopping mirror/);
});
test('typed cell backup distinguishes a literal equals sign from a formula', () => {
  const backup = legacyBackup();
  const tx = backup.valueRanges.find(range => range.range.includes("'Transactions'"));
  const col = tx.values[0].indexOf('Description'); tx.values[1][col] = '=literal';
  const computed = backup.computedRanges.find(range => range.range.includes("'Transactions'")); computed.values[1][col] = '=literal';
  const shop = backup.computedRanges.find(range => range.range.includes("'Shopping'")); shop.values[1][1] = '=literal';
  const rawShop = backup.valueRanges.find(range => range.range.includes("'Shopping'")); rawShop.values[1][1] = '=literal';
  assert.throws(() => buildMigrationPlan(backup), /typed grid backup required/);
  const sheet = backup.spreadsheet.sheets.find((sheet: any) => sheet.properties.title === 'Transactions');
  const cells = Array.from({ length: col + 1 }, () => ({} as any)); cells[col] = { userEnteredValue: { stringValue: '=literal' } };
  sheet.data = [{ rowData: [{}, { values: cells }] }];
  const plan = buildMigrationPlan(backup);
  const write = plan.requests.find(request => request.updateCells?.start?.sheetId === sheet.properties.sheetId && request.updateCells.start.rowIndex === 1);
  assert.deepEqual(write.updateCells.rows[0].values[col], { userEnteredValue: { stringValue: '=literal' } });
});
