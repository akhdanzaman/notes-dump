import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { routeBatchParserInput } from '../services/batchParserCoordinator';
import { runFastThenDeepParserModelRouting } from '../services/parserModelRouting';
import { DEFAULT_FLASH_MODEL, DEFAULT_PRO_MODEL } from '../services/aiService';
import { BrainDumpItem, BudgetRule, ItemType, ParserResultV2, Skill, Wallet } from '../types';

const repoRoot = resolve(import.meta.dirname, '..');
const outputPath = resolve(repoRoot, 'docs/artifacts/ndx-010-model-routing-benchmark-2026-05-09.json');
const markdownPath = resolve(repoRoot, 'docs/artifacts/ndx-010-model-routing-benchmark-2026-05-09.md');

const wallets: Wallet[] = [
  { id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, color: 'bg-green-500' },
  { id: 'bca', name: 'BCA', type: 'bank', initialBalance: 0, color: 'bg-blue-500' },
  { id: 'gopay', name: 'Gopay', type: 'ewallet', initialBalance: 0, color: 'bg-cyan-500' },
];

const budgetRules: BudgetRule[] = [
  { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
  { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
  { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
];

const skills: Skill[] = [
  { id: 'skill-english', name: 'English Speaking', color: 'indigo-500', created_at: '2026-05-01T00:00:00.000+07:00' },
];

const existingItems: BrainDumpItem[] = [
  {
    id: 'goal-emergency',
    type: ItemType.SHOPPING,
    content: 'Emergency fund',
    status: 'pending',
    created_at: '2026-05-01T00:00:00.000+07:00',
    meta: { shoppingCategory: 'saving', amount: 10000000, dedicatedWalletId: 'bca' },
  },
];

const ctx = {
  existingTags: ['work'],
  availableSkills: skills,
  availableWallets: wallets,
  availableBudgetRules: budgetRules,
  existingItems,
  now: new Date('2026-05-09T08:57:00+07:00'),
};

const cases = [
  { id: 'simple_expense', label: 'simple expense', text: 'expense kopi 10rb cash', fastMode: 'accept' },
  { id: 'clear_batch', label: 'clear local batch', text: 'expense kopi 10rb cash\nincome gaji 5jt bca\ntodo: send invoice', fastMode: 'accept' },
  { id: 'ambiguous_fast_ok', label: 'ambiguous note fast ok', text: 'unclear project note about budget review', fastMode: 'accept' },
  { id: 'ambiguous_deep', label: 'ambiguous reimbursement deep', text: 'lunch with Maya maybe reimburse later', fastMode: 'unknown' },
  { id: 'mixed_leftover_fast_ok', label: 'mixed batch one leftover fast ok', text: 'expense kopi 10rb cash\nunclear project note about budget review\nincome gaji 5jt bca', fastMode: 'accept' },
  { id: 'mixed_leftover_deep', label: 'mixed batch one leftover deep', text: 'expense kopi 10rb cash\nlunch with Maya maybe reimburse later\nincome gaji 5jt bca', fastMode: 'unknown' },
] as const;

type BenchMode = 'static_deep_pro' | 'fast_then_deep_routing';

type BenchRow = {
  id: string;
  label: string;
  mode: BenchMode;
  route: string;
  aiCallCount: number;
  weightedCostUnits: number;
  selectedTier?: string;
  finalModel?: string;
  fastModel?: string;
  deepModel?: string;
  escalationReasonCodes: string[];
  latencyMs: number;
  resultCount: number;
  needsReviewCount: number;
  batchItems?: number;
  localBatchItems?: number;
  aiBatchItems?: number;
};

const FAST_COST_UNIT = 1;
const DEEP_COST_UNIT = 10;

const createNote = (content: string, confidence: ParserResultV2['confidence'] = 'medium', needsReview = false): ParserResultV2 => ({
  action: 'create_item',
  entityType: 'note',
  content,
  confidence,
  needsReview,
  reviewReason: needsReview ? 'Mocked ambiguous extraction for offline benchmark.' : undefined,
  payload: {
    itemType: ItemType.NOTE,
    content,
    status: 'pending',
    meta: {},
  },
});

const createUnknown = (content: string): ParserResultV2 => ({
  action: 'unknown',
  entityType: 'unknown',
  content,
  confidence: 'low',
  needsReview: true,
  reviewReason: 'Mocked fast extraction could not confidently structure this input.',
});

const candidateContent = (text: string) => text.replace(/^\d+\.\s*/, '').trim();

const mockFastParser = async (text: string, fastMode: typeof cases[number]['fastMode'], _model = DEFAULT_FLASH_MODEL): Promise<ParserResultV2[]> => {
  const lines = text.split('\n').map(candidateContent).filter(Boolean);
  if (fastMode === 'unknown') return lines.map(createUnknown);
  return lines.map(line => createNote(line, 'medium', false));
};

const mockDeepParser = async (text: string, _model = DEFAULT_PRO_MODEL): Promise<ParserResultV2[]> => {
  const lines = text.split('\n').map(candidateContent).filter(Boolean);
  return lines.map(line => createNote(line, 'high', false));
};

async function benchStaticDeep(testCase: typeof cases[number]): Promise<BenchRow> {
  const started = performance.now();
  const routed = await routeBatchParserInput(testCase.text, ctx, async (batchText) => mockDeepParser(batchText));
  return {
    id: testCase.id,
    label: testCase.label,
    mode: 'static_deep_pro',
    route: routed.decision.route,
    aiCallCount: routed.decision.batch?.aiCallCount ?? (routed.decision.route === 'deep_ai' ? 1 : 0),
    weightedCostUnits: routed.decision.route === 'deep_ai' ? DEEP_COST_UNIT : 0,
    selectedTier: routed.decision.route === 'deep_ai' ? 'deep_parse' : 'not_applicable',
    finalModel: routed.decision.route === 'deep_ai' ? DEFAULT_PRO_MODEL : undefined,
    escalationReasonCodes: routed.decision.reasonCodes,
    latencyMs: Math.round(performance.now() - started),
    resultCount: routed.results.length,
    needsReviewCount: routed.results.filter(result => result.needsReview).length,
    batchItems: routed.decision.batch?.itemCount,
    localBatchItems: routed.decision.batch?.localItemCount,
    aiBatchItems: routed.decision.batch?.aiItemCount,
  };
}

async function benchFastRouting(testCase: typeof cases[number]): Promise<BenchRow> {
  const started = performance.now();
  const routed = await routeBatchParserInput(
    testCase.text,
    ctx,
    async (batchText, candidates) => runFastThenDeepParserModelRouting({
      text: batchText,
      candidateCount: candidates.length || 1,
      settings: { enabled: true, fastModel: DEFAULT_FLASH_MODEL, deepModel: DEFAULT_PRO_MODEL },
      fastParser: async (model) => mockFastParser(batchText, testCase.fastMode, model),
      deepParser: async (model) => mockDeepParser(batchText, model),
    }),
  );
  const modelRouting = routed.decision.modelRouting || routed.decision.batch?.modelRouting;
  const weightedCostUnits = modelRouting
    ? (modelRouting.fastAttempted ? FAST_COST_UNIT : 0) + (modelRouting.deepAttempted ? DEEP_COST_UNIT : 0)
    : 0;
  return {
    id: testCase.id,
    label: testCase.label,
    mode: 'fast_then_deep_routing',
    route: routed.decision.route,
    aiCallCount: routed.decision.batch?.aiCallCount ?? modelRouting?.aiCallCount ?? (routed.decision.route === 'deep_ai' ? 1 : 0),
    weightedCostUnits,
    selectedTier: modelRouting?.selectedTier || (routed.decision.route === 'deep_ai' ? 'deep_parse' : 'not_applicable'),
    finalModel: modelRouting?.finalModel,
    fastModel: modelRouting?.fastModel,
    deepModel: modelRouting?.deepModel,
    escalationReasonCodes: modelRouting?.escalationReasonCodes || routed.decision.reasonCodes,
    latencyMs: Math.round(performance.now() - started),
    resultCount: routed.results.length,
    needsReviewCount: routed.results.filter(result => result.needsReview).length,
    batchItems: routed.decision.batch?.itemCount,
    localBatchItems: routed.decision.batch?.localItemCount,
    aiBatchItems: routed.decision.batch?.aiItemCount,
  };
}

function toMarkdown(rows: BenchRow[]) {
  const totals = rows.reduce<Record<BenchMode, { rows: number; aiCalls: number; weightedCostUnits: number; deepSelections: number; fastSelections: number }>>((acc, row) => {
    acc[row.mode].rows += 1;
    acc[row.mode].aiCalls += row.aiCallCount;
    acc[row.mode].weightedCostUnits += row.weightedCostUnits;
    if (row.selectedTier === 'deep_parse') acc[row.mode].deepSelections += 1;
    if (row.selectedTier === 'fast_extraction') acc[row.mode].fastSelections += 1;
    return acc;
  }, {
    static_deep_pro: { rows: 0, aiCalls: 0, weightedCostUnits: 0, deepSelections: 0, fastSelections: 0 },
    fast_then_deep_routing: { rows: 0, aiCalls: 0, weightedCostUnits: 0, deepSelections: 0, fastSelections: 0 },
  });

  return [
    '# NDX-010 model-routing benchmark',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Methodology',
    '',
    '- Offline mocked-AI benchmark derived from the NDX-008 handoff requirements because no committed NDX-008 harness artifact exists in this checkout.',
    '- Uses the real `routeBatchParserInput` local/batch router and the real `runFastThenDeepParserModelRouting` policy.',
    '- Provider calls are mocked; latency is harness/runtime latency only, not Gemini SLA.',
    '- Static comparison treats each AI fallback as direct deep Pro. Routed comparison tries Flash first, then Pro only when fast extraction is ambiguous.',
    `- Weighted cost units are planning-only: Flash=${FAST_COST_UNIT}, Pro=${DEEP_COST_UNIT}. They are not provider billing truth.`,
    '',
    '## Totals',
    '',
    `- Static deep Pro: ${totals.static_deep_pro.aiCalls} AI calls, ${totals.static_deep_pro.deepSelections} deep selections, ${totals.static_deep_pro.weightedCostUnits} weighted cost units.`,
    `- Fast routing: ${totals.fast_then_deep_routing.aiCalls} AI calls, ${totals.fast_then_deep_routing.fastSelections} fast selections, ${totals.fast_then_deep_routing.deepSelections} deep selections, ${totals.fast_then_deep_routing.weightedCostUnits} weighted cost units.`,
    '',
    '| Case | Mode | Route | AI calls | Cost units | Selected tier | Final model | Latency ms | Results | Review results | Batch local/AI | Escalation reasons |',
    '|---|---|---|---:|---:|---|---|---:|---:|---:|---|---|',
    ...rows.map(row => `| ${row.label} | ${row.mode} | ${row.route} | ${row.aiCallCount} | ${row.weightedCostUnits} | ${row.selectedTier || 'n/a'} | ${row.finalModel || 'n/a'} | ${row.latencyMs} | ${row.resultCount} | ${row.needsReviewCount} | ${row.localBatchItems ?? 'n/a'}/${row.aiBatchItems ?? 'n/a'} | ${row.escalationReasonCodes.join(', ') || 'none'} |`),
  ].join('\n') + '\n';
}

const rows: BenchRow[] = [];
for (const testCase of cases) {
  rows.push(await benchStaticDeep(testCase));
  rows.push(await benchFastRouting(testCase));
}

const artifact = {
  generatedAt: new Date().toISOString(),
  repo: 'notes-dump',
  task: 'NDX-010',
  note: 'No committed NDX-008 harness artifact was present; this script implements the NDX-008 offline mocked-AI benchmark handoff shape and uses real NDX router/model-routing code.',
  supportedModels: [DEFAULT_FLASH_MODEL, DEFAULT_PRO_MODEL],
  rows,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
writeFileSync(markdownPath, toMarkdown(rows));
console.log(toMarkdown(rows));
console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${markdownPath}`);
