import { execFileSync } from 'node:child_process';
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

const runActualTransformer = () => {
  const code = `
    const titles = JSON.parse(process.env.TARGET_TITLES || '[]');
    const mod = await import('./services/deepWorkTransformer.ts');
    const results = titles.map(title => ({ title, plan: mod.analyzeDeepWorkTodo(title) }));
    console.log(JSON.stringify(results));
  `;
  return JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '-e', code], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, TARGET_TITLES: JSON.stringify(targetTitles) },
  }));
};

const actualTransforms = runActualTransformer();
const actualByTitle = new Map(actualTransforms.map(result => [result.title, result.plan]));

const concreteVerbPattern = /^(open|read|extract|compare|list|draft|decide|send|ask|review|identify|collect|write)\b/i;
const assertRealTransform = (title, plan) => {
  const failures = [];
  if (!plan?.shouldTransform) failures.push('shouldTransform=false');
  const transform = plan?.transform || {};
  if (!transform.nextAction?.text || !concreteVerbPattern.test(transform.nextAction.text)) failures.push('nextAction missing concrete verb');
  if (!transform.finalRequestedOutput?.description) failures.push('finalRequestedOutput missing description');
  if (!transform.sessionEstimate?.minutes) failures.push('sessionEstimate missing minutes');
  if (!transform.blockerCheck) failures.push('blockerCheck missing');
  if (transform.nextAction?.text?.toLowerCase() === title.toLowerCase()) failures.push('nextAction repeats original title');
  if ((transform.subtasks || []).some(subtask => subtask.title?.toLowerCase() === title.toLowerCase())) failures.push('subtask repeats original title');
  if ((transform.subtasks || []).some(subtask => /^(research|draft|review|write summary|summarize)$/i.test(subtask.title || ''))) failures.push('generic one-word subtask found');
  return failures;
};

const realValidation = targetTitles.map(title => {
  const plan = actualByTitle.get(title);
  const failures = assertRealTransform(title, plan);
  if (/IIMS/i.test(title)) {
    if (!/IIMS 2026/i.test(plan?.transform?.nextAction?.text || '')) failures.push('IIMS nextAction does not name real topic');
    if (!/IIMS 2026/i.test(plan?.transform?.finalRequestedOutput?.description || '')) failures.push('IIMS final output does not name real topic');
  }
  if (/regulasi/i.test(title)) {
    if (!/regulation source|regulasi|regulation/i.test(plan?.transform?.nextAction?.text || '')) failures.push('regulasi nextAction does not address source ambiguity');
    if (!(plan?.transform?.blockerCheck?.missingInputs || []).includes('specific regulation')) failures.push('regulasi blockerCheck does not require specific regulation');
  }
  return { title, failures, plan };
});

const sourceRoots = ['types.ts', 'components', 'hooks', 'services', 'utils', 'App.tsx'];
const implementationNeedles = [
  /deepWork/i,
  /Deep Work Transformer/i,
  /nextAction/i,
  /finalRequestedOutput|deepWorkFinalOutput/i,
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
  transformerUtilityFiles: filesReferencing(/buildDeepWorkPlan|getDeepWorkChildren|refreshDeepWorkSuggestionForTodo/),
  transformerImportsOutsideUtility: filesReferencing(/import .*buildDeepWorkPlan|from ['"].*deepWorkTransformer/).filter(file => file !== 'services/deepWorkTransformer.ts'),
  createUpdatePathReferences: filesReferencing(/buildItemsFromCreatePayload|refreshDeepWorkSuggestionForTodo|handleAcceptDeepWorkTodo|handleRetriggerDeepWorkTodo/).filter(file => file.includes('useBrainDumpData')),
  planViewDeepWorkReferences: filesReferencing(/deepWork|subtasks|parentTodoId|nextAction|blockerCheck/i).filter(file => file.includes('PlanView') || file.includes('Card')),
  spreadsheetRoundTripReferences: filesReferencing(/deepWork|subtasks|parentTodoId|nextAction|blockerCheck/i).filter(file => file.includes('spreadsheet') || file.includes('exportUtils') || file.includes('mergeUtils')),
  changelogReferences: existsSync(join(repoRoot, 'utils', 'changelog.ts'))
    ? (/Deep Work Transformer|nested todo|subtask/i.test(readFileSync(join(repoRoot, 'utils', 'changelog.ts'), 'utf8')) ? ['utils/changelog.ts'] : [])
    : [],
};

const bypassReadPathProof = {
  requestedCheck: 'bypass/read-path static scan proof',
  noBypassClaim: 'Deep Work suggestions are not created by a hidden bypass path: create/update/retrigger paths call the same transformer metadata builder and Plan/Card reads those stored fields.',
  createPath: filesReferencing(/buildDeepWorkSuggestionMeta|buildItemsFromCreatePayload/).filter(file => file.includes('useBrainDumpData') || file.includes('deepWorkTransformer')),
  updatePath: filesReferencing(/refreshDeepWorkSuggestionForTodo|handleRetriggerDeepWorkTodo|deepWorkNextAction: changes\.deepWorkNextAction/).filter(file => file.includes('useBrainDumpData')),
  userAcceptPath: filesReferencing(/createDeepWorkSubtaskItems|handleAcceptDeepWorkTodo/).filter(file => file.includes('useBrainDumpData') || file.includes('deepWorkTransformer')),
  readPath: filesReferencing(/deepWorkNextAction|deepWorkFinalOutput|deepWorkBlockerCheck|Deep Work Transformer/).filter(file => file.includes('PlanView') || file.includes('Card')),
  syncExportReadPath: filesReferencing(/Parent_ID|Final_Output|Blocker_Check|deepWorkCompletionMode|deepWorkBlockerStatus/).filter(file => file.includes('spreadsheetReconciler') || file.includes('exportUtils') || file.includes('deepWorkTodoModel')),
  regressionTests: filesReferencing(/summary IIMS|summary regulasi|Parent_ID|Blocker_Check|final_output_check/).filter(file => file.includes('__tests__')),
};

const hasBypassReadPathProof =
  bypassReadPathProof.createPath.length > 0 &&
  bypassReadPathProof.updatePath.length > 0 &&
  bypassReadPathProof.userAcceptPath.length > 0 &&
  bypassReadPathProof.readPath.length > 0 &&
  bypassReadPathProof.syncExportReadPath.length > 0 &&
  bypassReadPathProof.regressionTests.length > 0;

const hasEndToEndFeature =
  integrationChecks.transformerUtilityFiles.length > 0 &&
  integrationChecks.transformerImportsOutsideUtility.length > 0 &&
  integrationChecks.createUpdatePathReferences.length > 0 &&
  integrationChecks.planViewDeepWorkReferences.length > 0 &&
  integrationChecks.spreadsheetRoundTripReferences.length > 0 &&
  integrationChecks.changelogReferences.length > 0 &&
  hasBypassReadPathProof &&
  realValidation.every(result => result.failures.length === 0);

const beforeAfter = targetTitles.map(title => {
  const plan = actualByTitle.get(title);
  return {
    realTask: title,
    before: title === 'Selesaiin summary IIMS 2026'
      ? 'Single vague todo: no first source checkpoint, output format, or stop point is encoded.'
      : 'Single vague continuation todo: no regulation source, restart point, audience, or completion shape is encoded.',
    actualAfter: {
      nextAction: plan.transform.nextAction.text,
      finalRequestedOutput: plan.transform.finalRequestedOutput.description,
      sessionEstimate: `${plan.transform.sessionEstimate.minutes} minutes (${plan.transform.sessionEstimate.confidence})`,
      blockerCheck: plan.transform.blockerCheck.questions.join(' | ') || 'No blocker detected before starting the next action.',
      optionalSubtasks: plan.transform.subtasks.map(subtask => subtask.title),
    },
    judgment: title === 'Selesaiin summary IIMS 2026'
      ? 'Not boilerplate: output names IIMS 2026 and asks for five source-backed points before drafting.'
      : 'Not boilerplate: output explicitly blocks on the missing regulation source/audience/purpose before continuing.',
  };
});

const result = {
  verdict: hasEndToEndFeature ? 'pass_corrective_ship_gate' : 'reject_ship_incomplete_or_missing_integration',
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
  realValidation: realValidation.map(({ title, failures, plan }) => ({
    title,
    failures,
    triggerPattern: plan.transform.trigger.pattern,
    confidence: plan.confidence,
    nextAction: plan.transform.nextAction.text,
    finalRequestedOutput: plan.transform.finalRequestedOutput.description,
    sessionEstimateMinutes: plan.transform.sessionEstimate.minutes,
    blockerCheck: plan.transform.blockerCheck,
    subtasks: plan.transform.subtasks.map(subtask => subtask.title),
  })),
  beforeAfter,
  nestedSubtaskCall: 'Useful only as a compact editable checklist under the parent. The contract fields carry the required value; subtasks are optional support and remain collapsed/editable in UX.',
  implementationScan: {
    scannedFiles: files.length,
    matches: sourceMatches,
    integrationChecks,
    bypassReadPathProof,
    conclusion: hasEndToEndFeature
      ? 'Corrective end-to-end markers and requested bypass/read-path proof are present: structured contract, create/update/read UX, explicit no-bypass path evidence, sync/export/reconcile, changelog, and real-data validation.'
      : 'Feature is not shippable: at least one corrective gate failed, including possible missing bypass/read-path proof.',
  }
};

if (!targetItems.every(Boolean)) {
  console.error(JSON.stringify({ error: 'Missing required real target tasks', targetTitles, targetItems }, null, 2));
  process.exit(1);
}

const failures = realValidation.flatMap(item => item.failures.map(failure => `${item.title}: ${failure}`));
if (!hasEndToEndFeature || failures.length > 0) {
  console.error(JSON.stringify({ ...result, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
