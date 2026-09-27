import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePro } from '../geminiProService';
import { classifyText } from '../geminiService';

const response = (text: string) => new Response(JSON.stringify({
  candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
}), { headers: { 'Content-Type': 'application/json' } });

test('Pro retries only failed stage 2, never replays completed stage 1', async (t) => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'synthetic-key';
  t.after(() => { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls === 1) return response(JSON.stringify([{ action: 'create_item', entityType: 'note', content: 'A quiet morning', confidence: 'high' }]));
    return response('not JSON');
  });
  const result = await parsePro('Catatan: a quiet morning');
  assert.equal(calls, 4, 'one successful stage 1 plus three stage 2 attempts');
  assert.equal(result[0].needsReview, true);
  assert.equal(result[0].content, 'Catatan: a quiet morning');
});

test('Flash malformed output has one bounded retry layer and preserves input in fallback', async (t) => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'synthetic-key';
  t.after(() => { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response('not JSON'); });
  const result = await classifyText('A quiet morning');
  assert.equal(calls, 3);
  assert.equal(result[0].content, 'A quiet morning');
  assert.ok(result[0].meta?.parsingError);
});
