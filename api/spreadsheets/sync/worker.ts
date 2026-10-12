import { QueueClient } from '@vercel/queue';
import { DurableSheets } from '../../_lib/durableSheets.js';
import {
  validateOperation,
  type SyncOperation,
} from '../../../utils/syncProtocol.js';
import { assertServiceAccountSpreadsheetAllowed } from '../../_lib/googleServiceAccount.js';
import { durableReady } from '../../_lib/durableAuth.js';
import type { MutationBatch } from '../../../utils/syncBatch.js';
import { QuotaDeferred } from '../../_lib/syncCoordination.js';
const queue = new QueueClient({ region: 'iad1' });
// SDK validates private queue callbacks and renews visibility while processing.
export default queue.handleNodeCallback<
  SyncOperation | MutationBatch | { kind: 'reports'; scope: string }
>(
  async (operation) => {
    if ('kind' in operation && operation.kind === 'reports') {
      assertServiceAccountSpreadsheetAllowed(operation.scope);
      if (!durableReady(operation.scope))
        throw new Error('Workbook activation is incomplete');
      await new DurableSheets().refreshReports(operation.scope);
      return;
    }
    const operations =
      'kind' in operation && operation.kind === 'mutations'
        ? operation.operations
        : [operation];
    if (
      !Array.isArray(operations) ||
      !operations.length ||
      operations.length > 20
    )
      throw new Error('Invalid mutation batch');
    const validated = operations.map((value) =>
      validateOperation(value, operation.scope),
    );
    assertServiceAccountSpreadsheetAllowed(operation.scope);
    if (!durableReady(operation.scope))
      throw new Error('Workbook activation is incomplete');
    const sheets = new DurableSheets();
    const receipts = await sheets.applyBatch(validated);
    console.info(
      JSON.stringify({
        event: 'sync-batch',
        operations: validated.length,
        committed: receipts.filter((receipt) => receipt.state === 'committed')
          .length,
        conflicts: receipts.filter((receipt) => receipt.state === 'conflict')
          .length,
        ...sheets.requestCounts,
      }),
    );
  },
  {
    visibilityTimeoutSeconds: 600,
    retry: (error) => ({
      afterSeconds:
        error instanceof QuotaDeferred
          ? error.retryAfterSeconds + Math.floor(Math.random() * 5)
          : 30,
    }),
  },
);
