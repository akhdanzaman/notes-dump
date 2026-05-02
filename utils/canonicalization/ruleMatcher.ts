import { CanonicalCandidate, CanonicalField, CanonicalRule, ParsedItemMetaV2 } from '../../types';
import { isCanonicalRuleAutoApplyEligible } from './learnedRules';
import { normalizeCanonicalText, normalizeMerchantText, normalizeWalletText, tokenizeCanonicalText } from './normalize';
import { scoreCandidate } from './scoring';

// Canonical precedence is intentionally deterministic:
// 1. manual_review annotations already stored on item meta are preserved by the service layer.
// 2. Enabled rules are scored with contextual boosts included in the score.
// 3. Equal scores break by rule source (manual > system > learned), then net evidence, then stable ids.
// 4. Learned lifecycle state can make an otherwise high-score rule review-only or disabled.

const normalizeByField = (field: CanonicalField, value?: string) => {
  if (field === 'merchant') return normalizeMerchantText(value);
  if (field === 'paymentMethod') return normalizeWalletText(value);
  return normalizeCanonicalText(value);
};

const overlapRatio = (left: string[], right: string[]) => {
  if (left.length === 0 || right.length === 0) return 0;
  const rightSet = new Set(right);
  const overlap = left.filter(token => rightSet.has(token)).length;
  return overlap / Math.max(left.length, right.length);
};

const scoreRuleContext = (rule: CanonicalRule, meta: ParsedItemMetaV2) => {
  const conditions = rule.conditions;
  if (!conditions) return 0;

  let score = 0;

  if (conditions.financeType?.length && meta.financeType && conditions.financeType.includes(meta.financeType)) {
    score += 0.35;
  }
  if (conditions.budgetCategory?.length && meta.budgetCategory && conditions.budgetCategory.includes(meta.budgetCategory)) {
    score += 0.25;
  }
  if (conditions.commodity?.length && meta.commodity && conditions.commodity.includes(meta.commodity)) {
    score += 0.25;
  }
  if (conditions.paymentMethod?.length && meta.paymentMethod && conditions.paymentMethod.includes(meta.paymentMethod)) {
    score += 0.15;
  }
  if (
    typeof conditions.amountMin === 'number' &&
    typeof conditions.amountMax === 'number' &&
    typeof meta.amount === 'number' &&
    meta.amount >= conditions.amountMin &&
    meta.amount <= conditions.amountMax
  ) {
    score += 0.1;
  }

  return Math.min(1, score);
};

const estimateAmbiguityPenalty = (normalizedRaw: string, aliasExact: boolean) => {
  if (aliasExact) return 0;
  if (!normalizedRaw) return 0.25;
  if (normalizedRaw.length <= 2) return 0.25;
  if (normalizedRaw.split(' ').length === 1 && normalizedRaw.length <= 4) return 0.1;
  return 0;
};

const buildReason = (rule: CanonicalRule, aliasExact: boolean, overlap: number, contextMatch: number) => {
  const parts: string[] = [];
  if (aliasExact) parts.push('exact alias match');
  else if (overlap > 0) parts.push(`token overlap ${Math.round(overlap * 100)}%`);
  if (contextMatch > 0) parts.push('context matched known pattern');
  if (rule.source === 'learned') parts.push('based on prior approved correction');
  return parts.join(' • ') || 'weak canonical signal';
};

const sourceRank = (rule: CanonicalRule) => {
  if (rule.source === 'manual') return 3;
  if (rule.source === 'system') return 2;
  return 1;
};

const candidateSource = (rule: CanonicalRule) => {
  if (rule.source === 'learned') return 'learned_rule' as const;
  if (rule.source === 'manual') return 'manual_review' as const;
  return 'system_rule' as const;
};

const compareCandidates = (
  left: CanonicalCandidate & { rule: CanonicalRule },
  right: CanonicalCandidate & { rule: CanonicalRule }
) => {
  if (left.score !== right.score) return right.score - left.score;
  const sourceDelta = sourceRank(right.rule) - sourceRank(left.rule);
  if (sourceDelta !== 0) return sourceDelta;
  const leftNet = (left.rule.approvalCount || 0) - (left.rule.rejectionCount || 0);
  const rightNet = (right.rule.approvalCount || 0) - (right.rule.rejectionCount || 0);
  if (leftNet !== rightNet) return rightNet - leftNet;
  if ((left.rule.approvalCount || 0) !== (right.rule.approvalCount || 0)) return (right.rule.approvalCount || 0) - (left.rule.approvalCount || 0);
  if ((left.rule.rejectionCount || 0) !== (right.rule.rejectionCount || 0)) return (left.rule.rejectionCount || 0) - (right.rule.rejectionCount || 0);
  const canonicalDelta = left.canonicalValue.localeCompare(right.canonicalValue);
  if (canonicalDelta !== 0) return canonicalDelta;
  return (left.ruleId || '').localeCompare(right.ruleId || '');
};

export function buildRuleCandidates(
  field: CanonicalField,
  rawValue: string,
  meta: ParsedItemMetaV2,
  rules: CanonicalRule[]
): CanonicalCandidate[] {
  const normalizedRaw = normalizeByField(field, rawValue);
  const rawTokens = tokenizeCanonicalText(normalizedRaw);

  return rules
    .filter(rule => rule.field === field && !rule.disabled)
    .map((rule) => {
      const aliases = Array.from(new Set([...rule.aliases, rule.canonicalValue]));
      const normalizedAliases = aliases.map(alias => normalizeByField(field, alias));
      const aliasExact = normalizedAliases.includes(normalizedRaw);
      const tokenOverlap = normalizedAliases.reduce((best, alias) => {
        const aliasTokens = tokenizeCanonicalText(alias);
        return Math.max(best, overlapRatio(rawTokens, aliasTokens));
      }, 0);
      const contextMatch = scoreRuleContext(rule, meta);
      const ambiguityPenalty = estimateAmbiguityPenalty(normalizedRaw, aliasExact);
      const score = scoreCandidate({
        aliasExact,
        tokenOverlap,
        priorApprovals: rule.approvalCount,
        priorRejections: rule.rejectionCount,
        contextMatch,
        ambiguityPenalty,
        confidenceBoost: rule.confidenceBoost || 0,
      });

      return {
        field,
        rawValue,
        canonicalValue: rule.canonicalValue,
        score,
        reason: buildReason(rule, aliasExact, tokenOverlap, contextMatch),
        ruleId: rule.id,
        source: candidateSource(rule),
        autoApplyEligible: isCanonicalRuleAutoApplyEligible(rule),
        rule,
      } satisfies CanonicalCandidate & { rule: CanonicalRule };
    })
    .filter(candidate => candidate.score > 0)
    .sort(compareCandidates)
    .map(({ rule, ...candidate }) => candidate);
}

export function findBestCanonicalCandidate(
  field: CanonicalField,
  rawValue: string,
  meta: ParsedItemMetaV2,
  rules: CanonicalRule[]
): CanonicalCandidate | undefined {
  return buildRuleCandidates(field, rawValue, meta, rules)[0];
}
