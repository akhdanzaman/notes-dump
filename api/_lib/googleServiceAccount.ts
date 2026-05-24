import crypto from 'node:crypto';

export const DEFAULT_SERVICE_ACCOUNT_EMAIL = 'openclaw-adan@gen-lang-client-0558606321.iam.gserviceaccount.com';

const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const SERVICE_ACCOUNT_ALLOWED_ORIGINS = (process.env.SERVICE_ACCOUNT_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const getServiceAccountAllowedSpreadsheetIds = () => (process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS || process.env.SERVICE_ACCOUNT_SPREADSHEET_IDS || '')
  .split(',')
  .map(id => id.trim())
  .filter(Boolean);

export const SERVICE_ACCOUNT_SESSION_COOKIE = 'arkaiv_sa_session';
export const SERVICE_ACCOUNT_CSRF_HEADER = 'x-arkaiv-csrf';

const SERVICE_ACCOUNT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

let cachedToken: { accessToken: string; expiresAtMs: number } | null = null;

export type ServiceAccountStatus = {
  configured: boolean;
  serviceAccountEmail: string;
  accessible: boolean;
  writable?: boolean;
  needsSharing?: boolean;
  status?: number;
  error?: string;
};

const base64Url = (input: string | Buffer) => Buffer.from(input)
  .toString('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_');

const decodeBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
};

const sha256 = (input: string) => crypto.createHash('sha256').update(input).digest('hex');

const hmac = (input: string, secret: string) => crypto.createHmac('sha256', secret).update(input).digest('hex');

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const parseJsonMaybeBase64 = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
  return JSON.parse(decoded);
};

const getServiceAccountCredentials = (): { clientEmail: string; privateKey: string } | null => {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (json) {
    try {
      const parsed = parseJsonMaybeBase64(json);
      const clientEmail = parsed.client_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || DEFAULT_SERVICE_ACCOUNT_EMAIL;
      const privateKey = parsed.private_key;
      if (clientEmail && privateKey) {
        return { clientEmail, privateKey: String(privateKey).replace(/\\n/g, '\n') };
      }
    } catch (error) {
      console.warn('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON/KEY', error);
    }
  }

  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || DEFAULT_SERVICE_ACCOUNT_EMAIL;
  if (!privateKey) return null;
  return { clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') };
};

export const getConfiguredServiceAccountEmail = () => (
  getServiceAccountCredentials()?.clientEmail
  || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  || DEFAULT_SERVICE_ACCOUNT_EMAIL
);

const createJwtAssertion = (clientEmail: string, privateKey: string) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey);
  return `${unsigned}.${base64Url(signature)}`;
};

export const getServiceAccountAccessToken = async (): Promise<string> => {
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    throw new Error('Google service account private key is not configured on the server. Set GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SERVICE_ACCOUNT_KEY, or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.');
  }

  if (cachedToken && cachedToken.expiresAtMs > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const assertion = createJwtAssertion(credentials.clientEmail, credentials.privateKey);
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error_description || data.error || `Failed to mint service account token (${response.status})`);
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + Math.max(60, Number(data.expires_in || 3600) - 30) * 1000,
  };
  return cachedToken.accessToken;
};

export const validateSpreadsheetId = (spreadsheetId: unknown): string => {
  const id = String(spreadsheetId || '').trim();
  if (!/^[a-zA-Z0-9-_]+$/.test(id)) throw new Error('Invalid spreadsheetId');
  return id;
};

export const validateSheetsPath = (path: unknown): string => {
  const raw = String(path || '');
  if (raw.includes('\n') || raw.includes('\r') || raw.startsWith('http://') || raw.startsWith('https://')) {
    throw new Error('Invalid Google Sheets API path');
  }

  if (
    raw === ''
    || raw === ':batchUpdate'
    || raw.startsWith('/values')
  ) {
    return raw;
  }

  throw new Error('Unsupported Google Sheets API path');
};

const getHeaderValue = (headers: Record<string, unknown>, name: string): string => {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return String(value[0] || '');
  return String(value || '');
};

const getCookieValue = (headers: Record<string, unknown>, name: string): string => {
  const cookie = getHeaderValue(headers, 'cookie');
  return cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
};

const splitForwardedHeader = (value: string) => value.split(',')[0]?.trim() || '';

const getRequestOrigin = (headers: Record<string, unknown>) => {
  const host = splitForwardedHeader(getHeaderValue(headers, 'x-forwarded-host'))
    || splitForwardedHeader(getHeaderValue(headers, 'host'));
  if (!host) return '';
  const proto = splitForwardedHeader(getHeaderValue(headers, 'x-forwarded-proto')) || 'https';
  return `${proto}://${host}`;
};

const getSessionSigningSecret = () => (
  process.env.SERVICE_ACCOUNT_SESSION_SECRET
  || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  || process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  || process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  || (process.env.NODE_ENV === 'production' ? '' : 'arkaiv-development-service-account-session')
);

export const createServiceAccountSession = (headers: Record<string, unknown>) => {
  const secret = getSessionSigningSecret();
  if (!secret) {
    throw new Error('SERVICE_ACCOUNT_SESSION_SECRET is required for service-account spreadsheet sessions.');
  }

  const csrfToken = base64Url(crypto.randomBytes(32));
  const payload = base64Url(JSON.stringify({
    nonce: base64Url(crypto.randomBytes(16)),
    csrfHash: sha256(csrfToken),
    exp: Date.now() + SERVICE_ACCOUNT_SESSION_TTL_MS,
  }));
  const signature = hmac(payload, secret);
  const secure = getRequestOrigin(headers).startsWith('https://') || process.env.NODE_ENV === 'production';
  const cookieParts = [
    `${SERVICE_ACCOUNT_SESSION_COOKIE}=${payload}.${signature}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SERVICE_ACCOUNT_SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) cookieParts.push('Secure');
  return { csrfToken, cookie: cookieParts.join('; ') };
};

export const assertServiceAccountSessionAllowed = (headers: Record<string, unknown>) => {
  const secret = getSessionSigningSecret();
  if (!secret) {
    throw new Error('SERVICE_ACCOUNT_SESSION_SECRET is required for service-account spreadsheet sessions.');
  }

  const session = getCookieValue(headers, SERVICE_ACCOUNT_SESSION_COOKIE);
  const csrfToken = getHeaderValue(headers, SERVICE_ACCOUNT_CSRF_HEADER);
  const [payload, signature] = session.split('.');
  if (!payload || !signature || !csrfToken) {
    throw new Error('Service-account spreadsheet API requires an active same-origin app session.');
  }
  if (!safeEqual(hmac(payload, secret), signature)) {
    throw new Error('Invalid service-account spreadsheet session.');
  }

  const parsed = JSON.parse(decodeBase64Url(payload));
  if (!parsed?.exp || Date.now() > Number(parsed.exp)) {
    throw new Error('Service-account spreadsheet session expired.');
  }
  if (!parsed?.csrfHash || !safeEqual(String(parsed.csrfHash), sha256(csrfToken))) {
    throw new Error('Invalid service-account spreadsheet session token.');
  }
};

export const assertServiceAccountSpreadsheetAllowed = (spreadsheetId: string) => {
  const allowedSpreadsheetIds = getServiceAccountAllowedSpreadsheetIds();
  if (allowedSpreadsheetIds.includes('*')) return;
  if (allowedSpreadsheetIds.includes(spreadsheetId)) return;
  if (allowedSpreadsheetIds.length === 0) {
    // No explicit allowlist configured: allow all spreadsheets.
    // The security boundary is already enforced by:
    //  - The spreadsheet must be shared with the service account
    //  - The user must have a valid same-origin app session
    if (process.env.NODE_ENV === 'production') {
      console.warn('SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS is not set — allowing all spreadsheets. Set it to restrict access to specific spreadsheet IDs.');
    }
    return;
  }

  throw new Error('Spreadsheet is not allowlisted for service-account access. Set SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS on the server.');
};

const isAllowedOrigin = (candidate: string, headers: Record<string, unknown>) => {
  if (!candidate) return false;
  try {
    const candidateOrigin = new URL(candidate).origin;
    const requestOrigin = getRequestOrigin(headers);
    const allowed = new Set([
      requestOrigin ? new URL(requestOrigin).origin : '',
      ...SERVICE_ACCOUNT_ALLOWED_ORIGINS.map(origin => new URL(origin).origin),
    ].filter(Boolean));
    return allowed.has(candidateOrigin);
  } catch {
    return false;
  }
};

export const assertServiceAccountRequestAllowed = (headers: Record<string, unknown>) => {
  const fetchSite = getHeaderValue(headers, 'sec-fetch-site').toLowerCase();
  if (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
    throw new Error('Service account spreadsheet API only accepts same-origin app requests.');
  }

  const origin = getHeaderValue(headers, 'origin');
  if (origin && !isAllowedOrigin(origin, headers)) {
    throw new Error('Service account spreadsheet API origin is not allowed.');
  }

  const referer = getHeaderValue(headers, 'referer');
  if (referer && !isAllowedOrigin(referer, headers)) {
    throw new Error('Service account spreadsheet API referer is not allowed.');
  }

  if (process.env.NODE_ENV === 'production' && !fetchSite && !origin && !referer) {
    throw new Error('Service account spreadsheet API requires a same-origin browser request in production.');
  }
};

export const fetchWithServiceAccount = async (
  spreadsheetIdInput: unknown,
  pathInput: unknown = '',
  init: RequestInit = {}
): Promise<Response> => {
  const spreadsheetId = validateSpreadsheetId(spreadsheetIdInput);
  const path = validateSheetsPath(pathInput);
  const token = await getServiceAccountAccessToken();

  return fetch(`${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
};

export const checkServiceAccountSpreadsheetAccess = async (spreadsheetIdInput: unknown): Promise<ServiceAccountStatus> => {
  const serviceAccountEmail = getConfiguredServiceAccountEmail();
  if (!getServiceAccountCredentials()) {
    return {
      configured: false,
      serviceAccountEmail,
      accessible: false,
      error: 'Server service account private key is not configured.',
    };
  }

  try {
    const response = await fetchWithServiceAccount(spreadsheetIdInput, '');
    if (response.ok) {
      const spreadsheet = await response.json().catch(() => ({}));
      const title = spreadsheet?.properties?.title;

      if (!title) {
        return {
          configured: true,
          serviceAccountEmail,
          accessible: false,
          writable: false,
          status: response.status,
          error: 'Spreadsheet metadata could not be read.',
        };
      }

      const writeCheck = await fetchWithServiceAccount(spreadsheetIdInput, ':batchUpdate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            updateSpreadsheetProperties: {
              properties: { title },
              fields: 'title',
            },
          }],
        }),
      });

      if (writeCheck.ok) {
        return { configured: true, serviceAccountEmail, accessible: true, writable: true, status: writeCheck.status };
      }

      const writeError = await writeCheck.text();
      return {
        configured: true,
        serviceAccountEmail,
        accessible: false,
        writable: false,
        needsSharing: writeCheck.status === 403 || writeCheck.status === 404,
        status: writeCheck.status,
        error: writeError,
      };
    }

    const text = await response.text();
    return {
      configured: true,
      serviceAccountEmail,
      accessible: false,
      writable: false,
      needsSharing: response.status === 403 || response.status === 404,
      status: response.status,
      error: text,
    };
  } catch (error: any) {
    return {
      configured: true,
      serviceAccountEmail,
      accessible: false,
      writable: false,
      error: error?.message || 'Unknown service account access error',
    };
  }
};
