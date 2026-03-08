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

    // Send success message to parent window and close popup
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <html>
        <body>
          <script>
            try {
              const tokens = ${JSON.stringify(tokens)};
              localStorage.setItem('oauth_tokens', JSON.stringify(tokens));
              
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', tokens: tokens }, '*');
              }
              
              window.close();
              
              setTimeout(() => {
                document.body.innerHTML = '<div style="font-family: sans-serif; padding: 20px; text-align: center;"><h3>Authentication successful!</h3><p>You can close this window now and return to the app.</p></div>';
              }, 1000);
            } catch (e) {
              document.body.innerHTML += '<p>Error: ' + e.message + '</p>';
            }
          </script>
          <p>Authentication successful. Processing...</p>
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
          <a href="/">Return to App</a>
        </body>
      </html>
    `);
  }
}
