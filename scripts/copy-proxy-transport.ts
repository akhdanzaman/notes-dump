import type { SheetsTransport } from '../api/_lib/durableSheets';
/** Migration/test adapter for the explicitly named copy. Credentials stay on the live server. */
export function copyProxyTransport(scope: string, appOrigin: string): SheetsTransport {
  const origin = new URL(appOrigin).origin; const headers = { Origin: origin, Referer: `${origin}/` }; let csrf = ''; let cookie = '';
  return async (target, inputPath, init = {}) => {
    if (target !== scope) throw new Error('Copy boundary violation');
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!csrf) {
        const session = await fetch(`${origin}/api/spreadsheets/service-account/session`, { method: 'POST', headers, signal: AbortSignal.timeout(25000) });
        if (!session.ok) throw new Error(`Session ${session.status}`);
        csrf = (await session.json()).csrfToken; cookie = session.headers.get('set-cookie')!.split(';')[0];
      }
      const response = await fetch(`${origin}/api/spreadsheets/service-account/proxy?${new URLSearchParams({ spreadsheetId: scope, path: inputPath.startsWith('?fields=') ? '' : inputPath })}`, {
        ...init, signal: AbortSignal.timeout(45000), headers: { ...headers, Cookie: cookie, 'X-Arkaiv-Csrf': csrf,
          ...(process.env.SPREADSHEET_MIGRATION_SECRET ? { 'X-Arkaiv-Migration': process.env.SPREADSHEET_MIGRATION_SECRET } : {}), ...(init.headers || {}) },
      });
      if (response.status === 401) { csrf = ''; continue; }
      if (response.status === 429) { await new Promise(resolve => setTimeout(resolve, 30000)); continue; }
      return response;
    }
    throw new Error('Copy request retries exhausted');
  };
}
