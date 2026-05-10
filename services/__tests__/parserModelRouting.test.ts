import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getFastExtractionEscalationReasons,
  isSupportedParserModelId,
  resolveParserModelRoutingSettings,
  runFastThenDeepParserModelRouting,
  SUPPORTED_PARSER_MODEL_IDS,
} from '../parserModelRouting';
import { DEFAULT_FLASH_MODEL, DEFAULT_PRO_MODEL } from '../aiService';
import { ItemType, ParserResultV2 } from '../../types';

const fastResult = (content = 'clear note'): ParserResultV2 => ({
  action: 'create_item',
  entityType: 'note',
  content,
  confidence: 'medium',
  needsReview: false,
  payload: {
    itemType: ItemType.NOTE,
    content,
    status: 'pending',
    meta: {},
  },
});

const deepResult = (content = 'deep note'): ParserResultV2 => ({
  ...fastResult(content),
  confidence: 'high',
});

test('parser model routing allowlist contains only supported Gemini parser models', () => {
  assert.deepEqual([...SUPPORTED_PARSER_MODEL_IDS], [DEFAULT_FLASH_MODEL, DEFAULT_PRO_MODEL]);
  assert.equal(isSupportedParserModelId(DEFAULT_FLASH_MODEL), true);
  assert.equal(isSupportedParserModelId(DEFAULT_PRO_MODEL), true);
  assert.equal(isSupportedParserModelId('openai-codex/gpt-5.5'), false);
  assert.equal(isSupportedParserModelId('gemini-2.5-flash-lite'), false);
});

test('unsupported configured model IDs are ignored with warnings, not passed to callers', () => {
  const resolved = resolveParserModelRoutingSettings({
    enabled: true,
    fastModel: 'gemini-2.5-flash-lite',
    deepModel: 'openai-codex/gpt-5.5',
  });

  assert.equal(resolved.enabled, true);
  assert.equal(resolved.fastModel, DEFAULT_FLASH_MODEL);
  assert.equal(resolved.deepModel, DEFAULT_PRO_MODEL);
  assert.ok(resolved.warnings.includes('unsupported_fast_model_ignored:gemini-2.5-flash-lite'));
  assert.ok(resolved.warnings.includes('unsupported_deep_model_ignored:openai-codex/gpt-5.5'));
});

test('fast extraction result is accepted without deep parse when confidence is sufficient', async () => {
  const calls: string[] = [];
  const routed = await runFastThenDeepParserModelRouting({
    text: 'note: clear thing',
    settings: { enabled: true },
    fastParser: async (model) => {
      calls.push(`fast:${model}`);
      return [fastResult()];
    },
    deepParser: async (model) => {
      calls.push(`deep:${model}`);
      return [deepResult()];
    },
  });

  assert.deepEqual(calls, [`fast:${DEFAULT_FLASH_MODEL}`]);
  assert.equal(routed.modelRouting.selectedTier, 'fast_extraction');
  assert.equal(routed.modelRouting.finalModel, DEFAULT_FLASH_MODEL);
  assert.equal(routed.modelRouting.aiCallCount, 1);
  assert.equal(routed.results[0].content, 'clear note');
});

test('deep parse is reserved for ambiguous fast extraction results', async () => {
  const calls: string[] = [];
  const routed = await runFastThenDeepParserModelRouting({
    text: 'unclear capture',
    settings: { enabled: true },
    fastParser: async (model) => {
      calls.push(`fast:${model}`);
      return [{ action: 'unknown', entityType: 'unknown', confidence: 'low', needsReview: true }];
    },
    deepParser: async (model) => {
      calls.push(`deep:${model}`);
      return [deepResult('deep resolved')];
    },
  });

  assert.deepEqual(calls, [`fast:${DEFAULT_FLASH_MODEL}`, `deep:${DEFAULT_PRO_MODEL}`]);
  assert.equal(routed.modelRouting.selectedTier, 'deep_parse');
  assert.equal(routed.modelRouting.finalModel, DEFAULT_PRO_MODEL);
  assert.equal(routed.modelRouting.aiCallCount, 2);
  assert.ok(routed.modelRouting.escalationReasonCodes.includes('fast_unknown_result'));
  assert.ok(routed.modelRouting.escalationReasonCodes.includes('fast_below_min_confidence'));
  assert.ok(routed.modelRouting.escalationReasonCodes.includes('fast_needs_review'));
  assert.equal(routed.results[0].content, 'deep resolved');
});

test('batch gaps escalate from fast extraction to deep parse', () => {
  const reasons = getFastExtractionEscalationReasons([fastResult('one')], { candidateCount: 2 });
  assert.ok(reasons.includes('fast_batch_result_gap'));
});
