import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { BrainDumpItem, ReceiptProcessingTask, ReceiptReviewDraft } from '../types';
import type { useBrainDumpData } from './useBrainDumpData';
import type { ShowAppNotice } from './useAppFeedback';
import { createReceiptFingerprint, deleteReceiptAttachment, saveReceiptAttachment } from '../services/receiptAttachmentService';
import { findDuplicateReceiptTransaction } from '../utils/receiptDuplicate';
import { shouldQueueReceiptReview } from '../utils/receiptReviewPolicy';
import { convertTransactionLineItemsToIdr, sumTransactionLineItems } from '../utils/transactionLineItems';

type ReceiptWorkflowOptions = Pick<ReturnType<typeof useBrainDumpData>, 'items' | 'wallets' | 'budgetConfig' | 'appSettings' | 'handleAddTransaction'> & {
  showAppNotice: ShowAppNotice;
  revealReceiptTransaction: (date: string) => void;
};

const RECEIPT_REVIEWS_STORAGE_KEY = "braindump_receipt_reviews";

const readStoredReceiptReviews = (): ReceiptReviewDraft[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECEIPT_REVIEWS_STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const seenIds = new Set<string>();
    return raw.filter((review): review is ReceiptReviewDraft => {
      if (!review || typeof review !== 'object') return false;
      if (typeof review.id !== 'string' || !review.id || seenIds.has(review.id)) return false;
      if (!Array.isArray(review.lineItems) || typeof review.date !== 'string') return false;
      seenIds.add(review.id);
      return true;
    });
  } catch {
    return [];
  }
};

const persistReceiptReviews = (reviews: ReceiptReviewDraft[]) => {
  try {
    localStorage.setItem(RECEIPT_REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch {
    // Storage may be unavailable in private/restricted browser contexts.
  }
};

const getLocalDateInput = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;



export function useReceiptWorkflow({ items, wallets, budgetConfig, appSettings, handleAddTransaction, showAppNotice, revealReceiptTransaction }: ReceiptWorkflowOptions) {
  const appItemsRef = useRef(items);
  appItemsRef.current = items;
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);
  const later = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
    timers.current.add(timer);
  };
  const [receiptTasks, setReceiptTasks] = useState<ReceiptProcessingTask[]>([]);
  const receiptTaskFilesRef = useRef(new Map<string, { file: File; context: string }>());
  const [receiptReviews, setReceiptReviews] = useState<ReceiptReviewDraft[]>(readStoredReceiptReviews);

  const updateReceiptReviews = (
    updater: (current: ReceiptReviewDraft[]) => ReceiptReviewDraft[],
  ) => {
    setReceiptReviews((current) => {
      const next = updater(current);
      persistReceiptReviews(next);
      return next;
    });
  };

  useEffect(() => {
    if (!receiptReviews.length || !items.length) return;
    const committedAttachmentIds = new Set(
      items
        .map((item) => item.meta.receiptCapture?.attachmentId)
        .filter((value): value is string => !!value),
    );
    if (!committedAttachmentIds.size) return;

    updateReceiptReviews((current) => {
      const next = current.filter((review) =>
        !review.attachmentId || !committedAttachmentIds.has(review.attachmentId),
      );
      return next.length === current.length ? current : next;
    });
  }, [items, receiptReviews.length]);

  const handleChangeReceiptReview = (draft: ReceiptReviewDraft) => {
    const duplicate = findDuplicateReceiptTransaction(appItemsRef.current, {
      merchant: draft.merchant,
      date: draft.date,
      totalAmount: sumTransactionLineItems(draft.lineItems),
      lineItems: draft.lineItems,
      fingerprint: draft.fingerprint,
    });
    updateReceiptReviews((current) => current.map((review) => review.id === draft.id
      ? {
          ...draft,
          duplicateItemId: duplicate?.id,
          allowDuplicate: duplicate?.id === draft.duplicateItemId ? draft.allowDuplicate : false,
        }
      : review));
  };

  const commitReceiptDraft = async (
    draft: ReceiptReviewDraft,
    options: { requireWallet: boolean; revealTransaction: boolean },
  ) => {
    const duplicate = findDuplicateReceiptTransaction(appItemsRef.current, {
      merchant: draft.merchant,
      date: draft.date,
      totalAmount: sumTransactionLineItems(draft.lineItems),
      lineItems: draft.lineItems,
      fingerprint: draft.fingerprint,
    });
    if (duplicate && !draft.allowDuplicate) {
      throw new Error('Transaksi serupa sudah ada. Tinjau transaksi lama atau izinkan penyimpanan duplikat.');
    }

    const currency = (draft.originalCurrency || 'IDR').toUpperCase();
    const exchangeRate = currency === 'IDR' ? 1 : Number(draft.exchangeRateToIdr || 0);
    if (currency !== 'IDR' && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      throw new Error('Kurs mata uang ke IDR diperlukan sebelum transaksi dapat disimpan.');
    }

    const convertedLineItems = convertTransactionLineItemsToIdr(draft.lineItems, currency, exchangeRate);
    if (!draft.date || !convertedLineItems.length || (options.requireWallet && !draft.walletId)) {
      throw new Error(options.requireWallet
        ? 'Lengkapi wallet, tanggal, dan rincian item sebelum menyimpan.'
        : 'Tanggal dan rincian item harus tersedia sebelum menyimpan.');
    }

    const originalTotal = sumTransactionLineItems(draft.lineItems);
    const description = draft.merchant?.trim()
      || draft.imageName.replace(/\.[^.]+$/, '').trim()
      || 'Transaksi dari nota';

    const savedItem = await handleAddTransaction(
      description,
      sumTransactionLineItems(convertedLineItems),
      'expense',
      draft.walletId,
      draft.defaultBudgetCategory,
      undefined,
      draft.date,
      convertedLineItems,
      draft.merchant,
      {
        attachmentId: draft.attachmentId,
        imageName: draft.imageName,
        imageMimeType: draft.imageMimeType,
        imageSize: draft.imageSize,
        fingerprint: draft.fingerprint,
        context: draft.context,
        extractedAt: draft.createdAt,
        originalCurrency: currency,
        originalTotal,
        exchangeRateToIdr: exchangeRate,
      },
      currency,
      originalTotal,
      exchangeRate,
    );

    if (options.revealTransaction) revealReceiptTransaction(draft.date);
    return savedItem;
  };

  const handleApproveReceiptReview = async (draft: ReceiptReviewDraft) => {
    await commitReceiptDraft(draft, { requireWallet: true, revealTransaction: true });
    updateReceiptReviews((current) => current.filter((review) => review.id !== draft.id));
  };

  const handleRejectReceiptReview = async (draft: ReceiptReviewDraft) => {
    updateReceiptReviews((current) => current.filter((review) => review.id !== draft.id));
    await deleteReceiptAttachment(draft.attachmentId).catch(() => undefined);
  };

  const updateReceiptTask = (taskId: string, changes: Partial<ReceiptProcessingTask>) => {
    setReceiptTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...changes } : task));
  };

  const clearReceiptTask = (taskId: string) => {
    receiptTaskFilesRef.current.delete(taskId);
    setReceiptTasks((current) => current.filter((task) => task.id !== taskId));
  };

  const processReceiptInBackground = async (taskId: string, image: File, text: string) => {
    let attachmentId: string | undefined;
    updateReceiptTask(taskId, {
      status: 'pending',
      stage: 'uploading',
      error: undefined,
      outcome: undefined,
      transactionItemId: undefined,
      completedAt: undefined,
    });

    try {
      const [savedAttachmentId, fingerprint] = await Promise.all([
        saveReceiptAttachment(image),
        createReceiptFingerprint(image),
      ]);
      attachmentId = savedAttachmentId;
      updateReceiptTask(taskId, { stage: 'reading' });

      const { parseReceiptImage } = await import('../services/receiptParserService');
      const parsed = await parseReceiptImage(
        image,
        text,
        wallets,
        budgetConfig.rules || [],
        appSettings.parsingModel,
      );
      updateReceiptTask(taskId, { stage: 'categorizing' });

      const originalCurrency = (parsed.currency || 'IDR').toUpperCase();
      const originalTotal = sumTransactionLineItems(parsed.lineItems);
      const duplicate = findDuplicateReceiptTransaction(appItemsRef.current, {
        merchant: parsed.merchant,
        date: parsed.date,
        totalAmount: originalTotal,
        lineItems: parsed.lineItems,
        fingerprint,
      });
      const draft: ReceiptReviewDraft = {
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        imageName: image.name,
        imageMimeType: image.type,
        imageSize: image.size,
        attachmentId,
        fingerprint,
        context: text.trim() || undefined,
        merchant: parsed.merchant,
        date: parsed.date || getLocalDateInput(),
        walletId: parsed.walletId,
        originalCurrency,
        originalTotal,
        exchangeRateToIdr: originalCurrency === 'IDR' ? 1 : undefined,
        lineItems: parsed.lineItems,
        warnings: parsed.warnings,
        duplicateItemId: duplicate?.id,
        allowDuplicate: false,
      };

      if (shouldQueueReceiptReview(appSettings)) {
        updateReceiptReviews((current) => [draft, ...current]);
        updateReceiptTask(taskId, {
          status: 'success',
          stage: 'ready',
          outcome: 'review',
          completedAt: Date.now(),
        });
        showAppNotice('Nota selesai dibaca dan siap ditinjau di pusat tinjauan.', 'success');
        later(() => clearReceiptTask(taskId), 2500);
      } else {
        updateReceiptTask(taskId, { stage: 'saving' });
        const savedItem = await commitReceiptDraft(draft, {
          requireWallet: false,
          revealTransaction: false,
        });
        updateReceiptTask(taskId, {
          status: 'success',
          stage: 'ready',
          outcome: 'saved',
          transactionItemId: savedItem.id,
          completedAt: Date.now(),
        });
        showAppNotice('Transaksi dari nota sudah disimpan. Proses lengkap tersedia di pusat tinjauan.', 'success');
        receiptTaskFilesRef.current.delete(taskId);
        later(() => clearReceiptTask(taskId), 12000);
      }
    } catch (scanError) {
      if (attachmentId) await deleteReceiptAttachment(attachmentId).catch(() => undefined);
      const message = scanError instanceof Error ? scanError.message : 'Gagal memproses nota.';
      updateReceiptTask(taskId, {
        status: 'failed',
        error: message,
        completedAt: Date.now(),
      });
      showAppNotice(`Gagal memproses nota: ${message}`, 'error');
    }
  };

  const enqueueReceiptProcessing = (image: File, text: string) => {
    const taskId = uuidv4();
    receiptTaskFilesRef.current.set(taskId, { file: image, context: text });
    setReceiptTasks((current) => [{
      id: taskId,
      createdAt: Date.now(),
      imageName: image.name,
      context: text.trim() || undefined,
      status: 'pending',
      stage: 'uploading',
    }, ...current]);
    showAppNotice('Nota diproses di latar belakang. Kamu tetap bisa menambahkan input baru.', 'info');
    void processReceiptInBackground(taskId, image, text);
  };

  const retryReceiptTask = (taskId: string) => {
    const source = receiptTaskFilesRef.current.get(taskId);
    if (!source) {
      updateReceiptTask(taskId, {
        status: 'failed',
        error: 'Gambar asli tidak lagi tersedia. Lampirkan ulang nota dari chat bar.',
        completedAt: Date.now(),
      });
      return;
    }
    void processReceiptInBackground(taskId, source.file, source.context);
  };

  const handleViewReceiptTaskTransaction = (itemId: string) => {
    const item = appItemsRef.current.find((candidate) => candidate.id === itemId);
    if (!item) return;
    revealReceiptTransaction(item.meta.date || item.completed_at || item.created_at);
  };


  return { receiptTasks, receiptReviews, handleChangeReceiptReview, handleApproveReceiptReview, handleRejectReceiptReview, clearReceiptTask, retryReceiptTask, enqueueReceiptProcessing, handleViewReceiptTaskTransaction };
}
