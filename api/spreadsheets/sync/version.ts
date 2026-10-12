import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authorizeDurable } from '../../_lib/durableAuth.js';
import {
  syncCache,
  scopeKey,
  hasSharedCoordination,
} from '../../_lib/syncCoordination.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'POST required' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const scope = authorizeDurable(req);
    return res
      .status(200)
      .json({
        shared: hasSharedCoordination(),
        version: (await syncCache.get(`${scopeKey(scope)}:version`)) || {
          revision: 0,
          tables: [],
        },
      });
  } catch (error) {
    return res
      .status(
        error instanceof Error && /session/i.test(error.message) ? 401 : 503,
      )
      .json({
        error: 'Versi sinkronisasi belum tersedia. Data lokal tetap aman.',
      });
  }
}
