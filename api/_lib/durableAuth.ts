import type { VercelRequest } from '@vercel/node';
import { assertServiceAccountRequestAllowed, assertServiceAccountSessionAllowed, assertServiceAccountSpreadsheetAllowed, validateSpreadsheetId } from './googleServiceAccount.js';
export const durableEnabled = () => process.env.SPREADSHEET_DURABLE_SYNC === 'true';
export function authorizeDurable(req: VercelRequest) {
  assertServiceAccountRequestAllowed(req.headers);
  assertServiceAccountSessionAllowed(req.headers);
  const scope = validateSpreadsheetId(req.body?.spreadsheetId);
  // An explicit list is required for durable writes; public session issuance alone is not ownership authentication.
  if (!(process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS || '').split(',').map(id => id.trim()).includes(scope)) throw new Error('Spreadsheet requires an explicit durable allowlist entry');
  assertServiceAccountSpreadsheetAllowed(scope);
  return scope;
}
export function durableReady(scope: string) {
  return durableEnabled() && process.env.SPREADSHEET_DURABLE_READY_IDS?.split(',').map(id => id.trim()).includes(scope);
}
