import test from 'node:test';
import assert from 'node:assert/strict';

import { fileToBase64, getGeminiKey, parseJsonResponse, saveGeminiKey, withAiRetry } from '../aiService';

test('AI retry has a bounded attempt count and does not retry non-transient failures', async () => {
  let calls = 0;
  await assert.rejects(withAiRetry(async () => { calls++; throw { status: 429 }; }, { baseDelayMs: 0 }));
  assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(withAiRetry(async () => { calls++; throw { status: 401 }; }, { baseDelayMs: 0 }));
  assert.equal(calls, 1);
});

test('getGeminiKey falls back to env when localStorage is unavailable', () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'env-key';

  assert.equal(getGeminiKey(), 'env-key');

  if (previous === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = previous;
  }
});

test('saveGeminiKey does not throw when localStorage is unavailable', () => {
  assert.doesNotThrow(() => saveGeminiKey('test-key'));
  assert.doesNotThrow(() => saveGeminiKey(''));
});

test('fileToBase64 handles binary payloads larger than one conversion chunk', async () => {
  const bytes = Uint8Array.from({ length: 70_000 }, (_, index) => index % 251);
  assert.equal(await fileToBase64(new Blob([bytes])), Buffer.from(bytes).toString('base64'));
});

test('parseJsonResponse handles fenced JSON and surrounding prose', () => {
  const arrayResult = parseJsonResponse<any[]>('```json\n[{"title":"Daily Review"}]\n```', []);
  assert.deepEqual(arrayResult, [{ title: 'Daily Review' }]);

  const objectResult = parseJsonResponse<{ ok: boolean }>('Model said: {"ok":true}', { ok: false });
  assert.deepEqual(objectResult, { ok: true });

  const nestedObjectResult = parseJsonResponse<{ data: { tags: string[]; meta: { count: number } } }>(
    'Sure — here you go: {"data":{"tags":["food"],"meta":{"count":1}}} Thanks!',
    { data: { tags: [], meta: { count: 0 } } }
  );
  assert.deepEqual(nestedObjectResult, { data: { tags: ['food'], meta: { count: 1 } } });

  const fallbackResult = parseJsonResponse('not json at all', [{ fallback: true }]);
  assert.deepEqual(fallbackResult, [{ fallback: true }]);
});
