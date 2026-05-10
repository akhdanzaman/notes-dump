import { DEFAULT_FLASH_MODEL, DEFAULT_PRO_MODEL } from './aiService';
import {
  ParserConfidence,
  ParserModelRoutingMetadata,
  ParserModelRoutingSettings,
  ParserResultV2,
} from '../types';

export const SUPPORTED_PARSER_MODEL_IDS = [DEFAULT_FLASH_MODEL, DEFAULT_PRO_MODEL] as const;
export type SupportedParserModelId = typeof SUPPORTED_PARSER_MODEL_IDS[number];

type ResolvedParserModelRoutingSettings = {
  enabled: boolean;
  fastModel: SupportedParserModelId;
  deepModel: SupportedParserModelId;
  minFastConfidence: ParserConfidence;
  escalateOnNeedsReview: boolean;
  warnings: string[];
};

type ParserModelCall = (model: SupportedParserModelId) => Promise<ParserResultV2[]>;

type RunParserModelRoutingOptions = {
  text: string;
  candidateCount?: number;
  settings?: ParserModelRoutingSettings;
  fastParser: ParserModelCall;
  deepParser: ParserModelCall;
};

const CONFIDENCE_SCORE: Record<ParserConfidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export const DEFAULT_PARSER_MODEL_ROUTING_SETTINGS: ResolvedParserModelRoutingSettings = {
  enabled: false,
  fastModel: DEFAULT_FLASH_MODEL,
  deepModel: DEFAULT_PRO_MODEL,
  minFastConfidence: 'medium',
  escalateOnNeedsReview: true,
  warnings: [],
};

export function isSupportedParserModelId(model: string | undefined): model is SupportedParserModelId {
  return typeof model === 'string' && (SUPPORTED_PARSER_MODEL_IDS as readonly string[]).includes(model);
}

export function resolveParserModelRoutingSettings(settings?: ParserModelRoutingSettings): ResolvedParserModelRoutingSettings {
  const warnings: string[] = [];
  const fastModel = settings?.fastModel;
  const deepModel = settings?.deepModel;
  const minFastConfidence = settings?.minFastConfidence;

  if (fastModel && !isSupportedParserModelId(fastModel)) {
    warnings.push(`unsupported_fast_model_ignored:${fastModel}`);
  }
  if (deepModel && !isSupportedParserModelId(deepModel)) {
    warnings.push(`unsupported_deep_model_ignored:${deepModel}`);
  }
  if (minFastConfidence && !['low', 'medium', 'high'].includes(minFastConfidence)) {
    warnings.push(`unsupported_min_fast_confidence_ignored:${minFastConfidence}`);
  }

  return {
    enabled: settings?.enabled === true,
    fastModel: isSupportedParserModelId(fastModel) ? fastModel : DEFAULT_FLASH_MODEL,
    deepModel: isSupportedParserModelId(deepModel) ? deepModel : DEFAULT_PRO_MODEL,
    minFastConfidence: minFastConfidence && ['low', 'medium', 'high'].includes(minFastConfidence) ? minFastConfidence : 'medium',
    escalateOnNeedsReview: settings?.escalateOnNeedsReview ?? true,
    warnings,
  };
}

const payloadMeta = (result: ParserResultV2): Record<string, unknown> => {
  const payload = result.payload as { meta?: Record<string, unknown> } | undefined;
  return payload?.meta || {};
};

const hasMissingApiKeyMarker = (result: ParserResultV2): boolean => {
  const meta = payloadMeta(result);
  return Array.isArray(meta.tags) && meta.tags.includes('missing-api-key');
};

export function getFastExtractionEscalationReasons(
  results: ParserResultV2[],
  options: { minFastConfidence?: ParserConfidence; escalateOnNeedsReview?: boolean; candidateCount?: number } = {},
): string[] {
  const minFastConfidence = options.minFastConfidence || DEFAULT_PARSER_MODEL_ROUTING_SETTINGS.minFastConfidence;
  const candidateCount = options.candidateCount || 1;
  const reasons = new Set<string>();

  if (results.length === 0) reasons.add('fast_empty_result');

  for (const result of results) {
    if (result.action === 'unknown' || result.entityType === 'unknown') reasons.add('fast_unknown_result');
    if (CONFIDENCE_SCORE[result.confidence] < CONFIDENCE_SCORE[minFastConfidence]) reasons.add('fast_below_min_confidence');
    if (options.escalateOnNeedsReview !== false && result.needsReview) reasons.add('fast_needs_review');
    if (hasMissingApiKeyMarker(result)) reasons.add('fast_missing_api_key');
  }

  if (candidateCount > 1) {
    if (results.length < candidateCount) reasons.add('fast_batch_result_gap');
    if (results.length > candidateCount * 2) reasons.add('fast_batch_overexpanded');
  }

  return Array.from(reasons);
}

export async function runFastThenDeepParserModelRouting({
  text,
  candidateCount = 1,
  settings,
  fastParser,
  deepParser,
}: RunParserModelRoutingOptions): Promise<{ results: ParserResultV2[]; modelRouting: ParserModelRoutingMetadata }> {
  const resolved = resolveParserModelRoutingSettings(settings);
  const baseMetadata = {
    enabled: resolved.enabled,
    policy: resolved.enabled ? 'fast_then_deep_on_ambiguity' as const : 'disabled_static_parser_choice' as const,
    fastModel: resolved.fastModel,
    deepModel: resolved.deepModel,
    warnings: resolved.warnings.length ? resolved.warnings : undefined,
  };

  if (!resolved.enabled) {
    const results = await deepParser(resolved.deepModel);
    return {
      results,
      modelRouting: {
        ...baseMetadata,
        selectedTier: 'deep_parse',
        finalModel: resolved.deepModel,
        fastAttempted: false,
        deepAttempted: true,
        aiCallCount: 1,
        escalationReasonCodes: ['routing_disabled_static_deep_parser'],
      },
    };
  }

  let fastResults: ParserResultV2[] = [];
  let fastFailureReason: string | undefined;
  try {
    fastResults = await fastParser(resolved.fastModel);
  } catch (error) {
    fastFailureReason = `fast_exception:${error instanceof Error ? error.message : String(error)}`;
  }

  const escalationReasonCodes = fastFailureReason
    ? [fastFailureReason]
    : getFastExtractionEscalationReasons(fastResults, {
      minFastConfidence: resolved.minFastConfidence,
      escalateOnNeedsReview: resolved.escalateOnNeedsReview,
      candidateCount,
    });

  if (escalationReasonCodes.length === 0) {
    return {
      results: fastResults,
      modelRouting: {
        ...baseMetadata,
        selectedTier: 'fast_extraction',
        finalModel: resolved.fastModel,
        fastAttempted: true,
        deepAttempted: false,
        aiCallCount: 1,
        escalationReasonCodes: [],
      },
    };
  }

  const deepResults = await deepParser(resolved.deepModel);
  return {
    results: deepResults,
    modelRouting: {
      ...baseMetadata,
      selectedTier: 'deep_parse',
      finalModel: resolved.deepModel,
      fastAttempted: true,
      deepAttempted: true,
      aiCallCount: 2,
      escalationReasonCodes,
    },
  };
}
