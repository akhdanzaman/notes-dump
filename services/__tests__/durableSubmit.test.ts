import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubmitHandler } from '../../api/spreadsheets/sync/submit';
import { createServiceAccountSession } from '../../api/_lib/googleServiceAccount';
import type { VercelRequest, VercelResponse } from '@vercel/node';
const scope = 'test-submit-sheet';
const setup = () => {
  process.env.SERVICE_ACCOUNT_ALLOWED_SPREADSHEET_IDS = scope;
  process.env.SPREADSHEET_DURABLE_SYNC = 'true'; process.env.SPREADSHEET_DURABLE_READY_IDS = scope;
  const headers: any = { origin: 'http://localhost', host: 'localhost', 'x-forwarded-proto': 'http' };
  const session = createServiceAccountSession(headers); headers.cookie = session.cookie.split(';')[0]; headers['x-arkaiv-csrf'] = session.csrfToken;
  return headers;
};
const operation = (operationId: string) => ({ operationId, scope, deviceId: 'device-a', entityKind: 'config', entityId: 'customPrompt', before: null, after: 'new' });
test('202 is emitted only after durable send completes; queue failure reports partial acceptance', async () => {
  const headers = setup(); const responses: any[] = [];
  const res = { status(code: number) { return { json(data: any) { responses.push({ code, data }); } }; } } as VercelResponse;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const request = { method: 'POST', headers, body: { spreadsheetId: scope, operations: [operation('operation-submit-001')] } } as VercelRequest;
  const sending = createSubmitHandler(async () => gate)(request, res);
  await Promise.resolve(); assert.equal(responses.length, 0);
  release(); await sending; assert.equal(responses[0].code, 202);
  responses.length = 0; let sent = 0;
  await createSubmitHandler(async () => { if (++sent === 2) throw new Error('Queue down'); })(
    { ...request, body: { spreadsheetId: scope, operations: [operation('operation-submit-001'), operation('operation-submit-002')] } } as VercelRequest, res);
  assert.equal(responses[0].code, 503); assert.deepEqual(responses[0].data.accepted, ['operation-submit-001']);
});
test('unready workbook and invalid operation never reach the queue', async () => {
  const headers = setup(); let sent = 0; let response: any;
  const res = { status(code: number) { return { json(data: any) { response = { code, data }; } }; } } as VercelResponse;
  const handler = createSubmitHandler(async () => { sent++; });
  process.env.SPREADSHEET_DURABLE_READY_IDS = '';
  await handler({ method: 'POST', headers, body: { spreadsheetId: scope, operations: [operation('operation-submit-001')] } } as VercelRequest, res);
  assert.equal(response.code, 503); assert.equal(sent, 0);
  process.env.SPREADSHEET_DURABLE_READY_IDS = scope;
  await handler({ method: 'POST', headers, body: { spreadsheetId: scope, operations: [{ ...operation('operation-submit-001'), entityId: 'unsupported' }] } } as VercelRequest, res);
  assert.equal(response.code, 503); assert.equal(sent, 0);
});
