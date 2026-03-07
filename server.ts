import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

dotenv.config();

const authSessions = new Map<string, { status: 'pending' | 'success' | 'error', tokens?: any, error?: string }>();

async function startServer() {
  const app = express();
  const PORT = 3000;

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

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const origin = req.query.origin as string || `${protocol}://${host}`;
    const redirectUri = `${origin}/api/auth/callback`;
    const sessionId = req.query.sessionId as string;

    if (sessionId) {
      authSessions.set(sessionId, { status: 'pending' });
    }

    const stateObj = { origin, sessionId };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    
    // Construct the OAuth provider's authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
      state: state // Pass origin and sessionId in state
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    res.json({ url: authUrl });
  });

  app.get("/api/auth/status", (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });
    
    const session = authSessions.get(sessionId);
    if (!session) return res.json({ status: 'not_found' });
    
    if (session.status === 'success') {
      authSessions.delete(sessionId); // clean up
      return res.json({ status: 'success', tokens: session.tokens });
    } else if (session.status === 'error') {
      authSessions.delete(sessionId);
      return res.json({ status: 'error', error: session.error });
    }
    
    res.json({ status: 'pending' });
  });

  app.get(["/api/auth/callback", "/api/auth/callback/"], async (req, res) => {
    const { code, state } = req.query;
    let origin = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
    let sessionId = '';

    if (state) {
      try {
        const stateObj = JSON.parse(Buffer.from(state as string, 'base64').toString('utf-8'));
        if (stateObj.origin) origin = stateObj.origin;
        if (stateObj.sessionId) sessionId = stateObj.sessionId;
      } catch (e) {
        // fallback
        origin = state as string;
      }
    }
    const redirectUri = `${origin}/api/auth/callback`;

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

      if (sessionId) {
        authSessions.set(sessionId, { status: 'success', tokens });
      }

      // Send success message to parent window and close popup
      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
                window.close();
              } else {
                window.location.href = '/?google_auth=' + encodeURIComponent(JSON.stringify(${JSON.stringify(tokens)}));
              }
            </script>
            <p>Authentication successful. This window should close automatically. If not, you can safely close it.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error("OAuth error:", error);
      if (sessionId) {
        authSessions.set(sessionId, { status: 'error', error: error.message });
      }
      res.status(500).send(`
        <html>
          <body>
            <p>Authentication failed: ${error.message}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: '${error.message}' }, '*');
                setTimeout(() => window.close(), 3000);
              }
            </script>
            <a href="/">Return to App</a>
          </body>
        </html>
      `);
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
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
