import type { VercelRequest, VercelResponse } from '@vercel/node';
import { QueueClient } from '@vercel/queue';
import { randomUUID } from 'node:crypto';
import { authorizeDurable, durableReady } from '../../_lib/durableAuth.js';
const queue = new QueueClient({ region: 'iad1' });
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  try {
    const scope = authorizeDurable(req);
    if (!durableReady(scope)) throw new Error('Durable sync is not ready');
    await queue.send('spreadsheet-mutations', { kind: 'reports', scope }, { idempotencyKey: randomUUID(), retentionSeconds: 604800 });
    return res.status(202).json({ state: 'accepted' });
  } catch (error) { return res.status(error instanceof Error && /session/i.test(error.message) ? 401 : 503).json({ error: error instanceof Error ? error.message : 'Reports unavailable' }); }
}
