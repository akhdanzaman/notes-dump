import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { refresh_token } = req.body;
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in environment variables");
    }

    if (!refresh_token) throw new Error("No refresh token provided");

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    const tokens = await tokenResponse.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    res.status(200).json(tokens);
  } catch (error: any) {
    console.error("Refresh token error:", error);
    res.status(400).json({ error: error.message });
  }
}
