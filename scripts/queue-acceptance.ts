import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { ItemType } from '../types';
const exec = promisify(execFile); const args = process.argv.slice(2); const option = (name: string) => args[args.indexOf(name) + 1];
for (const name of ['--deployment', '--scope', '--vercel-cli', '--output']) if (!args.includes(name)) throw new Error(`Missing ${name}`);
const origin = new URL(option('--deployment')).origin; const scope = option('--scope'); const cli = option('--vercel-cli');
const output = path.resolve(option('--output')); await fs.mkdir(output, { recursive: true });
const scratch = path.resolve('work/queue-acceptance'); await fs.mkdir(scratch, { recursive: true });
const cookieJar = path.join(scratch, 'cookies.txt'); let csrf = '';
async function call(route: string, payload: unknown) {
  const body = path.join(scratch, 'request.json'); await fs.writeFile(body, JSON.stringify(payload));
  const params = [cli, 'curl', route, '--deployment', origin, '--', '--silent', '--show-error', '--cookie', cookieJar, '--cookie-jar', cookieJar,
    '--request', 'POST', '--header', `Origin: ${origin}`, '--header', `Referer: ${origin}/`, '--header', 'Content-Type: application/json',
    ...(csrf ? ['--header', `X-Arkaiv-Csrf: ${csrf}`] : []), '--data-binary', `@${body}`, '--write-out', '\n%{http_code}'];
  const { stdout } = await exec(process.execPath, params, { maxBuffer: 5000000, timeout: 60000 });
  const index = stdout.lastIndexOf('\n'); const status = Number(stdout.slice(index + 1)); const raw = stdout.slice(0, index);
  const data = JSON.parse(raw); if (status >= 400) throw new Error(`API ${status}: ${data.error || data.code || 'failure'}`);
  return { status, data };
}
csrf = (await call('/api/spreadsheets/service-account/session', {})).data.csrfToken;
const capabilities = (await call('/api/spreadsheets/sync/capabilities', { spreadsheetId: scope })).data;
if (!capabilities.enabled || !capabilities.ready) throw new Error('Preview durable flag is not ready');
const outcomes: any[] = []; const pass = (name: string, detail?: unknown) => { outcomes.push({ name, passed: true, detail }); console.log(`PASS ${name}`); };
const runId = randomUUID(); const entityId = `queue-test-${runId}`;
const entity = { id: entityId, type: ItemType.NOTE, status: 'pending', created_at: new Date().toISOString(), content: 'Vercel queue copy test', meta: {} };
const operation = (before: unknown, after: unknown, suffix: string) => ({ operationId: `queue-${runId}-${suffix}`, scope, deviceId: 'queue-device-a', entityKind: 'item', entityId, before, after });
const create = operation(null, entity, 'create');
const submit = await call('/api/spreadsheets/sync/submit', { spreadsheetId: scope, operations: [create] });
if (submit.status !== 202 || !submit.data.accepted?.includes(create.operationId)) throw new Error('No durable acceptance');
pass('producer returns accepted only after real Vercel Queues send');
await fs.writeFile(path.join(output, 'accepted-operation.json'), JSON.stringify({ origin, scope, operationId: create.operationId, acceptedAt: new Date().toISOString() }, null, 2));
console.log('Request producer has finished. No browser window is needed for completion.');
async function waitFor(operationId: string, expected = 'committed') {
  for (let attempt = 0; attempt < 20; attempt++) {
    const receipts = (await call('/api/spreadsheets/sync/status', { spreadsheetId: scope, operationIds: [operationId] })).data.receipts;
    const receipt = receipts.find((receipt: any) => receipt.operationId === operationId);
    if (receipt) { if (receipt.state !== expected) throw new Error(`Unexpected receipt ${receipt.state}: ${receipt.error}`); return receipt; }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error('Queue did not produce a receipt within acceptance deadline');
}
await waitFor(create.operationId); pass('private queue consumer commits after producer request ends');
await call('/api/spreadsheets/sync/submit', { spreadsheetId: scope, operations: [create] }); await waitFor(create.operationId);
pass('same operation ID redelivery remains committed');
const edit = operation(entity, { ...entity, content: 'Device A' }, 'edit');
await call('/api/spreadsheets/sync/submit', { spreadsheetId: scope, operations: [edit] }); await waitFor(edit.operationId);
const conflict = operation(entity, { ...entity, content: 'Device B' }, 'conflict');
await call('/api/spreadsheets/sync/submit', { spreadsheetId: scope, operations: [conflict] }); await waitFor(conflict.operationId, 'conflict');
pass('real queue records same-field multi-device conflict');
const removal = operation({ ...entity, content: 'Device A' }, null, 'delete');
await call('/api/spreadsheets/sync/submit', { spreadsheetId: scope, operations: [removal] }); await waitFor(removal.operationId);
pass('test item deleted through the queue with a durable receipt');
await fs.writeFile(path.join(output, 'queue-acceptance-results.json'), JSON.stringify({ origin, scope, producerRequestEndedBeforeCommitCheck: true, outcomes, completedAt: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ passed: outcomes.length, scope, syntheticEntityCleaned: true }));

