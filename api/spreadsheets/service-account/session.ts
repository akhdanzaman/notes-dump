import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertServiceAccountRequestAllowed, createServiceAccountSession } from '../../_lib/googleServiceAccount.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    assertServiceAccountRequestAllowed(req.headers);
    const session = createServiceAccountSession(req.headers);
    res.setHeader('Set-Cookie', session.cookie);
    return res.status(200).json({ csrfToken: session.csrfToken });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
}
