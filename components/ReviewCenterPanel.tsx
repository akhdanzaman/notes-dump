import React from 'react';
import { AlertCircle, CheckCircle2, Eye, FileImage, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
import PendingReviewList from './PendingReviewList';
import ReceiptReviewCard from './ReceiptReviewCard';
import {
  ParserResultV2,
  ParsingTask,
  EnrichmentTask,
  ReceiptReviewDraft,
  ReceiptProcessingTask,
  Wallet,
  BudgetRule,
  BrainDumpItem,
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
  receiptTasks?: ReceiptProcessingTask[];
  pendingReviews?: { id: string; text: string; results: ParserResultV2[] }[];
  receiptReviews?: ReceiptReviewDraft[];
  wallets?: Wallet[];
  budgetRules?: BudgetRule[];
  items?: BrainDumpItem[];
  onChangeReceiptReview?: (draft: ReceiptReviewDraft) => void;
  onApproveReceiptReview?: (draft: ReceiptReviewDraft) => void;
  onRejectReceiptReview?: (draft: ReceiptReviewDraft) => void;
  onViewDuplicateReceipt?: (item: BrainDumpItem) => void;
  onRetryReceiptTask?: (id: string) => void;
  onClearReceiptTask?: (id: string) => void;
  onViewReceiptTaskTransaction?: (itemId: string) => void;
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
  result.action === 'withdraw_saving_funds' ||
  result.action === 'record_loan_transaction' ||
  result.action === 'unknown'
);

const RECEIPT_STAGE_LABELS: Record<ReceiptProcessingTask['stage'], string> = {
  uploading: 'Menyiapkan gambar',
  reading: 'Membaca nota',
  categorizing: 'Menyusun item dan kategori',
  saving: 'Menyimpan transaksi',
  ready: 'Selesai',
};

const PARSER_STAGE_LABELS: Record<NonNullable<ParsingTask['stage']>, string> = {
  router: 'Mengenali jenis input',
  local: 'Memproses cepat',
  stage1: 'Membaca isi',
  stage2: 'Menyusun detail',
  legacy: 'Memproses input',
  batch: 'Memproses beberapa entry',
  fast_extraction: 'Mengambil informasi utama',
  deep_parse: 'Memeriksa detail',
};

const formatBatchSummary = (task: ParsingTask): string | undefined => {
  const batch = task.batch || task.routerDecision?.batch;
  if (!batch) return undefined;
  const reviewText = batch.reviewItemCount ? ` · ${batch.reviewItemCount} perlu ditinjau` : '';
  const failedText = batch.failedItemCount ? ` · ${batch.failedItemCount} gagal` : '';
  return `${batch.itemCount} entry diproses · ${batch.localItemCount} selesai cepat · ${batch.aiItemCount} diperiksa lebih lanjut${reviewText}${failedText}`;
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
  receiptTasks = [],
  pendingReviews = [],
  receiptReviews = [],
  wallets = [],
  budgetRules = [],
  items = [],
  onChangeReceiptReview,
  onApproveReceiptReview,
  onRejectReceiptReview,
  onViewDuplicateReceipt,
  onRetryReceiptTask,
  onClearReceiptTask,
  onViewReceiptTaskTransaction,
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
  const hasReceiptTasks = receiptTasks.length > 0;
  const hasPendingReviews = pendingReviews.length > 0;
  const hasReceiptReviews = receiptReviews.length > 0;

  return (
    <div className="overflow-y-auto px-4 py-4 bg-background">

      {hasReceiptTasks && (
        <div className="mb-6 flex flex-col gap-2">
          <span className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Pemrosesan nota</span>
          {receiptTasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-border bg-surface p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                    <FileImage className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-primary" title={task.imageName}>{task.imageName}</div>
                    {task.context && <div className="mt-0.5 truncate text-[11px] text-muted" title={task.context}>{task.context}</div>}
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                      {task.status === 'pending' && (
                        <span className="flex items-center gap-1.5 text-amber-500">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          {RECEIPT_STAGE_LABELS[task.stage]}
                        </span>
                      )}
                      {task.status === 'success' && (
                        <span className="flex items-center gap-1.5 text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {task.outcome === 'review' ? 'Siap ditinjau' : 'Tersimpan di Transactions'}
                        </span>
                      )}
                      {task.status === 'failed' && (
                        <span className="flex items-center gap-1.5 text-red-500">
                          <AlertCircle className="h-3.5 w-3.5" /> Gagal memproses nota
                        </span>
                      )}
                    </div>
                    {task.error && (
                      <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-xs leading-relaxed text-red-500">
                        {task.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {task.status === 'failed' && onRetryReceiptTask && (
                    <button
                      type="button"
                      onClick={() => onRetryReceiptTask(task.id)}
                      className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20"
                    >
                      Coba lagi
                    </button>
                  )}
                  {task.status === 'success' && task.transactionItemId && onViewReceiptTaskTransaction && (
                    <button
                      type="button"
                      onClick={() => onViewReceiptTaskTransaction(task.transactionItemId!)}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 px-2.5 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-500/20"
                    >
                      <Eye className="h-3.5 w-3.5" /> Lihat
                    </button>
                  )}
                  {task.status !== 'pending' && onClearReceiptTask && (
                    <button
                      type="button"
                      onClick={() => onClearReceiptTask(task.id)}
                      className="rounded-lg p-1.5 text-muted hover:bg-red-500/10 hover:text-red-500"
                      aria-label="Tutup aktivitas nota"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasReceiptReviews && (
        <div className="mb-6 flex flex-col gap-3">
          <span className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Nota menunggu tinjauan</span>
          {receiptReviews.map((draft) => (
            <ReceiptReviewCard
              key={draft.id}
              draft={draft}
              wallets={wallets}
              budgetRules={budgetRules}
              duplicateItem={draft.duplicateItemId ? items.find((item) => item.id === draft.duplicateItemId) : undefined}
              onChange={(next) => onChangeReceiptReview?.(next)}
              onApprove={(next) => onApproveReceiptReview?.(next)}
              onReject={(next) => onRejectReceiptReview?.(next)}
              onViewDuplicate={onViewDuplicateReceipt}
            />
          ))}
        </div>
      )}

      {hasParsingTasks && (
        <div className="mb-6 flex flex-col gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Aktivitas input</span>
          {visibleParsingTasks.map(task => {
            const duplicateSummary = getParserTaskDuplicateSummary(task);
            const batchSummary = formatBatchSummary(task);
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
                        {task.stage ? PARSER_STAGE_LABELS[task.stage] : 'Memproses input'}
                      </span>
                    )}
                    {task.status === 'failed' && (
                      <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Gagal
                      </span>
                    )}
                    {task.status === 'success' && (
                      <span className={`text-xs flex items-center gap-1 font-medium ${task.undoStatus === 'undone' ? 'text-amber-500' : task.undoStatus === 'deleted' ? 'text-red-500' : 'text-emerald-500'}`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {task.undoStatus === 'undone' ? 'Dibatalkan' : task.undoStatus === 'deleted' ? 'Dihapus' : 'Selesai'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center shrink-0 gap-1.5">
                  {task.status === 'success' && !task.undoStatus && undoParsingTask && (
                    <button
                      onClick={() => undoParsingTask(task.id)}
                      className="shrink-0 px-2.5 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-md text-xs font-bold transition-colors inline-flex items-center gap-1"
                      title="Batalkan hasil parsing ini"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Batalkan
                    </button>
                  )}
                  {task.status === 'success' && !task.undoStatus && deleteParsingTaskEntries && task.results?.some(createsSavedEntry) && (
                    <button
                      onClick={() => deleteParsingTaskEntries(task.id)}
                      className="shrink-0 px-2.5 py-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-md text-xs font-bold transition-colors inline-flex items-center gap-1"
                      title="Hapus entry yang dibuat oleh parsing ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus entry
                    </button>
                  )}
                  {task.status === 'failed' && retryParsing && (
                    <button
                      onClick={() => retryParsing(task.id)}
                      className="shrink-0 px-2.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md text-xs font-bold transition-colors"
                    >
                      Coba lagi
                    </button>
                  )}
                  {task.status !== 'pending' && clearParsingTask && (
                    <button
                      onClick={() => clearParsingTask(task.id)}
                      className="p-1.5 text-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                      title="Tutup"
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
                  <div className="text-[10px] font-bold uppercase tracking-wide text-red-500 mb-1">Detail kegagalan</div>
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
          <span className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Penyempurnaan data</span>
          {visibleEnrichmentTasks.map(task => (
            <div key={task.id} className="bg-surface border border-border rounded-xl p-3 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-primary truncate" title={task.sourceText || task.itemId}>
                  {task.sourceText || task.itemId}
                </span>
                {task.status === 'running' ? (
                  <span className="text-xs text-amber-500 flex items-center gap-1 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Menyempurnakan...
                  </span>
                ) : task.status === 'failed' ? (
                  <span className="text-xs text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3" /> Gagal
                  </span>
                ) : task.reviewCount ? (
                  <span className="text-xs text-indigo-500 font-bold">Perlu ditinjau</span>
                ) : (
                  <span className="text-xs text-emerald-500 font-bold">Diperbarui</span>
                )}
              </div>
              {task.appliedFields && task.appliedFields.length > 0 && (
                <p className="text-[11px] text-muted">Diterapkan: {task.appliedFields.join(', ')}</p>
              )}
              {!!task.reviewCount && (
                <p className="text-[11px] text-amber-600">{task.reviewCount} saran ambigu dipindahkan ke Review Center.</p>
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
        !hasReceiptReviews && !hasReceiptTasks && !hasParsingTasks && !hasEnrichmentTasks && (
          <div className="text-center py-12 flex flex-col items-center justify-center opacity-60">
            <div className="w-12 h-12 rounded-full border border-current flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold">Semua sudah beres</p>
            <p className="text-xs mt-1">Tidak ada entry yang menunggu proses atau tinjauan.</p>
          </div>
        )
      )}
    </div>
  );
};

export default ReviewCenterPanel;
