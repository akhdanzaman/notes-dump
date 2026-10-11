import { copyProxyTransport } from './copy-proxy-transport';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildMigrationPlan, snapshotHash, readBackupDomain, type WorkbookBackup } from '../utils/spreadsheetMigration';
import { DurableSheets } from '../api/_lib/durableSheets';
import { assertServiceAccountSpreadsheetAllowed, validateSpreadsheetId } from '../api/_lib/googleServiceAccount';
import { splitSheetsBatch } from '../utils/spreadsheetBatch';
import { rollbackCell } from '../utils/spreadsheetMigration';
import { equivalent } from '../utils/syncProtocol';
const args = process.argv.slice(2); const option = (name: string) => args[args.indexOf(name) + 1];
const command = args[0]; const input = args[1];
if (command === 'capture') {
  for (const flag of ['--target', '--app-origin', '--output']) if (!args.includes(flag)) throw new Error(`Missing ${flag}`);
  const target = validateSpreadsheetId(option('--target'));
  const repo = new DurableSheets(copyProxyTransport(target, option('--app-origin')));
  const spreadsheet = await repo.json(target, '?includeGridData=true');
  const names = spreadsheet.sheets.map((sheet: any) => sheet.properties.title);
  const captured: WorkbookBackup = { spreadsheetId: target, spreadsheet, valueRanges: await repo.ranges(target, names, 'FORMULA'), computedRanges: await repo.ranges(target, names), formattedRanges: await repo.ranges(target, names, 'FORMATTED_VALUE') };
  const destination = path.resolve(option('--output')); await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, JSON.stringify(captured, null, 2));
  console.log(JSON.stringify({ target, beforeHash: snapshotHash(captured), captured: true }));
  process.exit(0);
}
if (!['dry-run', 'apply', 'rollback'].includes(command) || !input) throw new Error('Usage: tsx scripts/spreadsheet-migration.ts dry-run backup.json --output folder; apply backup.json --target COPY_ID --expect-hash SHA --output folder; rollback target-backup.json --target COPY_ID --expect-hash CURRENT_SHA --output folder');
const backup: WorkbookBackup = JSON.parse(await fs.readFile(input, 'utf8'));
const output = path.resolve(args.includes('--output') ? option('--output') : 'work/migration'); await fs.mkdir(output, { recursive: true });
if (command === 'dry-run') {
  const plan = buildMigrationPlan(backup);
  await fs.writeFile(path.join(output, 'migration-dry-run.json'), JSON.stringify(plan, null, 2));
  console.log(JSON.stringify({ schema: plan.schema, entityCount: plan.entityCount, tables: plan.tables, beforeHash: plan.beforeHash, writesApplied: 0 }, null, 2));
} else {
  if (!args.includes('--target') || !args.includes('--expect-hash')) throw new Error('Explicit target and expected snapshot hash are required');
  const target = validateSpreadsheetId(option('--target')); assertServiceAccountSpreadsheetAllowed(target);
  if (command === 'apply' && target === backup.spreadsheetId && !args.includes('--production')) throw new Error('Use a copy first. Production migration requires --production after copy acceptance.');
  if (process.env.SPREADSHEET_DURABLE_SYNC === 'true') throw new Error('Pause app writes and drain the queue before migration/rollback');
  const repository = new DurableSheets(args.includes('--app-origin') ? copyProxyTransport(target, option('--app-origin')) : undefined); const spreadsheet = await repository.metadata(target);
  const read = async (): Promise<WorkbookBackup> => {
    const metadata = await repository.json(target, '?includeGridData=true'); const names = metadata.sheets.map((sheet: any) => sheet.properties.title);
    return { spreadsheetId: target, spreadsheet: metadata, valueRanges: await repository.ranges(target, names, 'FORMULA'),
      computedRanges: await repository.ranges(target, names), formattedRanges: await repository.ranges(target, names, 'FORMATTED_VALUE') };
  };
  const current = await read();
  if (snapshotHash(current) !== option('--expect-hash')) throw new Error('Workbook changed after review; make a fresh backup and dry run');
  await fs.writeFile(path.join(output, 'target-backup-before-write.json'), JSON.stringify(current, null, 2));
  let requests: any[]; let expected;
  if (command === 'apply') { const plan = buildMigrationPlan(current); requests = plan.requests; expected = plan.db; }
  else {
    const ids = new Map(spreadsheet.sheets.map((sheet: any) => [sheet.properties.title, sheet.properties.sheetId]));
    requests = backup.valueRanges.map(range => {
      const title = String(range.range).split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'"); const sheetId = ids.get(title);
      if (sheetId === undefined) throw new Error(`Missing rollback sheet: ${title}`);
      const rows = range.values || []; const currentRows = current.valueRanges.find(r => r.range.split('!')[0] === range.range.split('!')[0])?.values || [];
      const width = Math.max(1, ...rows.map((row: any[]) => row.length), ...currentRows.map((row: any[]) => row.length));
      return { updateCells: { range: { sheetId, startRowIndex: 0, endRowIndex: Math.max(1, rows.length, currentRows.length), startColumnIndex: 0, endColumnIndex: width },
        rows: rows.map((row: any[], rowIndex: number) => ({ values: row.map((value, columnIndex: number) => rollbackCell(backup, title, rowIndex, columnIndex, value)) })), fields: 'userEnteredValue' } };
    });
    // Clear introduced technical tabs; keep their structure recoverable instead of deleting sheets.
    for (const sheet of spreadsheet.sheets.filter((sheet: any) => sheet.properties.title.startsWith('_Sync_') && !backup.spreadsheet.sheets.some((old: any) => old.properties.title === sheet.properties.title)))
      requests.push({ updateCells: { range: { sheetId: sheet.properties.sheetId }, fields: 'userEnteredValue' } });
  }
  for (const batch of splitSheetsBatch(requests, 1_400_000)) await repository.json(target, ':batchUpdate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: batch }) });
  const after = await read();
  if (command === 'rollback') {
    const restored = { ...after, valueRanges: backup.valueRanges.map(old => after.valueRanges.find(range => range.range.split('!')[0] === old.range.split('!')[0])) };
    if (snapshotHash(restored) !== snapshotHash(backup)) throw new Error('Rollback verification differs; inspect backups before enabling writes');
  }
  if (expected && !equivalent({ ...readBackupDomain(after), data: [...readBackupDomain(after).data].sort((a, b) => a.id.localeCompare(b.id)) }, { ...expected, data: [...expected.data].sort((a, b) => a.id.localeCompare(b.id)) })) throw new Error('Migration round trip differs; keep flags off and inspect the preserved target backup');
  await fs.writeFile(path.join(output, 'target-backup-after-write.json'), JSON.stringify(after, null, 2));
  console.log(JSON.stringify({ target, command, verified: true, next: 'Run copy/multi-device acceptance before enabling SPREADSHEET_DURABLE_READY_IDS' }));
}
