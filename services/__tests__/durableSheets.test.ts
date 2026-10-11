import test from 'node:test';
import assert from 'node:assert/strict';
import { DurableSheets, exportCore, RECEIPT_SHEET } from '../../api/_lib/durableSheets';
import { mergeMutation, SyncConflict, DeferredDependency, validateOperation, type SyncOperation } from '../../utils/syncProtocol';
import { reconcileSpreadsheetData } from '../spreadsheetReconciler';
import { ItemType, type DbSchema } from '../../types';
import { applyLosslessConfig } from '../../utils/losslessConfig';
const note = (id = 'one') => ({ id, type: ItemType.NOTE, content: 'old', status: 'pending' as const, created_at: '2026-10-01T00:00:00.000Z', meta: {} });
function workbook(items = [note()]) {
  let sheets = exportCore({ data: items }).map((sheet, index) => ({ properties: { title: sheet.name, sheetId: index + 1, gridProperties: { rowCount: 1000, columnCount: Math.max(26, sheet.data[0].length) } }, values: sheet.data as unknown[][] }));
  let writes = 0; let loseResponse = false; const reads: string[] = [];
  const transport = async (_scope: string, path: string, init?: RequestInit) => {
    if (path.startsWith('?')) return Response.json({ sheets: sheets.map(sheet => ({ properties: sheet.properties })) });
    if (path.startsWith('/values:batchGet')) {
      const query = new URLSearchParams(path.split('?')[1]);
      return Response.json({ valueRanges: query.getAll('ranges').map(range => {
        const name = range.match(/^'(.+)'!/)![1].replace(/''/g, "'"); reads.push(name);
        return { range, values: sheets.find(sheet => sheet.properties.title === name)?.values || [] };
      }) });
    }
    assert.equal(path, ':batchUpdate'); const requests = JSON.parse(String(init?.body)).requests;
    const next = structuredClone(sheets);
    for (const request of requests) {
      if (request.addSheet) next.push({ properties: { ...request.addSheet.properties, gridProperties: { rowCount: 1000, columnCount: 26, ...request.addSheet.properties.gridProperties } }, values: [] });
      if (request.updateCells || request.appendCells) {
        const action = request.updateCells || request.appendCells;
        const sheet = next.find(sheet => sheet.properties.sheetId === (action.sheetId ?? action.start.sheetId))!;
        const rowStart = request.appendCells ? Math.max(1, sheet.values.length) : action.start.rowIndex;
        for (const [offset, row] of action.rows.entries()) {
          const target = sheet.values[rowStart + offset] ||= [];
          for (const [column, cell] of row.values.entries()) target[(action.start?.columnIndex || 0) + column] = cell.userEnteredValue ? Object.values(cell.userEnteredValue)[0] : '';
        }
      }
      if (request.updateSheetProperties) {
        const p = request.updateSheetProperties.properties;
        Object.assign(next.find(sheet => sheet.properties.sheetId === p.sheetId)!.properties.gridProperties, p.gridProperties);
      }
    }
    sheets = next; writes++;
    if (loseResponse) { loseResponse = false; throw new Error('Connection lost AFTER commit'); }
    return Response.json({ replies: [] });
  };
  const repository = new DurableSheets(transport);
  const current = () => {
    const ranges = sheets.map(sheet => ({ range: `'${sheet.properties.title}'!A:ZZ`, values: sheet.values }));
    return applyLosslessConfig(reconcileSpreadsheetData({ data: [] }, ranges, { authoritativeEmpty: true }), ranges);
  };
  return { repository, current, reads, get sheets() { return sheets; }, get writes() { return writes; }, loseNextResponse() { loseResponse = true; } };
}
const mutation = (before: any, after: any, operationId = 'operation-0001'): SyncOperation => ({ operationId, scope: 'test-sheet', deviceId: 'device-a', entityKind: 'item', entityId: (after || before).id, before, after });

test('atomic receipt prevents duplicate append after response is lost following commit', async () => {
  const db = workbook([]); const op = mutation(null, note()); db.loseNextResponse();
  await assert.rejects(db.repository.apply(op), /AFTER commit/);
  assert.equal((await db.repository.apply(op)).state, 'committed');
  assert.equal(db.writes, 1); assert.equal(db.current().data.length, 1);
  assert.equal(db.sheets.find(sheet => sheet.properties.title === RECEIPT_SHEET)?.values.length, 2);
});
test('two devices merge independent fields but preserve explicit same-field conflicts', async () => {
  const db = workbook(); const before = structuredClone(db.current().data[0]);
  const a = { ...before, content: 'device A' }; const b = { ...before, meta: { ...before.meta, tags: ['device B'] } };
  assert.equal((await db.repository.apply(mutation(before, a))).state, 'committed');
  assert.equal((await db.repository.apply(mutation(before, b, 'operation-0002'))).state, 'committed');
  assert.equal(db.current().data[0].content, 'device A'); assert.deepEqual(db.current().data[0].meta.tags, ['device B']);
  assert.equal((await db.repository.apply(mutation(before, { ...before, content: 'device C' }, 'operation-0003'))).state, 'conflict');
  assert.equal(db.current().data[0].content, 'device A');
  assert.equal(db.reads.includes('Transactions'), false);
});
test('row deletion uses clear cells; a later update still addresses the correct ID after sort', async () => {
  const db = workbook([note('a'), note('b'), note('c')]); const before = db.current().data;
  await db.repository.apply(mutation(before[0], null));
  const sheet = db.sheets.find(sheet => sheet.properties.title === 'Notes & Journals')!;
  assert.equal(sheet.values.length, 4);
  [sheet.values[2], sheet.values[3]] = [sheet.values[3], sheet.values[2]];
  await db.repository.apply(mutation(before[2], { ...before[2], content: 'updated C' }, 'operation-0002'));
  assert.deepEqual(db.current().data.map(item => [item.id, item.content]), [['c', 'updated C'], ['b', 'old']]);
});
test('unordered queue defers dependency until parent commits, then applies child once', async () => {
  const db = workbook(); const before = db.current().data[0]; const after = { ...before, content: 'first' };
  const parent = mutation(before, after); const child = { ...mutation(after, { ...after, content: 'second' }, 'operation-0002'), parentOperationId: parent.operationId };
  await assert.rejects(db.repository.apply(child), DeferredDependency); assert.equal(db.writes, 0);
  await db.repository.apply(parent); await db.repository.apply(child); await db.repository.apply(child);
  assert.equal(db.current().data[0].content, 'second'); assert.equal(db.writes, 2);
});
test('concurrent delete versus edit conflicts; malformed IDs and oversized payloads reject before enqueue', () => {
  assert.throws(() => mergeMutation({ id: 'a', content: 'old' }, null, { id: 'a', content: 'new' }), SyncConflict);
  assert.throws(() => validateOperation({ ...mutation(note(), note()), entityId: 'other' }, 'test-sheet'), /Invalid entity/);
  assert.throws(() => validateOperation(mutation(note(), { ...note(), content: 'x'.repeat(181000) }), 'test-sheet'), /180 KB/);
});
test('unsupported legacy header is rejected without data or receipt mutation', async () => {
  const db = workbook(); const before = db.current().data[0];
  db.sheets.find(sheet => sheet.properties.title === 'Notes & Journals')!.values[0].pop();
  await assert.rejects(db.repository.apply(mutation(before, { ...before, content: 'new' })), /migration.required/i);
  assert.equal(db.writes, 0);
});
test('keyed config arrays merge edits to different IDs instead of replacing all wallets', () => {
  const before = [{ id: 'a', value: 1 }, { id: 'b', value: 1 }];
  assert.deepEqual(mergeMutation(before, [{ id: 'a', value: 2 }, before[1]], [before[0], { id: 'b', value: 3 }]), [{ id: 'a', value: 2 }, { id: 'b', value: 3 }]);
});
test('config fields absent from visible settings survive cold reload and a second save', async () => {
  const db = workbook(); const before = db.current().appSettings!;
  const after = { ...before, personalExtension: { value: 'kept' } };
  const op: SyncOperation = { operationId: 'operation-settings-001', scope: 'test-sheet', deviceId: 'device-a', entityKind: 'config', entityId: 'appSettings', before, after };
  await db.repository.apply(op);
  assert.deepEqual((db.current().appSettings as any).personalExtension, { value: 'kept' });
  await db.repository.apply({ ...op, operationId: 'operation-settings-002', before: after, after: { ...after, hideMoney: true } });
  assert.equal(db.current().appSettings?.hideMoney, true);
  assert.deepEqual((db.current().appSettings as any).personalExtension, { value: 'kept' });
});
