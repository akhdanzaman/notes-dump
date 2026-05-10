import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { routeParserInput } from '../services/parserRouter';
import { canonicalizeParserResults } from '../services/canonicalizerService';
import { getSystemCanonicalRules } from '../utils/canonicalization/systemRules';
import { guardParserResultMultiplicity } from '../utils/parserResultGuards';
import { classifyText, DEFAULT_PROMPT } from '../services/geminiService';
import { parsePro } from '../services/geminiProService';
import {
  BrainDumpItem,
  BudgetRule,
  CreateItemPayload,
  ItemType,
  ParserResultV2,
  Skill,
  Wallet,
} from '../types';

const repoRoot = resolve(import.meta.dirname, '..');
const outputPath = resolve(repoRoot, 'docs/artifacts/ndx-001-parser-baseline-2026-05-09.json');
const markdownPath = resolve(repoRoot, 'docs/artifacts/ndx-001-parser-baseline-2026-05-09.md');
const args = new Set(process.argv.slice(2));
const includePro = args.has('--include-pro');
const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);

const wallets: Wallet[] = [
  { id: 'cash', name: 'Cash', type: 'cash', initialBalance: 0, color: 'bg-green-500' },
  { id: 'bca', name: 'BCA', type: 'bank', initialBalance: 0, color: 'bg-blue-500' },
  { id: 'gopay', name: 'Gopay', type: 'ewallet', initialBalance: 0, color: 'bg-cyan-500' },
  { id: 'mandiri', name: 'Mandiri', type: 'bank', initialBalance: 0, color: 'bg-yellow-500' },
];

const budgetRules: BudgetRule[] = [
  { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
  { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
  { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
  { id: 'fixed', name: 'Fixed', percentage: 0, color: 'bg-slate-500' },
  { id: 'sedekah', name: 'Sedekah', percentage: 0, color: 'bg-purple-500' },
  { id: 'unintend', name: 'Unintend', percentage: 0, color: 'bg-red-500' },
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
  {
    id: 'todo-weekly-brief',
    type: ItemType.TODO,
    content: 'Prepare weekly brief',
    status: 'pending',
    created_at: '2026-05-01T00:00:00.000+07:00',
    meta: { tags: ['work'], priority: 'normal' },
  },
];

const cases = [
  { id: 'simple_expense', label: 'simple expense', text: 'sarapan 14000 cash' },
  { id: 'transfer', label: 'transfer', text: 'transfer 250rb dari bca ke cash' },
  { id: 'saving', label: 'saving', text: 'tabung 500rb ke Emergency fund dari BCA' },
  { id: 'todo', label: 'todo', text: 'todo: follow up invoice vendor besok jam 10 pagi' },
  { id: 'shopping', label: 'shopping', text: 'beli susu besok 12rb' },
  { id: 'mixed_batch', label: 'mixed batch', text: 'sarapan 14000 cash; beli susu besok 12rb; todo: follow up invoice vendor' },
  { id: 'long_natural_language', label: 'long natural language', text: 'Kemarin aku bayar laundry 28000 pakai gopay, terus hari ini perlu ingat untuk review budget mingguan dan besok beli token listrik 100rb kalau saldo sudah masuk.' },
];

type BenchRow = {
  id: string;
  label: string;
  parserMode: 'router-current-default' | 'pro-two-stage-static';
  status: 'ok' | 'deep_ai_missing_key' | 'static_estimate_only' | 'error';
  textLength: number;
  route: string;
  intent: string;
  confidenceScore: number | null;
  reasonCodes: string[];
  latencyMs: number | null;
  aiCallCount: number;
  avoidedAiCalls: number;
  maxRetryCallCount: number;
  inputTokenEstimate: number;
  outputTokenEstimate: number | null;
  resultCount: number | null;
  needsReviewCount: number | null;
  duplicateGuardRemovedCount: number | null;
  resultSummary?: string;
  error?: string;
};

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function convertLegacyResultsToNative(legacyResults: Partial<BrainDumpItem>[], originalText: string): ParserResultV2[] {
  return legacyResults.map((partial) => {
    const meta = partial.meta || {};
    const type = partial.type || ItemType.NOTE;
    return {
      action: 'create_item',
      entityType:
        type === ItemType.TODO ? 'todo' :
        type === ItemType.SHOPPING ? 'shopping' :
        type === ItemType.NOTE ? 'note' :
        type === ItemType.EVENT ? 'event' :
        type === ItemType.FINANCE ? 'finance' :
        type === ItemType.JOURNAL ? 'journal' :
        type === ItemType.SKILL_LOG ? 'skill_log' :
        'unknown',
      content: partial.content || originalText,
      confidence: meta.parsingError ? 'low' : 'medium',
      needsReview: Boolean(meta.parsingError),
      reviewReason: meta.parsingError,
      payload: {
        itemType: type,
        content: partial.content || originalText,
        meta,
      } as CreateItemPayload,
    };
  });
}

function extractTemplateConstant(fileText: string, name: string): string {
  const marker = `const ${name} = \``;
  const start = fileText.indexOf(marker);
  if (start === -1) return '';
  const bodyStart = start + marker.length;
  const end = fileText.indexOf('\n`;', bodyStart);
  return end === -1 ? '' : fileText.slice(bodyStart, end);
}

const proSource = readFileSync(resolve(repoRoot, 'services/geminiProService.ts'), 'utf8');
const intentPromptV2 = extractTemplateConstant(proSource, 'INTENT_PROMPT_V2');
const featurePromptBase = extractTemplateConstant(proSource, 'FEATURE_PROMPT_BASE');

function legacyPromptEstimate(text: string): number {
  const prompt = `Analyze this user input: "${text}". Current Date context: 2026-05-09T08:57:00.000+07:00 (Saturday). Existing tags context: work Known User Skills (match 'skillName' to one of these if possible): ${skills.map(s => s.name).join(', ')} Known Wallets (for paymentMethod/toWallet): ${wallets.map(w => `${w.name} [ID: ${w.id}]`).join(', ')} Known Budget Categories (for budgetCategory): ${budgetRules.map(b => `${b.name} [ID: ${b.id}]`).join(', ')} ${DEFAULT_PROMPT}`;
  return estimateTokens(prompt);
}

function proPromptEstimate(text: string): number {
  const context = [
    'Current date: 2026-05-09T08:57:00.000+07:00 (Saturday)',
    'Existing tags: work',
    `Known skills: ${skills.map(s => `${s.name} [${s.id}]`).join(', ')}`,
    `Known wallets: ${wallets.map(w => `${w.name} [${w.id}] type=${w.type}`).join(', ')}`,
    `Known budget categories: ${budgetRules.map(b => `${b.name} [${b.id}]`).join(', ')}`,
    'Known saving goals: Emergency fund',
    'Pending items: TODO: Prepare weekly brief',
  ].join('\n');
  return estimateTokens(`${intentPromptV2}\n${context}\n${text}`) + estimateTokens(`${featurePromptBase}\n${DEFAULT_PROMPT}\n${context}\n[]\n${text}`);
}

function finishPipeline(parsedResults: ParserResultV2[], text: string) {
  const canonicalized = canonicalizeParserResults(parsedResults, {
    existingItems,
    wallets,
    budgetRules,
    rules: [...getSystemCanonicalRules(wallets)],
  });
  return guardParserResultMultiplicity(canonicalized, text);
}

function summarizeResults(results: ParserResultV2[]): string {
  return results.map(result => [result.action, result.entityType, result.confidence, result.needsReview ? 'review' : 'auto'].join('/')).join(', ');
}

async function benchCurrent(testCase: typeof cases[number]): Promise<BenchRow> {
  const started = performance.now();
  let deepParserInvoked = false;
  try {
    const routed = await routeParserInput(
      testCase.text,
      { existingTags: ['work'], availableSkills: skills, availableWallets: wallets, availableBudgetRules: budgetRules, existingItems, now: new Date('2026-05-09T08:57:00+07:00') },
      async () => {
        deepParserInvoked = true;
        const legacy = await classifyText(testCase.text, ['work'], skills.map(s => s.name), 0, DEFAULT_PROMPT, undefined, wallets, budgetRules);
        return convertLegacyResultsToNative(legacy, testCase.text);
      },
    );
    const guarded = finishPipeline(routed.results, testCase.text);
    const latencyMs = Math.round(performance.now() - started);
    const expectedAiCallCount = routed.decision.route === 'deep_ai' ? 1 : 0;
    return {
      id: testCase.id,
      label: testCase.label,
      parserMode: 'router-current-default',
      status: deepParserInvoked && !hasGeminiKey ? 'deep_ai_missing_key' : 'ok',
      textLength: testCase.text.length,
      route: routed.decision.route,
      intent: routed.decision.intent,
      confidenceScore: routed.decision.confidenceScore,
      reasonCodes: routed.decision.reasonCodes,
      latencyMs,
      aiCallCount: expectedAiCallCount,
      avoidedAiCalls: routed.decision.route === 'deep_ai' ? 0 : 1,
      maxRetryCallCount: routed.decision.route === 'deep_ai' ? 9 : 0,
      inputTokenEstimate: routed.decision.route === 'deep_ai' ? legacyPromptEstimate(testCase.text) : 0,
      outputTokenEstimate: estimateTokens(JSON.stringify(guarded.results)),
      resultCount: guarded.results.length,
      needsReviewCount: guarded.results.filter(result => result.needsReview).length,
      duplicateGuardRemovedCount: guarded.removedCount,
      resultSummary: summarizeResults(guarded.results),
      error: deepParserInvoked && !hasGeminiKey ? 'GEMINI_API_KEY/GOOGLE_API_KEY not present; deep AI used missing-key fallback item.' : undefined,
    };
  } catch (error) {
    return {
      id: testCase.id,
      label: testCase.label,
      parserMode: 'router-current-default',
      status: 'error',
      textLength: testCase.text.length,
      route: 'error',
      intent: 'unknown',
      confidenceScore: null,
      reasonCodes: [],
      latencyMs: Math.round(performance.now() - started),
      aiCallCount: deepParserInvoked ? 1 : 0,
      avoidedAiCalls: 0,
      maxRetryCallCount: deepParserInvoked ? 9 : 0,
      inputTokenEstimate: deepParserInvoked ? legacyPromptEstimate(testCase.text) : 0,
      outputTokenEstimate: null,
      resultCount: null,
      needsReviewCount: null,
      duplicateGuardRemovedCount: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function benchProStatic(testCase: typeof cases[number]): BenchRow {
  return {
    id: testCase.id,
    label: testCase.label,
    parserMode: 'pro-two-stage-static',
    status: 'static_estimate_only',
    textLength: testCase.text.length,
    route: 'deep_ai',
    intent: 'unknown',
    confidenceScore: null,
    reasonCodes: ['static_comparison'],
    latencyMs: null,
    aiCallCount: 2,
    avoidedAiCalls: 0,
    maxRetryCallCount: 18,
    inputTokenEstimate: proPromptEstimate(testCase.text),
    outputTokenEstimate: null,
    resultCount: null,
    needsReviewCount: null,
    duplicateGuardRemovedCount: null,
  };
}

function toMarkdown(rows: BenchRow[]) {
  return [
    '# NDX-001 parser baseline benchmark',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Gemini key present: ${hasGeminiKey}`,
    '',
    '## Methodology',
    '',
    '- Sample count: one run per benchmark case in this Node/tsx runtime.',
    '- Cold/warm timing: no warm-up separation; first local row may include module/JIT/cache setup.',
    '- Real vs estimated: local router/canonicalizer/guard latency is measured live; deep Gemini provider latency is not measured when no key is configured.',
    '- Non-SLA estimates: deep-AI latency/tokens are planning estimates only; queue live-provider calibration in a Gemini-keyed environment before treating them as SLA.',
    '- Token estimates: static `ceil(promptCharacters / 4)` from current repo prompt text; not provider billing truth.',
    '- Current behavior proof: `hooks/useBrainDumpData.ts` calls `routeParserInput` before legacy/pro deep parser fallback, so `local_save` rows are current behavior, not hypothetical future leakage.',
    '',
    '| Case | Parser mode | Status | Route | Intent | Confidence | Latency ms | AI calls | Avoided AI calls | Max retry calls | Est input tokens | Est output tokens | Results | Review results | Duplicate guard removed | Reason codes |',
    '|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
    ...rows.map(row => `| ${row.label} | ${row.parserMode} | ${row.status} | ${row.route} | ${row.intent} | ${row.confidenceScore ?? 'n/a'} | ${row.latencyMs ?? 'n/a'} | ${row.aiCallCount} | ${row.avoidedAiCalls} | ${row.maxRetryCallCount} | ${row.inputTokenEstimate} | ${row.outputTokenEstimate ?? 'n/a'} | ${row.resultCount ?? 'n/a'} | ${row.needsReviewCount ?? 'n/a'} | ${row.duplicateGuardRemovedCount ?? 'n/a'} | ${row.reasonCodes.join(', ')} |`),
  ].join('\n') + '\n';
}

const rows: BenchRow[] = [];
for (const testCase of cases) {
  rows.push(await benchCurrent(testCase));
  if (includePro) rows.push(benchProStatic(testCase));
}

const artifact = {
  generatedAt: new Date().toISOString(),
  repo: 'notes-dump',
  task: 'NDX-001',
  benchmarkCases: cases,
  environment: {
    node: process.version,
    geminiKeyPresent: hasGeminiKey,
    includePro,
  },
  assumptions: {
    methodology: 'One run per benchmark case; no cold/warm separation. Local router/canonicalizer/guard latency is live; deep-AI latency/tokens are non-SLA planning estimates unless a Gemini key is configured for live-provider calibration.',
    currentDefaultParserMode: 'routeParserInput in useBrainDumpData; deep fallback uses legacy classifyText unless useProParser is enabled. local_save is current repo behavior, not a proposed route.',
    tokenEstimate: 'ceil(prompt characters / 4) for legacy/pro deep parser prompts; local router estimates are zero input tokens because no AI prompt is sent. Estimates are not provider billing truth.',
    aiCallCount: 'local_save/review routes are zero AI calls; deep_ai current-default is one legacy Gemini call when a key exists; pro comparison is two Gemini calls.',
    maxRetryCallCount: 'legacy classifyText can attempt up to 9 generateContent calls (withAiRetry x recursive retries); pro two-stage comparison can reach 18 attempts if both stages are reached in each retry window.',
  },
  rows,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(artifact, null, 2));
writeFileSync(markdownPath, toMarkdown(rows));
console.log(toMarkdown(rows));
console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${markdownPath}`);
