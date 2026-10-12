import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { ItemType } from '../types';
const exec = promisify(execFile);
const args = process.argv.slice(2);
const option = (name: string) => args[args.indexOf(name) + 1];
for (const name of ['--deployment', '--scope', '--vercel-cli', '--output'])
  if (!args.includes(name)) throw new Error(`Missing ${name}`);
const scope = option('--scope');
if (scope !== '1QI4JHaz0wIRDUjqqK8Ewnl17vrGv9B9sP9tPvsTKUMI')
  throw new Error(
    'Live quota test is restricted to the authorized copy spreadsheet',
  );
const origin = new URL(option('--deployment')).origin;
const output = path.resolve(option('--output'));
await fs.mkdir(output, { recursive: true });
const scratch = path.resolve('work/quota-copy');
await fs.mkdir(scratch, { recursive: true });
const cookies = path.join(scratch, 'cookies.txt');
let csrf = '';
let calls = 0;
async function call(route: string, payload: any = {}, method = 'POST') {
  const body = path.join(scratch, 'request.json');
  await fs.writeFile(body, JSON.stringify(payload));
  const params = [
    option('--vercel-cli'),
    'curl',
    route,
    '--scope',
    'akhdanzamans-projects',
    '--deployment',
    origin,
    '--',
    '--silent',
    '--show-error',
    '--cookie',
    cookies,
    '--cookie-jar',
    cookies,
    '--request',
    method,
    '--header',
    `Origin: ${origin}`,
    '--header',
    `Referer: ${origin}/`,
    ...(csrf ? ['--header', `X-Arkaiv-Csrf: ${csrf}`] : []),
    ...(method === 'POST'
      ? [
          '--header',
          'Content-Type: application/json',
          '--data-binary',
          `@${body}`,
        ]
      : []),
    '--write-out',
    '\n%{http_code}',
  ];
  const { stdout } = await exec(process.execPath, params, {
    maxBuffer: 5000000,
    timeout: 60000,
  });
  calls++;
  const index = stdout.lastIndexOf('\n');
  const status = Number(stdout.slice(index + 1));
  const data = JSON.parse(stdout.slice(0, index));
  if (status >= 400)
    throw new Error(`API ${status}: ${data.error || data.code || 'failure'}`);
  return { status, data };
}
csrf = (await call('/api/spreadsheets/service-account/session')).data.csrfToken;
const capabilities = (
  await call('/api/spreadsheets/sync/capabilities', { spreadsheetId: scope })
).data;
if (!capabilities.enabled || !capabilities.ready)
  throw new Error('Copy durable sync is not ready');
const run = randomUUID();
const entities = Array.from({ length: 20 }, (_, i) => ({
  id: `quota-live-${run}-${i}`,
  type: ItemType.NOTE,
  content: `Synthetic quota batch ${i}`,
  status: 'pending',
  created_at: new Date().toISOString(),
  meta: { tags: ['quota-live-synthetic'] },
}));
const create = entities.map((entity) => ({
  operationId: `quota-create-${run}-${entities.indexOf(entity)}`,
  scope,
  deviceId: 'quota-copy-test',
  entityKind: 'item',
  entityId: entity.id,
  before: null,
  after: entity,
}));
const manifest = { origin, scope, entities, create };
await fs.writeFile(
  path.join(output, 'synthetic-recovery.json'),
  JSON.stringify(manifest, null, 2),
);
const outcomes: any[] = [];
const pass = (name: string) => {
  outcomes.push({ name, passed: true });
  console.log(`PASS ${name}`);
};
async function wait(operations: any[]) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const receipts = (
      await call('/api/spreadsheets/sync/status', {
        spreadsheetId: scope,
        operationIds: operations.map((op) => op.operationId),
      })
    ).data.receipts;
    if (receipts.some((receipt: any) => receipt.state === 'conflict'))
      throw new Error(
        'Synthetic copy operation conflicted; recovery manifest retained',
      );
    if (
      operations.every((operation) =>
        receipts.some(
          (receipt: any) =>
            receipt.operationId === operation.operationId &&
            receipt.state === 'committed',
        ),
      )
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(
    'Timed out waiting for batch receipts; recovery manifest retained',
  );
}
const started = Date.now();
const submitted = await call('/api/spreadsheets/sync/submit', {
  spreadsheetId: scope,
  operations: create,
});
if (submitted.status !== 202 || submitted.data.accepted.length !== 20)
  throw new Error('Batch not durably accepted');
pass('20 operations accepted after durable queue send');
await wait(create);
pass('all 20 receipts committed after producer returned');
const readPath = `/api/spreadsheets/service-account/proxy?spreadsheetId=${scope}&path=${encodeURIComponent('/values:batchGet?ranges=' + encodeURIComponent("'Notes & Journals'!A:Z") + '&valueRenderOption=UNFORMATTED_VALUE')}`;
const rows = (await call(readPath, {}, 'GET')).data.valueRanges[0].values;
const idColumn = rows[0].indexOf('ID');
const jsonColumn = rows[0].indexOf('_Entity_JSON');
const stored = entities.map((entity) => {
  const matches = rows
    .slice(1)
    .filter((row: any[]) => row[idColumn] === entity.id);
  if (matches.length !== 1) throw new Error('Missing/duplicate synthetic ID');
  const item = JSON.parse(matches[0][jsonColumn]);
  if (item.content !== entity.content)
    throw new Error('Synthetic content did not round-trip');
  return item;
});
pass('20 IDs read back exactly once with matching content');
await call('/api/spreadsheets/sync/submit', {
  spreadsheetId: scope,
  operations: create,
});
await wait(create);
pass('duplicate batch retains committed receipts');
const remove = stored.map((entity: any, i: number) => ({
  operationId: `quota-delete-${run}-${i}`,
  scope,
  deviceId: 'quota-copy-test',
  entityKind: 'item',
  entityId: entity.id,
  before: entity,
  after: null,
}));
await call('/api/spreadsheets/sync/submit', {
  spreadsheetId: scope,
  operations: remove,
});
await wait(remove);
const afterRows = (await call(readPath, {}, 'GET')).data.valueRanges[0].values;
if (
  afterRows
    .slice(1)
    .some((row: any[]) =>
      entities.some((entity) => entity.id === row[idColumn]),
    )
)
  throw new Error('Synthetic cleanup incomplete');
pass('20 synthetic entities deleted and absence verified');
const version = (
  await call('/api/spreadsheets/sync/version', { spreadsheetId: scope })
).data;
await fs.writeFile(
  path.join(output, 'live-copy-results.json'),
  JSON.stringify(
    {
      origin,
      scope,
      coordination: capabilities.coordination,
      outcomes,
      syntheticEntityCleaned: true,
      elapsedMs: Date.now() - started,
      applicationRequests: calls,
      versionEndpoint: version,
      completedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    passed: outcomes.length,
    syntheticEntityCleaned: true,
    coordination: capabilities.coordination,
  }),
);
