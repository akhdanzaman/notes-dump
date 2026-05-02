import React, { useState, useRef, useEffect, ReactNode } from 'react';
import {
  SendHorizonal,
  TrendingDown,
  TrendingUp,
  Target,
  ShoppingCart,
  StickyNote,
  PiggyBank,
  Loader2,
  MessageSquareText,
  ClipboardCheck
} from 'lucide-react';
import { SyncStatus } from '../types';

interface InputBarProps {
  onSend: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  startAction?: ReactNode;
  topContent?: ReactNode;
  saveStatus?: SyncStatus;
  fetchStatus?: SyncStatus;
  pendingCount?: number;
  isChatOpen?: boolean;
  onOpenChat?: () => void;
  showReviewCenterButton?: boolean;
  reviewCenterActive?: boolean;
  reviewCenterCount?: number;
  onOpenReviewCenter?: () => void;
}

const SUGGESTIONS = [
  { label: 'Expense', value: 'Expense:', icon: <TrendingDown className="w-3 h-3 text-red-400" /> },
  { label: 'Income', value: 'Income:', icon: <TrendingUp className="w-3 h-3 text-emerald-400" /> },
  { label: 'Saving', value: 'Saving:', icon: <PiggyBank className="w-3 h-3 text-indigo-400" /> },
  { label: 'Focus', value: 'Focus:', icon: <Target className="w-3 h-3 text-blue-400" /> },
  { label: 'Shopping', value: 'shopping:', icon: <ShoppingCart className="w-3 h-3 text-purple-400" /> },
  { label: 'Notes', value: 'notes:', icon: <StickyNote className="w-3 h-3 text-amber-400" /> },
];

const InputBar: React.FC<InputBarProps> = ({
  onSend,
  onFocus,
  onBlur,
  startAction,
  topContent,
  saveStatus,
  fetchStatus,
  pendingCount,
  isChatOpen,
  onOpenChat,
  showReviewCenterButton,
  reviewCenterActive,
  reviewCenterCount,
  onOpenReviewCenter
}) => {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
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

  const isPopupVisible =
    showSuggestions ||
    !!startAction ||
    saveStatus === 'saving' ||
    fetchStatus === 'syncing' ||
    showReviewCenterButton ||
    (pendingCount !== undefined && pendingCount > 0);

  return (
    <div className="w-full pt-2 pb-4 px-4 z-[60] pointer-events-none">
      <div className="max-w-2xl mx-auto pointer-events-none">
        <div className="relative">
          {/* Top Content (e.g. Pending Reviews) */}
          {topContent && (
            <div className="absolute bottom-full left-0 w-full mb-16 pointer-events-none">
              {topContent}
            </div>
          )}

          {/* Quick Suggestions & Actions Popup */}
          <div
            className={`absolute bottom-full left-0 w-full mb-3 transition-all duration-300 ease-out origin-bottom ${
              isPopupVisible
                ? 'opacity-100 scale-100 translate-y-0'
                : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
            } pointer-events-none`}
          >
            <div className="flex items-center justify-between gap-2 px-1 py-1 w-full pointer-events-none">
              <div className="flex items-center gap-2 flex-1 overflow-hidden pointer-events-none">
                {/* Start Action */}
                {startAction && (
                  <div className="shrink-0 z-20 pointer-events-auto">
                    {startAction}
                  </div>
                )}

                {/* Suggestions List */}
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

              {/* Review Center / Syncing Animation */}
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
                <div className="shrink-0 z-20 pointer-events-none">
                  <div
                    className={`w-10 h-10 rounded-full ${
                      saveStatus === 'saving'
                        ? 'bg-amber-500/20 border-amber-500/40'
                        : fetchStatus === 'syncing'
                        ? 'bg-blue-500/20 border-blue-500/40'
                        : 'bg-purple-500/20 border-purple-500/40'
                    } backdrop-blur-xl border flex items-center justify-center shadow-xl ${
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
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] opacity-20 group-hover:opacity-40 transition duration-500 blur pointer-events-none"></div>

          {/* Input Area */}
          <div className="relative flex items-end bg-surface/80 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden min-h-[56px] pointer-events-auto">
            <button
              onClick={onOpenChat}
              className={`p-4 mb-0.5 transition-colors ${
                isChatOpen ? 'text-indigo-500' : 'text-muted hover:text-indigo-500'
              }`}
              title="Open AI Chat"
            >
              <MessageSquareText className="w-5 h-5" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={isChatOpen ? 'Ask a follow-up question...' : 'Dump your brain here...'}
              className="flex-1 bg-transparent py-4 text-primary placeholder-muted focus:outline-none resize-none no-scrollbar max-h-[120px]"
              rows={1}
            />

            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim()}
              className="p-4 mb-0.5 text-muted hover:text-indigo-500 disabled:opacity-30 transition-colors"
            >
              <SendHorizonal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputBar;