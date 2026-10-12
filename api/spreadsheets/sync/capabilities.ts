import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authorizeDurable, durableEnabled, durableReady } from '../../_lib/durableAuth.js';
import { hasSharedCoordination } from '../../_lib/syncCoordination.js';
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    // Legacy deployments may run without an explicit allowlist. Disabled mode remains readable.
    if (!durableEnabled()) return res.status(200).json({ enabled: false, ready: false });
    const scope = authorizeDurable(req);
    return res.status(200).json({ enabled: true, ready: !!durableReady(scope), coordination:hasSharedCoordination()?'shared':'instance' });
  } catch (error) { return res.status(error instanceof Error && /session/i.test(error.message) ? 401 : 403).json({ error: error instanceof Error ? error.message : 'Access rejected' }); }
}
