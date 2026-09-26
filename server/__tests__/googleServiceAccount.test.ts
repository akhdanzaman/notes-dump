import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertServiceAccountRequestAllowed,
  assertServiceAccountSessionAllowed,
  assertServiceAccountSpreadsheetAllowed,
  createServiceAccountSession,
  DEFAULT_SERVICE_ACCOUNT_EMAIL,
  checkServiceAccountSpreadsheetAccess,
  getConfiguredServiceAccountEmail,
  validateSheetsPath,
  validateSpreadsheetId,
} from '../../api/_lib/googleServiceAccount';
import {
  createGoogleAuthorizationUrl,
  decodeOAuthStateOrigin,
  exchangeGoogleAuthorizationCode,
  refreshGoogleAccessToken,
  resolveOAuthOrigin,
} from '../../api/_lib/googleOAuth';
import googleAuthUrlHandler from '../../api/auth/google/url';
import googleAuthExchangeHandler from '../../api/auth/google/exchange';
import googleAuthRefreshHandler from '../../api/auth/google/refresh';
import serviceAccountStatusHandler from '../../api/spreadsheets/service-account/status';
import serviceAccountSessionHandler from '../../api/spreadsheets/service-account/session';
import serviceAccountProxyHandler from '../../api/spreadsheets/service-account/proxy';

const restoreEnv = (name: string, value: string | undefined) => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

const createMockResponse = () => {
  const state: { status: number; body?: unknown; headers: Record<string, unknown> } = {
    status: 200,
    headers: {},
  };
  const response = {
    setHeader(name: string, value: unknown) {
      state.headers[name.toLowerCase()] = value;
      return response;
    },
    status(status: number) {
      state.status = status;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
    send(body: unknown) {
      state.body = body;
      return response;
    },
  };
  return { response, state };
};

test('service account helpers expose configured email without requiring OAuth', async () => {
  const originalJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const originalKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const originalPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  try {
    assert.equal(getConfiguredServiceAccountEmail(), DEFAULT_SERVICE_ACCOUNT_EMAIL);
    const status = await checkServiceAccountSpreadsheetAccess('spreadsheet_123-ABC');
    assert.deepEqual(status, {
      configured: false,
      serviceAccountEmail: DEFAULT_SERVICE_ACCOUNT_EMAIL,
      accessible: false,
      error: 'Server service account private key is not configured.',
    });
  } finally {
    if (originalJson === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    else process.env.GOOGLE_SERVICE_ACCOUNT_JSON = originalJson;
    if (originalKey === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    else process.env.GOOGLE_SERVICE_ACCOUNT_KEY = originalKey;
    if (originalPrivateKey === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    else process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = originalPrivateKey;
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
  }
});

test('service account proxy validators restrict spreadsheet ids and Sheets API paths', () => {
  assert.equal(validateSpreadsheetId('abc_123-DEF'), 'abc_123-DEF');
  assert.equal(validateSheetsPath(''), '');
  assert.equal(validateSheetsPath(':batchUpdate'), ':batchUpdate');
  assert.equal(validateSheetsPath('/values/Transactions!A%3AK'), '/values/Transactions!A%3AK');
  assert.equal(validateSheetsPath('/values/Transactions!A%3AK?valueInputOption=USER_ENTERED'), '/values/Transactions!A%3AK?valueInputOption=USER_ENTERED');

  assert.throws(() => validateSpreadsheetId('../secret'), /Invalid spreadsheetId/);
  assert.throws(() => validateSheetsPath('https://sheets.googleapis.com/v4/spreadsheets/x'), /Invalid Google Sheets API path/);
  assert.throws(() => validateSheetsPath('/values-private'), /Unsupported Google Sheets API path/);
  assert.throws(() => validateSheetsPath('/values/../developerMetadata'), /Invalid Google Sheets API path/);
  assert.throws(() => validateSheetsPath('/values/Transactions#fragment'), /Invalid Google Sheets API path/);
  assert.throws(() => validateSheetsPath('/developerMetadata'), /Unsupported Google Sheets API path/);
});

test('service account request guard rejects cross-site browser calls', () => {
  assert.doesNotThrow(() => assertServiceAccountRequestAllowed({
    host: 'notes.example.com',
    'x-forwarded-proto': 'https',
    origin: 'https://notes.example.com',
    'sec-fetch-site': 'same-origin',
  }));

  assert.throws(() => assertServiceAccountRequestAllowed({
    host: 'notes.example.com',
    'x-forwarded-proto': 'https',
    origin: 'https://evil.example',
    'sec-fetch-site': 'cross-site',
  }), /same-origin app requests|origin is not allowed/);
});

test('service account request guard requires browser origin signal in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => assertServiceAccountRequestAllowed({
      host: 'notes.example.com',
      'x-forwarded-proto': 'https',
    }), /requires a same-origin browser request/);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test('service account sessions require signed cookie and csrf header', () => {
  const originalSecret = process.env.SERVICE_ACCOUNT_SESSION_SECRET;
  process.env.SERVICE_ACCOUNT_SESSION_SECRET = 'unit-test-session-secret';
  try {
    const headers = {
      host: 'notes.example.com',
      'x-forwarded-proto': 'https',
      origin: 'https://notes.example.com',
      'sec-fetch-site': 'same-origin',
    };
    const session = createServiceAccountSession(headers);
    assert.match(session.cookie, /arkaiv_sa_session=/);
    assert.doesNotThrow(() => assertServiceAccountSessionAllowed({
      ...headers,
      cookie: session.cookie.split(';')[0],
      'x-arkaiv-csrf': session.csrfToken,
    }));
    assert.throws(() => assertServiceAccountSessionAllowed({
      ...headers,
      cookie: session.cookie.split(';')[0],
      'x-arkaiv-csrf': 'wrong-token',
    }), /Invalid service-account spreadsheet session token/);
  } finally {
    if (originalSecret === undefined) delete process.env.SERVICE_ACCOUNT_SESSION_SECRET;
    else process.env.SERVICE_ACCOUNT_SESSION_SECRET = originalSecret;
  }
});

test('service account spreadsheet allowlist is enforced in production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowlist = process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS;
  process.env.NODE_ENV = 'production';
  process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS = 'sheet-allowed';
  try {
    assert.doesNotThrow(() => assertServiceAccountSpreadsheetAllowed('sheet-allowed'));
    assert.throws(() => assertServiceAccountSpreadsheetAllowed('sheet-blocked'), /not allowlisted/);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalAllowlist === undefined) delete process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS;
    else process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS = originalAllowlist;
  }
});

test('service account spreadsheet allowlist defaults to allow-all when not configured (production)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAllowlist = process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS;
  process.env.NODE_ENV = 'production';
  delete process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS;
  try {
    // When allowlist is not set, any spreadsheet ID should be allowed (default permissive).
    assert.doesNotThrow(() => assertServiceAccountSpreadsheetAllowed('any-sheet-id'));
    assert.doesNotThrow(() => assertServiceAccountSpreadsheetAllowed('another-random-sheet'));
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalAllowlist === undefined) delete process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS;
    else process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS = originalAllowlist;
  }
});

test('service account wildcard allowlist bypasses specific checks', () => {
  const originalAllowlist = process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS;
  process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS = 'sheet-allowed,*';
  try {
    assert.doesNotThrow(() => assertServiceAccountSpreadsheetAllowed('anything-goes'));
    assert.doesNotThrow(() => assertServiceAccountSpreadsheetAllowed('sheet-allowed'));
  } finally {
    if (originalAllowlist === undefined) delete process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS;
    else process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS = originalAllowlist;
  }
});

test('OAuth authorization URL signs the allowed callback origin', () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalStateSecret = process.env.OAUTH_STATE_SECRET;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';
  const req = {
    headers: { host: 'notes.example.com', 'x-forwarded-proto': 'https' },
  };

  try {
    const authUrl = new URL(createGoogleAuthorizationUrl(req));
    assert.equal(authUrl.origin, 'https://accounts.google.com');
    assert.equal(authUrl.searchParams.get('client_id'), 'test-client-id');
    assert.equal(authUrl.searchParams.get('redirect_uri'), 'https://notes.example.com/auth/callback');
    assert.equal(decodeOAuthStateOrigin(req, authUrl.searchParams.get('state')), 'https://notes.example.com');
    assert.throws(() => resolveOAuthOrigin(req, 'https://evil.example'), /not allowed/);

    const state = authUrl.searchParams.get('state') || '';
    assert.throws(() => decodeOAuthStateOrigin(req, `${state}tampered`), /Invalid OAuth state/);
  } finally {
    restoreEnv('GOOGLE_CLIENT_ID', originalClientId);
    restoreEnv('OAUTH_STATE_SECRET', originalStateSecret);
  }
});

test('OAuth helpers preserve local HTTP callbacks and share one token request path', async () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const originalStateSecret = process.env.OAUTH_STATE_SECRET;
  const originalFetch = globalThis.fetch;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';
  const req = { headers: { host: 'localhost:3010' }, protocol: 'http' };
  const requests: URLSearchParams[] = [];

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push(init?.body as URLSearchParams);
    return new Response(JSON.stringify({ access_token: 'token', expires_in: 3600 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const authUrl = new URL(createGoogleAuthorizationUrl(req));
    const state = authUrl.searchParams.get('state');
    assert.equal(authUrl.searchParams.get('redirect_uri'), 'http://localhost:3010/auth/callback');

    await exchangeGoogleAuthorizationCode(req, 'auth-code', state);
    await refreshGoogleAccessToken('refresh-token');

    assert.equal(requests[0].get('grant_type'), 'authorization_code');
    assert.equal(requests[0].get('redirect_uri'), 'http://localhost:3010/auth/callback');
    assert.equal(requests[1].get('grant_type'), 'refresh_token');
    assert.equal(requests[1].get('refresh_token'), 'refresh-token');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv('GOOGLE_CLIENT_ID', originalClientId);
    restoreEnv('GOOGLE_CLIENT_SECRET', originalClientSecret);
    restoreEnv('OAUTH_STATE_SECRET', originalStateSecret);
  }
});

test('shared API handlers enforce the same HTTP method contract in every runtime', async () => {
  const cases = [
    { handler: googleAuthUrlHandler, method: 'POST', allow: 'GET' },
    { handler: googleAuthExchangeHandler, method: 'GET', allow: 'POST' },
    { handler: googleAuthRefreshHandler, method: 'GET', allow: 'POST' },
    { handler: serviceAccountStatusHandler, method: 'POST', allow: 'GET' },
    { handler: serviceAccountSessionHandler, method: 'GET', allow: 'POST' },
    { handler: serviceAccountProxyHandler, method: 'TRACE', allow: 'GET, HEAD, POST, PUT, PATCH, DELETE' },
  ];

  for (const { handler, method, allow } of cases) {
    const { response, state } = createMockResponse();
    await handler({ method, headers: {}, query: {}, body: {} } as any, response as any);
    assert.equal(state.status, 405);
    assert.deepEqual(state.body, { error: 'Method not allowed' });
    assert.equal(state.headers.allow, allow);
  }
});
