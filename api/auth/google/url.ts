import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createGoogleAuthorizationUrl } from '../../_lib/googleOAuth.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return res.status(200).json({ url: createGoogleAuthorizationUrl(req, req.query.origin) });
  } catch (error: any) {
    const status = error?.message?.includes('GOOGLE_CLIENT_ID is missing') ? 500 : 400;
    return res.status(status).json({ error: error?.message || 'Failed to create Google authorization URL' });
  }
}
