import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { workbook } from './fixtures/sheetsWorkbook';
import { DurableSheets, RECEIPT_SHEET } from '../../api/_lib/durableSheets';
import {
  SyncCache,
  reserveSheetsRequest,
  sheetsCooldown,
  QuotaDeferred,
  RESERVE_SCRIPT,
  scopeKey,
} from '../../api/_lib/syncCoordination';
import { ItemType } from '../../types';
import {
  DeferredDependency,
  type SyncOperation,
} from '../../utils/syncProtocol';
import {
  shouldPollOperation,
  shouldSubmitOperation,
  nextStatusSchedule,
} from '../../utils/outboxPolicy';
import { packSyncOperations } from '../../utils/syncBatch';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';
import { persistLocalState,readLocalState,changeOperationState,closeLocalStore } from '../localOutbox';
import { replayDurableOutbox } from '../durableSync';
import { saveSpreadsheetConfig,clearSpreadsheetConfig } from '../spreadsheetService';
const note = (id: string, content = 'hello') => ({
  id,
  type: ItemType.NOTE,
  content,
  status: 'pending' as const,
  created_at: '2026-10-12T00:00:00.000Z',
  meta: {},
});
const op = (
  id: string,
  before: any = null,
  after: any = note(id),
): SyncOperation => ({
  operationId: `quota-${id}-operation`,
  scope: 'quota-test-sheet',
  deviceId: 'device-a',
  entityKind: 'item',
  entityId: id,
  before,
  after,
});
test('twenty note mutations share two Google reads and one atomic write, preserving all entities and receipts', async () => {
  const db = workbook([]);
  const operations = Array.from({ length: 20 }, (_, i) => op(`note-${i}`));
  const results = await db.repository.applyBatch(operations);
  assert.equal(results.length, 20);
  assert.ok(results.every((receipt) => receipt.state === 'committed'));
  assert.equal(db.current().data.length, 20);
  assert.equal(db.writes, 1);
  assert.equal(db.calls.filter((call) => call.kind === 'read').length, 2);
  assert.equal(
    db.sheets.find((sheet) => sheet.properties.title === RECEIPT_SHEET)?.values
      .length,
    21,
  );
});
test('batch topologically orders dependencies, merges independent fields, and records a conflict without losing other changes', async () => {
  const before = note('chain', 'original');
  const db = workbook([before]);
  const parent = op('chain', before, { ...before, content: 'parent' });
  const child = {
    ...op('chain', parent.after, {
      ...(parent.after as any),
      meta: { tags: ['child'] },
    }),
    operationId: 'quota-chain-child',
    parentOperationId: parent.operationId,
  };
  const independent = {
    ...op('chain', before, { ...before, meta: { tags: ['device-b'] } }),
    operationId: 'quota-other-device',
  };
  const results = await db.repository.applyBatch([
    child,
    parent,
    independent,
    op('another'),
  ]);
  assert.deepEqual(
    results.map((receipt) => receipt.state),
    ['committed', 'committed', 'conflict', 'committed'],
  );
  assert.equal(
    db.current().data.find((item) => item.id === 'chain')?.content,
    'parent',
  );
  assert.equal(db.current().data.length, 2);
  assert.equal(db.writes, 1);
});
test('a deferred or malformed mutation prevents any partial batch write or false receipt', async () => {
  const db = workbook([]);
  const dependent = {
    ...op('child'),
    parentOperationId: 'missing-parent-operation',
  };
  await assert.rejects(
    db.repository.applyBatch([op('ready'), dependent]),
    DeferredDependency,
  );
  assert.equal(db.writes, 0);
  assert.equal(db.current().data.length, 0);
  await assert.rejects(
    db.repository.applyBatch([op('a'), op('a')]),
    /duplicate/i,
  );
  assert.equal(db.writes, 0);
});
test('batch redelivery after losing the commit response never duplicates rows', async () => {
  const db = workbook([]);
  const operations = [op('lost-a'), op('lost-b')];
  db.loseNextResponse();
  await assert.rejects(db.repository.applyBatch(operations), /AFTER commit/);
  assert.ok(
    (await db.repository.applyBatch(operations)).every(
      (receipt) => receipt.state === 'committed',
    ),
  );
  assert.equal(db.writes, 1);
  assert.equal(db.current().data.length, 2);
});
test('cached receipts and duplicate batch require zero Google reads and accepted never proves committed', async () => {
  const db = workbook([]);
  const cache = new SyncCache();
  const repo = new DurableSheets(db.transport, cache);
  const operation = { ...op('cache-once'), scope: 'unique-cache-workbook' };
  await repo.applyBatch([operation]);
  const before = db.calls.length;
  assert.equal(
    (await repo.receipts(operation.scope, [operation.operationId]))[0].state,
    'committed',
  );
  await repo.applyBatch([operation]);
  assert.equal(db.calls.length, before);
});
test('browser and service worker stop polling terminal conflicts and resending accepted mutations', () => {
  const context = vm.createContext({ Date });
  vm.runInContext(
    fs.readFileSync('public/durable-outbox-sw.js', 'utf8') +
      ';globalThis.policy={shouldSubmitOutbox,shouldPollOutbox};',
    context,
  );
  const now = 1_000_000;
  const cases = [
    { state: 'conflict', createdAt: now - 10000, attempts: 1 },
    { state: 'pending', createdAt: now, attempts: 0 },
    {
      state: 'accepted',
      createdAt: now - 10000,
      attempts: 1,
      lastSubmittedAt: now - 10000,
    },
    {
      state: 'sending',
      createdAt: now - 120000,
      attempts: 1,
      lastSubmittedAt: now - 120000,
    },
    {
      state: 'accepted',
      createdAt: now - 10000,
      attempts: 1,
      nextStatusAt: now + 10000,
    },
  ];
  for (const operation of cases) {
    assert.equal(
      context.policy.shouldSubmitOutbox(operation, now),
      shouldSubmitOperation(operation, now),
    );
    assert.equal(
      context.policy.shouldPollOutbox(operation, now),
      shouldPollOperation(operation, now),
    );
  }
  assert.equal(shouldPollOperation(cases[0], now), false);
  assert.equal(shouldPollOperation(cases[1], now), false);
  assert.equal(shouldSubmitOperation(cases[2], now), false);
  assert.ok(
    nextStatusSchedule({ ...cases[2], pollDelayMs: 60000 }, now).nextStatusAt >
      now,
  );
  assert.equal(
    nextStatusSchedule(cases[2], now, 90000).nextStatusAt,
    now + 90000,
  );
});
test('queue batching respects UTF-8 byte limit and preserves every mutation', () => {
  const operations = Array.from({ length: 20 }, (_, i) =>
    op(`large-${i}`, null, note(`large-${i}`, '猫'.repeat(20000))),
  );
  const batches = packSyncOperations(operations);
  assert.ok(batches.length > 1);
  assert.equal(batches.flat().length, 20);
  assert.ok(
    batches.every(
      (operations) =>
        new TextEncoder().encode(
          JSON.stringify({
            kind: 'mutations',
            scope: 'quota-test-sheet',
            operations,
          }),
        ).length <= 200000,
    ),
  );
});
test('cache publication failure after Sheets commit is recoverable without a second data write or missing version', async () => {
  const db = workbook([]);
  const operation = { ...op('cache-recovery'), scope: 'cache-recovery-unique' };
  class BrokenCache extends SyncCache {
    async publish() {
      throw new Error('Cache unavailable after commit');
    }
  }
  await assert.rejects(
    new DurableSheets(db.transport, new BrokenCache()).applyBatch([operation]),
    /after commit/,
  );
  assert.equal(db.writes, 1);
  const cache = new SyncCache();
  await new DurableSheets(db.transport, cache).applyBatch([operation]);
  assert.equal(db.writes, 1);
  assert.equal(
    (
      await cache.get<{ revision: number }>(
        `${scopeKey(operation.scope)}:version`,
      )
    )?.revision,
    1,
  );
  await new DurableSheets(db.transport, cache).applyBatch([operation]);
  assert.equal(
    (
      await cache.get<{ revision: number }>(
        `${scopeKey(operation.scope)}:version`,
      )
    )?.revision,
    1,
  );
});
test('shared quota cooldown defers calls and storage failure never bypasses the coordinator', async () => {
  const commands: (string | number)[][] = [];
  const command = async (args: (string | number)[]) => {
    commands.push(args);
    return args[1] === RESERVE_SCRIPT ? 65000 : 1;
  };
  await sheetsCooldown('same-service-account', 60, command);
  await assert.rejects(
    reserveSheetsRequest('same-service-account', 'read', undefined, command),
    QuotaDeferred,
  );
  await assert.rejects(
    reserveSheetsRequest('same-service-account', 'write', undefined, command),
    QuotaDeferred,
  );
  assert.equal(commands[0][3], commands[1][3]);
  assert.equal(commands[1][3], commands[2][3]);
  await assert.rejects(
    reserveSheetsRequest(
      'same-service-account',
      'read',
      undefined,
      async () => {
        throw new Error('Redis unavailable');
      },
    ),
    /unavailable/,
  );
});

test('status failure still queues new writes without acknowledging the uncertain older operation',async t=>{
 const dom=new JSDOM('',{url:'http://localhost'});
 const values={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,localStorage:dom.window.localStorage,indexedDB,CustomEvent:dom.window.CustomEvent,Event:dom.window.Event};
 const originals=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of Object.entries(values)) Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 const scope='quota-status-failure';const submitted:string[]=[];
 try {
  saveSpreadsheetConfig({spreadsheetId:scope,spreadsheetUrl:'https://example.invalid',authMode:'service_account'});
  const old=note('status-old');await persistLocalState(scope,{data:[old]},{data:[]});const prior=(await readLocalState(scope)).operations[0];
  await changeOperationState(scope,[prior.operationId],'accepted');await persistLocalState(scope,{data:[old,note('status-new')]});
  t.mock.method(globalThis,'fetch',async(input:string|URL|Request,init?:RequestInit)=>{
   const url=String(input);let data:any;let status=200;
   if(url.endsWith('/session')) data={csrfToken:'synthetic'};
   else if(url.endsWith('/capabilities')) data={enabled:true,ready:true};
   else if(url.endsWith('/status')) {data={error:'Quota cooldown'};status=503;}
   else if(url.endsWith('/submit')) {const body=JSON.parse(String(init?.body));submitted.push(...body.operations.map((operation:any)=>operation.operationId));data={accepted:submitted};}
   else throw new Error(`Unexpected API ${url}`);
   return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Retry-After':'60'}});
  });
  await replayDurableOutbox();
  assert.equal(submitted.length,1);assert.notEqual(submitted[0],prior.operationId);
  const remaining=(await readLocalState(scope)).operations;assert.equal(remaining.length,2);assert.ok(remaining.every(operation=>operation.state==='accepted'));
 } finally {
  clearSpreadsheetConfig();closeLocalStore();dom.window.close();for(const [key,value] of originals) value ? Object.defineProperty(globalThis,key,value) : Reflect.deleteProperty(globalThis,key);
 }
});
