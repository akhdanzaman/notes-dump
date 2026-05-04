import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertServiceAccountRequestAllowed, fetchWithServiceAccount, validateSheetsPath, validateSpreadsheetId } from '../../../server/googleServiceAccount';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!['GET', 'HEAD', 'POST'].includes(req.method || 'GET')) {
    res.setHeader('Allow', 'GET, HEAD, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    assertServiceAccountRequestAllowed(req.headers);
    const spreadsheetId = validateSpreadsheetId(req.query.spreadsheetId);
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
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    return res.status(response.status).send(text);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
}
