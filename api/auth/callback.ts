import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state } = req.query;
  // Use state as origin if available, otherwise fallback to request host
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['host'];
  const origin = (state as string) || `${protocol}://${host}`;
  const redirectUri = `${origin}/api/auth/callback`;

  try {
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
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      throw new Error(tokens.error_description || tokens.error);
    }

    // Send success message to parent window and close popup
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("OAuth error:", error);
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(`
      <html>
        <body>
          <p>Authentication failed: ${error.message}</p>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.close();
              }
            }, 3000);
          </script>
        </body>
      </html>
    `);
  }
}
