import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state } = req.body;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'];
  const origin = (state as string) || `${protocol}://${host}`;
  const redirectUri = `${origin}/auth/callback`;

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables');
    }

    if (!code) {
      throw new Error('No code provided');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: code as string,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok || tokens.error) {
      throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
    }

    res.status(200).json(tokens);
  } catch (error: any) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: error.message || 'Authentication failed' });
  }
}
