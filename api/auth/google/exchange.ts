import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';

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

const getOAuthStateSecret = () => (
  process.env.OAUTH_STATE_SECRET
  || process.env.SERVICE_ACCOUNT_SESSION_SECRET
  || process.env.GOOGLE_CLIENT_SECRET
  || (process.env.NODE_ENV === 'production' ? '' : 'arkaiv-development-oauth-state')
);

const hmac = (input: string, secret: string) => crypto.createHmac('sha256', secret).update(input).digest('base64url');

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const decodeOAuthStateOrigin = (req: VercelRequest, state: unknown) => {
  const raw = String(state || '');
  if (!raw) return resolveAllowedOrigin(req, requestOrigin(req));
  const [payload, signature] = raw.split('.');
  const secret = getOAuthStateSecret();
  if (!secret) throw new Error('OAUTH_STATE_SECRET or GOOGLE_CLIENT_SECRET is required for OAuth state verification.');
  if (!payload || !signature || !safeEqual(hmac(payload, secret), signature)) {
    throw new Error('Invalid OAuth state');
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > Number(parsed.exp)) throw new Error('OAuth state expired');
    return resolveAllowedOrigin(req, String(parsed.origin || ''));
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Invalid OAuth state');
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
