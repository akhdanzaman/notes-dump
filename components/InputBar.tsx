
import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { SendHorizonal, TrendingDown, TrendingUp, Target, ShoppingCart, StickyNote, Sparkles, PiggyBank } from 'lucide-react';

interface InputBarProps {
  onSend: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  startAction?: ReactNode;
}

const SUGGESTIONS = [
  { label: 'Expense', value: 'Expense:', icon: <TrendingDown className="w-3 h-3 text-red-400" /> },
  { label: 'Income', value: 'Income:', icon: <TrendingUp className="w-3 h-3 text-emerald-400" /> },
  { label: 'Saving', value: 'Saving:', icon: <PiggyBank className="w-3 h-3 text-indigo-400" /> },
  { label: 'Focus', value: 'Focus:', icon: <Target className="w-3 h-3 text-blue-400" /> },
  { label: 'Shopping', value: 'shopping:', icon: <ShoppingCart className="w-3 h-3 text-purple-400" /> },
  { label: 'Notes', value: 'notes:', icon: <StickyNote className="w-3 h-3 text-amber-400" /> },
];

const InputBar: React.FC<InputBarProps> = ({ onSend, onFocus, onBlur, startAction }) => {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize logic
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to allow shrinking
      textareaRef.current.style.height = 'auto';
      // Set height based on scrollHeight, capped at some max
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput('');
    // Focus back
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
    if (onFocus) onFocus();
  };

  const handleBlur = () => {
    // Delay hiding to allow clicks to register if needed, though onMouseDown prevents blur usually
    setShowSuggestions(false);
    if (onBlur) onBlur();
  };

  const addTemplate = (template: string) => {
      setInput(prev => {
          const trimmed = prev.trim();
          if (!trimmed) return `${template} `;
          
          // Check if it already ends with a separator
          if (trimmed.endsWith(';')) return `${trimmed} ${template} `;
          
          return `${trimmed}; ${template} `;
      });
      // Ensure focus remains/returns to textarea
      textareaRef.current?.focus();
  };

  const isPopupVisible = showSuggestions || !!startAction;

  return (
    <div className="w-full pt-2 pb-4 px-4 z-50 pointer-events-none">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <div className="relative group">
          
          {/* Quick Suggestions & Actions Popup */}
          <div className={`absolute bottom-full left-0 w-full mb-3 transition-all duration-200 ease-out origin-bottom ${isPopupVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}>
              <div className="flex items-end gap-2 px-1 py-1">
                  
                  {/* Start Action (e.g. Search Button) */}
                  {startAction && (
                      <div className="shrink-0 z-20">
                          {startAction}
                      </div>
                  )}
                  
                  {/* Suggestions List */}
                  {showSuggestions && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 flex-1">
                        {SUGGESTIONS.map((item) => (
                            <button
                                key={item.label}
                                onMouseDown={(e) => {
                                    e.preventDefault(); // Prevent focus loss from textarea
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
          </div>

          {/* Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2rem] opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
          
          {/* Input Area */}
          <div className="relative flex items-end bg-surface/80 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden min-h-[56px]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Dump your brain here..."
              className="flex-1 bg-transparent px-6 py-4 text-primary placeholder-muted focus:outline-none resize-none no-scrollbar max-h-[120px]"
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
