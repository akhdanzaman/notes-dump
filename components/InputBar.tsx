import React, { useState, useRef, useEffect, ReactNode } from "react";
import {
  SendHorizontal,
  TrendingDown,
  TrendingUp,
  Target,
  ShoppingCart,
  StickyNote,
  PiggyBank,
  Loader2,
  MessageSquareText,
} from "lucide-react";
import { SyncStatus } from "../types";

interface InputBarProps {
  onSend: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  startAction?: ReactNode;
  saveStatus?: SyncStatus;
  fetchStatus?: SyncStatus;
  pendingCount?: number;
  isChatOpen?: boolean;
  onOpenChat?: () => void;
}

const SUGGESTIONS = [
  {
    label: "Expense",
    value: "Expense:",
    icon: <TrendingDown className="w-3 h-3 text-red-400" />,
  },
  {
    label: "Income",
    value: "Income:",
    icon: <TrendingUp className="w-3 h-3 text-emerald-400" />,
  },
  {
    label: "Saving",
    value: "Saving:",
    icon: <PiggyBank className="w-3 h-3 text-indigo-400" />,
  },
  {
    label: "Focus",
    value: "Focus:",
    icon: <Target className="w-3 h-3 text-blue-400" />,
  },
  {
    label: "Shopping",
    value: "shopping:",
    icon: <ShoppingCart className="w-3 h-3 text-purple-400" />,
  },
  {
    label: "Notes",
    value: "notes:",
    icon: <StickyNote className="w-3 h-3 text-amber-400" />,
  },
];

const InputBar: React.FC<InputBarProps> = ({
  onSend,
  onFocus,
  onBlur,
  startAction,
  saveStatus,
  fetchStatus,
  pendingCount,
  isChatOpen,
  onOpenChat,
}) => {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;

    const updatePosition = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        /**
         * Rumus:
         * visual viewport bottom = vv.offsetTop + vv.height
         * layout viewport bottom = window.innerHeight
         * selisihnya = area yang "tertutup" keyboard / berubah karena viewport mobile
         */
        const viewportBottom = vv.offsetTop + vv.height;
        const offset = Math.max(0, window.innerHeight - viewportBottom);

        setKeyboardOffset(offset);
      });
    };

    updatePosition();

    vv.addEventListener("resize", updatePosition);
    vv.addEventListener("scroll", updatePosition);
    window.addEventListener("orientationchange", updatePosition);
    window.addEventListener("resize", updatePosition);

    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", updatePosition);
      vv.removeEventListener("scroll", updatePosition);
      window.removeEventListener("orientationchange", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
    setInput((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return `${template} `;
      if (trimmed.endsWith(";")) return `${trimmed} ${template} `;
      return `${trimmed}; ${template} `;
    });

    textareaRef.current?.focus();
  };

  const isPopupVisible =
    showSuggestions ||
    !!startAction ||
    saveStatus === "saving" ||
    fetchStatus === "syncing" ||
    (pendingCount !== undefined && pendingCount > 0);

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
      style={{
        transform: `translateY(-${keyboardOffset}px)`,
        transition: "transform 120ms ease-out",
        willChange: "transform",
      }}
    >
      <div className="max-w-2xl mx-auto pointer-events-none">
        <div className="relative">
          {/* Quick Suggestions & Actions Popup */}
          <div
            className={`absolute bottom-full left-0 w-full mb-3 transition-all duration-300 ease-out origin-bottom ${
              isPopupVisible
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 translate-y-2 pointer-events-none"
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

              {(saveStatus === "saving" || fetchStatus === "syncing") && (
                <div className="shrink-0 z-20 pointer-events-none">
                  <div
                    className={`w-10 h-10 rounded-full ${
                      saveStatus === "saving"
                        ? "bg-amber-500/20 border-amber-500/40"
                        : fetchStatus === "syncing"
                          ? "bg-blue-500/20 border-blue-500/40"
                          : "bg-purple-500/20 border-purple-500/40"
                    } backdrop-blur-xl border flex items-center justify-center shadow-xl ${
                      saveStatus === "saving"
                        ? "shadow-amber-500/20"
                        : fetchStatus === "syncing"
                          ? "shadow-blue-500/20"
                          : "shadow-purple-500/20"
                    } animate-pulse`}
                  >
                    <Loader2
                      className={`w-5 h-5 ${
                        saveStatus === "saving"
                          ? "text-amber-400"
                          : fetchStatus === "syncing"
                            ? "text-blue-400"
                            : "text-purple-400"
                      } animate-spin`}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] opacity-20 group-hover:opacity-40 transition duration-500 blur pointer-events-none" />

          {/* Input Area */}
          <div className="relative flex items-end bg-surface/80 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden min-h-[56px] pointer-events-auto">
            <button
              onClick={onOpenChat}
              className={`p-4 mb-0.5 transition-colors ${
                isChatOpen
                  ? "text-indigo-500"
                  : "text-muted hover:text-indigo-500"
              }`}
              title="Open AI Chat"
              type="button"
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
              placeholder={
                isChatOpen
                  ? "Ask a follow-up question..."
                  : "Dump your brain here..."
              }
              className="flex-1 bg-transparent py-4 text-primary placeholder-muted focus:outline-none resize-none no-scrollbar max-h-[120px]"
              rows={1}
            />

            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim()}
              className="p-4 mb-0.5 text-muted hover:text-indigo-500 disabled:opacity-30 transition-colors"
              type="button"
            >
              <SendHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputBar;
