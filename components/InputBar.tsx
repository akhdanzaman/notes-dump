import React, { useEffect, useRef, useState, ReactNode } from 'react';
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
} from 'lucide-react';
import { SyncProgress, SyncStatus } from '../types';

interface InputBarProps {
  onSend: (text: string, image?: File) => void | Promise<void>;
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
  { label: 'Expense', value: 'Expense:', icon: <TrendingDown className="w-3 h-3 text-red-400" /> },
  { label: 'Income', value: 'Income:', icon: <TrendingUp className="w-3 h-3 text-emerald-400" /> },
  { label: 'Saving', value: 'Saving:', icon: <PiggyBank className="w-3 h-3 text-indigo-400" /> },
  { label: 'Focus', value: 'Focus:', icon: <Target className="w-3 h-3 text-blue-400" /> },
  { label: 'Shopping', value: 'shopping:', icon: <ShoppingCart className="w-3 h-3 text-purple-400" /> },
  { label: 'Notes', value: 'notes:', icon: <StickyNote className="w-3 h-3 text-amber-400" /> },
  { label: 'Journal', value: 'Journal:', icon: <BookText className="w-3 h-3 text-fuchsia-400" /> },
];

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
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageError, setImageError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

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

    setIsSubmitting(true);
    setImageError('');
    try {
      await onSend(input.trim(), image || undefined);
      setInput('');
      setImage(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      textareaRef.current?.focus();
    } catch (submitError) {
      setImageError(submitError instanceof Error ? submitError.message : 'Gagal mengirim input.');
    } finally {
      setIsSubmitting(false);
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
    textareaRef.current?.focus();
  };

  const removeImage = () => {
    setImage(null);
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

  return (
    <div data-global-composer="true" className="w-full pt-2 pb-4 px-4 z-[60] pointer-events-none lg:px-0 lg:pb-6">
      <div className="max-w-2xl mx-auto pointer-events-none lg:mx-0 lg:max-w-none lg:w-full">
        <div className="relative">
          {visibleError && (
            <div className="absolute bottom-full left-0 w-full mb-3 pointer-events-auto">
              <div className="mx-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-xs font-medium animate-in slide-in-from-bottom-2">
                ⚠️ {visibleError}
              </div>
            </div>
          )}

          {topContent && (
            <div className="absolute bottom-full left-0 w-full mb-16 pointer-events-none">
              {topContent}
            </div>
          )}

          <div
            className={`absolute bottom-full left-0 w-full mb-3 transition-all duration-300 ease-out origin-bottom ${
              isPopupVisible
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
            } pointer-events-none`}
          >
            <div className="flex items-center justify-between gap-2 px-1 py-1 w-full pointer-events-none">
              <div className="flex items-center gap-2 flex-1 overflow-hidden pointer-events-none">
                {startAction && (
                  <div className="shrink-0 z-20 pointer-events-auto">
                    {startAction}
                  </div>
                )}

                {showSuggestions && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 flex-1 pointer-events-auto">
                    {SUGGESTIONS.map((item) => (
                      <button
                        key={item.label}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addTemplate(item.value);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface/80 backdrop-blur-md border border-border rounded-full text-xs font-medium text-primary shadow-lg hover:border-primary/50 hover:bg-surface active:scale-95 transition-all whitespace-nowrap"
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {showReviewCenterButton ? (
                <div className="shrink-0 z-20 pointer-events-auto">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onOpenReviewCenter}
                    className="relative w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-500/40 text-indigo-500 backdrop-blur-xl flex items-center justify-center shadow-xl shadow-indigo-500/20 hover:bg-indigo-500/25 active:scale-95 transition-all"
                    title="Open Review Center"
                    aria-label="Open Review Center"
                  >
                    {reviewCenterActive && (
                      <span className="absolute -inset-1 rounded-full border-2 border-transparent border-t-indigo-500 border-r-indigo-300 animate-spin" />
                    )}
                    <ClipboardCheck className="w-5 h-5" />
                    {reviewCenterCount !== undefined && reviewCenterCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center border border-surface">
                        {reviewCenterCount > 9 ? '9+' : reviewCenterCount}
                      </span>
                    )}
                  </button>
                </div>
              ) : (saveStatus === 'saving' || fetchStatus === 'syncing') && (
                <div className="shrink-0 z-20 pointer-events-none" title={saveStatus === 'saving' && saveProgress ? `${saveProgress.label}${saveProgress.detail ? ` — ${saveProgress.detail}` : ''}` : undefined}>
                  <div
                    className={`min-w-10 h-10 rounded-full ${
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
                    } animate-pulse`}
                  >
                    <Loader2
                      className={`w-5 h-5 ${
                        saveStatus === 'saving'
                          ? 'text-amber-400'
                          : fetchStatus === 'syncing'
                          ? 'text-blue-400'
                          : 'text-purple-400'
                      } animate-spin`}
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
          </div>

          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] opacity-20 group-hover:opacity-40 transition duration-500 blur pointer-events-none"></div>

          <div data-composer-surface="true" className="relative bg-surface/80 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden pointer-events-auto">
            {image && (
              <div className="flex items-center gap-3 px-4 pt-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-background/60">
                  {imagePreviewUrl && <img src={imagePreviewUrl} alt="Lampiran nota" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold text-primary">{image.name}</div>
                  <div className="mt-0.5 text-[10px] text-muted">Gambar akan dibaca sebagai nota atau invoice.</div>
                </div>
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={isSubmitting}
                  className="rounded-full p-2 text-muted hover:bg-black/5 hover:text-red-500 dark:hover:bg-white/10 disabled:opacity-50"
                  title="Hapus gambar"
                  aria-label="Hapus gambar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="flex min-h-[56px] items-end">
              <button
                type="button"
                onClick={onOpenChat}
                className={`p-4 mb-0.5 transition-colors ${
                  isChatOpen ? 'text-indigo-500' : 'text-muted hover:text-indigo-500'
                }`}
                title="Open AI Chat"
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
                className={`p-3 mb-1 transition-colors disabled:opacity-50 ${image ? 'text-indigo-500' : 'text-muted hover:text-indigo-500'}`}
                title="Tambahkan gambar nota atau invoice"
                aria-label="Tambahkan gambar nota atau invoice"
              >
                <ImagePlus className="w-5 h-5" />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder={image ? 'Tambahkan wallet, tanggal, atau info lain...' : (isChatOpen ? 'Ask a follow-up question...' : 'Dump your brain here...')}
                className="flex-1 bg-transparent py-4 text-primary placeholder-muted focus:outline-none resize-none no-scrollbar max-h-[120px]"
                rows={1}
              />

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={(!input.trim() && !image) || isSubmitting}
                className="p-4 mb-0.5 text-muted hover:text-indigo-500 disabled:opacity-30 transition-colors"
                title={image ? 'Ekstrak dan simpan transaksi' : 'Kirim'}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <SendHorizonal className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputBar;
