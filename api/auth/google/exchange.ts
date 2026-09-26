import type { VercelRequest, VercelResponse } from '@vercel/node';
import { exchangeGoogleAuthorizationCode } from '../../_lib/googleOAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tokens = await exchangeGoogleAuthorizationCode(req, req.body?.code, req.body?.state);
    return res.status(200).json(tokens);
  } catch (error: any) {
    console.error('OAuth error:', error);
    return res.status(500).json({ error: error.message || 'Authentication failed' });
  }
}
