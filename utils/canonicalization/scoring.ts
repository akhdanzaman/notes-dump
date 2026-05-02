export interface CandidateScoreParams {
  aliasExact: boolean;
  tokenOverlap: number;
  priorApprovals: number;
  priorRejections: number;
  contextMatch: number;
  ambiguityPenalty: number;
  confidenceBoost?: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function scoreCandidate(params: CandidateScoreParams): number {
  let score = 0;

  if (params.aliasExact) score += 0.45;
  score += clamp(params.tokenOverlap) * 0.2;
  score += Math.min(0.25, Math.max(0, params.priorApprovals) * 0.05);
  score -= Math.min(0.2, Math.max(0, params.priorRejections) * 0.08);
  score += clamp(params.contextMatch) * 0.15;
  score -= clamp(params.ambiguityPenalty, 0, 0.25);
  score += clamp(params.confidenceBoost || 0, 0, 0.15);

  return clamp(score);
}

export function shouldAutoApply(score: number): boolean {
  return score >= 0.9;
}

export function shouldSuggestReview(score: number): boolean {
  return score >= 0.7 && score < 0.9;
}
