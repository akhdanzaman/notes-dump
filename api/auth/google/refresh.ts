import type { VercelRequest, VercelResponse } from '@vercel/node';
import { refreshGoogleAccessToken } from '../../_lib/googleOAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tokens = await refreshGoogleAccessToken(req.body?.refresh_token);
    return res.status(200).json(tokens);
  } catch (error: any) {
    console.error("Refresh token error:", error);
    return res.status(400).json({ error: error.message });
  }
}
