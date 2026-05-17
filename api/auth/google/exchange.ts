import type { VercelRequest, VercelResponse } from '@vercel/node';

const firstHeaderValue = (value: string | string[] | undefined, fallback = '') => (
  Array.isArray(value) ? value[0] || fallback : value || fallback
).split(',')[0].trim();

const allowedExtraOrigins = () => (process.env.OAUTH_ALLOWED_ORIGINS || process.env.SERVICE_ACCOUNT_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const requestOrigin = (req: VercelRequest) => {
  const protocol = firstHeaderValue(req.headers['x-forwarded-proto'], 'https');
  const host = firstHeaderValue(req.headers.host);
  return `${protocol}://${host}`;
};

const resolveAllowedOrigin = (req: VercelRequest, candidate: string) => {
  const fallbackOrigin = requestOrigin(req);
  const allowed = new Set([fallbackOrigin, ...allowedExtraOrigins()].map(origin => new URL(origin).origin));
  const origin = new URL(candidate || fallbackOrigin).origin;
  if (!allowed.has(origin)) throw new Error('OAuth origin is not allowed');
  return origin;
};

const decodeOAuthStateOrigin = (req: VercelRequest, state: unknown) => {
  const raw = String(state || '');
  if (!raw) return resolveAllowedOrigin(req, requestOrigin(req));
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    return resolveAllowedOrigin(req, String(parsed.origin || ''));
  } catch {
    return resolveAllowedOrigin(req, raw);
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state } = req.body;
  const origin = decodeOAuthStateOrigin(req, state);
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
