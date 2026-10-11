import { QueueClient } from '@vercel/queue';
import { DurableSheets } from '../../_lib/durableSheets.js';
import { validateOperation, type SyncOperation } from '../../../utils/syncProtocol.js';
import { assertServiceAccountSpreadsheetAllowed } from '../../_lib/googleServiceAccount.js';
import { durableReady } from '../../_lib/durableAuth.js';
const queue = new QueueClient({ region: 'iad1' });
// SDK validates private queue callbacks and renews visibility while processing.
export default queue.handleNodeCallback<SyncOperation | { kind: 'reports'; scope: string }>(async operation => {
  if ('kind' in operation && operation.kind === 'reports') {
    assertServiceAccountSpreadsheetAllowed(operation.scope);
    if (!durableReady(operation.scope)) throw new Error('Workbook activation is incomplete');
    await new DurableSheets().refreshReports(operation.scope);
    return;
  }
  validateOperation(operation, operation.scope);
  assertServiceAccountSpreadsheetAllowed(operation.scope);
  if (!durableReady(operation.scope)) throw new Error('Workbook activation is incomplete');
  await new DurableSheets().apply(operation as SyncOperation);
}, { visibilityTimeoutSeconds: 600, retry: () => ({ afterSeconds: 30 }) });
