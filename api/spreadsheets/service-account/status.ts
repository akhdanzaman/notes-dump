import type { VercelRequest, VercelResponse } from '@vercel/node';
import { assertServiceAccountRequestAllowed, assertServiceAccountSessionAllowed, assertServiceAccountSpreadsheetAllowed, checkServiceAccountSpreadsheetAccess, validateSpreadsheetId } from '../../_lib/googleServiceAccount.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    assertServiceAccountRequestAllowed(req.headers);
    const spreadsheetId = validateSpreadsheetId(req.query.spreadsheetId);
    assertServiceAccountSessionAllowed(req.headers);
    assertServiceAccountSpreadsheetAllowed(spreadsheetId);
    const status = await checkServiceAccountSpreadsheetAccess(spreadsheetId);
    return res.status(status.accessible ? 200 : 403).json(status);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
}
