import {
  BrainDumpItem,
  BudgetRule,
  ParserResultV2,
  ParserRouterDecisionMetadata,
  ParserRouterRoute,
  Skill,
  Wallet,
  ParserBatchItemStatus,
  ParserBatchMetadata,
  ParserModelRoutingMetadata,
} from '../types';
import { classifyLocalIntent, normalizeDeepParserOutput, routeParserInput, type DeepParserOutput, type LocalClassifierContext, type ParserRouterOutput } from './parserRouter';

export interface ParserBatchCandidate {
  id: string;
  index: number;
  sourceText: string;
  startLine: number;
  endLine: number;
}

type BatchDeepParser = (text: string, candidates: ParserBatchCandidate[]) => Promise<DeepParserOutput>;

type BatchRouteContext = LocalClassifierContext & {
  existingTags?: string[];
  availableSkills?: Skill[];
  availableWallets?: Wallet[];
  availableBudgetRules?: BudgetRule[];
  existingItems?: BrainDumpItem[];
};

const LIST_MARKER_RE = /^\s*(?:[-*•]|(?:\d+|[a-zA-Z])[.)])\s+/;
const LONGFORM_PREFIX_RE = /^(note|catatan|idea|ide|journal|jurnal|diary)\s*[:\-]/;
const AMOUNT_RE = /\b(?:rp|idr)?\s*\d+(?:[.,]\d{3})*(?:[.,]\d+)?\s*(?:ribu|rb|k|juta|jt|mio|m)?\b/i;

const normalizeCandidate = (text: string): string => text.replace(LIST_MARKER_RE, '').trim();
const compact = (text: string): string => text.replace(/\s+/g, ' ').trim();

const hasItemLikeSignal = (text: string): boolean => {
  const normalized = compact(text).toLowerCase();
  if (!normalized) return false;
  if (/^(todo|task|tugas|remind me to|ingatkan|shopping|belanja|buy|beli|note|catatan|idea|ide|journal|jurnal|event|calendar|jadwal|schedule|finance|expense|income|pemasukan|transfer|tf|trf|saving|savings|tabung|nabung)\b/.test(normalized)) return true;
  if (/\b(expense|spent|paid|bayar|income|gaji|salary|bonus|refund|transfer|topup|tarik tunai|setor|saving|nabung|meeting|rapat)\b/.test(normalized)) return true;
  if (AMOUNT_RE.test(normalized)) return true;
  return false;
};

const hasStrongItemPrefix = (text: string): boolean => {
  const normalized = compact(normalizeCandidate(text)).toLowerCase();
  if (!normalized) return false;
  if (/^(todo|task|tugas|remind me to|ingatkan|shopping|belanja|buy|beli|note|catatan|idea|ide|journal|jurnal|event|calendar|jadwal|schedule|finance|expense|income|pemasukan|gaji|salary|bonus|refund|transfer|tf|trf|saving|savings|tabung|nabung)\b/.test(normalized)) return true;
  if (/^(bayar|paid|spent)\b/.test(normalized) && !/^(paid attention|spent time)\b/.test(normalized) && AMOUNT_RE.test(normalized)) return true;
  return false;
};

const shouldPreserveLongformNote = (parts: string[]): boolean => {
  const normalizedParts = parts.map(part => compact(normalizeCandidate(part))).filter(Boolean);
  if (normalizedParts.length <= 1) return false;
  if (!LONGFORM_PREFIX_RE.test(normalizedParts[0].toLowerCase())) return false;
  return normalizedParts.slice(1).every(part => !hasStrongItemPrefix(part));
};

const makeCandidate = (sourceText: string, index: number, startLine: number, endLine = startLine): ParserBatchCandidate => ({
  id: `item-${index + 1}`,
  index,
  sourceText: compact(sourceText),
  startLine,
  endLine,
});

export const splitParserBatchInput = (rawText: string): ParserBatchCandidate[] => {
  const text = rawText.replace(/\r\n/g, '\n').trim();
  if (!text) return [];

  const rawLines = text.split('\n');
  const nonEmpty = rawLines
    .map((line, idx) => ({ line: line.trim(), lineNo: idx + 1 }))
    .filter(entry => entry.line.length > 0);

  if (nonEmpty.length > 1) {
    const bulletCount = nonEmpty.filter(entry => LIST_MARKER_RE.test(entry.line)).length;
    const signaledCount = nonEmpty.filter(entry => hasItemLikeSignal(normalizeCandidate(entry.line))).length;

    const shortCaptureLines = nonEmpty.length <= 8 && nonEmpty.every(entry => entry.line.length <= 160);
    if (!shouldPreserveLongformNote(nonEmpty.map(entry => entry.line)) && (bulletCount >= 2 || signaledCount >= 2 || (signaledCount >= 1 && shortCaptureLines))) {
      return nonEmpty.map((entry, idx) => makeCandidate(normalizeCandidate(entry.line), idx, entry.lineNo));
    }

    const blocks: Array<{ text: string; startLine: number; endLine: number }> = [];
    let current: string[] = [];
    let startLine = 1;
    rawLines.forEach((line, idx) => {
      if (line.trim()) {
        if (current.length === 0) startLine = idx + 1;
        current.push(line.trim());
        return;
      }
      if (current.length > 0) {
        blocks.push({ text: current.join(' '), startLine, endLine: idx });
        current = [];
      }
    });
    if (current.length > 0) blocks.push({ text: current.join(' '), startLine, endLine: rawLines.length });
    if (blocks.length > 1 && blocks.filter(block => hasItemLikeSignal(block.text)).length >= 2) {
      return blocks.map((block, idx) => makeCandidate(block.text, idx, block.startLine, block.endLine));
    }
  }

  const singleLineParts = text
    .split(/\s*(?:;|•)\s*/)
    .map(part => normalizeCandidate(part))
    .filter(Boolean);
  if (singleLineParts.length > 1 && !shouldPreserveLongformNote(singleLineParts) && singleLineParts.filter(hasItemLikeSignal).length >= 2) {
    return singleLineParts.map((part, idx) => makeCandidate(part, idx, 1));
  }

  return [makeCandidate(text, 0, 1, rawLines.length)];
};

const annotateResult = (result: ParserResultV2, candidate: ParserBatchCandidate): ParserResultV2 => ({
  ...result,
  targetText: result.targetText || candidate.sourceText,
  batchItem: {
    id: candidate.id,
    index: candidate.index,
    sourceText: candidate.sourceText,
    startLine: candidate.startLine,
    endLine: candidate.endLine,
  },
});

const unknownForCandidate = (candidate: ParserBatchCandidate, reviewReason: string): ParserResultV2 => annotateResult({
  action: 'unknown',
  entityType: 'unknown',
  content: candidate.sourceText,
  confidence: 'low',
  needsReview: true,
  reviewReason,
}, candidate);

const batchTextForAi = (candidates: ParserBatchCandidate[]): string => candidates
  .map(candidate => `${candidate.index + 1}. ${candidate.sourceText}`)
  .join('\n');

const matchDeepResultToCandidate = (result: ParserResultV2, candidates: ParserBatchCandidate[]): ParserBatchCandidate | undefined => {
  if (result.batchItem) {
    return candidates.find(candidate => candidate.index === result.batchItem?.index || candidate.id === result.batchItem?.id);
  }
  const target = compact(result.targetText || result.content || '').toLowerCase();
  if (!target) return undefined;
  return candidates.find(candidate => candidate.sourceText.toLowerCase() === target);
};

const assignDeepResults = (results: ParserResultV2[], candidates: ParserBatchCandidate[]): Map<number, ParserResultV2[]> => {
  const byIndex = new Map<number, ParserResultV2[]>();
  const remaining = [...candidates];

  results.forEach(result => {
    const hasExplicitBatchRef = result.batchItem?.id !== undefined || result.batchItem?.index !== undefined;
    const matched = hasExplicitBatchRef
      ? matchDeepResultToCandidate(result, candidates)
      : (matchDeepResultToCandidate(result, remaining) || remaining[0]);
    if (!matched) return;
    if (!hasExplicitBatchRef) {
      const remainingIndex = remaining.findIndex(candidate => candidate.index === matched.index);
      if (remainingIndex >= 0) remaining.splice(remainingIndex, 1);
    }
    byIndex.set(matched.index, [...(byIndex.get(matched.index) || []), annotateResult(result, matched)]);
  });

  return byIndex;
};

const routeRank: Record<ParserRouterRoute, number> = { local_save: 0, review: 1, deep_ai: 2 };

export const routeBatchParserInput = async (
  text: string,
  ctx: BatchRouteContext,
  deepBatchParser: BatchDeepParser,
): Promise<ParserRouterOutput> => {
  const candidates = splitParserBatchInput(text);
  if (candidates.length <= 1) {
    return routeParserInput(text, ctx, () => deepBatchParser(text, candidates));
  }

  const resultsByIndex = new Map<number, ParserResultV2[]>();
  const items: ParserBatchMetadata['items'] = [];
  const ambiguousCandidates: ParserBatchCandidate[] = [];
  let highestRoute: ParserRouterRoute = 'local_save';

  for (const candidate of candidates) {
    const local = classifyLocalIntent(candidate.sourceText, ctx);
    let status: ParserBatchItemStatus = 'local_saved';

    if (local.route === 'deep_ai' || !local.result) {
      ambiguousCandidates.push(candidate);
      status = 'ai_pending';
      highestRoute = 'deep_ai';
    } else {
      status = local.route === 'review' ? 'local_review' : 'local_saved';
      highestRoute = routeRank[local.route] > routeRank[highestRoute] ? local.route : highestRoute;
      resultsByIndex.set(candidate.index, [annotateResult(local.result, candidate)]);
    }

    items.push({
      id: candidate.id,
      index: candidate.index,
      sourceText: candidate.sourceText,
      startLine: candidate.startLine,
      endLine: candidate.endLine,
      status,
      route: local.route,
      intent: local.intent,
      reasonCodes: local.reasonCodes,
      resultCount: local.result ? 1 : 0,
    });
  }

  let aiCallCount = 0;
  let modelRouting: ParserModelRoutingMetadata | undefined;
  if (ambiguousCandidates.length > 0) {
    aiCallCount = 1;
    try {
      const aiResponse = normalizeDeepParserOutput(await deepBatchParser(batchTextForAi(ambiguousCandidates), ambiguousCandidates));
      const aiResults = aiResponse.results;
      modelRouting = aiResponse.modelRouting;
      if (modelRouting?.aiCallCount) aiCallCount = modelRouting.aiCallCount;
      const assigned = assignDeepResults(aiResults, ambiguousCandidates);

      ambiguousCandidates.forEach(candidate => {
        const assignedResults = assigned.get(candidate.index) || [];
        const finalResults = assignedResults.length > 0
          ? assignedResults
          : [unknownForCandidate(candidate, 'AI batch parser returned no structured result for this item.')];
        resultsByIndex.set(candidate.index, finalResults);
        const item = items.find(next => next.index === candidate.index);
        if (item) {
          item.status = finalResults.some(result => result.action === 'unknown' || result.needsReview) ? 'ai_review' : 'ai_saved';
          item.resultCount = finalResults.length;
        }
      });
    } catch (error: any) {
      ambiguousCandidates.forEach(candidate => {
        const failure = unknownForCandidate(candidate, error?.message || 'AI batch parser failed for this item.');
        resultsByIndex.set(candidate.index, [failure]);
        const item = items.find(next => next.index === candidate.index);
        if (item) {
          item.status = 'failed';
          item.error = failure.reviewReason;
          item.resultCount = 1;
        }
      });
    }
  }

  const orderedResults = candidates.flatMap(candidate => resultsByIndex.get(candidate.index) || []);
  const failedItemCount = items.filter(item => item.status === 'failed').length;
  const reviewItemCount = items.filter(item => item.status === 'local_review' || item.status === 'ai_review' || item.status === 'failed').length;
  const localItemCount = items.filter(item => item.status === 'local_saved' || item.status === 'local_review').length;
  const aiItemCount = items.filter(item => item.status === 'ai_saved' || item.status === 'ai_review' || item.status === 'failed').length;

  const decision: ParserRouterDecisionMetadata = {
    route: highestRoute,
    intent: 'mixed',
    confidenceScore: ambiguousCandidates.length > 0 ? 0.65 : reviewItemCount > 0 ? 0.72 : 0.95,
    reasonCodes: [
      'batch_input',
      `batch_items_${candidates.length}`,
      `batch_local_items_${localItemCount}`,
      `batch_ai_items_${ambiguousCandidates.length}`,
    ],
    batch: {
      id: `batch-${candidates.length}-${candidates[0]?.startLine || 1}`,
      itemCount: candidates.length,
      localItemCount,
      reviewItemCount,
      aiItemCount,
      failedItemCount,
      aiCallCount,
      modelRouting,
      items,
    },
    modelRouting,
  };

  return { decision, results: orderedResults };
};
