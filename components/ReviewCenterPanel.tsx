import React from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
import PendingReviewList from './PendingReviewList';
import {
  ParserResultV2,
  ParsingTask,
  EnrichmentTask,
} from '../types';
import {
  getParserResultDetails,
  getParserResultSummary,
  getParserTaskDuplicateSummary,
  parserActionDestination,
  shouldShowParserTaskInReviewCenter,
} from '../utils/parserResultSummary';

interface ReviewCenterPanelProps {
  parsingTasks?: ParsingTask[];
  enrichmentTasks?: EnrichmentTask[];
  pendingReviews?: { id: string; text: string; results: ParserResultV2[] }[];
  onApproveReview?: (id: string, updatedResults: ParserResultV2[]) => void;
  onRejectReview?: (id: string) => void;
  retryParsing?: (id: string) => void;
  clearParsingTask?: (id: string) => void;
  undoParsingTask?: (id: string) => void;
  deleteParsingTaskEntries?: (id: string) => void;
}

const createsSavedEntry = (result: ParserResultV2) => (
  result.action === 'create_item' ||
  result.action === 'transfer_money' ||
  result.action === 'add_saving_funds' ||
  result.action === 'unknown'
);

const formatBatchSummary = (task: ParsingTask): string | undefined => {
  const batch = task.batch || task.routerDecision?.batch;
  if (!batch) return undefined;
  const reviewText = batch.reviewItemCount ? ` · ${batch.reviewItemCount} review` : '';
  const failedText = batch.failedItemCount ? ` · ${batch.failedItemCount} failed` : '';
  return `Batch parse: ${batch.itemCount} items · ${batch.localItemCount} local · ${batch.aiItemCount} AI fallback · ${batch.aiCallCount} AI batch call${batch.aiCallCount === 1 ? '' : 's'}${reviewText}${failedText}`;
};

const formatModelRoutingSummary = (task: ParsingTask): string | undefined => {
  const routing = task.routerDecision?.modelRouting || task.routerDecision?.batch?.modelRouting || task.batch?.modelRouting;
  if (!routing || !routing.enabled) return undefined;
  const tier = routing.selectedTier === 'fast_extraction' ? 'fast extraction' : 'deep parse';
  const escalation = routing.escalationReasonCodes.length ? ` · escalated: ${routing.escalationReasonCodes.join(', ')}` : '';
  const warnings = routing.warnings?.length ? ` · warnings: ${routing.warnings.join(', ')}` : '';
  return `Model routing: ${tier} (${routing.finalModel || 'unknown model'}) · fast=${routing.fastModel || 'n/a'} · deep=${routing.deepModel || 'n/a'} · AI calls=${routing.aiCallCount}${escalation}${warnings}`;
};

const ParsingResultDetails: React.FC<{ result: ParserResultV2; index?: number }> = ({ result, index = 0 }) => {
  const attrs = getParserResultDetails(result);
  const summary = getParserResultSummary(result);
  const confidenceColor =
    result.confidence === 'high' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
    result.confidence === 'medium' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
    'text-red-500 bg-red-500/10 border-red-500/20';

  return (
    <div className="rounded-lg border border-border bg-background/70 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-bold uppercase tracking-wide">
          {result.batchItem ? `Item ${result.batchItem.index + 1}` : `${index + 1}.`} {parserActionDestination(result)}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-muted capitalize">
          {result.action.replace(/_/g, ' ')}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-muted capitalize">
          {result.entityType}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${confidenceColor}`}>
          {result.confidence}
        </span>
      </div>

      {result.batchItem && (
        <div className="rounded-md bg-indigo-500/5 border border-indigo-500/15 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wide text-indigo-600 font-bold">Batch source</div>
          <div className="text-[11px] text-primary font-medium leading-snug">{result.batchItem.sourceText}</div>
        </div>
      )}

      <div className="rounded-md bg-emerald-500/5 border border-emerald-500/15 px-2 py-1.5">
        <div className="text-[9px] uppercase tracking-wide text-emerald-600 font-bold">Result summary</div>
        <div className="text-[11px] text-primary font-medium leading-snug">{summary.title}</div>
      </div>

      {attrs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {attrs.slice(0, 14).map(([key, value]) => (
            <div key={`${key}-${value}`} className="min-w-0 rounded-md bg-surface/70 border border-border px-2 py-1">
              <div className="text-[9px] uppercase tracking-wide text-muted font-bold truncate">{key}</div>
              <div className="text-[11px] text-primary font-medium truncate" title={value}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {result.reviewReason && (
        <p className="text-[10px] text-amber-500 leading-tight">{result.reviewReason}</p>
      )}
    </div>
  );
};

const ReviewCenterPanel: React.FC<ReviewCenterPanelProps> = ({
  parsingTasks = [],
  enrichmentTasks = [],
  pendingReviews = [],
  onApproveReview,
  onRejectReview,
  retryParsing,
  clearParsingTask,
  undoParsingTask,
  deleteParsingTaskEntries,
}) => {
  const visibleEnrichmentTasks = enrichmentTasks.filter(task => task.status === 'running' || task.status === 'failed' || task.reviewCount || (task.appliedFields?.length || 0) > 0);
  const visibleParsingTasks = parsingTasks.filter(shouldShowParserTaskInReviewCenter);
  const hasParsingTasks = visibleParsingTasks.length > 0;
  const hasEnrichmentTasks = visibleEnrichmentTasks.length > 0;
  const hasPendingReviews = pendingReviews.length > 0;

  return (
    <div className="overflow-y-auto px-4 py-4 bg-background">
      {hasParsingTasks && (
        <div className="mb-6 flex flex-col gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Parsing Queue</span>
          {visibleParsingTasks.map(task => {
            const duplicateSummary = getParserTaskDuplicateSummary(task);
            const batchSummary = formatBatchSummary(task);
            const modelRoutingSummary = formatModelRoutingSummary(task);
            const visibleResults = (task.results || []).filter(result => !getParserResultSummary(result).noop);
            return (
            <div key={task.id} className="bg-surface border border-border rounded-xl p-3 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1 overflow-hidden flex-1">
                  <span className="text-sm font-medium text-primary truncate" title={task.text}>"{task.text}"</span>
                  <div className="flex items-center gap-2">
                    {task.status === 'pending' && (
                      <span className="text-xs text-amber-500 flex items-center gap-1 font-medium">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Parsing... {task.stage ? `(${task.stage})` : ''}
                      </span>
                    )}
                    {task.status === 'failed' && (
                      <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                    {task.status === 'success' && (
                      <span className={`text-xs flex items-center gap-1 font-medium ${task.undoStatus === 'undone' ? 'text-amber-500' : task.undoStatus === 'deleted' ? 'text-red-500' : 'text-emerald-500'}`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {task.undoStatus === 'undone' ? 'Undone' : task.undoStatus === 'deleted' ? 'Deleted' : 'Success'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center shrink-0 gap-1.5">
                  {task.status === 'success' && !task.undoStatus && undoParsingTask && (
                    <button
                      onClick={() => undoParsingTask(task.id)}
                      className="shrink-0 px-2.5 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-md text-xs font-bold transition-colors inline-flex items-center gap-1"
                      title="Undo this successful parse"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Undo
                    </button>
                  )}
                  {task.status === 'success' && !task.undoStatus && deleteParsingTaskEntries && task.results?.some(createsSavedEntry) && (
                    <button
                      onClick={() => deleteParsingTaskEntries(task.id)}
                      className="shrink-0 px-2.5 py-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-md text-xs font-bold transition-colors inline-flex items-center gap-1"
                      title="Delete saved entries from this parse"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                  {task.status === 'failed' && retryParsing && (
                    <button
                      onClick={() => retryParsing(task.id)}
                      className="shrink-0 px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-bold transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  {task.status !== 'pending' && clearParsingTask && (
                    <button
                      onClick={() => clearParsingTask(task.id)}
                      className="p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {task.status === 'success' && batchSummary && (
                <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-2 text-[11px] text-indigo-600">
                  {batchSummary}
                </div>
              )}

              {task.status === 'success' && modelRoutingSummary && (
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2 text-[11px] text-sky-600">
                  {modelRoutingSummary}
                </div>
              )}

              {task.status === 'success' && duplicateSummary && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-600">
                  {duplicateSummary}
                </div>
              )}

              {task.status === 'success' && visibleResults.length > 0 && (
                <div className="space-y-2">
                  {visibleResults.map((result, index) => (
                    <ParsingResultDetails key={`${task.id}-${index}`} result={result} index={index} />
                  ))}
                </div>
              )}

              {task.status === 'failed' && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-1">Failure details</div>
                  <p className="text-xs text-red-500 leading-relaxed whitespace-pre-wrap">
                    {task.error || 'Unknown parser error'}
                  </p>
                </div>
              )}
            </div>
          );})}
        </div>
      )}

      {hasEnrichmentTasks && (
        <div className="mb-6 flex flex-col gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Background Enrichment</span>
          {visibleEnrichmentTasks.map(task => (
            <div key={task.id} className="bg-surface border border-border rounded-xl p-3 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-primary truncate" title={task.sourceText || task.itemId}>
                  {task.sourceText || task.itemId}
                </span>
                {task.status === 'running' ? (
                  <span className="text-xs text-amber-500 flex items-center gap-1 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Enriching...
                  </span>
                ) : task.status === 'failed' ? (
                  <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3" /> Failed
                  </span>
                ) : task.reviewCount ? (
                  <span className="text-xs text-indigo-500 font-bold">Needs review</span>
                ) : (
                  <span className="text-xs text-emerald-500 font-bold">Updated</span>
                )}
              </div>
              {task.appliedFields && task.appliedFields.length > 0 && (
                <p className="text-[11px] text-muted">Applied: {task.appliedFields.join(', ')}</p>
              )}
              {!!task.reviewCount && (
                <p className="text-[11px] text-amber-600">{task.reviewCount} ambiguous suggestion{task.reviewCount === 1 ? '' : 's'} moved to Review Center.</p>
              )}
              {task.error && <p className="text-[11px] text-red-500">{task.error}</p>}
            </div>
          ))}
        </div>
      )}

      {hasPendingReviews ? (
        <PendingReviewList
          reviews={pendingReviews}
          onApprove={(id, res) => onApproveReview?.(id, res)}
          onReject={(id) => onRejectReview?.(id)}
        />
      ) : (
        !hasParsingTasks && !hasEnrichmentTasks && (
          <div className="text-center py-12 flex flex-col items-center justify-center opacity-60">
            <div className="w-12 h-12 rounded-full border border-current flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold">All caught up!</p>
            <p className="text-xs mt-1">No entries awaiting review.</p>
          </div>
        )
      )}
    </div>
  );
};

export default ReviewCenterPanel;
