import { BrainDumpItem, BudgetConfig, BudgetRule, ParsedItemMetaV2, ItemType } from '../types';

const normalize = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const compactKey = (value?: string) => normalize(value).replace(/\s+/g, '');
const tokenize = (value?: string) => normalize(value).split(/\s+/).filter(Boolean);

const WEAK_BUDGET_VALUES = new Set(['', 'none', 'null', 'undefined', 'unknown', 'other', 'others', 'uncategorized', 'tidak diketahui', 'n a', 'na', '-']);

const CATEGORY_PROFILES: Record<string, string[]> = {
  needs: [
    'needs', 'need', 'necessity', 'necessities', 'basic', 'essentials', 'essential', 'pokok', 'kebutuhan', 'wajib',
    'makan', 'food', 'grocery', 'groceries', 'sembako', 'health', 'medical', 'medicine', 'transport', 'commute',
    'utility', 'utilities', 'housing', 'home', 'household', 'daily', 'routine'
  ],
  wants: [
    'wants', 'want', 'lifestyle', 'discretionary', 'fun', 'joy', 'leisure', 'treat', 'treats', 'hiburan', 'jajan', 'nongkrong', 'hobby', 'hobi',
    'digital', 'subscription', 'app', 'game', 'shopping', 'clothing', 'fashion', 'coffee', 'kopi', 'snack',
    'drink', 'hangout', 'growth', 'bet', 'bets', 'personal'
  ],
  fixed: [
    'fixed', 'recurring', 'tetap', 'rutin', 'bill', 'bills', 'tagihan', 'rent', 'kos', 'kost', 'kosan', 'internet',
    'wifi', 'listrik', 'pln', 'parking', 'parkir', 'laundry', 'insurance', 'subscription'
  ],
  savings: [
    'savings', 'saving', 'save', 'tabungan', 'nabung', 'investment', 'investasi', 'invest', 'emergency',
    'dana darurat', 'debt', 'hutang', 'utang', 'repayment', 'goal', 'asset', 'capital'
  ],
  sedekah: [
    'sedekah', 'charity', 'donation', 'donasi', 'giving', 'give', 'social giving', 'zakat', 'amal', 'gift', 'tip'
  ],
  unintend: [
    'unintend', 'unintended', 'unexpected', 'miss', 'lost', 'loss', 'penalty', 'denda', 'fee', 'charge',
    'admin', 'error', 'mistake', 'extra', 'leak', 'bocor'
  ],
};

const COMMODITY_TO_PROFILE: Record<string, string[]> = {
  food: ['needs', 'wants'],
  groceries: ['needs'],
  transport: ['needs', 'fixed'],
  utilities: ['fixed', 'needs'],
  health: ['needs'],
  education: ['needs', 'wants'],
  shopping: ['wants'],
  housing: ['fixed', 'needs'],
  home: ['needs', 'wants'],
  hobby: ['wants'],
  electronics: ['wants'],
  clothing: ['wants', 'needs'],
  personal_care: ['wants', 'needs'],
  digital: ['wants', 'fixed'],
  social: ['sedekah', 'wants'],
  donation: ['sedekah'],
  debt: ['savings'],
  saving: ['savings'],
  investment: ['savings'],
  bank_fee: ['unintend'],
  loss: ['unintend'],
};

const SUBCOMMODITY_TO_PROFILE: Record<string, string[]> = {
  breakfast: ['needs'],
  lunch: ['needs'],
  dinner: ['needs'],
  groceries: ['needs'],
  drink: ['wants'],
  snack: ['wants'],
  coffee: ['wants'],
  parking: ['fixed', 'needs'],
  fuel: ['needs'],
  ride_hailing: ['needs'],
  toll: ['fixed', 'needs'],
  electricity: ['fixed', 'needs'],
  water: ['fixed', 'needs'],
  internet: ['fixed', 'needs'],
  phone: ['needs'],
  rent: ['fixed'],
  laundry: ['fixed', 'needs'],
  subscription: ['wants', 'fixed'],
  ai_subscription: ['wants'],
  donation: ['sedekah'],
  charity: ['sedekah'],
  tip: ['sedekah', 'wants'],
  transfer_fee: ['unintend'],
  monthly_admin: ['unintend'],
  lost_cash: ['unintend'],
  goal_funding: ['savings'],
  stock: ['savings'],
};

type RuleLike = Pick<BudgetRule, 'id' | 'name'>;

const isWeakBudgetValue = (value?: string): boolean => WEAK_BUDGET_VALUES.has(normalize(value));

const scoreRuleMatch = (value: string, rule: RuleLike): number => {
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

const findBestRuleByProfile = (profile: string, rules: RuleLike[]): { id: string; score: number } | undefined => {
  const hints = CATEGORY_PROFILES[profile] || [profile];
  let best: { id: string; score: number } | undefined;

  for (const rule of rules) {
    const ruleText = `${rule.id} ${rule.name}`;
    let score = scoreRuleMatch(profile, rule);
    const ruleTokens = new Set(tokenize(ruleText));
    for (const hint of hints) {
      const hintTokens = tokenize(hint);
      const overlap = hintTokens.filter(token => ruleTokens.has(token)).length;
      if (overlap) score = Math.max(score, 420 + overlap * 80);
      if (compactKey(ruleText).includes(compactKey(hint))) score = Math.max(score, 620);
    }
    if (!best || score > best.score) best = { id: rule.id, score };
  }

  return best && best.score >= 360 ? best : undefined;
};

const findBestRuleByProfiles = (profiles: string[], rules: RuleLike[]): string | undefined => {
  let best: { id: string; score: number } | undefined;
  profiles.forEach((profile, index) => {
    const match = findBestRuleByProfile(profile, rules);
    if (!match) return;
    const weighted = { id: match.id, score: match.score - index * 20 };
    if (!best || weighted.score > best.score) best = weighted;
  });
  return best?.id;
};

const rulesFromConfig = (budgetConfig?: BudgetConfig): RuleLike[] => budgetConfig?.rules || [];

export const resolveBudgetCategoryIdFromRules = (value: string | undefined, rules: RuleLike[] = []): string | undefined => {
  if (!value || isWeakBudgetValue(value)) return undefined;

  if (!rules.length) {
    const normalized = normalize(value).replace(/\s+/g, '-');
    return normalized || undefined;
  }

  let bestRule: RuleLike | undefined;
  let bestScore = -1;

  for (const rule of rules) {
    const score = scoreRuleMatch(value, rule);
    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  if (bestScore >= 120) return bestRule?.id;

  const profileMatch = findBestRuleByProfiles([value], rules);
  return profileMatch;
};

export const resolveBudgetCategoryId = (value: string | undefined, budgetConfig?: BudgetConfig): string | undefined => (
  resolveBudgetCategoryIdFromRules(value, rulesFromConfig(budgetConfig))
);

const meaningfulBudgetCategory = (value: unknown, rules: RuleLike[]): string | undefined => {
  if (typeof value !== 'string' || isWeakBudgetValue(value)) return undefined;
  return resolveBudgetCategoryIdFromRules(value, rules) || (!rules.length ? normalize(value).replace(/\s+/g, '-') : undefined);
};

const itemTimestamp = (item: BrainDumpItem): number => {
  const raw = item.completed_at || item.created_at;
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeBehaviorText = (value?: string): string => normalize(value)
  .replace(/\b(?:rp|idr|rupiah)\b/g, ' ')
  .replace(/\b\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta|mio|m)?\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenOverlapScore = (a?: string, b?: string): number => {
  const aTokens = new Set(tokenize(normalizeBehaviorText(a)).filter(token => token.length >= 3));
  const bTokens = new Set(tokenize(normalizeBehaviorText(b)).filter(token => token.length >= 3));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  aTokens.forEach(token => { if (bTokens.has(token)) overlap += 1; });
  return overlap / Math.max(aTokens.size, bTokens.size);
};

const inferFromHistory = (params: {
  text?: string;
  meta?: Partial<ParsedItemMetaV2>;
  existingItems?: BrainDumpItem[];
  rules: RuleLike[];
}): string | undefined => {
  const { text = '', meta = {}, existingItems = [], rules } = params;
  const candidates = new Map<string, { score: number; count: number; latestAt: number }>();
  const inputMerchant = normalizeBehaviorText(meta.merchant);
  const inputCommodity = normalizeBehaviorText(meta.commodity);
  const inputSubcommodity = normalizeBehaviorText(meta.subcommodity);
  const inputPayment = normalizeBehaviorText(meta.paymentMethod);

  existingItems
    .filter(item => item.type === ItemType.FINANCE || item.type === ItemType.SHOPPING)
    .forEach(item => {
      const itemMeta = item.meta as ParsedItemMetaV2;
      const category = meaningfulBudgetCategory(itemMeta.budgetCategory, rules);
      if (!category) return;

      let score = 0;
      const merchant = normalizeBehaviorText(itemMeta.merchant);
      if (inputMerchant && merchant && inputMerchant === merchant) score += 7;

      const contentOverlap = tokenOverlapScore(text, item.content);
      score += contentOverlap * 5;

      if (inputCommodity && inputCommodity === normalizeBehaviorText(itemMeta.commodity)) score += 3;
      if (inputSubcommodity && inputSubcommodity === normalizeBehaviorText(itemMeta.subcommodity)) score += 4;
      if (inputPayment && inputPayment === normalizeBehaviorText(itemMeta.paymentMethod)) score += 0.75;

      if (score < 2.5) return;
      const latestAt = itemTimestamp(item);
      const recencyBoost = latestAt > 0 ? Math.min(1.5, latestAt / Date.now()) : 0;
      const current = candidates.get(category) || { score: 0, count: 0, latestAt: 0 };
      current.score += score + recencyBoost;
      current.count += 1;
      current.latestAt = Math.max(current.latestAt, latestAt);
      candidates.set(category, current);
    });

  const ranked = Array.from(candidates.entries())
    .sort((a, b) => b[1].score - a[1].score || b[1].count - a[1].count || b[1].latestAt - a[1].latestAt);
  const best = ranked[0];
  const totalScore = ranked.reduce((sum, [, candidate]) => sum + candidate.score, 0);
  const agreement = best && totalScore > 0 ? best[1].score / totalScore : 0;

  return best && best[1].score >= 3 && agreement >= 0.65 ? best[0] : undefined;
};

const inferProfilesFromMeta = (meta: Partial<ParsedItemMetaV2> = {}, hints: string[] = [], text = ''): string[] => {
  const profiles: string[] = [];
  const push = (values: string[]) => values.forEach(value => { if (!profiles.includes(value)) profiles.push(value); });

  hints.forEach(hint => {
    const normalized = normalize(hint).replace(/\s+/g, '_');
    if (CATEGORY_PROFILES[normalized]) push([normalized]);
  });

  const financeType = normalize(meta.financeType);
  if (financeType === 'saving') push(['savings']);
  if (financeType === 'transfer' || financeType === 'income') return profiles;

  const commodity = normalize(meta.commodity).replace(/\s+/g, '_');
  const subcommodity = normalize(meta.subcommodity).replace(/\s+/g, '_');
  if (SUBCOMMODITY_TO_PROFILE[subcommodity]) push(SUBCOMMODITY_TO_PROFILE[subcommodity]);
  if (COMMODITY_TO_PROFILE[commodity]) push(COMMODITY_TO_PROFILE[commodity]);

  const normalizedText = ` ${normalizeBehaviorText(text)} `;
  Object.entries(CATEGORY_PROFILES).forEach(([profile, keywords]) => {
    if (profiles.includes(profile)) return;
    if (keywords.some(keyword => {
      const normalizedKeyword = normalizeBehaviorText(keyword);
      return normalizedKeyword.length >= 3 && normalizedText.includes(` ${normalizedKeyword} `);
    })) push([profile]);
  });

  return profiles;
};

export const inferBudgetCategoryId = (params: {
  value?: string;
  text?: string;
  meta?: Partial<ParsedItemMetaV2>;
  budgetRules?: RuleLike[];
  existingItems?: BrainDumpItem[];
  hints?: string[];
}): string | undefined => {
  const rules = params.budgetRules || [];
  const explicit = resolveBudgetCategoryIdFromRules(params.value || params.meta?.budgetCategory, rules);
  if (explicit) return explicit;

  const financeType = normalize(params.meta?.financeType);
  if (financeType === 'income' || financeType === 'transfer') return undefined;

  const historical = inferFromHistory({ text: params.text, meta: params.meta, existingItems: params.existingItems, rules });
  if (historical) return historical;

  const profiles = inferProfilesFromMeta(params.meta, params.hints, params.text);
  const profileMatch = findBestRuleByProfiles(profiles, rules);
  if (profileMatch) return profileMatch;

  // Fallback: if we resolved profiles but no rule matched (e.g. custom-named rules),
  // pick the first configured rule as a pragmatic default instead of returning None.
  if (profiles.length > 0 && rules.length > 0) {
    return rules[0].id;
  }

  if (!rules.length) return profiles[0];

  return undefined;
};

export const formatBudgetRuleContext = (budgetConfig?: BudgetConfig): string => {
  const rules = budgetConfig?.rules || [];
  if (!rules.length) {
    return 'Configured budget categories: none';
  }

  return [
    'Configured budget categories (canonical):',
    ...rules.map((rule) => `- ${rule.name} (id: ${rule.id}, target: ${rule.percentage}%)`),
    'When assigning budgetCategory for finance/saving, use one of the configured category ids exactly.',
    'Use current spreadsheet category names and historical transaction patterns as the strongest evidence.',
    'If there is no exact reference, infer the closest configured category creatively from purpose, commodity, merchant, and user wording instead of returning none.',
    'Only leave budgetCategory blank for income/transfer or totally purpose-less amount-only inputs.'
  ].join('\n');
};
