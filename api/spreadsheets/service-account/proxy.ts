import type { VercelRequest, VercelResponse } from '@vercel/node';
import { QuotaDeferred,syncCache,scopeKey,hashKey } from '../../_lib/syncCoordination.js';
import { assertServiceAccountRequestAllowed, assertServiceAccountSessionAllowed, assertServiceAccountSpreadsheetAllowed, fetchWithServiceAccount, validateSheetsPath, validateSpreadsheetId, isSpreadsheetMaintenanceRequestAllowed } from '../../_lib/googleServiceAccount.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method || 'GET')) {
    res.setHeader('Allow', 'GET, HEAD, POST, PUT, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    assertServiceAccountRequestAllowed(req.headers);
    const spreadsheetId = validateSpreadsheetId(req.query.spreadsheetId);
    assertServiceAccountSessionAllowed(req.headers);
    assertServiceAccountSpreadsheetAllowed(spreadsheetId);
    const path = validateSheetsPath(req.query.path);
    if (process.env.SPREADSHEET_DURABLE_SYNC === 'true' && !['GET', 'HEAD'].includes(req.method || 'GET') && !isSpreadsheetMaintenanceRequestAllowed(req.headers)) {
      return res.status(409).json({ code: 'DURABLE_WRITER_REQUIRED', error: 'Direct writes disabled; use durable sync. Reports can be refreshed before activation.' });
    }
    const body = req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body || {});

    const metadataRead=['GET','HEAD'].includes(req.method || 'GET') && path.startsWith('?fields=');
    const version=metadataRead ? await syncCache.get<{revision:number}>(`${scopeKey(spreadsheetId)}:version`) : undefined;
    const cacheKey=`${scopeKey(spreadsheetId)}:metadata:${hashKey(path)}:${version?.revision || 0}`;
    const cached=metadataRead ? await syncCache.get<string>(cacheKey) : undefined;
    if(cached) {res.setHeader('Content-Type','application/json');return res.status(200).send(cached);}
    const response = await fetchWithServiceAccount(spreadsheetId, path, {
      method: req.method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body,
    });

    const text = await response.text();
    if(metadataRead && response.ok) await syncCache.set(cacheKey,text,300);
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('content-type', contentType);
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    res.setHeader('Content-Length', Buffer.byteLength(text));
    return res.status(response.status).send(text);
  } catch (error: any) {
    if (error instanceof QuotaDeferred) { res.setHeader('Retry-After',error.retryAfterSeconds); return res.status(429).json({error:error.message,code:'SHEETS_QUOTA_WAIT'}); }
    const message = error instanceof Error ? error.message : 'Unknown Sheets failure';
    const session = /session/i.test(message);
    const forbidden = /allowlist|origin|referer/i.test(message);
    return res.status(session ? 401 : forbidden ? 403 : 400).json({ error: message, code: session ? (/expired/i.test(message) ? 'SESSION_EXPIRED' : 'SESSION_INVALID') : 'SHEETS_REQUEST_REJECTED' });
  }
}
