import type { VercelRequest, VercelResponse } from '@vercel/node';
import { QueueClient } from '@vercel/queue';
import { createHash } from 'node:crypto';
import { authorizeDurable, durableReady } from '../../_lib/durableAuth.js';
import { validateOperation } from '../../../utils/syncProtocol.js';
import {
  packSyncOperations,
  type MutationBatch,
} from '../../../utils/syncBatch.js';
import { syncCache, receiptKey } from '../../_lib/syncCoordination.js';
const queue = new QueueClient({ region: 'iad1' });
export const createSubmitHandler =
  (send: (batch: MutationBatch, key: string) => Promise<unknown>) =>
  async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'POST required' });
    const accepted: string[] = [];
    try {
      const scope = authorizeDurable(req);
      if (!durableReady(scope))
        return res
          .status(503)
          .json({
            error: 'Durable sync awaits migration and queue configuration',
          });
      if (
        !Array.isArray(req.body.operations) ||
        !req.body.operations.length ||
        req.body.operations.length > 20
      )
        throw new Error('Send 1â€“20 operations');
      const operations = req.body.operations.map((value: unknown) =>
        validateOperation(value, scope),
      );
      if (
        new Set(
          operations.map(
            (operation: ReturnType<typeof validateOperation>) =>
              operation.operationId,
          ),
        ).size !== operations.length
      )
        throw new Error('Duplicate operation IDs');
      for (const batch of packSyncOperations(operations)) {
        await send(
          { kind: 'mutations', scope, operations: batch },
          createHash('sha256')
            .update(
              `${scope}:${batch
                .map((operation) => operation.operationId)
                .sort()
                .join(',')}`,
            )
            .digest('hex'),
        );
        accepted.push(...batch.map((operation) => operation.operationId));
        // NX prevents a fast worker's committed receipt being overwritten by accepted.
        await syncCache
          .setMany(
            batch.map((operation) => ({
              key: receiptKey(scope, operation.operationId),
              value: { operationId: operation.operationId, state: 'accepted' },
            })),
            120,
            true,
          )
          .catch(() => {});
      }
      return res.status(202).json({ state: 'accepted', accepted });
    } catch (error) {
      // Partial acceptance is explicit. The browser keeps all operations until Sheets receipts exist.
      return res
        .status(
          error instanceof Error && /session/i.test(error.message) ? 401 : 503,
        )
        .json({
          accepted,
          error: error instanceof Error ? error.message : 'Queue unavailable',
        });
    }
  };
export default createSubmitHandler((operation, key) =>
  queue.send('spreadsheet-mutations', operation, {
    retentionSeconds: 604800,
    idempotencyKey: key,
  }),
);
