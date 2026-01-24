import React, { useState, useRef, useEffect } from 'react';
import { SendHorizonal } from 'lucide-react';

interface InputBarProps {
  onSend: (text: string) => void;
  // Removed isProcessing prop as we want background processing
}

const InputBar: React.FC<InputBarProps> = ({ onSend }) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input);
    setInput('');
    // Keep focus on input for rapid fire entry
    inputRef.current?.focus();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pb-6 pt-10 z-50">
      <div className="max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-acc-todo via-acc-note to-acc-event rounded-full opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
          <div className="relative flex items-center bg-surface rounded-full border border-border shadow-2xl overflow-hidden">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Dump your brain here..."
              className="flex-1 bg-transparent px-6 py-4 text-white placeholder-muted focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-4 text-primary hover:text-white disabled:opacity-30 transition-colors"
            >
              <SendHorizonal className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputBar;