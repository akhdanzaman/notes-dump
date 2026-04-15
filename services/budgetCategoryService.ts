import { BudgetConfig, BudgetRule } from '../types';

const normalize = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenize = (value?: string) => normalize(value).split(/\s+/).filter(Boolean);

const scoreRuleMatch = (value: string, rule: BudgetRule): number => {
  const normalizedValue = normalize(value);
  const ruleId = normalize(rule.id);
  const ruleName = normalize(rule.name);

  if (!normalizedValue) return -1;
  if (normalizedValue === ruleId) return 1000;
  if (normalizedValue === ruleName) return 950;
  if (ruleId.includes(normalizedValue) || normalizedValue.includes(ruleId)) return 800;
  if (ruleName.includes(normalizedValue) || normalizedValue.includes(ruleName)) return 760;

  const valueTokens = tokenize(value);
  const ruleTokens = Array.from(new Set([...tokenize(rule.id), ...tokenize(rule.name)]));
  const overlap = valueTokens.filter((token) => ruleTokens.includes(token)).length;
  if (!overlap) return -1;

  return overlap * 100 - Math.abs(ruleTokens.length - valueTokens.length) * 5;
};

export const resolveBudgetCategoryId = (value: string | undefined, budgetConfig?: BudgetConfig): string | undefined => {
  if (!value || !budgetConfig?.rules?.length) return undefined;

  let bestRule: BudgetRule | undefined;
  let bestScore = -1;

  for (const rule of budgetConfig.rules) {
    const score = scoreRuleMatch(value, rule);
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  return bestScore >= 120 ? bestRule?.id : undefined;
};

export const formatBudgetRuleContext = (budgetConfig?: BudgetConfig): string => {
  const rules = budgetConfig?.rules || [];
  if (!rules.length) {
    return 'Configured budget categories: none';
  }

  return [
    'Configured budget categories (canonical):',
    ...rules.map((rule) => `- ${rule.name} (id: ${rule.id}, target: ${rule.percentage}%)`),
    'When assigning budgetCategory for finance/saving, you MUST use one of the configured category ids exactly.',
    'If the user language sounds like a category name, convert it to the matching configured id.',
    'Do not invent categories outside the configured list.'
  ].join('\n');
};
