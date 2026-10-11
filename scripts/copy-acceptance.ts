import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DurableSheets, type SheetsTransport } from '../api/_lib/durableSheets';
import { buildMigrationPlan, readBackupDomain, snapshotHash, type WorkbookBackup } from '../utils/spreadsheetMigration';
import { equivalent, type SyncOperation } from '../utils/syncProtocol';
import { splitSheetsBatch } from '../utils/spreadsheetBatch';
import { ItemType } from '../types';
const args = process.argv.slice(2); const option = (name: string) => args[args.indexOf(name) + 1];
if (!args.includes('--target') || !args.includes('--app-origin') || !args.includes('--original-backup') || !args.includes('--output')) throw new Error('Specify --target COPY_ID --app-origin https://app.example --original-backup backup.json --output folder');
const scope = option('--target'); const origin = new URL(option('--app-origin')).origin;
const original: WorkbookBackup = JSON.parse(await fs.readFile(option('--original-backup'), 'utf8'));
if (scope === original.spreadsheetId) throw new Error('Acceptance requires a copy, never the original');
const output = path.resolve(option('--output')); await fs.mkdir(output, { recursive: true });
const headers = { Origin: origin, Referer: `${origin}/` }; let csrf = ''; let cookie = ''; let requests = 0; let loseNextWriteResponse = false;
const transport: SheetsTransport = async (target, inputPath, init = {}) => {
  if (target !== scope) throw new Error('Copy boundary violation');
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!csrf) {
      const session = await fetch(`${origin}/api/spreadsheets/service-account/session`, { method: 'POST', headers, signal: AbortSignal.timeout(25000) });
      if (!session.ok) throw new Error(`Session ${session.status}`);
      csrf = (await session.json()).csrfToken; cookie = session.headers.get('set-cookie')!.split(';')[0];
    }
    const apiPath = inputPath.startsWith('?fields=') ? '' : inputPath; // Legacy live proxy supports metadata but no fields query.
    const response = await fetch(`${origin}/api/spreadsheets/service-account/proxy?${new URLSearchParams({ spreadsheetId: target, path: apiPath })}`, {
      ...init, signal: AbortSignal.timeout(45000), headers: { ...headers, Cookie: cookie, 'X-Arkaiv-Csrf': csrf, ...(init.headers || {}) },
    }); requests++;
    if (response.status === 401) { csrf = ''; continue; }
    if (response.status === 429) { console.log('Read quota reached; waiting 30 seconds'); await new Promise(resolve => setTimeout(resolve, 30000)); continue; }
    if (loseNextWriteResponse && inputPath === ':batchUpdate' && response.ok) { loseNextWriteResponse = false; await response.text(); throw new Error('Simulated lost response after real commit'); }
    return response;
  }
  throw new Error('Copy transport retries exhausted');
};
const repository = new DurableSheets(transport);
const capture = async (fullGrid = false): Promise<WorkbookBackup> => {
  let spreadsheet = await repository.metadata(scope);
  if (fullGrid) {
    // Preserve the current title; this standard access-check request changes no title/cell values.
    const response = await repository.json(scope, ':batchUpdate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      requests: [{ updateSpreadsheetProperties: { properties: { title: spreadsheet.properties.title }, fields: 'title' } }],
      includeSpreadsheetInResponse: true, responseIncludeGridData: true,
    }) }); spreadsheet = response.updatedSpreadsheet;
  }
  const names = spreadsheet.sheets.map((sheet: any) => sheet.properties.title);
  return { spreadsheetId: scope, spreadsheet, valueRanges: await repository.ranges(scope, names, 'FORMULA'), computedRanges: await repository.ranges(scope, names), formattedRanges: await repository.ranges(scope, names, 'FORMATTED_VALUE') };
};
const sameDomain = (a: any, b: any) => equivalent({ ...a, data: [...a.data].sort((x, y) => x.id.localeCompare(y.id)) }, { ...b, data: [...b.data].sort((x, y) => x.id.localeCompare(y.id)) });
const outcomes: any[] = []; const pass = (name: string, detail?: unknown) => { outcomes.push({ name, passed: true, detail }); console.log(`PASS ${name}`); };
const initial = args.includes('--resume') ? JSON.parse(await fs.readFile(path.join(output, 'copy-workbook-backup-before.json'), 'utf8')) : await capture(true);
if (!args.includes('--resume')) await fs.writeFile(path.join(output, 'copy-workbook-backup-before.json'), JSON.stringify(initial, null, 2));
if (snapshotHash(initial) !== snapshotHash(original)) throw new Error('Copy differs from reviewed original snapshot; review a fresh dry run before applying');
pass('copy equals original cell snapshot');
const plan = buildMigrationPlan(initial);
await fs.writeFile(path.join(output, 'copy-migration-plan.json'), JSON.stringify(plan, null, 2));
if (!args.includes('--resume')) for (const batch of splitSheetsBatch(plan.requests, 1400000)) await repository.json(scope, ':batchUpdate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: batch }) });
const migrated = await capture(); const migratedDb = readBackupDomain(migrated);
if (!sameDomain(migratedDb, plan.db)) {
  await fs.writeFile(path.join(output, 'migration-difference.json'), JSON.stringify({ expected: plan.db, actual: migratedDb }, null, 2));
  throw new Error('Cold migration round trip differs; see preserved copy backups');
}
pass('live schema migration and cold round trip', { entities: migratedDb.data.length, archivedMirrors: plan.archivedRows.length });
const runId = randomUUID(); const itemId = `acceptance-${runId}`;
const item = { id: itemId, type: ItemType.NOTE, status: 'pending' as const, content: 'Copy acceptance test', created_at: new Date().toISOString(), meta: {} };
const operation = (before: any, after: any, suffix: string): SyncOperation => ({ operationId: `test-${runId}-${suffix}`, scope, deviceId: 'copy-acceptance-a', entityKind: 'item', entityId: itemId, before, after });
loseNextWriteResponse = true;
const create = operation(null, item, 'create');
try { await repository.apply(create); throw new Error('Response-loss injection failed'); } catch (error) { if (!(error instanceof Error) || !error.message.includes('Simulated lost')) throw error; }
await repository.apply(create);
let current = readBackupDomain(await capture()).data.find(entity => entity.id === itemId)!;
pass('real commit followed by response loss and replay has one ID');
const first = { ...current, content: 'Device A edit' };
const second = { ...current, meta: { ...current.meta, tags: ['device-b'] } };
if ((await repository.apply(operation(current, first, 'device-a'))).state !== 'committed') throw new Error('Device A failed');
if ((await repository.apply(operation(current, second, 'device-b'))).state !== 'committed') throw new Error('Independent edit conflicted');
const conflict = await repository.apply(operation(current, { ...current, content: 'Conflicting C edit' }, 'conflict'));
if (conflict.state !== 'conflict') throw new Error('Same-field conflict was silently overwritten');
pass('two device snapshots merge different fields and retain same-field conflict');
const check = readBackupDomain(await capture()); current = check.data.find(entity => entity.id === itemId)!;
if (current.content !== 'Device A edit' || !current.meta.tags?.includes('device-b') || check.data.filter(entity => entity.id === itemId).length !== 1) throw new Error('Merge verification failed');
await repository.apply(operation(current, null, 'delete'));
const final = await capture();
if (!sameDomain(readBackupDomain(final), plan.db)) {
  await fs.writeFile(path.join(output, 'post-test-difference.json'), JSON.stringify({ expected: plan.db, actual: readBackupDomain(final) }, null, 2));
  throw new Error('Copy did not return to migrated domain after test cleanup');
}
pass('delete tombstone leaves all original entities and config intact');
await fs.writeFile(path.join(output, 'copy-workbook-after-tests.json'), JSON.stringify(final, null, 2));
await fs.writeFile(path.join(output, 'acceptance-results.json'), JSON.stringify({ scope, originalUntouched: true, transport: 'real Sheets through existing app proxy; local durable repository; Vercel queue delivery still requires deployment', schema: 3, outcomes, requests }, null, 2));
console.log(JSON.stringify({ passed: outcomes.length, entities: plan.entityCount, originalUntouched: true, queuedDeliveryTested: false, requests }));
