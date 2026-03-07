import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query;
  // Use state as origin if available, otherwise fallback to request host
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'];
  const origin = (state as string) || `${protocol}://${host}`;
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

    // Redirect to app with tokens in URL fragment
    // We use the 'state' parameter as the origin to redirect back to
    const appUrl = (state as string) || '/';
    let redirectUrl;
    try {
        redirectUrl = new URL(appUrl);
    } catch (e) {
        // If appUrl is relative, use current host as base
        redirectUrl = new URL(appUrl, `${protocol}://${host}`);
    }
    
    redirectUrl.searchParams.set('google_auth', JSON.stringify(tokens));
    
    res.redirect(302, redirectUrl.toString());
  } catch (error: any) {
    console.error("OAuth error:", error);
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(`
      <html>
        <body>
          <p>Authentication failed: ${error.message}</p>
          <a href="/">Return to App</a>
        </body>
      </html>
    `);
  }
}
