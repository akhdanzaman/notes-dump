import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileImage,
  X,
} from 'lucide-react';
import {
  BrainDumpItem,
  BudgetRule,
  ReceiptReviewDraft,
  Wallet,
} from '../types';
import { getReceiptAttachmentUrl } from '../services/receiptAttachmentService';
import LineItemsEditor from './LineItemsEditor';
import { sumTransactionLineItems } from '../utils/transactionLineItems';

interface Props {
  draft: ReceiptReviewDraft;
  wallets: Wallet[];
  budgetRules: BudgetRule[];
  duplicateItem?: BrainDumpItem;
  onChange: (draft: ReceiptReviewDraft) => void;
  onApprove: (draft: ReceiptReviewDraft) => void | Promise<void>;
  onReject: (draft: ReceiptReviewDraft) => void | Promise<void>;
  onViewDuplicate?: (item: BrainDumpItem) => void;
  hideMoney?: boolean;
}

const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toLocaleString('id-ID')}`;
  }
};

const ReceiptReviewCard: React.FC<Props> = ({
  draft,
  wallets,
  budgetRules,
  duplicateItem,
  onChange,
  onApprove,
  onReject,
  onViewDuplicate,
  hideMoney = false,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showLargePreview, setShowLargePreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [actionError, setActionError] = useState('');
  const previewButtonRef = useRef<HTMLButtonElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setPreviewUrl(undefined);
    setPreviewState('loading');
    if (hideMoney) {
      return () => {
        active = false;
      };
    }
    void getReceiptAttachmentUrl(draft.attachmentId)
      .then((url) => {
        objectUrl = url;
        if (!active) return;
        setPreviewUrl(url);
        setPreviewState(url ? 'ready' : 'error');
      })
      .catch(() => {
        if (active) setPreviewState('error');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [draft.attachmentId, hideMoney]);

  useEffect(() => {
    if (!showLargePreview) return;
    const frame = window.requestAnimationFrame(() => previewCloseRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowLargePreview(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      window.requestAnimationFrame(() => previewButtonRef.current?.focus({ preventScroll: true }));
    };
  }, [showLargePreview]);

  const originalTotal = useMemo(() => sumTransactionLineItems(draft.lineItems), [draft.lineItems]);
  const normalizedCurrency = (draft.originalCurrency || 'IDR').toUpperCase();
  const exchangeRate = normalizedCurrency === 'IDR' ? 1 : Number(draft.exchangeRateToIdr || 0);
  const idrTotal = exchangeRate > 0 ? originalTotal * exchangeRate : 0;
  const needsDefaultCategory = draft.lineItems.some((line) =>
    line.allocationMode !== 'proportional'
    && line.allocationMode !== 'uncategorized'
    && !line.budgetCategory,
  );
  const missingCategoryCount = draft.lineItems.filter((line) =>
    line.allocationMode !== 'proportional'
    && line.allocationMode !== 'uncategorized'
    && !line.budgetCategory
    && !draft.defaultBudgetCategory,
  ).length;
  const canApprove = !!draft.walletId
    && !!draft.date
    && draft.lineItems.length > 0
    && originalTotal > 0
    && (normalizedCurrency === 'IDR' || exchangeRate > 0)
    && (!duplicateItem || !!draft.allowDuplicate);

  const approveDraft = async () => {
    if (!canApprove || isSaving || isRejecting) return;
    setActionError('');
    setIsSaving(true);
    try {
      await onApprove(draft);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Gagal menyimpan transaksi.');
    } finally {
      setIsSaving(false);
    }
  };

  const rejectDraft = async () => {
    if (isSaving || isRejecting) return;
    setActionError('');
    setIsRejecting(true);
    try {
      await onReject(draft);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Gagal membatalkan hasil scan.');
    } finally {
      setIsRejecting(false);
    }
  };

  if (hideMoney) {
    return (
      <article
        className="rounded-[24px] bg-surface p-5 shadow-sm ring-1 ring-inset ring-border/70"
        aria-label="Rincian nota disembunyikan oleh mode privasi"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-primary">Rincian nota disembunyikan</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Total, rincian item, kurs, gambar nota, dan transaksi serupa tidak ditampilkan saat mode privasi aktif.
              Tampilkan nominal untuk memeriksa dan menyimpan transaksi ini.
            </p>
            <div className="mt-3 font-semibold tabular-nums tracking-[0.18em] text-primary" aria-hidden="true">
              Rp ••••••
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-[24px] bg-surface shadow-sm ring-1 ring-inset ring-border/70" aria-labelledby={`receipt-review-title-${draft.id}`}>
      <div className="space-y-5 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={previewButtonRef}
              type="button"
              onClick={() => previewUrl && setShowLargePreview(true)}
              disabled={!previewUrl}
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background ring-1 ring-inset ring-border/70 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:cursor-default"
              title={previewUrl ? 'Lihat gambar nota' : previewState === 'loading' ? 'Memuat gambar nota' : 'Gambar tidak tersedia di perangkat ini'}
              aria-label={previewUrl ? 'Buka pratinjau gambar nota' : previewState === 'loading' ? 'Gambar nota sedang dimuat' : 'Gambar nota tidak tersedia'}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Pratinjau nota" className="h-full w-full object-cover" />
              ) : (
                <FileImage className={`mx-auto h-5 w-5 ${previewState === 'error' ? 'text-amber-500' : 'text-muted'}`} />
              )}
            </button>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-indigo-500">Perlu ditinjau</div>
              <div id={`receipt-review-title-${draft.id}`} className="truncate text-sm font-semibold text-primary">{draft.imageName}</div>
              <div className="text-xs text-muted">Periksa hasil pembacaan sebelum menyimpan transaksi.</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void approveDraft()}
              disabled={!canApprove || isSaving || isRejecting}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40"
              title={canApprove ? 'Simpan transaksi' : 'Lengkapi data yang diperlukan'}
              aria-label={isSaving ? 'Transaksi sedang disimpan' : canApprove ? 'Simpan transaksi dari nota' : 'Lengkapi data sebelum menyimpan transaksi'}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void rejectDraft()}
              disabled={isSaving || isRejecting}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-background text-muted ring-1 ring-inset ring-border/70 transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 disabled:opacity-40"
              title="Batalkan hasil scan"
              aria-label={isRejecting ? 'Hasil scan sedang dibatalkan' : 'Batalkan hasil scan'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {actionError && (
          <div className="flex items-start gap-2 rounded-2xl bg-red-500/10 p-3 text-xs font-medium leading-relaxed text-red-600 ring-1 ring-inset ring-red-500/20" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{actionError} Data Anda belum diubah; silakan coba lagi.</span>
          </div>
        )}

        {(draft.warnings.length > 0 || missingCategoryCount > 0) && (
          <div className="rounded-2xl bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {draft.warnings.map((warning) => <div key={warning}>{warning}</div>)}
                {missingCategoryCount > 0 && <div>{missingCategoryCount} item belum memiliki kategori budget. Anda tetap dapat memperbaikinya di rincian.</div>}
              </div>
            </div>
          </div>
        )}

        {duplicateItem && (
          <div className="rounded-2xl bg-red-500/10 p-3 text-xs leading-relaxed text-red-600 ring-1 ring-inset ring-red-500/20">
            <div className="flex items-start gap-2">
              <Copy className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold">Transaksi serupa sudah ada</div>
                <div className="truncate text-red-500/80">{duplicateItem.content} · {formatMoney(duplicateItem.meta.amount || 0, 'IDR')}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {onViewDuplicate && (
                    <button type="button" onClick={() => onViewDuplicate(duplicateItem)} className="min-h-11 rounded-xl px-3 py-2 font-semibold ring-1 ring-inset ring-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50">
                      Lihat transaksi lama
                    </button>
                  )}
                  <label className="flex min-h-11 items-center gap-2 rounded-xl px-1 font-medium">
                    <input
                      type="checkbox"
                      checked={!!draft.allowDuplicate}
                      onChange={(event) => onChange({ ...draft, allowDuplicate: event.target.checked })}
                      className="h-5 w-5 rounded border-border text-indigo-600 focus:ring-indigo-500"
                    />
                    Tetap simpan sebagai transaksi baru
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`receipt-merchant-${draft.id}`} className="mb-1.5 block text-xs font-semibold text-primary">Toko atau merchant</label>
            <input
              id={`receipt-merchant-${draft.id}`}
              value={draft.merchant || ''}
              onChange={(event) => onChange({ ...draft, merchant: event.target.value })}
              className="min-h-11 w-full rounded-xl border border-border/80 bg-background/70 px-3.5 py-2.5 text-sm text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
              placeholder="Nama merchant"
            />
          </div>
          <div>
            <label htmlFor={`receipt-date-${draft.id}`} className="mb-1.5 block text-xs font-semibold text-primary">Tanggal transaksi</label>
            <input
              id={`receipt-date-${draft.id}`}
              type="date"
              value={draft.date}
              onChange={(event) => onChange({ ...draft, date: event.target.value })}
              className="min-h-11 w-full rounded-xl border border-border/80 bg-background/70 px-3.5 py-2.5 text-sm text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
          <div>
            <label htmlFor={`receipt-wallet-${draft.id}`} className="mb-1.5 block text-xs font-semibold text-primary">Wallet pembayaran</label>
            <select
              id={`receipt-wallet-${draft.id}`}
              value={draft.walletId || ''}
              onChange={(event) => onChange({ ...draft, walletId: event.target.value || undefined })}
              className="min-h-11 w-full rounded-xl border border-border/80 bg-background/70 px-3.5 py-2.5 text-sm text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
            >
              <option value="">Pilih wallet</option>
              {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
            </select>
          </div>
          {needsDefaultCategory && (
            <div>
              <label htmlFor={`receipt-category-${draft.id}`} className="mb-1.5 block text-xs font-semibold text-primary">Kategori default</label>
              <select
                id={`receipt-category-${draft.id}`}
                value={draft.defaultBudgetCategory || ''}
                onChange={(event) => onChange({ ...draft, defaultBudgetCategory: event.target.value || undefined })}
                className="min-h-11 w-full rounded-xl border border-border/80 bg-background/70 px-3.5 py-2.5 text-sm text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
              >
                <option value="">Tanpa kategori default</option>
                {budgetRules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
              </select>
              <div className="mt-1.5 text-xs text-muted">Hanya dipakai untuk item yang memilih kategori default.</div>
            </div>
          )}
        </div>

        <LineItemsEditor
          variant="transaction"
          value={draft.lineItems}
          onChange={(lineItems) => onChange({ ...draft, lineItems })}
          budgetRules={budgetRules}
          defaultBudgetCategory={draft.defaultBudgetCategory}
          currency={normalizedCurrency}
          title="Rincian hasil scan"
          helpText="Perbaiki nama, jumlah, total item, dan alokasi budget sebelum menyimpan."
        />

        <div className="rounded-2xl bg-background/60 p-4 ring-1 ring-inset ring-border/60">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-muted">Total pada nota</div>
              <div className="mt-1 text-base font-semibold tabular-nums tracking-tight text-primary">{formatMoney(originalTotal, normalizedCurrency)}</div>
            </div>
            {normalizedCurrency !== 'IDR' && (
              <div>
                <label htmlFor={`receipt-rate-${draft.id}`} className="text-xs font-medium text-primary">Kurs ke IDR</label>
                <input
                  id={`receipt-rate-${draft.id}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={draft.exchangeRateToIdr || ''}
                  onChange={(event) => onChange({ ...draft, exchangeRateToIdr: Number(event.target.value) || undefined })}
                  className="mt-1 min-h-11 w-full rounded-xl border border-border/80 bg-surface px-3 py-2 text-sm tabular-nums text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="Contoh: 16250"
                />
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-muted">Nilai yang masuk budget</div>
              <div className="mt-1 text-base font-semibold tabular-nums tracking-tight text-indigo-500">{formatMoney(idrTotal, 'IDR')}</div>
            </div>
          </div>
          {normalizedCurrency !== 'IDR' && !draft.exchangeRateToIdr && (
            <div className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400" role="status">Masukkan kurs sebelum transaksi dapat disimpan.</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void approveDraft()}
          disabled={!canApprove || isSaving || isRejecting}
          className="min-h-12 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-500/15 transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-40"
          aria-busy={isSaving || undefined}
        >
          {isSaving ? 'Menyimpan transaksi…' : `Simpan transaksi · ${formatMoney(idrTotal, 'IDR')}`}
        </button>
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {isSaving ? 'Transaksi sedang disimpan.' : isRejecting ? 'Hasil scan sedang dibatalkan.' : ''}
        </div>
      </div>

      {showLargePreview && previewUrl && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowLargePreview(false)}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault();
              previewCloseRef.current?.focus();
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Pratinjau nota ${draft.imageName}`}
        >
          <div className="relative max-h-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <img src={previewUrl} alt="Gambar nota" className="max-h-[88vh] max-w-full rounded-2xl object-contain" />
            <button
              ref={previewCloseRef}
              type="button"
              onClick={() => setShowLargePreview(false)}
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Tutup gambar"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white">
              <Eye className="h-3.5 w-3.5" /> {draft.imageName}
            </div>
          </div>
        </div>
      )}
    </article>
  );
};

export default ReceiptReviewCard;
