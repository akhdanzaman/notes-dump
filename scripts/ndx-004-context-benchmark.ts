import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildContextTextForIntent, buildLegacyParserContextText, type IntentParserContext } from '../services/parserContextBuilder';
import { ItemType, type BrainDumpItem } from '../types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const item = (id: string, type: ItemType, content: string, status: 'pending' | 'done', meta: BrainDumpItem['meta'] = {}): BrainDumpItem => ({ id, type, content, status, created_at: '2026-05-01T00:00:00.000Z', meta });
const existingItems: BrainDumpItem[] = [];
for (let i = 0; i < 48; i += 1) existingItems.push(item(`todo-${i}`, ItemType.TODO, `pending task ${i}`, 'pending'));
for (let i = 0; i < 30; i += 1) existingItems.push(item(`shop-${i}`, ItemType.SHOPPING, `shopping item ${i}`, 'pending', { shoppingCategory: i % 5 === 0 ? 'saving' : 'not_urgent' }));
for (let i = 0; i < 60; i += 1) existingItems.push(item(`finance-${i}`, ItemType.FINANCE, `transaction ${i}`, 'done', { financeType: i % 6 === 0 ? 'income' : 'expense', paymentMethod: i % 2 === 0 ? 'wallet-cash' : 'wallet-bca', budgetCategory: i % 3 === 0 ? 'budget-food' : 'budget-transport', commodity: i % 3 === 0 ? 'food' : 'transport', subcommodity: i % 3 === 0 ? 'meal' : 'ride' }));
const ctx: IntentParserContext = {
  existingTags: ['home', 'urgent', 'health', 'errand', 'work', 'weekly'],
  availableSkills: Array.from({ length: 8 }, (_, i) => ({ id: `skill-${i}`, name: `Skill ${i}`, color: '#fff', created_at: '2026-01-01T00:00:00.000Z' })),
  availableWallets: [
    { id: 'wallet-cash', name: 'Cash', type: 'cash', initialBalance: 0, color: '#fff' },
    { id: 'wallet-bca', name: 'BCA', type: 'bank', initialBalance: 0, color: '#fff' },
    { id: 'wallet-ovo', name: 'OVO', type: 'ewallet', initialBalance: 0, color: '#fff' },
  ],
  availableBudgetRules: [
    { id: 'budget-food', name: 'Food', percentage: 40, color: '#f00' },
    { id: 'budget-transport', name: 'Transportation', percentage: 20, color: '#0f0' },
    { id: 'budget-home', name: 'Home', percentage: 20, color: '#00f' },
    { id: 'budget-learning', name: 'Learning', percentage: 20, color: '#ff0' },
  ],
  existingItems,
  currentDateISO: '2026-05-09T00:00:00.000Z',
  currentDayName: 'Saturday',
  currentMonthKey: '2026-05',
};
const estimateTokens = (text: string) => Math.ceil(text.length / 4);
const legacy = buildLegacyParserContextText(ctx);
const rows = (['stage1', 'finance', 'task', 'shopping', 'general'] as const).map(intent => {
  const slim = buildContextTextForIntent(ctx, intent);
  return { intent, legacyChars: legacy.length, slimChars: slim.length, legacyTokenEstimate: estimateTokens(legacy), slimTokenEstimate: estimateTokens(slim), reductionChars: legacy.length - slim.length, reductionPercent: Number((((legacy.length - slim.length) / legacy.length) * 100).toFixed(1)) };
});
const artifact = { task: 'NDX-004', generatedAt: new Date().toISOString(), method: 'char_count_div_4_token_estimate; representative parser context with 48 tasks, 30 shopping items, 60 finance transactions, 3 wallets, 4 budgets, 8 skills', rows };
const outDir = resolve(repoRoot, 'docs/artifacts');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'ndx-004-context-benchmark-2026-05-09.json');
writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
for (const row of rows) console.log(`${row.intent}: legacy=${row.legacyTokenEstimate} slim=${row.slimTokenEstimate} reduction=${row.reductionPercent}%`);
