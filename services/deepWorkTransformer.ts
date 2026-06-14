import { BrainDumpItem, DeepWorkBlockerStatus, DeepWorkCompletionMode, DeepWorkOutputFormat, DeepWorkPattern, DeepWorkStatus, ItemMeta, ItemType, ParsedItemMetaV2 } from '../types';

export type DeepWorkConfidence = 'low' | 'medium' | 'high';

export type DeepWorkTransformSubtask = {
  title: string;
  estimateMinutes: number;
  doneCheck: string;
};

export type DeepWorkTransform = {
  status: 'suggested' | 'applied' | 'rejected';
  trigger: { pattern: DeepWorkPattern; evidence: string[]; confidence: DeepWorkConfidence };
  nextAction?: { text: string; durationMinutes: number; acceptanceCheck: string };
  finalRequestedOutput?: { format: DeepWorkOutputFormat; description: string; audience?: string };
  sessionEstimate?: { minutes: number; confidence: DeepWorkConfidence; reason: string };
  blockerCheck?: { blocked: boolean; questions: string[]; missingInputs: string[] };
  subtasks?: DeepWorkTransformSubtask[];
  rejectionReasons?: string[];
};

export type DeepWorkPlan = {
  shouldTransform: boolean;
  status: DeepWorkStatus;
  reason?: string;
  confidence: DeepWorkConfidence;
  transform: DeepWorkTransform;
  steps: string[];
  source: 'explicit_subtasks' | 'heuristic';
};

type PatternMatch = { pattern: DeepWorkPattern; evidence: string[] };

const MAX_SUBTASKS = 5;
const DEFAULT_COMPLETION_MODE: DeepWorkCompletionMode = 'final_output_check';

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();
const stripTrailingPunctuation = (value: string) => normalizeWhitespace(value).replace(/[.!?]+$/, '');
const unique = <T,>(values: T[]): T[] => Array.from(new Set(values));
const cleanStepTitle = (step: string) => stripTrailingPunctuation(step.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''));

const explicitListPattern = /(^|\n)\s*(?:[-*•]|\d+[.)])\s+\S+/;
const concreteErrandPattern = /\b(buy|beli|pay|bayar|transfer|top ?up|telepon|call|email|send|kirim|book|pesan|order|ambil|pick up|packing|pack|bawa|antar|jemput|isi bensin|laundry)\b/i;
const concreteArtifactPattern = /\b(rfq|invoice|faktur|kwitansi|surat|email draft|slide deck|notulen|meeting notes)\b/i;
const countPattern = /\b\d+\b/;
const timeboxPattern = /\b(\d+\s*(?:menit|min|minutes?|jam|hours?)|15m|25m|45m|60m|90m)\b/i;
const decisionOutputPattern = /\b(putuskan|decide|pilih|prioritize|prioritise|recommendation|rekomendasi)\b/i;
const explicitFinalOutputPattern = /\b(table|tabel|brief|memo|deck|slides?|email|draft|laporan|report|summary|rangkuman|ringkasan|bullet|checklist|daftar|matrix|matriks|notulen)\b/i;
const specificRegulationPattern = /\b(kepmen|komdigi|sdppi|permen|pp|uu|no\.?\s*\d+|nomor\s+\d+|tahun\s+\d{4})\b/i;

const patternMatchers: Array<{ pattern: DeepWorkPattern; regex: RegExp; label: string }> = [
  { pattern: 'regulation', regex: /\b(regulasi|peraturan|kepmen|komdigi|sdppi|legal|policy|compliance|aturan)\b/i, label: 'regulation/compliance wording' },
  { pattern: 'summary', regex: /\b(summary|summarize|rangkum|ringkas|rangkuman|ringkasan|resume|recap|synthesize|sintesis)\b/i, label: 'summary/synthesis wording' },
  { pattern: 'research', regex: /\b(research|riset|cari tau|cari tahu|pelajari|explore|benchmark|competitor|kompetitor|referensi)\b/i, label: 'research/discovery wording' },
  { pattern: 'review', regex: /\b(review|evaluasi|retrospective|retro|temuan|apa yang jelas|apa yang kabur)\b/i, label: 'review/reflection wording' },
  { pattern: 'continuation', regex: /\b(lanjut|lanjutkan|selesaiin|beresin|kerjain|progress|continue|finish)\b/i, label: 'continuation wording' },
  { pattern: 'decision', regex: decisionOutputPattern, label: 'decision wording' },
  { pattern: 'artifact', regex: /\b(bikin|buat|prepare|mapping|map|plan|skema|briefing|proposal|deck|draft|write|tulis|design|build|implement|integrate|ship|launch|migrate|refactor|debug|fix)\b/i, label: 'vague artifact/build wording' },
];

const concreteVerbs = ['open', 'read', 'extract', 'compare', 'list', 'draft', 'decide', 'send', 'ask', 'review', 'identify', 'collect', 'write'];
const startsWithConcreteVerb = (value: string) => concreteVerbs.includes(normalizeWhitespace(value).split(/\s+/)[0]?.toLowerCase());
const hasDetailedChecklist = (content: string) => explicitListPattern.test(content) || /\b(done when|acceptance|criteria|checklist|langkah|steps?:)\b/i.test(content);
const detectPatterns = (content: string): PatternMatch[] => patternMatchers.filter(({ regex }) => regex.test(content)).map(({ pattern, label }) => ({ pattern, evidence: [label] }));
const choosePrimaryPattern = (matches: PatternMatch[]): DeepWorkPattern => ['regulation', 'summary', 'research', 'review', 'continuation', 'decision', 'artifact'].find(pattern => matches.some(match => match.pattern === pattern)) as DeepWorkPattern || matches[0]?.pattern || 'artifact';

const hasConcreteScope = (content: string): boolean => {
  const hasCount = countPattern.test(content);
  const hasDimensions = /\b(style|harga|material|audience|sinyal|scope|owner|deadline|criteria|kriteria|what changed|impact|follow-up|follow up)\b/i.test(content);
  const hasConnectorToOutput = /\b(lalu|then|and then|output|hasilnya|deliverable)\b/i.test(content);
  return (hasCount && hasDimensions && hasConnectorToOutput) || (timeboxPattern.test(content) && /\b(apa yang|questions?|pertanyaan|jelas|kabur|dibuang)\b/i.test(content));
};

const inferTopic = (content: string): string => {
  const topic = stripTrailingPunctuation(content)
    .replace(/\b(selesaiin|lanjut|lanjutkan|beresin|kerjain|finish|continue)\b/ig, '')
    .replace(/\b(summary|summarize|rangkum|ringkas|rangkuman|ringkasan|resume|recap|synthesize|riset|research|review|cari tau|cari tahu)\b/ig, '')
    .trim();
  return topic || stripTrailingPunctuation(content);
};

const inferConfidence = (content: string, pattern: DeepWorkPattern, hasFinalOutput: boolean, hasEstimate: boolean): DeepWorkConfidence => {
  if (pattern === 'regulation' && !specificRegulationPattern.test(content)) return 'low';
  if (hasFinalOutput && hasEstimate) return 'high';
  if (specificRegulationPattern.test(content) || /\bIIMS\b/i.test(content)) return 'medium';
  if (pattern === 'continuation') return 'low';
  return 'medium';
};

const inferFinalOutput = (content: string, pattern: DeepWorkPattern): NonNullable<DeepWorkTransform['finalRequestedOutput']> => {
  const topic = inferTopic(content);
  if (pattern === 'regulation' || /\b(regulasi|kepmen|komdigi|sdppi)\b/i.test(content)) {
    return { format: 'table', description: specificRegulationPattern.test(content) ? `A regulation summary table for ${topic}: reference, what changed, impact, required follow-up, and open questions.` : 'A regulation summary table: rule/reference, what changed, impact, required follow-up, and open questions.' };
  }
  if (pattern === 'research') return { format: 'brief', description: `A concise research brief for ${topic} with findings, tradeoffs, risks, and recommended next actions.` };
  if (pattern === 'decision') return { format: 'decision_memo', description: `A decision memo that names the options, criteria, chosen path, and immediate follow-up for ${topic}.` };
  if (pattern === 'review') return { format: 'notes', description: `Review notes for ${topic} that separate what is clear, what is still unclear, and what to do next.` };
  if (/\brecap\b/i.test(content)) return { format: 'brief', description: `A concise ${topic} recap with key decisions, changes, follow-ups, and unresolved questions.` };
  if (pattern === 'summary' || /\b(summary|rangkum|ringkas|recap)\b/i.test(content)) return { format: 'brief', description: `A concise ${topic} summary with key points, implications, and follow-up questions or actions.` };
  return { format: 'brief', description: `A clear finished artifact for ${topic}, with enough detail to know the task is done.` };
};

const inferNextAction = (content: string, pattern: DeepWorkPattern): NonNullable<DeepWorkTransform['nextAction']> => {
  const topic = inferTopic(content);
  if (/\brecap\b/i.test(content)) return { text: `Open the source notes for ${topic} and list the 5 moments, decisions, or changes worth recapping`, durationMinutes: 25, acceptanceCheck: 'Five recap candidates are listed with source/context notes' };
  if (/\bsummary\b/i.test(content) && /\bIIMS\b/i.test(content)) return { text: 'Open the IIMS 2026 notes/source material and mark the 5 points worth summarizing', durationMinutes: 25, acceptanceCheck: 'Five candidate points are listed with source references' };
  if (/\b(regulasi|peraturan)\b/i.test(content) && !specificRegulationPattern.test(content)) return { text: 'Identify the exact regulation source and write the title/date/version at the top of the working note', durationMinutes: 15, acceptanceCheck: 'The regulation source is named and linked or copied into the working note' };
  if (/\bkepmen\b/i.test(content) || (specificRegulationPattern.test(content) && /\b(komdigi|sdppi|regulasi|peraturan)\b/i.test(content))) return { text: `Open ${topic} and extract the 5 clauses that change obligations or workflow`, durationMinutes: 30, acceptanceCheck: 'Five relevant clauses are listed with references and initial impact notes' };
  if (pattern === 'research') return { text: `List the decision question ${topic} needs to answer before collecting sources`, durationMinutes: 20, acceptanceCheck: 'The research question, scope, and source list are written down' };
  if (pattern === 'review') return { text: `Review the current notes for ${topic} and separate clear findings from unclear points`, durationMinutes: 30, acceptanceCheck: 'Clear findings, unclear points, and next decisions are listed separately' };
  if (decisionOutputPattern.test(content)) return { text: `List the options and decision criteria for ${topic}`, durationMinutes: 25, acceptanceCheck: 'Options and criteria are visible before choosing a path' };
  return { text: `Open the current working material for ${topic} and define the first concrete output`, durationMinutes: 25, acceptanceCheck: 'The source/context and first output checkpoint are written down' };
};

const inferBlockerCheck = (content: string, pattern: DeepWorkPattern): NonNullable<DeepWorkTransform['blockerCheck']> => {
  const questions: string[] = [];
  const missingInputs: string[] = [];
  if ((pattern === 'regulation' || /\bregulasi\b/i.test(content)) && !specificRegulationPattern.test(content)) {
    questions.push('Regulasi yang mana?', 'Need summary for self, boss, or submission?', 'Is the goal understanding, compliance action, or presentation?');
    missingInputs.push('specific regulation', 'audience', 'purpose');
  } else if (/\bsummary|rangkum|ringkas|recap\b/i.test(content)) {
    if (!/\b(link|doc|file|notes?|source|kepmen|IIMS|sdppi|komdigi|no\.?\s*\d+)\b/i.test(content)) { questions.push('Which source should be summarized?'); missingInputs.push('source material'); }
    if (!/\b(for|untuk|buat boss|submission|email|slides?|brief)\b/i.test(content)) { questions.push('Who is the summary for?'); missingInputs.push('audience/output format'); }
  } else if (pattern === 'research') {
    if (!decisionOutputPattern.test(content)) { questions.push('What decision should this research support?'); missingInputs.push('decision question'); }
  } else if (pattern === 'decision') {
    questions.push('What options and criteria should be compared?'); missingInputs.push('options', 'decision criteria');
  } else if (pattern === 'artifact') {
    questions.push('What format counts as finished?'); missingInputs.push('final format');
  }
  return { blocked: missingInputs.length > 0, questions: questions.slice(0, 3), missingInputs: unique(missingInputs).slice(0, 4) };
};

const inferSessionEstimate = (content: string, confidence: DeepWorkConfidence, blockerCheck: NonNullable<DeepWorkTransform['blockerCheck']>): NonNullable<DeepWorkTransform['sessionEstimate']> => {
  if (/\b(regulasi|kepmen|komdigi|sdppi)\b/i.test(content)) return { minutes: blockerCheck.blocked ? 75 : 60, confidence: blockerCheck.blocked ? 'low' : confidence, reason: blockerCheck.blocked ? 'Regulation scope or audience is missing.' : 'Specific regulation work usually needs one focused reading-and-summary session.' };
  if (/\bIIMS\b/i.test(content)) return { minutes: 60, confidence, reason: 'Summary topic is visible, but source volume and audience may still vary.' };
  if (timeboxPattern.test(content)) {
    const match = content.match(/\b(\d+)\s*(?:menit|min|minutes?|m)\b/i);
    const minutes = match ? Number(match[1]) : 45;
    return { minutes: Math.min(Math.max(minutes, 15), 90), confidence: 'high', reason: 'The task already includes an explicit timebox.' };
  }
  return { minutes: confidence === 'low' ? 45 : 60, confidence, reason: confidence === 'low' ? 'Scope is unclear, so estimate covers only the first unblock-and-start session.' : 'One focused session should produce the first useful draft or checkpoint.' };
};

const buildSubtasks = (content: string, pattern: DeepWorkPattern, nextAction: NonNullable<DeepWorkTransform['nextAction']>, finalOutput: NonNullable<DeepWorkTransform['finalRequestedOutput']>, explicitSubtasks?: string[]): DeepWorkTransformSubtask[] => {
  const explicit = unique((explicitSubtasks || []).map(cleanStepTitle).filter(Boolean)).filter(step => step.toLowerCase() !== stripTrailingPunctuation(content).toLowerCase()).slice(0, MAX_SUBTASKS).map(title => ({ title, estimateMinutes: 25, doneCheck: `${title} is complete and usable for the final output` }));
  if (explicit.length > 0) return explicit;
  if (pattern === 'regulation' || /\b(regulasi|kepmen|komdigi|sdppi)\b/i.test(content)) return [
    { title: nextAction.text, estimateMinutes: nextAction.durationMinutes, doneCheck: nextAction.acceptanceCheck },
    { title: 'Extract clauses that affect work, obligations, deadlines, or decisions', estimateMinutes: 30, doneCheck: 'Relevant clauses are listed with references' },
    { title: 'Write the impact/action table', estimateMinutes: 30, doneCheck: 'Each clause has impact, follow-up, and open questions where needed' },
  ];
  if (pattern === 'research') return [
    { title: nextAction.text, estimateMinutes: nextAction.durationMinutes, doneCheck: nextAction.acceptanceCheck },
    { title: 'Gather the relevant sources or examples', estimateMinutes: 30, doneCheck: 'Sources are captured with short notes' },
    { title: 'Compare findings and call out tradeoffs or risks', estimateMinutes: 30, doneCheck: 'Findings are grouped into decision-useful themes' },
    { title: 'Write the recommendation or next-action summary', estimateMinutes: 20, doneCheck: finalOutput.description },
  ];
  if (pattern === 'summary') return [
    { title: nextAction.text, estimateMinutes: nextAction.durationMinutes, doneCheck: nextAction.acceptanceCheck },
    { title: 'Extract the key points, numbers, dates, and unresolved questions', estimateMinutes: 25, doneCheck: 'Key points have enough context to draft from' },
    { title: 'Draft the final summary in the target format', estimateMinutes: 25, doneCheck: finalOutput.description },
  ];
  return [
    { title: nextAction.text, estimateMinutes: nextAction.durationMinutes, doneCheck: nextAction.acceptanceCheck },
    { title: 'List constraints, inputs, and missing information', estimateMinutes: 20, doneCheck: 'Constraints and missing inputs are explicit' },
    { title: 'Produce the first complete checkpoint for the final output', estimateMinutes: 35, doneCheck: finalOutput.description },
  ];
};

const reject = (content: string, reasons: string[], matches: PatternMatch[] = []): DeepWorkPlan => {
  const transform: DeepWorkTransform = { status: 'rejected', trigger: { pattern: choosePrimaryPattern(matches), evidence: matches.flatMap(match => match.evidence), confidence: 'low' }, rejectionReasons: reasons };
  return { shouldTransform: false, status: 'dismissed', reason: reasons.join(' '), confidence: 'low', transform, steps: [], source: 'heuristic' };
};

const validateTransform = (content: string, transform: DeepWorkTransform): string[] => {
  const reasons: string[] = [];
  const parent = stripTrailingPunctuation(content).toLowerCase();
  const nextAction = transform.nextAction?.text || '';
  if (!nextAction || !startsWithConcreteVerb(nextAction)) reasons.push('Next action must start with a concrete verb.');
  if (!transform.finalRequestedOutput?.description) reasons.push('Final requested output is missing.');
  if (!transform.sessionEstimate?.minutes) reasons.push('Session estimate is missing.');
  if (!transform.blockerCheck) reasons.push('Blocker check is missing.');
  if (nextAction && stripTrailingPunctuation(nextAction).toLowerCase() === parent) reasons.push('Next action repeats the parent title.');
  if ((transform.subtasks || []).some(subtask => stripTrailingPunctuation(subtask.title).toLowerCase() === parent)) reasons.push('A subtask repeats the parent title.');
  return reasons;
};

export const analyzeDeepWorkTodo = (content: string, meta?: Pick<ParsedItemMetaV2, 'subtasks'>): DeepWorkPlan => {
  const normalizedContent = stripTrailingPunctuation(content);
  const matches = detectPatterns(normalizedContent);
  const explicitSubtasks = unique((meta?.subtasks || []).map(cleanStepTitle).filter(Boolean)).slice(0, MAX_SUBTASKS);
  if (!normalizedContent) return reject(content, ['Empty todo content cannot be transformed.'], matches);
  if (concreteErrandPattern.test(normalizedContent)) return reject(content, ['Concrete errand/simple physical task; deep-work breakdown would add noise.'], matches);
  if (concreteArtifactPattern.test(normalizedContent) && !matches.some(match => match.pattern === 'continuation')) return reject(content, ['Concrete artifact is already clear enough for direct execution.'], matches);
  if (hasDetailedChecklist(content)) return reject(content, ['Task already contains checklist or acceptance criteria.'], matches);
  if (matches.length === 0 && explicitSubtasks.length === 0) return reject(content, ['No abstract/stuck-task pattern detected.'], matches);
  if (hasConcreteScope(normalizedContent) && explicitSubtasks.length === 0) return reject(content, ['Task already has count/scope/output or timebox; no automatic breakdown needed.'], matches);

  const pattern = choosePrimaryPattern(matches);
  const confidence = explicitSubtasks.length > 0 ? 'medium' : inferConfidence(normalizedContent, pattern, explicitFinalOutputPattern.test(normalizedContent), timeboxPattern.test(normalizedContent));
  const nextAction = inferNextAction(normalizedContent, pattern);
  const finalRequestedOutput = inferFinalOutput(normalizedContent, pattern);
  const blockerCheck = inferBlockerCheck(normalizedContent, pattern);
  const sessionEstimate = inferSessionEstimate(normalizedContent, confidence, blockerCheck);
  const subtasks = buildSubtasks(normalizedContent, pattern, nextAction, finalRequestedOutput, explicitSubtasks).slice(0, MAX_SUBTASKS);
  const transform: DeepWorkTransform = { status: 'suggested', trigger: { pattern, evidence: unique(matches.flatMap(match => match.evidence).concat(explicitSubtasks.length ? ['parser supplied subtasks'] : [])), confidence }, nextAction, finalRequestedOutput, sessionEstimate, blockerCheck, subtasks };
  const rejectionReasons = validateTransform(normalizedContent, transform);
  if (rejectionReasons.length > 0) return reject(content, rejectionReasons, matches);
  return { shouldTransform: true, status: 'suggested', reason: confidence === 'low' ? 'Low-confidence abstract task: surface as editable guidance only.' : 'Abstract/stuck todo has enough structure for a useful suggested breakdown.', confidence, transform, steps: subtasks.map(subtask => subtask.title), source: explicitSubtasks.length > 0 ? 'explicit_subtasks' : 'heuristic' };
};

export const buildDeepWorkPlan = analyzeDeepWorkTodo;

export const buildDeepWorkSuggestionMeta = (content: string, meta: ItemMeta = {}): ItemMeta => {
  if (meta.deepWorkStatus === 'dismissed' || meta.parentTodoId) return meta;
  const plan = analyzeDeepWorkTodo(content, meta);
  if (!plan.shouldTransform || !plan.transform.nextAction || !plan.transform.finalRequestedOutput || !plan.transform.sessionEstimate || !plan.transform.blockerCheck) return meta;
  const blockerStatus: DeepWorkBlockerStatus = plan.transform.blockerCheck.blocked ? (plan.confidence === 'low' ? 'needs_input' : 'blocked') : 'clear';
  return { ...meta, deepWorkParent: true, deepWorkStatus: 'suggested', deepWorkTriggerPattern: plan.transform.trigger.pattern, deepWorkTriggerEvidence: plan.transform.trigger.evidence, deepWorkConfidence: plan.confidence, deepWorkNextAction: plan.transform.nextAction.text, deepWorkNextActionDurationMinutes: plan.transform.nextAction.durationMinutes, deepWorkNextActionAcceptanceCheck: plan.transform.nextAction.acceptanceCheck, deepWorkFinalOutputFormat: plan.transform.finalRequestedOutput.format, deepWorkFinalOutput: plan.transform.finalRequestedOutput.description, deepWorkSessionEstimateMinutes: plan.transform.sessionEstimate.minutes, deepWorkSessionEstimateConfidence: plan.transform.sessionEstimate.confidence, deepWorkSessionEstimateReason: plan.transform.sessionEstimate.reason, deepWorkBlockerCheck: plan.transform.blockerCheck.questions.join(' | ') || 'No blocker detected before starting the next action.', deepWorkBlockerStatus: blockerStatus, deepWorkMissingInputs: plan.transform.blockerCheck.missingInputs, deepWorkCompletionMode: meta.deepWorkCompletionMode || DEFAULT_COMPLETION_MODE, deepWorkGeneratedAt: meta.deepWorkGeneratedAt || new Date().toISOString(), deepWorkReason: plan.reason, subtasks: plan.transform.subtasks?.map(subtask => subtask.title) };
};

export const createDeepWorkSubtaskItems = (parent: BrainDumpItem, idFactory: () => string, now = new Date().toISOString()): BrainDumpItem[] => {
  const canCreateNestedSubtasks = parent.type === ItemType.TODO || (parent.type === ItemType.SKILLS && parent.meta.isRoutine === true);
  if (!canCreateNestedSubtasks) return [];
  const plan = analyzeDeepWorkTodo(parent.content, parent.meta);
  const subtaskTitles = parent.meta.subtasks?.length ? parent.meta.subtasks : plan.transform.subtasks?.map(subtask => subtask.title) || [];
  if ((parent.meta.childTodoIds?.length || 0) > 0 || subtaskTitles.length === 0) return [];
  const stepCount = Math.min(subtaskTitles.length, MAX_SUBTASKS);
  const inheritedTags = parent.type === ItemType.SKILLS
    ? Array.from(new Set([...(parent.meta.tags || []), 'skills', 'routine']))
    : parent.meta.tags || [];
  const inheritedDate = parent.meta.date || parent.meta.skillScheduledDate || parent.meta.start;
  return subtaskTitles.slice(0, MAX_SUBTASKS).map((title, index) => {
    const transformSubtask = plan.transform.subtasks?.[index];
    return { id: idFactory(), type: ItemType.TODO, content: title, status: 'pending' as const, created_at: now, meta: { tags: inheritedTags, date: inheritedDate, priority: parent.meta.priority || 'normal', parentTodoId: parent.id, deepWorkParent: false, deepWorkPlanId: parent.meta.deepWorkPlanId || parent.id, deepWorkStatus: 'active' as DeepWorkStatus, deepWorkStepIndex: index + 1, deepWorkStepCount: stepCount, deepWorkGeneratedAt: now, deepWorkReason: parent.meta.deepWorkReason, deepWorkSessionEstimateMinutes: transformSubtask?.estimateMinutes, deepWorkNextActionAcceptanceCheck: transformSubtask?.doneCheck } };
  });
};

export const getDeepWorkChildren = (items: BrainDumpItem[], parentId: string) => items.filter(item => item.type === ItemType.TODO && item.meta.parentTodoId === parentId).sort((a, b) => (a.meta.deepWorkStepIndex || 0) - (b.meta.deepWorkStepIndex || 0));
