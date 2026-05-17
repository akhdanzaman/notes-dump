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

const resolveOAuthOrigin = (req: VercelRequest) => {
  const fallbackOrigin = requestOrigin(req);
  const candidate = String(req.query.origin || fallbackOrigin);
  const allowed = new Set([fallbackOrigin, ...allowedExtraOrigins()].map(origin => new URL(origin).origin));
  const origin = new URL(candidate).origin;
  if (!allowed.has(origin)) throw new Error('OAuth origin is not allowed');
  return origin;
};

const encodeOAuthState = (origin: string) => Buffer.from(JSON.stringify({ origin, nonce: crypto.randomUUID() }))
  .toString('base64url');

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  
  if (!clientId) {
    console.error("GOOGLE_CLIENT_ID is missing from environment variables");
    return res.status(500).json({ error: "Server configuration error: GOOGLE_CLIENT_ID is missing" });
  }

  const origin = resolveOAuthOrigin(req);
  const redirectUri = `${origin}/auth/callback`;
  
  // Construct the OAuth provider's authorization URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    state: encodeOAuthState(origin)
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.status(200).json({ url: authUrl });
}
