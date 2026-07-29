import React, { useEffect, useLayoutEffect, useRef, useState, ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  SendHorizonal,
  TrendingDown,
  TrendingUp,
  Target,
  ShoppingCart,
  StickyNote,
  BookText,
  PiggyBank,
  Loader2,
  MessageSquareText,
  ClipboardCheck,
  ImagePlus,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { ImageAttachmentMode, SyncProgress, SyncStatus } from '../types';
import {
  errorNudgeVariants,
  fadeVariants,
  listItemVariants,
  popVariants,
  riseVariants,
  scaleVariants,
  staggerContainerVariants,
} from '../motion/variants';
import CountBadge from '../motion/CountBadge';

interface InputBarProps {
  onSend: (text: string, image?: File, options?: { imageMode: ImageAttachmentMode }) => void | Promise<void>;
  onFocus?: () => void;
  onBlur?: () => void;
  startAction?: ReactNode;
  topContent?: ReactNode;
  saveStatus?: SyncStatus;
  saveProgress?: SyncProgress | null;
  fetchStatus?: SyncStatus;
  pendingCount?: number;
  isChatOpen?: boolean;
  onOpenChat?: () => void;
  showReviewCenterButton?: boolean;
  reviewCenterActive?: boolean;
  reviewCenterCount?: number;
  onOpenReviewCenter?: () => void;
  error?: string | null;
}

const SUGGESTIONS = [
  { label: 'Catat pengeluaran', value: 'Expense:', icon: <TrendingDown className="h-3.5 w-3.5 text-red-500" /> },
  { label: 'Catat pemasukan', value: 'Income:', icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> },
  { label: 'Tambah tabungan', value: 'Saving:', icon: <PiggyBank className="h-3.5 w-3.5 text-indigo-500" /> },
  { label: 'Buat fokus', value: 'Focus:', icon: <Target className="h-3.5 w-3.5 text-blue-500" /> },
  { label: 'Tambah belanja', value: 'shopping:', icon: <ShoppingCart className="h-3.5 w-3.5 text-purple-500" /> },
  { label: 'Tulis catatan', value: 'notes:', icon: <StickyNote className="h-3.5 w-3.5 text-amber-500" /> },
  { label: 'Tulis jurnal', value: 'Journal:', icon: <BookText className="h-3.5 w-3.5 text-fuchsia-500" /> },
];

const RECEIPT_SUGGESTIONS = [
  { label: 'Pilih wallet', value: 'wallet:', icon: <TrendingDown className="h-3.5 w-3.5 text-indigo-500" /> },
  { label: 'Atur tanggal', value: 'tanggal:', icon: <ClipboardCheck className="h-3.5 w-3.5 text-emerald-500" /> },
  { label: 'Tambah catatan', value: 'catatan:', icon: <StickyNote className="h-3.5 w-3.5 text-amber-500" /> },
];

type ComposerSubmitState = 'idle' | 'submitting' | 'received' | 'error';

const InputBar: React.FC<InputBarProps> = ({
  onSend,
  onFocus,
  onBlur,
  startAction,
  topContent,
  saveStatus,
  saveProgress,
  fetchStatus,
  pendingCount,
  isChatOpen,
  onOpenChat,
  showReviewCenterButton,
  reviewCenterActive,
  reviewCenterCount,
  onOpenReviewCenter,
  error,
}) => {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imageMode, setImageMode] = useState<ImageAttachmentMode>('receipt');
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [submitState, setSubmitState] = useState<ComposerSubmitState>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const settleTimerRef = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();
  const isSubmitting = submitState === 'submitting';
  const isReady = !!input.trim() || !!image;

  useLayoutEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '0px';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
  }, []);

  useEffect(() => {
    if (!image) {
      setImagePreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(image);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !image) || isSubmitting) return;

    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    setSubmitState('submitting');
    setImageError('');
    try {
      await onSend(input.trim(), image || undefined, image ? { imageMode } : undefined);
      setInput('');
      setImage(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      textareaRef.current?.focus();
      setSubmitState('received');
      settleTimerRef.current = window.setTimeout(() => {
        setSubmitState('idle');
        settleTimerRef.current = null;
      }, 900);
    } catch (submitError) {
      setImageError(submitError instanceof Error ? submitError.message : 'Gagal mengirim input.');
      setSubmitState('error');
      settleTimerRef.current = window.setTimeout(() => {
        setSubmitState('idle');
        settleTimerRef.current = null;
      }, 1800);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleFocus = () => {
    setShowSuggestions(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setShowSuggestions(false);
    onBlur?.();
  };

  const addTemplate = (template: string) => {
    setInput(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return `${template} `;
      if (trimmed.endsWith(';')) return `${trimmed} ${template} `;
      return `${trimmed}; ${template} `;
    });

    textareaRef.current?.focus();
  };

  const handleImageChange = (file?: File) => {
    setSubmitState('idle');
    setImageError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('File harus berupa gambar.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageError('Ukuran gambar maksimal 10 MB.');
      return;
    }
    setImage(file);
    setImageMode('receipt');
    textareaRef.current?.focus();
  };

  const removeImage = () => {
    setSubmitState('idle');
    setImage(null);
    setImageMode('receipt');
    setImageError('');
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const isPopupVisible =
    showSuggestions ||
    !!startAction ||
    saveStatus === 'saving' ||
    fetchStatus === 'syncing' ||
    showReviewCenterButton ||
    (pendingCount !== undefined && pendingCount > 0);
  const visibleError = imageError || error;
  const buttonState = isSubmitting
    ? 'submitting'
    : submitState === 'received'
      ? 'received'
      : submitState === 'error'
        ? 'error'
        : isReady
          ? 'ready'
          : 'idle';

  return (
    <div data-global-composer="true" className="z-[60] w-full px-3 pb-3 pt-2 pointer-events-none sm:px-5 lg:px-0 lg:pb-5">
      <div className="mx-auto w-full max-w-3xl pointer-events-none lg:max-w-4xl">
        <div
          className="relative"
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget;
            if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
              handleBlur();
            }
          }}
        >
          <AnimatePresence initial={false}>
            {visibleError && (
              <motion.div
                key={visibleError}
                className="absolute bottom-full left-0 w-full mb-3 pointer-events-auto"
                variants={reduceMotion ? fadeVariants : errorNudgeVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                role="alert"
              >
                <div className="mx-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {visibleError}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {topContent && (
            <div className="absolute bottom-full left-0 w-full mb-16 pointer-events-none">
              {topContent}
            </div>
          )}

          <AnimatePresence initial={false}>
            {isPopupVisible && (
            <motion.div
              className="pointer-events-none absolute bottom-full left-0 mb-3 w-full"
              variants={reduceMotion ? fadeVariants : riseVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
            <div className="flex items-center justify-between gap-2 px-1 py-1 w-full pointer-events-none">
              <div className="flex items-center gap-2 flex-1 overflow-hidden pointer-events-none">
                {startAction && (
                  <div className="shrink-0 z-20 pointer-events-auto">
                    {startAction}
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {showSuggestions && (
                  <motion.div
                    className="flex gap-2 overflow-x-auto no-scrollbar pb-1 flex-1 pointer-events-auto"
                    variants={staggerContainerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    {(image && imageMode === 'receipt' ? RECEIPT_SUGGESTIONS : SUGGESTIONS).map((item) => (
                      <motion.button
                        key={item.label}
                        variants={listItemVariants}
                        onMouseDown={(e) => {
                          e.preventDefault();
                        }}
                        onClick={() => addTemplate(item.value)}
                        className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface/95 px-3.5 py-2 text-xs font-semibold text-primary shadow-sm ring-1 ring-inset ring-border/70 backdrop-blur-xl transition-colors hover:bg-surface hover:ring-indigo-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 active:scale-[0.98]"
                      >
                        {item.icon}
                        {item.label}
                      </motion.button>
                    ))}
                  </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {showReviewCenterButton ? (
                <div className="shrink-0 z-20 pointer-events-auto">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onOpenReviewCenter}
                    className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 shadow-sm ring-1 ring-inset ring-indigo-500/25 backdrop-blur-xl transition-colors hover:bg-indigo-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 active:scale-[0.98]"
                    title="Buka pusat tinjauan"
                    aria-label={`Buka pusat tinjauan${reviewCenterCount ? `, ${reviewCenterCount} item` : ''}`}
                    aria-busy={reviewCenterActive || undefined}
                  >
                    {reviewCenterActive && (
                      <span className={`absolute -inset-1 rounded-full border-2 border-transparent border-r-indigo-300 border-t-indigo-500 ${reduceMotion ? '' : 'animate-spin'}`} />
                    )}
                    <ClipboardCheck className="w-5 h-5" />
                    <CountBadge
                      count={reviewCenterCount || 0}
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center border border-surface"
                    />
                  </button>
                </div>
              ) : (saveStatus === 'saving' || fetchStatus === 'syncing') && (
                <div className="shrink-0 z-20 pointer-events-none" title={saveStatus === 'saving' && saveProgress ? `${saveProgress.label}${saveProgress.detail ? ` — ${saveProgress.detail}` : ''}` : undefined}>
                  <div
                    role="status"
                    aria-live="polite"
                    className={`min-h-11 min-w-11 rounded-full ${
                      saveStatus === 'saving'
                        ? 'bg-amber-500/20 border-amber-500/40'
                        : fetchStatus === 'syncing'
                        ? 'bg-blue-500/20 border-blue-500/40'
                        : 'bg-purple-500/20 border-purple-500/40'
                    } backdrop-blur-xl border flex items-center justify-center gap-2 px-3 shadow-xl ${
                      saveStatus === 'saving'
                        ? 'shadow-amber-500/20'
                        : fetchStatus === 'syncing'
                        ? 'shadow-blue-500/20'
                        : 'shadow-purple-500/20'
                    }`}
                  >
                    <Loader2
                      className={`w-5 h-5 ${
                        saveStatus === 'saving'
                          ? 'text-amber-400'
                          : fetchStatus === 'syncing'
                          ? 'text-blue-400'
                          : 'text-purple-400'
                      } ${reduceMotion ? '' : 'animate-spin'}`}
                    />
                    {saveStatus === 'saving' && saveProgress && (
                      <span className="hidden sm:flex flex-col leading-none text-left max-w-[190px]">
                        <span className="text-[11px] font-semibold text-amber-300 truncate">{saveProgress.label}</span>
                        {saveProgress.detail && <span className="text-[10px] text-muted truncate">{saveProgress.detail}</span>}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
            </motion.div>
            )}
          </AnimatePresence>

          <div
            data-composer-surface="true"
            data-composer-state={buttonState}
            className={`relative overflow-hidden rounded-[1.6rem] border bg-surface/94 backdrop-blur-2xl pointer-events-auto transition-[border-color,box-shadow,transform] duration-150 ${
              showSuggestions
                ? 'scale-[1.002] border-indigo-500/40 shadow-[0_16px_42px_rgba(79,70,229,0.14)]'
                : 'border-border/80 shadow-[0_14px_38px_rgba(0,0,0,0.12)]'
            }`}
          >
            <AnimatePresence initial={false}>
              {image && (
              <motion.div
                className="space-y-2 px-4 pt-3"
                variants={reduceMotion ? fadeVariants : scaleVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-background/60">
                    {imagePreviewUrl && <img src={imagePreviewUrl} alt="Lampiran gambar" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-indigo-500">
                        {imageMode === 'receipt' ? 'Nota' : 'Gambar chat'}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs font-bold text-primary">{image.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={removeImage}
                    disabled={isSubmitting}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-black/5 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:hover:bg-white/10 disabled:opacity-50"
                    title="Hapus gambar"
                    aria-label="Hapus gambar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-background/50 p-1">
                  <button
                    type="button"
                    onClick={() => setImageMode('receipt')}
                    disabled={isSubmitting}
                    className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${imageMode === 'receipt' ? 'bg-indigo-500 text-white' : 'text-muted hover:text-primary'}`}
                    aria-pressed={imageMode === 'receipt'}
                  >
                    Scan nota
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageMode('chat')}
                    disabled={isSubmitting}
                    className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${imageMode === 'chat' ? 'bg-indigo-500 text-white' : 'text-muted hover:text-primary'}`}
                    aria-pressed={imageMode === 'chat'}
                  >
                    Tanya tentang gambar
                  </button>
                </div>
              </motion.div>
              )}
            </AnimatePresence>

            <div className="flex min-h-[56px] items-end">
              <button
                type="button"
                onClick={onOpenChat}
                className={`m-1.5 mr-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${
                  isChatOpen ? 'bg-indigo-500/10 text-indigo-500' : 'text-muted hover:bg-black/[0.04] hover:text-indigo-500 dark:hover:bg-white/[0.06]'
                }`}
                title="Buka copilot Arkaiv"
                aria-label="Buka copilot Arkaiv"
              >
                <MessageSquareText className="w-5 h-5" />
              </button>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleImageChange(event.target.files?.[0])}
              />
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => imageInputRef.current?.click()}
                disabled={isSubmitting}
                className={`my-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:opacity-50 ${image ? 'bg-indigo-500/10 text-indigo-500' : 'text-muted hover:bg-black/[0.04] hover:text-indigo-500 dark:hover:bg-white/[0.06]'}`}
                title="Tambahkan gambar nota atau invoice"
                aria-label="Tambahkan gambar nota atau invoice"
              >
                <ImagePlus className="w-5 h-5" />
              </button>

              <textarea
                id="global-composer-input"
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (submitState !== 'submitting') setSubmitState('idle');
                }}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                placeholder={image ? (imageMode === 'receipt' ? 'Tambahkan wallet atau tanggal bila perlu' : 'Tanyakan apa pun tentang gambar ini') : (isChatOpen ? 'Berapa safe-to-spend sampai akhir bulan?' : 'Catat makan siang 45 ribu dari GoPay')}
                aria-label="Tulis perintah atau pertanyaan untuk copilot Arkaiv"
                enterKeyHint="send"
                className="max-h-[120px] min-w-0 flex-1 resize-none bg-transparent px-3 py-[18px] text-[15px] font-medium leading-5 text-primary placeholder:text-muted/75 focus:outline-none no-scrollbar"
                rows={1}
              />

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!isReady || isSubmitting}
                className={`m-1.5 ml-1 flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-3 text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:bg-muted/20 disabled:text-muted disabled:opacity-60 disabled:shadow-none ${
                  buttonState === 'received'
                    ? 'bg-emerald-600 shadow-emerald-500/20'
                    : buttonState === 'error'
                      ? 'bg-red-500 shadow-red-500/20 hover:bg-red-400'
                      : 'bg-indigo-600 shadow-indigo-500/20 hover:bg-indigo-500'
                }`}
                title={image ? (imageMode === 'receipt' ? 'Proses nota di latar belakang' : 'Tanyakan tentang gambar') : 'Kirim'}
                aria-label={
                  buttonState === 'submitting'
                    ? 'Menerima input'
                    : buttonState === 'received'
                      ? 'Input diterima'
                      : buttonState === 'error'
                        ? 'Coba kirim lagi'
                        : 'Kirim'
                }
              >
                <AnimatePresence initial={false} mode="wait">
                  <motion.span
                    key={buttonState}
                    variants={popVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex items-center gap-1.5"
                  >
                    {buttonState === 'submitting' ? (
                      <Loader2 className={`h-5 w-5 ${reduceMotion ? '' : 'animate-spin'}`} />
                    ) : buttonState === 'received' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : buttonState === 'error' ? (
                      <AlertCircle className="w-5 h-5" />
                    ) : (
                      <>
                        {image && <span className="hidden text-[10px] font-bold sm:inline">{imageMode === 'receipt' ? 'Proses' : 'Tanya'}</span>}
                        <SendHorizonal className="w-5 h-5" />
                      </>
                    )}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
          </div>
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {buttonState === 'submitting'
              ? 'Input sedang diproses.'
              : buttonState === 'received'
                ? 'Input diterima.'
                : buttonState === 'error'
                  ? 'Input belum terkirim. Coba lagi.'
                  : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputBar;
