import type { VercelRequest, VercelResponse } from '@vercel/node';
import { QueueClient } from '@vercel/queue';
import { createHash } from 'node:crypto';
import { authorizeDurable, durableReady } from '../../_lib/durableAuth.js';
import { validateOperation } from '../../../utils/syncProtocol';
const queue = new QueueClient({ region: 'iad1' });
export const createSubmitHandler = (send: (operation: ReturnType<typeof validateOperation>, key: string) => Promise<unknown>) => async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const accepted: string[] = [];
  try {
    const scope = authorizeDurable(req);
    if (!durableReady(scope)) return res.status(503).json({ error: 'Durable sync awaits migration and queue configuration' });
    if (!Array.isArray(req.body.operations) || !req.body.operations.length || req.body.operations.length > 20) throw new Error('Send 1â€“20 operations');
    const operations = req.body.operations.map((value: unknown) => validateOperation(value, scope));
    for (const operation of operations) {
      await send(operation, createHash('sha256').update(`${scope}:${operation.operationId}`).digest('hex'));
      accepted.push(operation.operationId);
    }
    return res.status(202).json({ state: 'accepted', accepted });
  } catch (error) {
    // Partial acceptance is explicit. The browser keeps all operations until Sheets receipts exist.
    return res.status(error instanceof Error && /session/i.test(error.message) ? 401 : 503).json({ accepted, error: error instanceof Error ? error.message : 'Queue unavailable' });
  }
};
export default createSubmitHandler((operation, key) => queue.send('spreadsheet-mutations', operation, { retentionSeconds: 604800, idempotencyKey: key }));
