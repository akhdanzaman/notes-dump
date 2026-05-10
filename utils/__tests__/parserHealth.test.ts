import test from 'node:test';
import assert from 'node:assert/strict';

import { buildParserHealthSummary } from '../parserHealth';
import { ParserResultV2, ParsingTask } from '../../types';

const savedResult: ParserResultV2 = {
  action: 'create_item',
  entityType: 'finance',
  confidence: 'high',
  needsReview: false,
  payload: {
    itemType: 'FINANCE',
    content: 'kopi',
    status: 'done',
    meta: { amount: 10_000, financeType: 'expense' },
  },
};

const task = (overrides: Partial<ParsingTask>): ParsingTask => ({
  id: 'parser-task',
  text: 'private input is never surfaced by health summary',
  status: 'success',
  stage: 'local',
  createdAt: 100,
  completedAt: 160,
  results: [savedResult],
  routerDecision: { route: 'local_save', intent: 'finance', confidenceScore: 0.9, reasonCodes: [] },
  ...overrides,
});

test('buildParserHealthSummary aggregates fast path, fallback, latency, and review rates without content', () => {
  const summary = buildParserHealthSummary({
    parsingTasks: [
      task({ id: 'local', createdAt: 100, completedAt: 140 }),
      task({
        id: 'deep',
        createdAt: 200,
        completedAt: 300,
        routerDecision: {
          route: 'deep_ai',
          intent: 'finance',
          confidenceScore: 0.41,
          reasonCodes: ['ambiguous_finance'],
          modelRouting: {
            enabled: true,
            policy: 'fast_then_deep_on_ambiguity',
            fastModel: 'openai-codex/gpt-5.5',
            deepModel: 'openai-codex/gpt-5.5',
            selectedTier: 'deep_parse',
            finalModel: 'openai-codex/gpt-5.5',
            fastAttempted: true,
            deepAttempted: true,
            aiCallCount: 1,
            escalationReasonCodes: ['deep_parse_needed'],
          },
        },
      }),
      task({
        id: 'review',
        createdAt: 300,
        completedAt: 360,
        routerDecision: { route: 'review', intent: 'finance', confidenceScore: 0.62, reasonCodes: ['missing_wallet'] },
        results: [{ ...savedResult, needsReview: true, reviewReason: 'Missing wallet' }],
      }),
    ],
  });

  assert.equal(summary.totalTasks, 3);
  assert.equal(summary.completedTasks, 3);
  assert.equal(summary.failedTasks, 0);
  assert.equal(summary.localSavedUnits, 1);
  assert.equal(summary.aiFallbackUnits, 1);
  assert.equal(summary.reviewUnits, 2);
  assert.equal(summary.aiCallCount, 1);
  assert.equal(summary.averageLatencyMs, 67);
  assert.equal(summary.fastPathRate, 25);
  assert.equal(summary.aiFallbackRate, 25);
  assert.equal(summary.reviewRate, 50);
  assert.equal(summary.healthTone, 'bad');
  assert.equal(JSON.stringify(summary).includes('private input'), false);
});

test('buildParserHealthSummary warns on failed parsers and high fallback pressure', () => {
  const summary = buildParserHealthSummary({
    parsingTasks: [
      task({ id: 'f1', status: 'failed', completedAt: 130, routerDecision: { route: 'deep_ai', intent: 'unknown', confidenceScore: 0.2, reasonCodes: [] } }),
      task({ id: 'f2', routerDecision: { route: 'deep_ai', intent: 'unknown', confidenceScore: 0.2, reasonCodes: [] } }),
      task({ id: 'f3', routerDecision: { route: 'deep_ai', intent: 'unknown', confidenceScore: 0.2, reasonCodes: [] } }),
    ],
  });

  assert.equal(summary.failedTasks, 1);
  assert.equal(summary.aiCallCount, 3);
  assert.equal(summary.healthTone, 'bad');
  assert.ok(summary.warnings.some(warning => warning.includes('parser failure')));
  assert.ok(summary.warnings.some(warning => warning.includes('AI fallback calls')));
});
