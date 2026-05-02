import React from 'react';
import { ChevronDown } from 'lucide-react';

interface LoadMoreButtonProps {
  remainingCount: number;
  onClick: () => void;
  className?: string;
}

const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({ remainingCount, onClick, className = '' }) => {
  if (remainingCount <= 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-3xl border border-border bg-surface/80 px-4 py-3 text-sm font-semibold text-primary transition-all hover:bg-surface hover:border-primary/20 flex items-center justify-center gap-2 ${className}`.trim()}
    >
      <ChevronDown className="w-4 h-4" />
      Load {Math.min(remainingCount, 20)} more
      <span className="text-muted font-medium">({remainingCount} left)</span>
    </button>
  );
};

export default LoadMoreButton;
