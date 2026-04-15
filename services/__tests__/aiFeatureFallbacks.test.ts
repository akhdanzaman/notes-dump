import test from 'node:test';
import assert from 'node:assert/strict';

import { generateChatResponse } from '../chatService';
import { classifyText } from '../geminiService';
import { parsePro } from '../geminiProService';
import { generateAIInsights } from '../insightService';

function withMissingKey<T>(fn: () => Promise<T> | T) {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  return Promise.resolve(fn()).finally(() => {
    if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
  });
}

test('AI services fail gracefully when API key is missing', async () => {
  await withMissingKey(async () => {
    const classified = await classifyText('beli susu');
    assert.equal(classified[0]?.meta?.tags?.[0], 'missing-api-key');

    const chat = await generateChatResponse('Halo', [], [], { monthlyIncome: 0, rules: [] }, [], [], {});
    assert.match(chat, /configure your Gemini API key/i);

    const insights = await generateAIInsights([], { monthlyIncome: 0, rules: [] }, [], []);
    assert.equal(insights[0]?.title, 'API Key Missing');

    const pro = await parsePro('bayar listrik');
    assert.equal(pro[0]?.needsReview, true);
    assert.match(pro[0]?.reviewReason || '', /Missing Gemini API key/i);
  });
});
