import { v4 as uuidv4 } from 'uuid';
import { CanonicalField, CanonicalRule } from '../../types';
import { normalizeCanonicalText, normalizeMerchantText, normalizeWalletText } from './normalize';

export const LEARNED_RULE_AUTO_APPLY_REJECTION_THRESHOLD = 2;
export const LEARNED_RULE_DISABLE_REJECTION_THRESHOLD = 3;

const nowIso = () => new Date().toISOString();

const normalizeByField = (field: CanonicalField, value?: string) => {
  if (field === 'merchant') return normalizeMerchantText(value);
  if (field === 'paymentMethod') return normalizeWalletText(value);
  return normalizeCanonicalText(value);
};

const sourceRank = (rule: CanonicalRule) => {
  if (rule.source === 'manual') return 3;
  if (rule.source === 'system') return 2;
  return 1;
};

const canonicalKey = (rule: Pick<CanonicalRule, 'field' | 'canonicalValue'>) => (
  `${rule.field}\u0000${normalizeByField(rule.field, rule.canonicalValue)}`
);

const aliasKey = (field: CanonicalField, alias: string) => `${field}\u0000${normalizeByField(field, alias)}`;

const uniqueAliases = (field: CanonicalField, aliases: string[]) => {
  const byKey = new Map<string, string>();
  aliases.forEach((alias) => {
    const key = aliasKey(field, alias);
    if (!key.endsWith('\u0000') && !byKey.has(key)) byKey.set(key, alias);
  });
  return Array.from(byKey.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, alias]) => alias);
};

const earliestIso = (left?: string, right?: string) => {
  if (!left) return right || nowIso();
  if (!right) return left;
  return left <= right ? left : right;
};

const latestIso = (left?: string, right?: string) => {
  if (!left) return right || nowIso();
  if (!right) return left;
  return left >= right ? left : right;
};

const compareRuleTrust = (left: CanonicalRule, right: CanonicalRule) => {
  if (!!left.disabled !== !!right.disabled) return left.disabled ? 1 : -1;
  const leftNet = (left.approvalCount || 0) - (left.rejectionCount || 0);
  const rightNet = (right.approvalCount || 0) - (right.rejectionCount || 0);
  if (leftNet !== rightNet) return rightNet - leftNet;
  if ((left.approvalCount || 0) !== (right.approvalCount || 0)) return (right.approvalCount || 0) - (left.approvalCount || 0);
  if ((left.rejectionCount || 0) !== (right.rejectionCount || 0)) return (left.rejectionCount || 0) - (right.rejectionCount || 0);
  if ((left.updatedAt || '') !== (right.updatedAt || '')) return (right.updatedAt || '').localeCompare(left.updatedAt || '');
  if (left.canonicalValue !== right.canonicalValue) return left.canonicalValue.localeCompare(right.canonicalValue);
  return left.id.localeCompare(right.id);
};

const preferredRule = (left: CanonicalRule, right: CanonicalRule) => {
  const sourceDelta = sourceRank(right) - sourceRank(left);
  if (sourceDelta < 0) return left;
  if (sourceDelta > 0) return right;
  return compareRuleTrust(left, right) <= 0 ? left : right;
};

export function isCanonicalRuleAutoApplyEligible(rule: CanonicalRule): boolean {
  if (rule.disabled || rule.autoApplyDisabled) return false;
  if (rule.source !== 'learned') return true;
  return (rule.rejectionCount || 0) < LEARNED_RULE_AUTO_APPLY_REJECTION_THRESHOLD;
}

const applyLifecycle = (rule: CanonicalRule): CanonicalRule => {
  if (rule.source !== 'learned') return rule;

  if ((rule.rejectionCount || 0) >= LEARNED_RULE_DISABLE_REJECTION_THRESHOLD) {
    return {
      ...rule,
      disabled: true,
      autoApplyDisabled: true,
      disabledReason: rule.disabledReason || `learned rule rejected ${rule.rejectionCount} times`,
    };
  }

  if ((rule.rejectionCount || 0) >= LEARNED_RULE_AUTO_APPLY_REJECTION_THRESHOLD) {
    return {
      ...rule,
      disabled: false,
      disabledReason: undefined,
      autoApplyDisabled: true,
    };
  }

  return {
    ...rule,
    disabled: false,
    disabledReason: undefined,
    autoApplyDisabled: false,
  };
};

const applyApproval = (rule: CanonicalRule, timestamp: string): CanonicalRule => applyLifecycle({
  ...rule,
  approvalCount: (rule.approvalCount || 0) + 1,
  rejectionCount: Math.max(0, (rule.rejectionCount || 0) - 1),
  lastApprovedAt: timestamp,
  updatedAt: timestamp,
});

const applyRejection = (rule: CanonicalRule, timestamp: string): CanonicalRule => applyLifecycle({
  ...rule,
  rejectionCount: (rule.rejectionCount || 0) + 1,
  lastRejectedAt: timestamp,
  updatedAt: timestamp,
});

/**
 * Deterministically merges duplicate canonical rules by field + normalized canonical value,
 * then resolves alias collisions so a normalized alias belongs to at most one enabled learned target.
 * This keeps local/cloud merges and review learning from growing parallel near-duplicate rules.
 */
export function consolidateCanonicalRules(rules: CanonicalRule[]): CanonicalRule[] {
  const groups = new Map<string, CanonicalRule>();

  rules.forEach((rawRule) => {
    const normalizedCanonical = normalizeByField(rawRule.field, rawRule.canonicalValue);
    if (!normalizedCanonical) return;

    const rule = applyLifecycle({
      approvalCount: 0,
      rejectionCount: 0,
      ...rawRule,
      aliases: uniqueAliases(rawRule.field, rawRule.aliases || []),
    });

    const key = canonicalKey(rule);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, rule);
      return;
    }

    const preferred = preferredRule(existing, rule);
    const other = preferred.id === existing.id ? rule : existing;
    groups.set(key, applyLifecycle({
      ...preferred,
      aliases: uniqueAliases(preferred.field, [...preferred.aliases, ...other.aliases]),
      approvalCount: (existing.approvalCount || 0) + (rule.approvalCount || 0),
      rejectionCount: (existing.rejectionCount || 0) + (rule.rejectionCount || 0),
      createdAt: earliestIso(existing.createdAt, rule.createdAt),
      updatedAt: latestIso(existing.updatedAt, rule.updatedAt),
      lastApprovedAt: latestIso(existing.lastApprovedAt, rule.lastApprovedAt),
      lastRejectedAt: latestIso(existing.lastRejectedAt, rule.lastRejectedAt),
    }));
  });

  let consolidated = Array.from(groups.values()).map(applyLifecycle);
  const aliasesByKey = new Map<string, CanonicalRule[]>();

  consolidated.forEach((rule) => {
    rule.aliases.forEach((alias) => {
      const key = aliasKey(rule.field, alias);
      if (!key.endsWith('\u0000')) aliasesByKey.set(key, [...(aliasesByKey.get(key) || []), rule]);
    });
  });

  aliasesByKey.forEach((owners, key) => {
    if (owners.length <= 1) return;
    const winner = [...owners].sort(compareRuleTrust)[0];
    consolidated = consolidated.map((rule) => {
      if (!owners.some(owner => owner.id === rule.id) || rule.id === winner.id) return rule;
      return applyLifecycle({
        ...rule,
        aliases: rule.aliases.filter(alias => aliasKey(rule.field, alias) !== key),
      });
    });
  });

  return consolidated
    .map((rule) => {
      const aliases = uniqueAliases(rule.field, rule.aliases || []);
      const lifecycleRule = applyLifecycle({ ...rule, aliases });
      if (rule.source === 'learned' && aliases.length === 0) {
        return {
          ...lifecycleRule,
          disabled: true,
          autoApplyDisabled: true,
          disabledReason: lifecycleRule.disabledReason || 'learned rule has no remaining aliases after collision merge',
        };
      }
      return lifecycleRule;
    })
    .sort((left, right) => {
      const fieldDelta = left.field.localeCompare(right.field);
      if (fieldDelta !== 0) return fieldDelta;
      const canonicalDelta = normalizeByField(left.field, left.canonicalValue).localeCompare(normalizeByField(right.field, right.canonicalValue));
      if (canonicalDelta !== 0) return canonicalDelta;
      return left.id.localeCompare(right.id);
    });
}

export function mergeLearnedRule(
  rules: CanonicalRule[],
  field: CanonicalField,
  alias: string,
  canonicalValue: string
): CanonicalRule[] {
  const normalizedAlias = normalizeByField(field, alias);
  const normalizedCanonical = normalizeByField(field, canonicalValue);

  if (!normalizedAlias || !normalizedCanonical) return consolidateCanonicalRules(rules);

  const timestamp = nowIso();
  const preexistingConflictingRuleIds = new Set(rules
    .filter(rule =>
      rule.field === field &&
      normalizeByField(rule.field, rule.canonicalValue) !== normalizedCanonical &&
      (rule.aliases || []).some(existingAlias => normalizeByField(field, existingAlias) === normalizedAlias)
    )
    .map(rule => rule.id));
  let nextRules = consolidateCanonicalRules(rules);
  const targetIndex = nextRules.findIndex(rule =>
    rule.field === field &&
    normalizeByField(rule.field, rule.canonicalValue) === normalizedCanonical
  );

  if (targetIndex >= 0) {
    nextRules = nextRules.map((rule, index) => {
      if (index !== targetIndex) return rule;
      return applyApproval({
        ...rule,
        source: rule.source === 'system' ? 'system' : 'learned',
        aliases: uniqueAliases(field, [...rule.aliases, alias]),
      }, timestamp);
    });
  } else {
    nextRules = [
      ...nextRules,
      {
        id: uuidv4(),
        field,
        canonicalValue,
        aliases: [alias],
        source: 'learned',
        approvalCount: 1,
        rejectionCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        lastApprovedAt: timestamp,
      },
    ];
  }

  nextRules = nextRules.map((rule) => {
    if (rule.field !== field || normalizeByField(rule.field, rule.canonicalValue) === normalizedCanonical) return rule;
    const ownsAlias = rule.aliases.some(existingAlias => normalizeByField(field, existingAlias) === normalizedAlias);
    if (!ownsAlias && !preexistingConflictingRuleIds.has(rule.id)) return rule;
    return applyRejection({
      ...rule,
      aliases: rule.aliases.filter(existingAlias => normalizeByField(field, existingAlias) !== normalizedAlias),
    }, timestamp);
  });

  return consolidateCanonicalRules(nextRules);
}

export function incrementCanonicalRuleRejection(rules: CanonicalRule[], ruleId: string): CanonicalRule[] {
  const timestamp = nowIso();
  return consolidateCanonicalRules(rules.map(rule => rule.id === ruleId ? applyRejection(rule, timestamp) : rule));
}
