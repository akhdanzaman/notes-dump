import React, { useState, useEffect } from 'react';
import { BrainDumpItem, ItemType, ShoppingCategory } from '../types';
import { Circle, CheckCircle2, Trash2, Repeat, AlertCircle, Calendar, Clock, Edit2, ChevronDown, ChevronUp, Save, Tag } from 'lucide-react';

interface ShoppingItemProps {
  item: BrainDumpItem;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, newContent: string, newTags: string[], newAmount?: number, newDate?: string, newPaymentMethod?: string, newBudgetCategory?: string, newDuration?: number, newSkillId?: string, newToWallet?: string, newFinanceType?: any) => void;
  readonly?: boolean;
  handleUpdateItem?: any; // To match prop drilling, though we use onUpdate
}

const ShoppingItem: React.FC<ShoppingItemProps> = ({ item, onToggleStatus, onDelete, onUpdate, readonly = false, handleUpdateItem }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { content, meta, status, completed_at } = item;
  
  // Edit State
  const [editContent, setEditContent] = useState(content);
  const [editQuantity, setEditQuantity] = useState(meta.quantity || '');
  const [editAmount, setEditAmount] = useState(meta.amount ? meta.amount.toString() : '');
  const [editCategory, setEditCategory] = useState<ShoppingCategory>(meta.shoppingCategory || 'not_urgent');
  const [editRecurrence, setEditRecurrence] = useState(meta.recurrenceDays ? meta.recurrenceDays.toString() : '');
  const [editDate, setEditDate] = useState<string>('');

  // Sync state
  useEffect(() => {
      setEditContent(content);
      setEditQuantity(meta.quantity || '');
      setEditAmount(meta.amount ? meta.amount.toString() : '');
      setEditCategory(meta.shoppingCategory || 'not_urgent');
      setEditRecurrence(meta.recurrenceDays ? meta.recurrenceDays.toString() : '');
      
      // Date Init
      if (meta.date) {
        const dateObj = new Date(meta.date);
        if (!isNaN(dateObj.getTime())) {
             const offset = dateObj.getTimezoneOffset() * 60000;
             const localDate = new Date(dateObj.getTime() - offset);
             setEditDate(localDate.toISOString().slice(0, 16));
        } else {
             setEditDate('');
        }
    } else {
        setEditDate('');
    }
  }, [item, isExpanded]);

  const updateFn = onUpdate || handleUpdateItem;

  const handleSave = () => {
      if (!updateFn) return;
      const numAmount = editAmount ? parseFloat(editAmount) : undefined;
      
      let finalDate: string | undefined = undefined;
      if (editDate) finalDate = new Date(editDate).toISOString();

      updateFn(
          item.id,
          editContent,
          meta.tags || [],
          numAmount,
          finalDate, // Pass the new date
          meta.paymentMethod,
          meta.budgetCategory,
          meta.durationMinutes,
          meta.skillId,
          meta.toWallet,
          meta.financeType,
          meta.progress,
          meta.progressNotes
      );
  };

  const isDone = status === 'done';
  const isRoutine = meta?.shoppingCategory === 'routine';
  const isUrgent = meta?.shoppingCategory === 'urgent';
  
  // Date Logic for Display
  let dateDisplay = null;
  let isOverdue = false;
  let isToday = false;

  if (meta.date && !isDone) {
      const d = new Date(meta.date);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const itemDateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      
      if (itemDateStart < todayStart) isOverdue = true;
      if (itemDateStart.getTime() === todayStart.getTime()) isToday = true;

      dateDisplay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (d.getHours() !== 0 || d.getMinutes() !== 0) {
          dateDisplay += ` ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
  }

  // Routine next cycle logic
  let nextDueText = null;
  let isWaitingForNextCycle = false;
  if (isRoutine && isDone && completed_at) {
     const recurrence = meta.recurrenceDays || 7;
     const doneDate = new Date(completed_at);
     const nextDate = new Date(doneDate.getTime() + (recurrence * 24 * 60 * 60 * 1000));
     if (new Date() < nextDate) {
         isWaitingForNextCycle = true;
         nextDueText = `Next: ${nextDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
     }
  }

  const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
  };

  return (
    <div 
      className={`group flex flex-col rounded-lg border transition-all overflow-hidden
        ${isDone 
            ? 'bg-black/10 dark:bg-black/20 border-border/30 opacity-75' 
            : `bg-surface border-border hover:border-acc-shopping/50`
        }`}
    >
      {/* HEADER (Collapsed View) */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    if (!readonly) onToggleStatus(item.id);
                }}
                disabled={readonly}
                className={`text-muted transition-colors shrink-0 ${readonly ? 'cursor-not-allowed' : 'hover:text-acc-shopping'}`}
            >
            {isDone ? (
                <CheckCircle2 className="w-5 h-5 text-acc-shopping" />
            ) : (
                <Circle className="w-5 h-5" />
            )}
            </button>
            
            <div className="flex flex-col overflow-hidden min-w-0">
                <div className="flex items-center gap-2">
                    <span className={`text-sm truncate ${isDone ? 'line-through text-muted' : 'text-primary'}`}>
                        {content}
                    </span>
                    {meta.quantity && (
                        <span className="text-[10px] font-mono text-acc-shopping bg-acc-shopping/10 px-1.5 py-0.5 rounded shrink-0">
                        {meta.quantity}
                        </span>
                    )}
                </div>
                
                {/* Meta Summary */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    {dateDisplay && (
                        <div className={`flex items-center gap-1 text-[10px] ${isOverdue ? 'text-red-500 font-bold' : (isToday ? 'text-amber-500 font-bold' : 'text-muted')}`}>
                            <Calendar className="w-3 h-3" />
                            <span>{dateDisplay}</span>
                        </div>
                    )}
                    {isRoutine && (
                        <div className={`flex items-center gap-1 text-[10px] ${isWaitingForNextCycle ? 'text-acc-shopping' : 'text-acc-event/80'}`}>
                            <Repeat className="w-3 h-3" />
                            <span>{isWaitingForNextCycle ? nextDueText : `Every ${meta.recurrenceDays || 7}d`}</span>
                        </div>
                    )}
                    {isUrgent && !isDone && (
                        <div className="flex items-center gap-1 text-[10px] text-red-400">
                            <AlertCircle className="w-3 h-3" />
                            <span>Urgent</span>
                        </div>
                    )}
                    {meta.amount && (
                        <div className="text-[10px] text-amber-500 font-medium">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(meta.amount)}
                        </div>
                    )}
                </div>
            </div>
        </div>

        <button className="text-muted/50 hover:text-muted">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* EXPANDED EDIT BODY */}
      {isExpanded && !readonly && (
          <div className="p-3 pt-0 border-t border-border/30 bg-background/30">
              <div className="mt-3 space-y-3">
                  {/* Content & Quantity */}
                  <div className="flex gap-2">
                      <input 
                          className="flex-1 bg-background border border-border rounded-lg p-2 text-sm text-primary focus:outline-none focus:border-acc-shopping"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          placeholder="Item name"
                      />
                      <input 
                          className="w-20 bg-background border border-border rounded-lg p-2 text-sm text-primary focus:outline-none focus:border-acc-shopping"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(e.target.value)}
                          placeholder="Qty"
                      />
                  </div>

                  {/* Settings Grid */}
                  <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Category</label>
                          <select
                               className="w-full bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping"
                               value={editCategory}
                               onChange={(e) => setEditCategory(e.target.value as ShoppingCategory)}
                          >
                              <option value="not_urgent">Normal</option>
                              <option value="urgent">Urgent</option>
                              <option value="routine">Routine</option>
                          </select>
                      </div>
                      <div>
                           <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Est. Cost</label>
                           <input 
                              type="number"
                              className="w-full bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              placeholder="0"
                           />
                      </div>
                      <div>
                           <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Date / Due</label>
                           <input
                                type="datetime-local"
                                className="w-full bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                            />
                      </div>
                  </div>

                  {/* Routine Extras */}
                  {editCategory === 'routine' && (
                      <div className="flex gap-3 items-center bg-acc-event/5 p-2 rounded-lg border border-acc-event/10">
                          <Repeat className="w-4 h-4 text-acc-event" />
                          <div className="flex-1">
                              <label className="text-[10px] text-muted block">Repeat Every (Days)</label>
                              <input 
                                  type="number"
                                  className="w-full bg-transparent border-b border-acc-event/30 text-xs text-primary focus:outline-none"
                                  value={editRecurrence}
                                  onChange={(e) => setEditRecurrence(e.target.value)}
                                  placeholder="7"
                              />
                          </div>
                      </div>
                  )}

                  <div className="flex justify-between items-center pt-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                        className="text-red-400 hover:text-red-500 text-xs flex items-center gap-1"
                      >
                          <Trash2 className="w-3 h-3" /> Delete
                      </button>
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleSave(); setIsExpanded(false); }}
                        className="bg-acc-shopping text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 flex items-center gap-1"
                      >
                          <Save className="w-3 h-3" /> Save
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ShoppingItem;