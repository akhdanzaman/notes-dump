import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
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
}) => {
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [showLargePreview, setShowLargePreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    void getReceiptAttachmentUrl(draft.attachmentId).then((url) => {
      objectUrl = url;
      if (active) setPreviewUrl(url);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [draft.attachmentId]);

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
    if (!canApprove || isSaving) return;
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
    setActionError('');
    try {
      await onReject(draft);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Gagal membatalkan hasil scan.');
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-500/30 bg-surface shadow-sm">
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => previewUrl && setShowLargePreview(true)}
              className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-background"
              title={previewUrl ? 'Lihat gambar nota' : 'Gambar tidak tersedia di perangkat ini'}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Pratinjau nota" className="h-full w-full object-cover" />
              ) : (
                <FileImage className="mx-auto h-5 w-5 text-muted" />
              )}
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Tinjau nota</div>
              <div className="truncate text-sm font-semibold text-primary">{draft.imageName}</div>
              <div className="text-[10px] text-muted">Periksa hasil ekstraksi sebelum disimpan.</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void approveDraft()}
              disabled={!canApprove || isSaving}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
              title={canApprove ? 'Simpan transaksi' : 'Lengkapi data yang diperlukan'}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void rejectDraft()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface-elevated text-muted hover:text-red-500"
              title="Batalkan hasil scan"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {actionError && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-2.5 text-[11px] font-medium text-red-600">
            {actionError}
          </div>
        )}

        {(draft.warnings.length > 0 || missingCategoryCount > 0) && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-[11px] text-amber-600">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                {draft.warnings.map((warning) => <div key={warning}>{warning}</div>)}
                {missingCategoryCount > 0 && <div>{missingCategoryCount} item belum memiliki kategori budget.</div>}
              </div>
            </div>
          </div>
        )}

        {duplicateItem && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-[11px] text-red-600">
            <div className="flex items-start gap-2">
              <Copy className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold">Transaksi serupa sudah ada</div>
                <div className="truncate text-red-500/80">{duplicateItem.content} · {formatMoney(duplicateItem.meta.amount || 0, 'IDR')}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {onViewDuplicate && (
                    <button type="button" onClick={() => onViewDuplicate(duplicateItem)} className="rounded-lg border border-red-500/30 px-2 py-1 font-bold">
                      Lihat transaksi lama
                    </button>
                  )}
                  <label className="flex items-center gap-1.5 font-medium">
                    <input
                      type="checkbox"
                      checked={!!draft.allowDuplicate}
                      onChange={(event) => onChange({ ...draft, allowDuplicate: event.target.checked })}
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
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Merchant</label>
            <input
              value={draft.merchant || ''}
              onChange={(event) => onChange({ ...draft, merchant: event.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-primary focus:border-indigo-500 focus:outline-none"
              placeholder="Nama merchant"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Tanggal transaksi</label>
            <input
              type="date"
              value={draft.date}
              onChange={(event) => onChange({ ...draft, date: event.target.value })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-primary focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Wallet</label>
            <select
              value={draft.walletId || ''}
              onChange={(event) => onChange({ ...draft, walletId: event.target.value || undefined })}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-primary focus:border-indigo-500 focus:outline-none"
            >
              <option value="">Pilih wallet</option>
              {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
            </select>
          </div>
          {needsDefaultCategory && (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Kategori default</label>
              <select
                value={draft.defaultBudgetCategory || ''}
                onChange={(event) => onChange({ ...draft, defaultBudgetCategory: event.target.value || undefined })}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-primary focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Tanpa kategori default</option>
                {budgetRules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
              </select>
              <div className="mt-1 text-[9px] text-muted">Hanya dipakai untuk item yang memilih kategori default.</div>
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

        <div className="rounded-xl border border-border bg-background/60 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted">Total asli</div>
              <div className="text-sm font-bold text-primary">{formatMoney(originalTotal, normalizedCurrency)}</div>
            </div>
            {normalizedCurrency !== 'IDR' && (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-muted">Kurs ke IDR</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={draft.exchangeRateToIdr || ''}
                  onChange={(event) => onChange({ ...draft, exchangeRateToIdr: Number(event.target.value) || undefined })}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-primary focus:border-indigo-500 focus:outline-none"
                  placeholder="Contoh: 16250"
                />
              </div>
            )}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-muted">Nilai budget</div>
              <div className="text-sm font-bold text-indigo-500">{formatMoney(idrTotal, 'IDR')}</div>
            </div>
          </div>
          {normalizedCurrency !== 'IDR' && !draft.exchangeRateToIdr && (
            <div className="mt-2 text-[10px] text-amber-600">Masukkan kurs sebelum transaksi dapat disimpan.</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void approveDraft()}
          disabled={!canApprove || isSaving}
          className="w-full rounded-xl bg-indigo-500 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSaving ? 'Menyimpan transaksi...' : `Simpan transaksi · ${formatMoney(idrTotal, 'IDR')}`}
        </button>
      </div>

      {showLargePreview && previewUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onClick={() => setShowLargePreview(false)}>
          <div className="relative max-h-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <img src={previewUrl} alt="Gambar nota" className="max-h-[88vh] max-w-full rounded-2xl object-contain" />
            <button
              type="button"
              onClick={() => setShowLargePreview(false)}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"
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
    </div>
  );
};

export default ReceiptReviewCard;
