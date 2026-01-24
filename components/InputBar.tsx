import React, { useState, useRef, useEffect } from 'react';
import { SendHorizonal } from 'lucide-react';

interface InputBarProps {
  onSend: (text: string) => void;
}

const InputBar: React.FC<InputBarProps> = ({ onSend }) => {
  const [input, setInput] = useState('');
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

  return (
    <div className="w-full pt-2 pb-4 px-4 bg-background z-50">
      <div className="max-w-3xl mx-auto">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-acc-todo via-acc-note to-acc-event rounded-3xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
          <div className="relative flex items-end bg-surface rounded-3xl border border-border shadow-2xl overflow-hidden min-h-[56px]">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Dump your brain here..."
              className="flex-1 bg-transparent px-6 py-4 text-white placeholder-muted focus:outline-none resize-none no-scrollbar max-h-[120px]"
              rows={1}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!input.trim()}
              className="p-4 mb-0.5 text-primary hover:text-white disabled:opacity-30 transition-colors"
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