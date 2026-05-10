import { BrainDumpItem, BudgetRule, ItemType, ParserResultV2, Skill, Wallet } from '../types';

export type ParserContextIntent = 'stage1' | 'finance' | 'task' | 'shopping' | 'general';

export interface IntentParserContext {
  existingTags: string[];
  availableSkills: Skill[];
  availableWallets: Wallet[];
  availableBudgetRules: BudgetRule[];
  existingItems: BrainDumpItem[];
  currentDateISO: string;
  currentDayName: string;
  currentMonthKey: string;
}

const compactItemLine = (item: BrainDumpItem) => `${item.type}: ${item.content}`;

const commonLines = (ctx: IntentParserContext): string[] => [
  `Current date: ${ctx.currentDateISO} (${ctx.currentDayName})`,
  `Current month key: ${ctx.currentMonthKey}`,
];

const savingGoalContext = (ctx: IntentParserContext): string => {
  const goals = ctx.existingItems
    .filter(item => item.type === ItemType.SHOPPING && item.meta?.shoppingCategory === 'saving')
    .slice(0, 40)
    .map(item => `${item.content} [${item.id}]`);
  return goals.length ? `Known saving goals: ${goals.join(', ')}` : 'Known saving goals: none';
};

const recentFinancePatterns = (ctx: IntentParserContext): string => {
  const patterns = Array.from(new Set(ctx.existingItems
    .filter(item => item.type === ItemType.FINANCE)
    .map(item => {
      const meta = item.meta || {};
      return [
        meta.financeType || '',
        meta.paymentMethod ? `wallet=${meta.paymentMethod}` : '',
        meta.budgetCategory ? `budget=${meta.budgetCategory}` : '',
        meta.commodity ? `commodity=${meta.commodity}` : '',
        meta.subcommodity ? `subcommodity=${meta.subcommodity}` : '',
      ].filter(Boolean).join(' ');
    })
    .filter(Boolean)))
    .slice(0, 12);
  return patterns.length ? `Recent finance patterns: ${patterns.join(' | ')}` : 'Recent finance patterns: none';
};

const spreadsheetBudgetCategoryExamples = (ctx: IntentParserContext): string => {
  const namesById = new Map(ctx.availableBudgetRules.map(rule => [rule.id, rule.name]));
  const examplesByCategory = new Map<string, string[]>();

  ctx.existingItems
    .filter(item => item.type === ItemType.FINANCE && item.meta?.budgetCategory)
    .sort((a, b) => Date.parse(b.completed_at || b.created_at) - Date.parse(a.completed_at || a.created_at))
    .forEach(item => {
      const category = item.meta?.budgetCategory;
      if (!category) return;
      const label = namesById.get(category) ? `${namesById.get(category)} [${category}]` : category;
      const current = examplesByCategory.get(label) || [];
      if (current.length >= 3) return;
      current.push([
        item.content,
        item.meta?.commodity ? `commodity=${item.meta.commodity}` : '',
        item.meta?.subcommodity ? `subcommodity=${item.meta.subcommodity}` : '',
        item.meta?.merchant ? `merchant=${item.meta.merchant}` : '',
      ].filter(Boolean).join(' '));
      examplesByCategory.set(label, current);
    });

  const lines = Array.from(examplesByCategory.entries()).slice(0, 8).map(([category, examples]) => `${category}: ${examples.join('; ')}`);
  return lines.length ? `Spreadsheet budget category examples: ${lines.join(' | ')}` : 'Spreadsheet budget category examples: none';
};

const shoppingPatterns = (ctx: IntentParserContext): string => {
  const patterns = ctx.existingItems
    .filter(item => item.type === ItemType.SHOPPING)
    .slice(0, 40)
    .map(item => [item.content, item.meta?.shoppingCategory ? `category=${item.meta.shoppingCategory}` : ''].filter(Boolean).join(' '));
  return patterns.length ? `Shopping patterns: ${patterns.join(' | ')}` : 'Shopping patterns: none';
};

export function buildLegacyParserContextText(ctx: IntentParserContext): string {
  const savingGoals = ctx.existingItems
    .filter(item => item.type === ItemType.SHOPPING && item.meta?.shoppingCategory === 'saving')
    .map(item => item.content);
  const pendingItems = ctx.existingItems
    .filter(item => item.status === 'pending')
    .slice(0, 120)
    .map(compactItemLine);

  return [
    ...commonLines(ctx),
    ctx.existingTags.length ? `Existing tags: ${ctx.existingTags.join(', ')}` : 'Existing tags: none',
    ctx.availableSkills.length ? `Known skills: ${ctx.availableSkills.map(skill => `${skill.name} [${skill.id}]`).join(', ')}` : 'Known skills: none',
    ctx.availableWallets.length ? `Known wallets: ${ctx.availableWallets.map(wallet => `${wallet.name} [${wallet.id}] type=${wallet.type}`).join(', ')}` : 'Known wallets: none',
    ctx.availableBudgetRules.length ? `Known budget categories: ${ctx.availableBudgetRules.map(rule => `${rule.name} [${rule.id}]`).join(', ')}` : 'Known budget categories: none',
    savingGoals.length ? `Known saving goals: ${savingGoals.join(', ')}` : 'Known saving goals: none',
    pendingItems.length ? `Pending items: ${pendingItems.join(' | ')}` : 'Pending items: none',
  ].join('\n');
}

export function resolveParserContextIntent(stage1Results: ParserResultV2[]): ParserContextIntent {
  const first = stage1Results[0];
  if (!first) return 'general';
  if (first.entityType === 'finance' || first.action === 'transfer_money' || first.action === 'add_saving_funds') return 'finance';
  if (first.entityType === 'shopping' || first.entityType === 'saving_goal') return 'shopping';
  if (first.entityType === 'todo' || first.entityType === 'event' || first.entityType === 'skill_log' || first.entityType === 'skill') return 'task';
  return 'general';
}

export function buildContextTextForIntent(ctx: IntentParserContext, intent: ParserContextIntent): string {
  const lines = commonLines(ctx);
  if (intent === 'stage1') return lines.join('\n');

  if (intent === 'finance') {
    lines.push(
      ctx.availableWallets.length ? `Known wallets: ${ctx.availableWallets.map(wallet => `${wallet.name} [${wallet.id}] type=${wallet.type}`).join(', ')}` : 'Known wallets: none',
      ctx.availableBudgetRules.length ? `Known budget categories: ${ctx.availableBudgetRules.map(rule => `${rule.name} [${rule.id}]`).join(', ')}` : 'Known budget categories: none',
      savingGoalContext(ctx),
      recentFinancePatterns(ctx),
      spreadsheetBudgetCategoryExamples(ctx),
      'Budget category rule: prefer spreadsheet examples first; otherwise infer the closest known budget category id from purpose/commodity/merchant instead of returning none. Leave blank only for income, transfers, or truly purpose-less amount-only input.',
    );
    return lines.join('\n');
  }

  if (intent === 'task') {
    const taskItems = ctx.existingItems
      .filter(item => item.status === 'pending' && [ItemType.TODO, ItemType.EVENT, ItemType.SKILL_LOG].includes(item.type))
      .slice(0, 100)
      .map(compactItemLine);
    lines.push(
      ctx.existingTags.length ? `Existing tags: ${ctx.existingTags.join(', ')}` : 'Existing tags: none',
      ctx.availableSkills.length ? `Known skills: ${ctx.availableSkills.map(skill => `${skill.name} [${skill.id}]`).join(', ')}` : 'Known skills: none',
      taskItems.length ? `Pending task/event items: ${taskItems.join(' | ')}` : 'Pending task/event items: none',
    );
    return lines.join('\n');
  }

  if (intent === 'shopping') {
    const pendingShopping = ctx.existingItems
      .filter(item => item.status === 'pending' && item.type === ItemType.SHOPPING)
      .slice(0, 80)
      .map(compactItemLine);
    lines.push(
      ctx.existingTags.length ? `Existing tags: ${ctx.existingTags.join(', ')}` : 'Existing tags: none',
      savingGoalContext(ctx),
      shoppingPatterns(ctx),
      pendingShopping.length ? `Pending shopping items: ${pendingShopping.join(' | ')}` : 'Pending shopping items: none',
    );
    return lines.join('\n');
  }

  const pendingItems = ctx.existingItems
    .filter(item => item.status === 'pending')
    .slice(0, 40)
    .map(compactItemLine);
  lines.push(
    ctx.existingTags.length ? `Existing tags: ${ctx.existingTags.join(', ')}` : 'Existing tags: none',
    pendingItems.length ? `Pending items: ${pendingItems.join(' | ')}` : 'Pending items: none',
  );
  return lines.join('\n');
}
