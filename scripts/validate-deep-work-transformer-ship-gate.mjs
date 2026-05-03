import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const realDataPath = join(repoRoot, '..', 'state', 'notes-dump-repair-backup-2026-04-14T23-45-43-290Z.json');
const db = JSON.parse(readFileSync(realDataPath, 'utf8'));
const items = Array.isArray(db.data) ? db.data : [];
const todos = items.filter(item => item.type === 'TODO');
const doneTodos = todos.filter(item => item.status === 'done');
const targetTitles = ['Selesaiin summary IIMS 2026', 'Lanjut summary regulasi'];
const targetItems = targetTitles.map(title => todos.find(item => item.content === title));

const abstractPattern = /\b(summary|summar(?:y|ize)|recap|riset|research|regulasi|cari tau|presentasi)\b/i;
const abstractTodos = todos.filter(item => abstractPattern.test(item.content || ''));

const sourceRoots = ['types.ts', 'components', 'hooks', 'services', 'utils', 'App.tsx'];
const implementationNeedles = [
  /deepWork/i,
  /Deep Work Transformer/i,
  /nextAction/i,
  /requestedFinalOutput/i,
  /blockerCheck/i,
  /subtasks/i,
  /nested todo/i,
];

const files = [];
const walk = (path) => {
  if (!existsSync(path)) return;
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walk(join(path, entry));
    }
    return;
  }
  if (/\.(ts|tsx)$/.test(path)) files.push(path);
};
sourceRoots.forEach(root => walk(join(repoRoot, root)));

const sourceMatches = [];
const sourceByFile = new Map();
for (const file of files) {
  const rel = relative(repoRoot, file);
  const text = readFileSync(file, 'utf8');
  sourceByFile.set(rel, text);
  for (const needle of implementationNeedles) {
    if (needle.test(text)) {
      sourceMatches.push({ file: rel, needle: String(needle) });
    }
  }
}

const filesReferencing = (pattern) =>
  [...sourceByFile.entries()]
    .filter(([_, text]) => pattern.test(text))
    .map(([file]) => file);

const integrationChecks = {
  transformerUtilityFiles: filesReferencing(/buildDeepWorkPlan|getDeepWorkChildren/),
  transformerImportsOutsideUtility: filesReferencing(/import .*buildDeepWorkPlan|from ['"].*deepWorkTransformer/).filter(file => file !== 'services/deepWorkTransformer.ts'),
  planViewDeepWorkReferences: filesReferencing(/deepWork|subtasks|parentTodoId|nextAction|blockerCheck/i).filter(file => file.includes('PlanView') || file.includes('Card')),
  spreadsheetRoundTripReferences: filesReferencing(/deepWork|subtasks|parentTodoId|nextAction|blockerCheck/i).filter(file => file.includes('spreadsheet') || file.includes('exportUtils') || file.includes('mergeUtils')),
  changelogReferences: existsSync(join(repoRoot, 'utils', 'changelog.ts'))
    ? (/Deep Work Transformer|nested todo|subtask/i.test(readFileSync(join(repoRoot, 'utils', 'changelog.ts'), 'utf8')) ? ['utils/changelog.ts'] : [])
    : [],
};

const hasEndToEndFeature =
  integrationChecks.transformerUtilityFiles.length > 0 &&
  integrationChecks.transformerImportsOutsideUtility.length > 0 &&
  integrationChecks.planViewDeepWorkReferences.length > 0 &&
  integrationChecks.spreadsheetRoundTripReferences.length > 0 &&
  integrationChecks.changelogReferences.length > 0;

const beforeAfter = [
  {
    realTask: targetTitles[0],
    before: 'Single vague done/pending-style todo: “Selesaiin summary IIMS 2026”; no first source, output format, or stop point is encoded.',
    after: {
      nextAction: 'Open the IIMS 2026 source material and capture the top 5 automotive / regulation / market notes in bullets.',
      finalOutput: 'One-page IIMS 2026 summary with key findings, implications for work, and 3 follow-up questions.',
      sessionEstimate: '45-60 minutes',
      blockerCheck: 'If source material is missing, first collect brochure/link/photos before summarizing.',
      subtasks: ['Collect source links/photos', 'Extract 5 facts', 'Write final one-page summary']
    },
    judgment: 'Clearer: yes. The first action is executable without deciding the whole summary shape in the moment.'
  },
  {
    realTask: targetTitles[1],
    before: 'Single vague continuation todo: “Lanjut summary regulasi”; the app does not store which regulation, what “lanjut” resumes, or what finished means.',
    after: {
      nextAction: 'Pick the exact regulation/doc number and write the current section heading + last completed paragraph before continuing.',
      finalOutput: 'Regulation summary with scope, obligations, deadlines, affected products/processes, and open questions.',
      sessionEstimate: '60-90 minutes',
      blockerCheck: 'If the regulation/doc is unspecified, do not start writing; first identify the document and source URL/file.',
      subtasks: ['Identify regulation and source', 'Extract obligations/deadlines', 'Draft summary', 'List unresolved interpretation questions']
    },
    judgment: 'Clearer: yes. This directly attacks the real failure mode: ambiguity around source, endpoint, and restart point.'
  }
];

const result = {
  verdict: hasEndToEndFeature ? 'review_required_end_to_end_markers_present' : 'reject_ship_incomplete_or_missing_integration',
  realDataPath: relative(repoRoot, realDataPath),
  todoStats: {
    total: todos.length,
    done: doneTodos.length,
    pending: todos.length - doneTodos.length,
    completionPct: Number(((doneTodos.length / todos.length) * 100).toFixed(1)),
    abstractTotal: abstractTodos.length,
    abstractDone: abstractTodos.filter(item => item.status === 'done').length,
    abstractPending: abstractTodos.filter(item => item.status !== 'done').length,
  },
  targetItems: targetItems.map(item => item && ({ id: item.id, content: item.content, status: item.status, meta: item.meta })),
  beforeAfter,
  nestedSubtaskCall: 'Useful only as a compact 3-4 item checklist under the parent. For these tasks, nextAction/finalOutput/blockerCheck carry most of the value; always-expanded or overly generic subtasks would add clutter.',
  implementationScan: {
    scannedFiles: files.length,
    matches: sourceMatches,
    integrationChecks,
    conclusion: hasEndToEndFeature
      ? 'End-to-end markers exist; still inspect behavior before passing ship gate.'
      : 'Feature is not shippable: markers may exist, but detector/output is not wired through Plan UX, sync/refresh, changelog, and/or runtime use.'
  }
};

if (!targetItems.every(Boolean)) {
  console.error(JSON.stringify({ error: 'Missing required real target tasks', targetTitles, targetItems }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
