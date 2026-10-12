import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authorizeDurable } from '../../_lib/durableAuth.js';
import { DurableSheets } from '../../_lib/durableSheets.js';
import { QuotaDeferred } from '../../_lib/syncCoordination.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const scope = authorizeDurable(req);
    if (!Array.isArray(req.body.operationIds) || req.body.operationIds.length > 200 || !req.body.operationIds.every((id: unknown) => typeof id === 'string' && /^[\w-]{8,128}$/.test(id))) throw new Error('Invalid operation IDs');
    return res.status(200).json({ receipts: await new DurableSheets().receipts(scope, req.body.operationIds) });
  } catch (error) { if(error instanceof QuotaDeferred) res.setHeader('Retry-After',error.retryAfterSeconds); return res.status(error instanceof Error && /session/i.test(error.message) ? 401 : 503).json({ error: error instanceof Error ? error.message : 'Status unavailable' }); }
}
