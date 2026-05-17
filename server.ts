import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { createServer as createViteServer } from "vite";
import { assertServiceAccountRequestAllowed, assertServiceAccountSessionAllowed, assertServiceAccountSpreadsheetAllowed, checkServiceAccountSpreadsheetAccess, createServiceAccountSession, fetchWithServiceAccount, validateSheetsPath, validateSpreadsheetId } from "./server/googleServiceAccount";

dotenv.config();

const splitForwardedHeader = (value: string | string[] | undefined, fallback = '') => (
  Array.isArray(value) ? value[0] || fallback : value || fallback
).split(',')[0].trim();

const allowedOAuthOrigins = () => (process.env.OAUTH_ALLOWED_ORIGINS || process.env.SERVICE_ACCOUNT_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const requestOrigin = (req: express.Request) => `${splitForwardedHeader(req.headers['x-forwarded-proto'], req.protocol)}://${req.get('host')}`;

const resolveOAuthOrigin = (req: express.Request, candidate?: unknown) => {
  const fallbackOrigin = requestOrigin(req);
  const allowed = new Set([fallbackOrigin, ...allowedOAuthOrigins()].map(origin => new URL(origin).origin));
  const origin = new URL(String(candidate || fallbackOrigin)).origin;
  if (!allowed.has(origin)) throw new Error('OAuth origin is not allowed');
  return origin;
};

const encodeOAuthState = (origin: string) => Buffer.from(JSON.stringify({ origin, nonce: crypto.randomUUID() })).toString('base64url');

const decodeOAuthStateOrigin = (req: express.Request, state: unknown) => {
  const raw = String(state || '');
  if (!raw) return resolveOAuthOrigin(req);
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    return resolveOAuthOrigin(req, parsed.origin);
  } catch {
    return resolveOAuthOrigin(req, raw);
  }
};

async function startServer() {
  const app = express();
  const PORT = 3010;

  app.use(cors());
  app.use(express.json());
  app.set('trust proxy', true);

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google OAuth Endpoints
  app.get("/api/auth/google/url", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      console.error("GOOGLE_CLIENT_ID is missing from environment variables");
      return res.status(500).json({ error: "Server configuration error: GOOGLE_CLIENT_ID is missing" });
    }

    const origin = resolveOAuthOrigin(req, req.query.origin);
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
    res.json({ url: authUrl });
  });

  app.post("/api/auth/google/exchange", async (req, res) => {
    const { code, state } = req.body;
    const origin = decodeOAuthStateOrigin(req, state);
    const redirectUri = `${origin}/auth/callback`;

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables");
      }

      if (!code) {
        throw new Error("No code provided");
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

      if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
      }

      res.json(tokens);
    } catch (error: any) {
      console.error("OAuth error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auth/google/refresh", async (req, res) => {
    const { refresh_token } = req.body;
    try {
      if (!refresh_token) throw new Error("No refresh token provided");

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          grant_type: 'refresh_token',
        }),
      });

      const tokens = await tokenResponse.json();
      if (tokens.error) throw new Error(tokens.error_description || tokens.error);

      res.json(tokens);
    } catch (error: any) {
      console.error("Refresh token error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/spreadsheets/service-account/status", async (req, res) => {
    try {
      assertServiceAccountRequestAllowed(req.headers);
      const spreadsheetId = validateSpreadsheetId(req.query.spreadsheetId);
      assertServiceAccountSessionAllowed(req.headers);
      assertServiceAccountSpreadsheetAllowed(spreadsheetId);
      const status = await checkServiceAccountSpreadsheetAccess(spreadsheetId);
      res.status(status.accessible ? 200 : 403).json(status);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/spreadsheets/service-account/session", (req, res) => {
    try {
      assertServiceAccountRequestAllowed(req.headers);
      const session = createServiceAccountSession(req.headers);
      res.setHeader('Set-Cookie', session.cookie);
      res.json({ csrfToken: session.csrfToken });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.all("/api/spreadsheets/service-account/proxy", async (req, res) => {
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD, POST, PUT, PATCH, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      assertServiceAccountRequestAllowed(req.headers);
      const spreadsheetId = validateSpreadsheetId(req.query.spreadsheetId);
      assertServiceAccountSessionAllowed(req.headers);
      assertServiceAccountSpreadsheetAllowed(spreadsheetId);
      const path = validateSheetsPath(req.query.path);
      const body = req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body || {});

      const response = await fetchWithServiceAccount(spreadsheetId, path, {
        method: req.method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body,
      });

      const text = await response.text();
      res.status(response.status);
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('content-type', contentType);
      res.send(text);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    
    // SPA fallback
    const path = await import('path');
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
