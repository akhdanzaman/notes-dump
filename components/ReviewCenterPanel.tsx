import React from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, X } from 'lucide-react';
import PendingReviewList from './PendingReviewList';
import {
  ParserResultV2,
  ParsingTask,
  ParserPayloadV2,
  CreateItemPayload,
  UpdateItemPayload,
  CreateSkillPayload,
  CreateWalletPayload,
  ThemePayload,
  TransferMoneyPayload,
  AddSavingFundsPayload,
} from '../types';

interface ReviewCenterPanelProps {
  parsingTasks?: ParsingTask[];
  pendingReviews?: { id: string; text: string; results: ParserResultV2[] }[];
  onApproveReview?: (id: string, updatedResults: ParserResultV2[]) => void;
  onRejectReview?: (id: string) => void;
  retryParsing?: (id: string) => void;
  clearParsingTask?: (id: string) => void;
}

const itemDestination: Record<string, string> = {
  FINANCE: 'Money > Transactions',
  TODO: 'Plan > Tasks',
  SHOPPING: 'Plan > Shopping',
  NOTE: 'Library > Notes',
  JOURNAL: 'Library > Journal',
  EVENT: 'Calendar',
};

const actionDestination = (result: ParserResultV2) => {
  const payload = result.payload as any;

  if (result.action === 'create_item') {
    return itemDestination[payload?.itemType] || `${result.entityType || 'Item'} list`;
  }

  if (result.action === 'update_item') return `Update ${result.entityType || 'item'}`;
  if (result.action === 'complete_item') return `Complete ${result.entityType || 'item'}`;
  if (result.action === 'delete_item') return `Delete ${result.entityType || 'item'}`;
  if (result.action === 'create_skill' || result.action === 'update_skill') return 'Plan > Skills';
  if (result.action === 'create_wallet' || result.action === 'update_wallet') return 'Money > Wallets';
  if (result.action === 'create_theme' || result.action === 'update_theme') return 'Summary > Monthly Theme';
  if (result.action === 'transfer_money') return 'Money > Wallet transfer';
  if (result.action === 'add_saving_funds') return 'Plan > Savings + Money';
  if (result.action === 'query_only') return 'No data saved';

  return result.entityType ? `${result.entityType}` : 'Needs review';
};

const cleanValue = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value.length ? value.join(', ') : undefined;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0));
    if (entries.length === 0) return undefined;
    return entries.map(([k, v]) => `${k}: ${cleanValue(v) || '—'}`).join(' · ');
  }
  return String(value);
};

const pushAttrs = (attrs: Array<[string, string]>, source?: Record<string, unknown>, labels?: Record<string, string>) => {
  if (!source) return;
  Object.entries(source).forEach(([key, value]) => {
    const cleaned = cleanValue(value);
    if (!cleaned) return;
    attrs.push([labels?.[key] || key, cleaned]);
  });
};

const resultAttributes = (result: ParserResultV2): Array<[string, string]> => {
  const payload = result.payload as ParserPayloadV2 | undefined;
  const attrs: Array<[string, string]> = [];

  if (result.content) attrs.push(['parser content', result.content]);
  if (result.targetText) attrs.push(['target', result.targetText]);
  if (!payload) return attrs;

  if ('itemType' in payload) {
    const itemPayload = payload as CreateItemPayload;
    attrs.push(['item type', itemPayload.itemType]);
    attrs.push(['content', itemPayload.content]);
    if (itemPayload.status) attrs.push(['status', itemPayload.status]);
    pushAttrs(attrs, itemPayload.meta as Record<string, unknown>, {
      financeType: 'finance type',
      paymentMethod: 'from wallet',
      toWallet: 'to wallet',
      budgetCategory: 'budget',
      durationMinutes: 'duration',
      shoppingCategory: 'shopping category',
      skillName: 'skill',
      isRoutine: 'routine',
      routineInterval: 'repeat',
      savingGoalName: 'saving goal',
      dedicatedWalletName: 'dedicated wallet',
    });
  } else if ('changes' in payload || 'match' in payload) {
    const updatePayload = payload as UpdateItemPayload;
    pushAttrs(attrs, updatePayload.match as Record<string, unknown>, { itemId: 'matched id', itemName: 'matched item' });
    pushAttrs(attrs, updatePayload.changes as Record<string, unknown>, { financeType: 'finance type', paymentMethod: 'from wallet', budgetCategory: 'budget' });
  } else if ('name' in payload || 'targetHours' in payload || 'targetMinutes' in payload) {
    pushAttrs(attrs, payload as CreateSkillPayload as Record<string, unknown>, { targetHours: 'target hours', targetMinutes: 'target minutes' });
  } else if ('walletType' in payload || 'initialBalance' in payload || 'isDebtAccount' in payload) {
    pushAttrs(attrs, payload as CreateWalletPayload as Record<string, unknown>, { walletType: 'wallet type', initialBalance: 'initial balance' });
  } else if ('monthKey' in payload) {
    pushAttrs(attrs, payload as ThemePayload as Record<string, unknown>, { monthKey: 'month' });
  } else if ('fromWallet' in payload || 'toWallet' in payload) {
    pushAttrs(attrs, payload as TransferMoneyPayload as Record<string, unknown>, { fromWallet: 'from wallet', toWallet: 'to wallet' });
  } else if ('savingGoalName' in payload || 'savingGoalId' in payload) {
    pushAttrs(attrs, payload as AddSavingFundsPayload as Record<string, unknown>, { savingGoalName: 'saving goal', fromWallet: 'from wallet', budgetCategory: 'budget' });
  } else {
    pushAttrs(attrs, payload as Record<string, unknown>);
  }

  return attrs;
};

const ParsingResultDetails: React.FC<{ result: ParserResultV2; index?: number }> = ({ result, index = 0 }) => {
  const attrs = resultAttributes(result);
  const confidenceColor =
    result.confidence === 'high' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
    result.confidence === 'medium' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
    'text-red-500 bg-red-500/10 border-red-500/20';

  return (
    <div className="rounded-lg border border-border bg-background/70 p-2.5 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-bold uppercase tracking-wide">
          {index + 1}. {actionDestination(result)}
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

      {attrs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {attrs.slice(0, 14).map(([key, value]) => (
            <div key={`${key}-${value}`} className="min-w-0 rounded-md bg-surface/70 border border-border px-2 py-1">
              <div className="text-[9px] uppercase tracking-wide text-muted font-bold truncate">{key}</div>
              <div className="text-[11px] text-primary font-medium truncate" title={value}>{value}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted">No structured attributes returned.</p>
      )}

      {result.reviewReason && (
        <p className="text-[10px] text-amber-500 leading-tight">{result.reviewReason}</p>
      )}
    </div>
  );
};

const ReviewCenterPanel: React.FC<ReviewCenterPanelProps> = ({
  parsingTasks = [],
  pendingReviews = [],
  onApproveReview,
  onRejectReview,
  retryParsing,
  clearParsingTask,
}) => {
  const hasParsingTasks = parsingTasks.length > 0;
  const hasPendingReviews = pendingReviews.length > 0;

  return (
    <div className="overflow-y-auto px-4 py-4 bg-background">
      {hasParsingTasks && (
        <div className="mb-6 flex flex-col gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Parsing Queue</span>
          {parsingTasks.map(task => (
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
                      <span className="text-xs text-emerald-500 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Success
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center shrink-0">
                  {task.status === 'failed' && retryParsing && (
                    <button
                      onClick={() => retryParsing(task.id)}
                      className="ml-2 shrink-0 px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-bold transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  {task.status !== 'pending' && clearParsingTask && (
                    <button
                      onClick={() => clearParsingTask(task.id)}
                      className="ml-2 p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {task.status === 'success' && !!task.duplicateGuardRemovedCount && task.duplicateGuardRemovedCount > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-600">
                  Blocked {task.duplicateGuardRemovedCount} duplicate parser result{task.duplicateGuardRemovedCount === 1 ? '' : 's'} before saving.
                </div>
              )}

              {task.status === 'success' && task.results && task.results.length > 0 && (
                <div className="space-y-2">
                  {task.results.map((result, index) => (
                    <ParsingResultDetails key={`${task.id}-${index}`} result={result} index={index} />
                  ))}
                </div>
              )}

              {task.status === 'success' && (!task.results || task.results.length === 0) && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2 text-[11px] text-emerald-600">
                  Parsing completed, but no structured result detail was returned.
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
        !hasParsingTasks && (
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
