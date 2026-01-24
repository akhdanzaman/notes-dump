import React from 'react';
import { BrainDumpItem } from '../types';
import { Circle, CheckCircle2, Trash2, Repeat, AlertCircle, Calendar, Clock } from 'lucide-react';

interface ShoppingItemProps {
  item: BrainDumpItem;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  readonly?: boolean;
}

const ShoppingItem: React.FC<ShoppingItemProps> = ({ item, onToggleStatus, onDelete, readonly = false }) => {
  const { content, meta, status, completed_at } = item;
  const isDone = status === 'done';
  const isRoutine = meta?.shoppingCategory === 'routine';
  const isUrgent = meta?.shoppingCategory === 'urgent';
  
  // --- Date Logic ---
  
  // 1. Calculate next recurrence for display if item is done
  let nextDueText = null;
  let isWaitingForNextCycle = false;

  if (isRoutine && isDone && completed_at) {
     const recurrence = meta.recurrenceDays || 7;
     const doneDate = new Date(completed_at);
     const nextDate = new Date(doneDate.getTime() + (recurrence * 24 * 60 * 60 * 1000));
     
     // Check if we are still waiting
     if (new Date() < nextDate) {
         isWaitingForNextCycle = true;
         const dayName = nextDate.toLocaleDateString(undefined, { weekday: 'short' });
         const dateNum = nextDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
         nextDueText = `Next: ${dayName}, ${dateNum}`;
     }
  }

  // 2. Format a friendly "Target Date" for Time-bound display (e.g. "Today", "Fri, Oct 12")
  const getFriendlyDate = (isoString?: string) => {
      if (!isoString || isoString === 'null') return null;
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return null;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      const diffTime = target.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays === -1) return 'Yesterday';
      if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
      
      return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const targetDateLabel = !isWaitingForNextCycle ? getFriendlyDate(meta?.date) : null;

  // Display Quantity
  const quantity = meta?.quantity && meta.quantity !== 'null' ? meta.quantity : null;
  
  // Display Recurrence Text (if not waiting)
  const recurrenceText = isRoutine ? `Every ${meta.recurrenceDays || 7} days` : null;

  // Determine styles
  // If waiting for next cycle: Dimmed, checked, but shows "Next: ..."
  const isDisabled = !readonly && isWaitingForNextCycle;

  return (
    <div 
      className={`group flex items-center justify-between p-3 rounded-lg bg-surface border border-border hover:border-acc-shopping/50 transition-all ${isDone && !isRoutine ? 'opacity-60' : ''} ${isWaitingForNextCycle ? 'opacity-50 bg-surface/30 border-dashed' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 overflow-hidden">
        <button 
            onClick={(e) => {
                e.stopPropagation();
                // Disable unchecking if it's in the waiting period (enforce the "disabled" feel requested)
                if (!readonly && !isWaitingForNextCycle) onToggleStatus(item.id);
            }}
            disabled={isDisabled}
            className={`text-muted transition-colors shrink-0 ${isDisabled ? 'cursor-not-allowed opacity-50' : 'hover:text-acc-shopping'}`}
        >
          {isDone ? (
            <CheckCircle2 className="w-5 h-5 text-acc-shopping" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>
        
        <div className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2">
                <span className={`text-sm truncate ${isDone ? 'line-through text-muted' : 'text-gray-200'}`}>
                    {content}
                </span>
                {quantity && (
                    <span className="text-[10px] font-mono text-acc-shopping bg-acc-shopping/10 px-1.5 py-0.5 rounded">
                    {quantity}
                    </span>
                )}
            </div>
            
            {/* Meta Details Line */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                {isRoutine && (
                    <div className={`flex items-center gap-1 text-[10px] ${isWaitingForNextCycle ? 'text-acc-shopping' : 'text-acc-event/80'}`}>
                        {isWaitingForNextCycle ? <Clock className="w-3 h-3" /> : <Repeat className="w-3 h-3" />}
                        <span>{isWaitingForNextCycle ? nextDueText : recurrenceText}</span>
                    </div>
                )}
                
                {isUrgent && !isDone && (
                    <div className="flex items-center gap-1 text-[10px] text-red-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>Urgent</span>
                    </div>
                )}
                
                {/* Time-Bound Indicator: Show date if exists, regardless of Urgent/Routine status */}
                {targetDateLabel && (
                     <div className={`flex items-center gap-1 text-[10px] ${targetDateLabel === 'Today' || targetDateLabel === 'Yesterday' ? 'text-acc-todo font-medium' : 'text-muted'}`}>
                        <Calendar className="w-3 h-3" />
                        <span>{targetDateLabel}</span>
                     </div>
                )}
            </div>
        </div>
      </div>

      {/* Actions */}
      {!readonly && (
          <button 
            onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
            }}
            // Delete is ALWAYS enabled, even if routine is waiting
            className="ml-2 p-2 text-muted hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors pointer-events-auto cursor-pointer"
            title="Delete"
          >
              <Trash2 className="w-4 h-4" />
          </button>
      )}
    </div>
  );
};

export default ShoppingItem;