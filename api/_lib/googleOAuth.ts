import crypto from 'node:crypto';

type OAuthRequest = {
  headers: Record<string, unknown>;
  protocol?: string;
};

type GoogleTokenResponse = Record<string, unknown> & {
  error?: string;
  error_description?: string;
};

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const firstHeaderValue = (value: unknown, fallback = '') => (
  Array.isArray(value) ? value[0] || fallback : value || fallback
).toString().split(',')[0].trim();

const getRequestOrigin = (req: OAuthRequest) => {
  const protocol = firstHeaderValue(req.headers['x-forwarded-proto'], req.protocol || 'https');
  const host = firstHeaderValue(req.headers['x-forwarded-host']) || firstHeaderValue(req.headers.host);
  if (!host) throw new Error('OAuth request host is missing');
  return `${protocol}://${host}`;
};

const getAllowedOrigins = () => (process.env.OAUTH_ALLOWED_ORIGINS || process.env.SERVICE_ACCOUNT_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

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

export const resolveOAuthOrigin = (req: OAuthRequest, candidate?: unknown) => {
  const fallbackOrigin = getRequestOrigin(req);
  const allowed = new Set([fallbackOrigin, ...getAllowedOrigins()].map(origin => new URL(origin).origin));
  const origin = new URL(String(candidate || fallbackOrigin)).origin;
  if (!allowed.has(origin)) throw new Error('OAuth origin is not allowed');
  return origin;
};

const createOAuthState = (origin: string) => {
  const secret = getOAuthStateSecret();
  if (!secret) throw new Error('OAUTH_STATE_SECRET or GOOGLE_CLIENT_SECRET is required for OAuth state signing.');
  const payload = Buffer.from(JSON.stringify({
    origin,
    nonce: crypto.randomUUID(),
    exp: Date.now() + 10 * 60 * 1000,
  })).toString('base64url');
  return `${payload}.${hmac(payload, secret)}`;
};

export const decodeOAuthStateOrigin = (req: OAuthRequest, state: unknown) => {
  const raw = String(state || '');
  if (!raw) return resolveOAuthOrigin(req);

  const [payload, signature] = raw.split('.');
  const secret = getOAuthStateSecret();
  if (!secret) throw new Error('OAUTH_STATE_SECRET or GOOGLE_CLIENT_SECRET is required for OAuth state verification.');
  if (!payload || !signature || !safeEqual(hmac(payload, secret), signature)) {
    throw new Error('Invalid OAuth state');
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > Number(parsed.exp)) throw new Error('OAuth state expired');
    return resolveOAuthOrigin(req, parsed.origin);
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('Invalid OAuth state');
  }
};

const requireOAuthCredentials = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables');
  }
  return { clientId, clientSecret };
};

const requestGoogleTokens = async (params: Record<string, string>): Promise<GoogleTokenResponse> => {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const tokens = await response.json().catch(() => ({})) as GoogleTokenResponse;
  if (!response.ok || tokens.error) {
    throw new Error(tokens.error_description || tokens.error || `Google token request failed (${response.status})`);
  }
  return tokens;
};

export const createGoogleAuthorizationUrl = (req: OAuthRequest, candidateOrigin?: unknown) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Server configuration error: GOOGLE_CLIENT_ID is missing');

  const origin = resolveOAuthOrigin(req, candidateOrigin);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/auth/callback`,
    response_type: 'code',
    scope: OAUTH_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: createOAuthState(origin),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
};

export const exchangeGoogleAuthorizationCode = async (req: OAuthRequest, code: unknown, state: unknown) => {
  if (!code) throw new Error('No code provided');
  const { clientId, clientSecret } = requireOAuthCredentials();
  const origin = decodeOAuthStateOrigin(req, state);
  return requestGoogleTokens({
    code: String(code),
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: `${origin}/auth/callback`,
    grant_type: 'authorization_code',
  });
};

export const refreshGoogleAccessToken = async (refreshToken: unknown) => {
  if (!refreshToken) throw new Error('No refresh token provided');
  const { clientId, clientSecret } = requireOAuthCredentials();
  return requestGoogleTokens({
    refresh_token: String(refreshToken),
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
};
