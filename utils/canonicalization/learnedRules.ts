import { v4 as uuidv4 } from 'uuid';
import { CanonicalField, CanonicalRule } from '../../types';
import { normalizeCanonicalText } from './normalize';

const nowIso = () => new Date().toISOString();

export function mergeLearnedRule(
  rules: CanonicalRule[],
  field: CanonicalField,
  alias: string,
  canonicalValue: string
): CanonicalRule[] {
  const normalizedAlias = normalizeCanonicalText(alias);
  const normalizedCanonical = normalizeCanonicalText(canonicalValue);

  if (!normalizedAlias || !normalizedCanonical) return rules;

  const existingIndex = rules.findIndex(rule =>
    rule.field === field &&
    normalizeCanonicalText(rule.canonicalValue) === normalizedCanonical
  );

  if (existingIndex >= 0) {
    return rules.map((rule, index) => {
      if (index !== existingIndex) return rule;

      const hasAlias = rule.aliases.some(existingAlias => normalizeCanonicalText(existingAlias) === normalizedAlias);
      return {
        ...rule,
        aliases: hasAlias ? rule.aliases : [...rule.aliases, alias],
        approvalCount: rule.approvalCount + 1,
        updatedAt: nowIso(),
      };
    });
  }

  return [
    ...rules,
    {
      id: uuidv4(),
      field,
      canonicalValue,
      aliases: [alias],
      source: 'learned',
      approvalCount: 1,
      rejectionCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];
}

export function incrementCanonicalRuleRejection(rules: CanonicalRule[], ruleId: string): CanonicalRule[] {
  return rules.map(rule => rule.id === ruleId
    ? { ...rule, rejectionCount: rule.rejectionCount + 1, updatedAt: nowIso() }
    : rule
  );
}
