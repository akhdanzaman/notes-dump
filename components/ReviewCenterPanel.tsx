import React from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, FileImage, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
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
  hideMoney?: boolean;
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
  batch: 'Memproses beberapa item',
  fast_extraction: 'Mengambil informasi utama',
  deep_parse: 'Memeriksa detail',
};

const CONFIDENCE_LABELS: Record<ParserResultV2['confidence'], string> = {
  high: 'Keyakinan tinggi',
  medium: 'Perlu dicek',
  low: 'Keyakinan rendah',
};

const formatBatchSummary = (task: ParsingTask): string | undefined => {
  const batch = task.batch || task.routerDecision?.batch;
  if (!batch) return undefined;
  const reviewText = batch.reviewItemCount ? ` · ${batch.reviewItemCount} perlu ditinjau` : '';
  const failedText = batch.failedItemCount ? ` · ${batch.failedItemCount} gagal` : '';
  return `${batch.itemCount} item diproses · ${batch.localItemCount} selesai cepat · ${batch.aiItemCount} diperiksa lebih lanjut${reviewText}${failedText}`;
};

const ParsingResultDetails: React.FC<{ result: ParserResultV2; index?: number }> = ({ result, index = 0 }) => {
  const attrs = getParserResultDetails(result);
  const summary = getParserResultSummary(result);
  const confidenceColor =
    result.confidence === 'high' ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' :
    result.confidence === 'medium' ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' :
    'text-red-500 bg-red-500/10 border-red-500/20';

  return (
    <div className="space-y-2 rounded-2xl bg-background/65 p-3 ring-1 ring-inset ring-border/60">
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
          {CONFIDENCE_LABELS[result.confidence]}
        </span>
      </div>

      {result.batchItem && (
        <div className="rounded-md bg-indigo-500/5 border border-indigo-500/15 px-2 py-1.5">
          <div className="text-[10px] font-semibold text-indigo-600">Sumber input</div>
          <div className="text-[11px] text-primary font-medium leading-snug">{result.batchItem.sourceText}</div>
        </div>
      )}

      <div className="rounded-md bg-emerald-500/5 border border-emerald-500/15 px-2 py-1.5">
        <div className="text-[10px] font-semibold text-emerald-600">Ringkasan hasil</div>
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
  hideMoney = false,
}) => {
  const visibleEnrichmentTasks = enrichmentTasks.filter(task => task.status === 'running' || task.status === 'failed' || task.reviewCount || (task.appliedFields?.length || 0) > 0);
  const visibleParsingTasks = parsingTasks.filter(shouldShowParserTaskInReviewCenter);
  const hasParsingTasks = visibleParsingTasks.length > 0;
  const hasEnrichmentTasks = visibleEnrichmentTasks.length > 0;
  const hasReceiptTasks = receiptTasks.length > 0;
  const hasPendingReviews = pendingReviews.length > 0;
  const hasReceiptReviews = receiptReviews.length > 0;

  return (
    <section className="overflow-y-auto bg-background px-4 py-4 sm:px-5" aria-label="Pusat tinjauan">
      {hideMoney && (
        <div
          className="mb-5 flex items-start gap-3 rounded-2xl bg-indigo-500/10 p-3.5 text-indigo-800 ring-1 ring-inset ring-indigo-500/20 dark:text-indigo-200"
          role="status"
        >
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <div className="text-xs font-semibold">Mode privasi aktif</div>
            <p className="mt-0.5 text-xs leading-relaxed opacity-80">
              Nominal, rincian nota, dan hasil parsing finansial disembunyikan. Tampilkan nominal untuk meninjau data lengkap.
            </p>
          </div>
        </div>
      )}

      {hasReceiptTasks && (
        <div className="mb-6 flex flex-col gap-2">
          <h3 className="mb-1 text-sm font-semibold text-primary">Pemrosesan nota</h3>
          {receiptTasks.map((task, index) => (
            <article key={task.id} className="rounded-2xl bg-surface p-3.5 shadow-sm ring-1 ring-inset ring-border/65">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                    <FileImage className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-primary" title={hideMoney ? undefined : task.imageName}>
                      {hideMoney ? `Nota ${index + 1}` : task.imageName}
                    </div>
                    {task.context && (
                      <div className="mt-0.5 truncate text-[11px] text-muted" title={hideMoney ? undefined : task.context}>
                        {hideMoney ? 'Detail disembunyikan oleh mode privasi' : task.context}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium" role="status" aria-live="polite">
                      {task.status === 'pending' && (
                        <span className="flex items-center gap-1.5 text-amber-500">
                          <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" />
                          {RECEIPT_STAGE_LABELS[task.stage]}
                        </span>
                      )}
                      {task.status === 'success' && (
                        <span className="flex items-center gap-1.5 text-emerald-500">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {task.outcome === 'review' ? 'Siap ditinjau' : 'Tersimpan di transaksi'}
                        </span>
                      )}
                      {task.status === 'failed' && (
                        <span className="flex items-center gap-1.5 text-red-500">
                          <AlertCircle className="h-3.5 w-3.5" /> Gagal memproses nota
                        </span>
                      )}
                    </div>
                    {task.error && (
                      <div className="mt-2 rounded-xl bg-red-500/10 p-2.5 text-xs leading-relaxed text-red-600 ring-1 ring-inset ring-red-500/20" role="alert">
                        {hideMoney ? 'Nota belum dapat diproses. Tampilkan nominal untuk melihat detail kegagalan.' : task.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {task.status === 'failed' && onRetryReceiptTask && (
                    <button
                      type="button"
                      onClick={() => onRetryReceiptTask(task.id)}
                      className="min-h-11 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                    >
                      Coba lagi
                    </button>
                  )}
                  {task.status === 'success' && task.transactionItemId && onViewReceiptTaskTransaction && (
                    <button
                      type="button"
                      onClick={() => onViewReceiptTaskTransaction(task.transactionItemId!)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                    >
                      <Eye className="h-3.5 w-3.5" /> Lihat
                    </button>
                  )}
                  {task.status !== 'pending' && onClearReceiptTask && (
                    <button
                      type="button"
                      onClick={() => onClearReceiptTask(task.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                      aria-label="Tutup aktivitas nota"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {hasReceiptReviews && (
        <div className="mb-6 flex flex-col gap-3">
          <h3 className="mb-1 text-sm font-semibold text-primary">Nota menunggu tinjauan</h3>
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
              hideMoney={hideMoney}
            />
          ))}
        </div>
      )}

      {hasParsingTasks && (
        <div className="mb-6 flex flex-col gap-2">
          <h3 className="mb-1 text-sm font-semibold text-primary">Aktivitas input</h3>
          {visibleParsingTasks.map(task => {
            const duplicateSummary = getParserTaskDuplicateSummary(task);
            const batchSummary = formatBatchSummary(task);
            const visibleResults = (task.results || []).filter(result => !getParserResultSummary(result).noop);
            return (
            <article key={task.id} className="space-y-3 rounded-2xl bg-surface p-3.5 shadow-sm ring-1 ring-inset ring-border/65">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1 overflow-hidden flex-1">
                  <span className="text-sm font-medium text-primary truncate" title={hideMoney ? undefined : task.text}>
                    {hideMoney ? 'Detail input disembunyikan' : `"${task.text}"`}
                  </span>
                  <div className="flex items-center gap-2" role="status" aria-live="polite">
                    {task.status === 'pending' && (
                      <span className="text-xs text-amber-500 flex items-center gap-1 font-medium">
                        <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" />
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
                      type="button"
                      onClick={() => undoParsingTask(task.id)}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:text-amber-400"
                      title="Batalkan hasil parsing ini"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Batalkan
                    </button>
                  )}
                  {task.status === 'success' && !task.undoStatus && deleteParsingTaskEntries && task.results?.some(createsSavedEntry) && (
                    <button
                      type="button"
                      onClick={() => deleteParsingTaskEntries(task.id)}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                      title="Hapus item yang dibuat dari input ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus item
                    </button>
                  )}
                  {task.status === 'failed' && retryParsing && (
                    <button
                      type="button"
                      onClick={() => retryParsing(task.id)}
                      className="min-h-11 shrink-0 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
                    >
                      Coba lagi
                    </button>
                  )}
                  {task.status !== 'pending' && clearParsingTask && (
                    <button
                      type="button"
                      onClick={() => clearParsingTask(task.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                      title="Tutup"
                      aria-label="Tutup aktivitas input"
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

              {task.status === 'success' && duplicateSummary && !hideMoney && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-600">
                  {duplicateSummary}
                </div>
              )}

              {task.status === 'success' && visibleResults.length > 0 && (
                <div className="space-y-2">
                  {hideMoney ? (
                    <div className="flex items-center gap-2 rounded-2xl bg-background/65 p-3 text-xs text-muted ring-1 ring-inset ring-border/60">
                      <EyeOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Hasil parsing dan nilai finansial disembunyikan.
                    </div>
                  ) : (
                    visibleResults.map((result, index) => (
                      <ParsingResultDetails key={`${task.id}-${index}`} result={result} index={index} />
                    ))
                  )}
                </div>
              )}

              {task.status === 'failed' && (
                <div className="rounded-xl bg-red-500/10 p-3 ring-1 ring-inset ring-red-500/20" role="alert">
                  <div className="mb-1 text-xs font-semibold text-red-600">Detail kegagalan</div>
                  <p className="text-xs text-red-500 leading-relaxed whitespace-pre-wrap">
                    {hideMoney ? 'Detail kegagalan disembunyikan oleh mode privasi.' : task.error || 'Detail error tidak tersedia.'}
                  </p>
                </div>
              )}
            </article>
          );})}
        </div>
      )}

      {hasEnrichmentTasks && (
        <div className="mb-6 flex flex-col gap-2">
          <h3 className="mb-1 text-sm font-semibold text-primary">Penyempurnaan data</h3>
          {visibleEnrichmentTasks.map(task => (
            <article key={task.id} className="space-y-2 rounded-2xl bg-surface p-3.5 shadow-sm ring-1 ring-inset ring-border/65">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-primary truncate" title={hideMoney ? undefined : task.sourceText || task.itemId}>
                  {hideMoney ? 'Sumber data disembunyikan' : task.sourceText || task.itemId}
                </span>
                {task.status === 'running' ? (
                  <span className="text-xs text-amber-500 flex items-center gap-1 font-medium">
                    <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" /> Menyempurnakan…
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
                <p className="text-[11px] text-amber-600">{task.reviewCount} saran yang perlu dicek dipindahkan ke pusat tinjauan.</p>
              )}
              {task.error && (
                <p className="text-[11px] text-red-500" role="alert">
                  {hideMoney ? 'Detail kegagalan disembunyikan oleh mode privasi.' : task.error}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {hasPendingReviews && hideMoney ? (
        <div className="flex items-start gap-3 rounded-[24px] bg-surface p-5 text-muted ring-1 ring-inset ring-border/60">
          <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-primary">Tinjauan input disembunyikan</p>
            <p className="mt-1 text-xs leading-relaxed">
              {pendingReviews.length} input tetap aman dalam antrean. Tampilkan nominal untuk memeriksa atau menyetujuinya.
            </p>
          </div>
        </div>
      ) : hasPendingReviews ? (
        <PendingReviewList
          reviews={pendingReviews}
          onApprove={(id, res) => onApproveReview?.(id, res)}
          onReject={(id) => onRejectReview?.(id)}
        />
      ) : (
        !hasReceiptReviews && !hasReceiptTasks && !hasParsingTasks && !hasEnrichmentTasks && (
          <div className="flex flex-col items-center justify-center rounded-[24px] bg-surface/60 py-12 text-center text-muted ring-1 ring-inset ring-border/50">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-primary">Semua sudah beres</p>
            <p className="mt-1 text-xs">Tidak ada item yang menunggu proses atau tinjauan.</p>
          </div>
        )
      )}
    </section>
  );
};

export default ReviewCenterPanel;
