import test from 'node:test';
import assert from 'node:assert/strict';

import { getGeminiKey, parseJsonResponse, saveGeminiKey } from '../aiService';

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

test('parseJsonResponse handles fenced JSON and surrounding prose', () => {
  const arrayResult = parseJsonResponse<any[]>('```json\n[{"title":"Daily Review"}]\n```', []);
  assert.deepEqual(arrayResult, [{ title: 'Daily Review' }]);

  const objectResult = parseJsonResponse<{ ok: boolean }>('Model said: {"ok":true}', { ok: false });
  assert.deepEqual(objectResult, { ok: true });

  const fallbackResult = parseJsonResponse('not json at all', [{ fallback: true }]);
  assert.deepEqual(fallbackResult, [{ fallback: true }]);
});
