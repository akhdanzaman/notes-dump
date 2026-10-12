import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { workbook } from '../services/__tests__/fixtures/sheetsWorkbook';
import { DurableSheets, RECEIPT_SHEET } from '../api/_lib/durableSheets';
import { SyncCache } from '../api/_lib/syncCoordination';
import { ItemType } from '../types';
import type { SyncOperation } from '../utils/syncProtocol';
// The baseline source is materialized from the recorded Git revision, never production data.
const revision = 'b0dd7d3';
await fs.mkdir('work', { recursive: true });
const source = execFileSync(
  'git',
  ['show', `${revision}:api/_lib/durableSheets.ts`],
  { encoding: 'utf8' },
)
  .replaceAll("'../../", "'../")
  .replace(
    "'./googleServiceAccount.js'",
    "'../api/_lib/googleServiceAccount.js'",
  );
await fs.writeFile(new URL('../work/quota-before.ts', import.meta.url), source);
const { DurableSheets: Before } = await import(
  new URL('../work/quota-before.ts', import.meta.url).href
);
const results: any[] = [];
for (const type of [ItemType.NOTE, ItemType.FINANCE])
  for (const size of [1, 20]) {
    const scope = `benchmark-${type}-${size}`;
    const operations: SyncOperation[] = Array.from(
      { length: size },
      (_, i) => ({
        operationId: `benchmark-${type}-${size}-${i}`,
        scope,
        deviceId: 'benchmark',
        entityKind: 'item',
        entityId: `entity-${i}`,
        before: null,
        after: {
          id: `entity-${i}`,
          type,
          content: `Synthetic ${type} ${i}`,
          status: 'pending',
          created_at: '2026-10-12T00:00:00.000Z',
          meta:
            type === ItemType.FINANCE
              ? { financeType: 'expense', amount: 15000, currency: 'IDR' }
              : { tags: ['synthetic'] },
        },
      }),
    );
    for (const mode of ['before', 'after']) {
      const wb = workbook([]);
      wb.sheets.push({
        properties: {
          title: RECEIPT_SHEET,
          sheetId: 100,
          gridProperties: { rowCount: 1000, columnCount: 26 },
        },
        values: [
          ['Operation_ID', 'State', 'Entity_ID', 'Error', 'Committed_At'],
        ],
      });
      let responseBytes = 0;
      let requestBytes = 0;
      const transport = async (
        scope: string,
        path: string,
        init?: RequestInit,
      ) => {
        requestBytes += Buffer.byteLength(String(init?.body || path));
        const response = await wb.transport(scope, path, init);
        responseBytes += Buffer.byteLength(await response.clone().text());
        return response;
      };
      const repo =
        mode === 'before'
          ? new Before(transport)
          : new DurableSheets(transport, new SyncCache());
      if (mode === 'before')
        for (const operation of operations) await repo.apply(operation);
      else await (repo as DurableSheets).applyBatch(operations);
      const count = () => ({
        reads: wb.calls.filter((call) => call.kind === 'read').length,
        writes: wb.calls.filter((call) => call.kind === 'write').length,
        requestBytes,
        responseBytes,
      });
      const mutation = count();
      const start = wb.calls.length;
      for (let i = 0; i < 20; i++)
        await repo.receipts(
          scope,
          operations.map((operation) => operation.operationId),
        );
      const polling = {
        reads: wb.calls.slice(start).filter((call) => call.kind === 'read')
          .length,
        writes: wb.calls.slice(start).filter((call) => call.kind === 'write')
          .length,
      };
      const duplicateStart = wb.calls.length;
      if (mode === 'before')
        for (const operation of operations) await repo.apply(operation);
      else await (repo as DurableSheets).applyBatch(operations);
      const duplicates = {
        reads: wb.calls
          .slice(duplicateStart)
          .filter((call) => call.kind === 'read').length,
        writes: wb.calls
          .slice(duplicateStart)
          .filter((call) => call.kind === 'write').length,
      };
      results.push({
        type,
        size,
        mode,
        mutation,
        polling20Checks: polling,
        redelivery: duplicates,
        entities: wb.current().data.length,
      });
    }
  }
const output =
  process.argv[2] ||
  'C:/Users/acer/Documents/Codex/2026-10-11/read/outputs/quota-comparison.json';
await fs.writeFile(
  output,
  JSON.stringify(
    {
      baselineRevision: revision,
      method:
        'Same synthetic transport, schema and operations; real repository code. Excludes network latency, Google quota and real Redis latency. Receipt cache exercised in process.',
      results,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    results.map(
      ({ type, size, mode, mutation, polling20Checks, redelivery }) => ({
        type,
        size,
        mode,
        reads: mutation.reads,
        writes: mutation.writes,
        pollReads: polling20Checks.reads,
        duplicateReads: redelivery.reads,
      }),
    ),
    null,
    2,
  ),
);
