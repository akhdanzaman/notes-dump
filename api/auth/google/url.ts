import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'];
  const origin = req.query.origin as string || `${protocol}://${host}`;
  const redirectUri = `${origin}/api/auth/callback`;
  
  // Construct the OAuth provider's authorization URL
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    access_type: 'offline',
    prompt: 'consent',
    state: origin // Pass origin in state
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.status(200).json({ url: authUrl });
}
