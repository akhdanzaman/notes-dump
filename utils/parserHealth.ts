import { ParserRouterRoute, ParserResultV2, ParsingTask } from '../types';

export interface ParserHealthInput {
  parsingTasks?: ParsingTask[];
  pendingReviews?: { id: string; text: string; results: ParserResultV2[] }[];
}

export interface ParserHealthSummary {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  localSavedUnits: number;
  aiFallbackUnits: number;
  reviewUnits: number;
  aiCallCount: number;
  averageLatencyMs: number | null;
  fastPathRate: number;
  aiFallbackRate: number;
  reviewRate: number;
  healthTone: 'good' | 'watch' | 'bad' | 'empty';
  warnings: string[];
}

const clampRate = (count: number, total: number): number => {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
};

const getRoute = (task: ParsingTask): ParserRouterRoute | undefined => task.routerDecision?.route;

const getAiCallCount = (task: ParsingTask): number => {
  const routing = task.routerDecision?.modelRouting || task.routerDecision?.batch?.modelRouting || task.batch?.modelRouting;
  if (routing?.aiCallCount !== undefined) return routing.aiCallCount;
  const batch = task.batch || task.routerDecision?.batch;
  if (batch) return batch.aiCallCount;
  return getRoute(task) === 'deep_ai' ? 1 : 0;
};

const getTaskLatency = (task: ParsingTask): number | undefined => {
  if (task.completedAt === undefined) return undefined;
  return Math.max(0, task.completedAt - task.createdAt);
};

const countReviewResults = (results: ParserResultV2[] = []): number => results.filter(result => result.needsReview).length;

export const buildParserHealthSummary = ({ parsingTasks = [], pendingReviews = [] }: ParserHealthInput): ParserHealthSummary => {
  const completedTasks = parsingTasks.filter(task => task.status === 'success').length;
  const failedTasks = parsingTasks.filter(task => task.status === 'failed').length;
  let localSavedUnits = 0;
  let aiFallbackUnits = 0;
  let reviewUnits = pendingReviews.length;
  let aiCallCount = 0;
  const latencies: number[] = [];

  for (const task of parsingTasks) {
    const batch = task.batch || task.routerDecision?.batch;
    if (batch) {
      localSavedUnits += batch.localItemCount;
      aiFallbackUnits += batch.aiItemCount;
      reviewUnits += batch.reviewItemCount;
    } else {
      const route = getRoute(task);
      if (route === 'local_save') localSavedUnits += 1;
      if (route === 'deep_ai') aiFallbackUnits += 1;
      if (route === 'review') reviewUnits += 1;
    }

    reviewUnits += countReviewResults(task.results);
    aiCallCount += getAiCallCount(task);
    const latency = getTaskLatency(task);
    if (latency !== undefined) latencies.push(latency);
  }

  const totalUnits = Math.max(localSavedUnits + aiFallbackUnits + reviewUnits, parsingTasks.length, pendingReviews.length);
  const fastPathRate = clampRate(localSavedUnits, totalUnits);
  const aiFallbackRate = clampRate(aiFallbackUnits, totalUnits);
  const reviewRate = clampRate(reviewUnits, totalUnits);
  const averageLatencyMs = latencies.length
    ? Math.round(latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length)
    : null;

  const warnings: string[] = [];
  if (failedTasks > 0) warnings.push(`${failedTasks} parser failure${failedTasks === 1 ? '' : 's'} need retry or review.`);
  if (totalUnits >= 3 && reviewRate >= 30) warnings.push('Review-needed rate is high; check ambiguous parser drafts before trusting automation.');
  if (totalUnits >= 5 && fastPathRate < 50) warnings.push('Local fast-path rate is low; parser acceleration may not be carrying enough common captures.');
  if (aiCallCount > localSavedUnits && aiCallCount >= 3) warnings.push('AI fallback calls are high versus local saves; watch cost and latency.');

  const healthTone: ParserHealthSummary['healthTone'] = totalUnits === 0
    ? 'empty'
    : failedTasks > 0 || (totalUnits >= 3 && reviewRate >= 45)
      ? 'bad'
      : warnings.length > 0
        ? 'watch'
        : 'good';

  return {
    totalTasks: parsingTasks.length,
    completedTasks,
    failedTasks,
    localSavedUnits,
    aiFallbackUnits,
    reviewUnits,
    aiCallCount,
    averageLatencyMs,
    fastPathRate,
    aiFallbackRate,
    reviewRate,
    healthTone,
    warnings,
  };
};
