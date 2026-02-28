import React, { useState, useEffect } from 'react';
import { BrainDumpItem, ItemType, ShoppingCategory, BudgetRule } from '../types';
import { Circle, CheckCircle2, Trash2, Repeat, AlertCircle, Calendar, Clock, Edit2, ChevronDown, ChevronUp, Save, Tag, RotateCcw } from 'lucide-react';
import { calculateNextDueDate, getRoutineScheduleLabel } from '../utils/selectors';

interface ShoppingItemProps {
  item: BrainDumpItem;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (
    id: string, 
    newContent: string, 
    newTags: string[], 
    newAmount?: number, 
    newDate?: string, 
    newPaymentMethod?: string, 
    newBudgetCategory?: string, 
    newDuration?: number, 
    newSkillId?: string, 
    newToWallet?: string, 
    newFinanceType?: any,
    newProgress?: number,
    newProgressNotes?: string,
    newShoppingCategory?: ShoppingCategory,
    newRecurrenceDays?: number,
    newQuantity?: string,
    newIsRoutine?: boolean,
    newRoutineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly',
    newRoutineDaysOfWeek?: number[],
    newRoutineDaysOfMonth?: number[],
    newRoutineMonthsOfYear?: number[]
  ) => void;
  readonly?: boolean;
  handleUpdateItem?: any; // To match prop drilling, though we use onUpdate
  budgetRules?: BudgetRule[];
  onResetRoutine?: (id: string) => void;
}

const ShoppingItem: React.FC<ShoppingItemProps> = ({ item, onToggleStatus, onDelete, onUpdate, readonly = false, handleUpdateItem, budgetRules = [], onResetRoutine }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { content, meta, status, completed_at } = item;
  
  // Edit State
  const [editContent, setEditContent] = useState(content);
  const [editQuantity, setEditQuantity] = useState(meta.quantity || '');
  const [editAmount, setEditAmount] = useState(meta.amount ? meta.amount.toString() : '');
  const [editCategory, setEditCategory] = useState<ShoppingCategory>(meta.shoppingCategory || 'not_urgent');
  const [editRecurrence, setEditRecurrence] = useState(meta.recurrenceDays ? meta.recurrenceDays.toString() : '');
  const [editRoutineInterval, setEditRoutineInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(meta.routineInterval || 'daily');
  const [editRoutineDaysOfWeek, setEditRoutineDaysOfWeek] = useState<number[]>(meta.routineDaysOfWeek || []);
  const [editRoutineDaysOfMonth, setEditRoutineDaysOfMonth] = useState<number[]>(meta.routineDaysOfMonth || []);
  const [editRoutineMonthsOfYear, setEditRoutineMonthsOfYear] = useState<number[]>(meta.routineMonthsOfYear || []);
  const [editDate, setEditDate] = useState<string>('');
  const [editBudgetCategory, setEditBudgetCategory] = useState(meta.budgetCategory || '');

  // Sync state
  useEffect(() => {
      setEditContent(content);
      setEditQuantity(meta.quantity || '');
      setEditAmount(meta.amount ? meta.amount.toString() : '');
      setEditCategory(meta.shoppingCategory || 'not_urgent');
      setEditRecurrence(meta.recurrenceDays ? meta.recurrenceDays.toString() : '');
      setEditRoutineInterval(meta.routineInterval || 'daily');
      setEditRoutineDaysOfWeek(meta.routineDaysOfWeek || []);
      setEditRoutineDaysOfMonth(meta.routineDaysOfMonth || []);
      setEditRoutineMonthsOfYear(meta.routineMonthsOfYear || []);
      setEditBudgetCategory(meta.budgetCategory || '');
      
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
      const numRecurrence = editRecurrence ? parseInt(editRecurrence) : undefined;
      
      let finalDate: string | undefined = undefined;
      if (editDate) finalDate = new Date(editDate).toISOString();

      updateFn(
          item.id,
          editContent,
          meta.tags || [],
          numAmount,
          finalDate, // Pass the new date
          meta.paymentMethod,
          editBudgetCategory,
          meta.durationMinutes,
          meta.skillId,
          meta.toWallet,
          meta.financeType,
          meta.progress,
          meta.progressNotes,
          editCategory,
          numRecurrence,
          editQuantity,
          // Routine params (isRoutine is implied by category='routine')
          editCategory === 'routine',
          editRoutineInterval,
          editRoutineDaysOfWeek,
          editRoutineDaysOfMonth,
          editRoutineMonthsOfYear
      );
  };

  const isDone = status === 'done';
  const isRoutine = meta?.shoppingCategory === 'routine';
  const isUrgent = meta?.shoppingCategory === 'urgent';
  
  // Date Logic for Display
  let dateDisplay = null;
  let isOverdue = false;
  let isToday = false;

  // Routine next cycle logic
  let nextDueText = null;
  let isWaitingForNextCycle = false;
  if (isRoutine && isDone && completed_at) {
     const doneDate = new Date(completed_at);
     
     const nextDate = calculateNextDueDate(
         doneDate,
         meta.routineInterval || 'daily',
         meta.routineDaysOfWeek,
         meta.routineDaysOfMonth,
         meta.routineMonthsOfYear
     );
     
     isWaitingForNextCycle = true;
     nextDueText = `Next: ${nextDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  }

  if (meta.date) {
      const d = new Date(meta.date);
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const itemDateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      
      if (itemDateStart < todayStart && !isDone) isOverdue = true;
      if (itemDateStart.getTime() === todayStart.getTime()) isToday = true;

      let datePart = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      if (d.getHours() !== 0 || d.getMinutes() !== 0) {
          datePart += ` ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      }

      if (isRoutine) {
          if (isWaitingForNextCycle && nextDueText) {
              dateDisplay = nextDueText;
          } else {
              dateDisplay = datePart;
          }
      } else {
          dateDisplay = datePart;
      }
  } else if (isRoutine && isWaitingForNextCycle && nextDueText) {
      dateDisplay = nextDueText;
  }

  const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
  };

  return (
    <div 
      className={`group flex flex-col rounded-[24px] p-4 shadow-sm transition-all overflow-hidden cursor-pointer
        ${isDone 
            ? 'bg-surface/50 opacity-75' 
            : `bg-surface hover:bg-surface/80`
        }`}
      onClick={toggleExpand}
    >
      <div className="flex flex-col gap-1">
        
        {/* Top Row */}
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!readonly) onToggleStatus(item.id);
                    }}
                    disabled={readonly}
                    className={`transition-colors shrink-0 ${readonly ? 'cursor-not-allowed' : 'hover:opacity-80'}`}
                >
                {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-muted" />
                ) : (
                    <Circle className={`w-4 h-4 ${isUrgent ? 'text-red-500' : (isRoutine ? 'text-acc-event' : 'text-acc-shopping')}`} />
                )}
                </button>
                <span className={`text-sm font-semibold capitalize ${isDone ? 'text-muted' : (isUrgent ? 'text-red-500' : (isRoutine ? 'text-acc-event' : 'text-acc-shopping'))}`}>
                    {isUrgent ? 'Urgent' : (isRoutine ? 'Routine' : 'Shopping')}
                </span>
                {isRoutine && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 ml-2">
                        <Repeat className="w-2.5 h-2.5 text-indigo-500" />
                        <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tight">
                            {getRoutineScheduleLabel(
                                meta.routineInterval,
                                meta.routineDaysOfWeek,
                                meta.routineDaysOfMonth,
                                meta.routineMonthsOfYear,
                                meta.recurrenceDays
                            )}
                        </span>
                    </div>
                )}
                {isRoutine && isDone && onResetRoutine && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onResetRoutine(item.id);
                        }}
                        className="ml-1 px-2 py-0.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                    >
                        <RotateCcw className="w-2.5 h-2.5" /> Reset
                    </button>
                )}
            </div>
            
            <div className="text-sm font-medium text-muted">
                {dateDisplay ? dateDisplay.split('•')[0].trim() : ''}
            </div>
        </div>
        
        {/* Bottom Row */}
        <div className="flex justify-between items-start gap-4 mt-1">
            <div className="flex flex-col min-w-0 flex-1">
                <div className={`text-base font-medium text-primary line-clamp-2 ${isDone ? 'line-through text-muted' : ''}`}>
                    {content}
                </div>
                
                {/* Extra Metadata Row */}
                {(meta.quantity) && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-muted">
                        {meta.quantity && (
                            <span className="px-1.5 py-0.5 rounded bg-muted/10 font-mono">
                                Qty: {meta.quantity}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {meta.amount && (
                <div className="text-base font-bold text-primary shrink-0 mt-0.5">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(meta.amount)}
                </div>
            )}
        </div>
      </div>

      {/* EXPANDED EDIT BODY */}
      {isExpanded && !readonly && (
          <div className="pt-4 mt-2 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-3">
                  {/* Content & Quantity */}
                  <div className="flex gap-2">
                      <input 
                          className="flex-1 bg-background border border-border rounded-xl p-2 text-sm text-primary focus:outline-none focus:border-acc-shopping"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          placeholder="Item name"
                      />
                      <input 
                          className="w-20 bg-background border border-border rounded-xl p-2 text-sm text-primary focus:outline-none focus:border-acc-shopping"
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
                               className="w-full bg-background border border-border rounded-xl p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping"
                               value={editCategory}
                               onChange={(e) => setEditCategory(e.target.value as ShoppingCategory)}
                          >
                              <option value="not_urgent">Normal</option>
                              <option value="urgent">Urgent</option>
                              <option value="routine">Routine</option>
                          </select>
                      </div>
                      <div>
                           <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Budget Category</label>
                           <select
                                className="w-full bg-background border border-border rounded-xl p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping"
                                value={editBudgetCategory}
                                onChange={(e) => setEditBudgetCategory(e.target.value)}
                           >
                               <option value="">Uncategorized</option>
                               {budgetRules.map(rule => (
                                   <option key={rule.id} value={rule.id}>{rule.name}</option>
                               ))}
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
                       <div className="col-span-2 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-4 mt-2">
                           <div className="flex items-center justify-between mb-4">
                               <div className="flex items-center gap-2">
                                   <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                                       <Repeat className="w-4 h-4 text-indigo-500" />
                                   </div>
                                   <div>
                                       <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Routine Schedule</h4>
                                       <p className="text-[10px] text-muted font-medium">Configure how this task repeats</p>
                                   </div>
                               </div>
                           </div>
                           
                           <div className="space-y-4">
                               {/* Interval Selector */}
                               <div className="grid grid-cols-4 gap-2 bg-background/50 p-1.5 rounded-2xl border border-border/50">
                                   {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(int => (
                                       <button
                                           key={int}
                                           onClick={() => setEditRoutineInterval(int)}
                                           className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${editRoutineInterval === int ? 'bg-indigo-600 text-white shadow-sm' : 'text-muted hover:text-primary hover:bg-background'}`}
                                       >
                                           {int}
                                       </button>
                                   ))}
                               </div>

                               {/* Weekly Selector */}
                               {editRoutineInterval === 'weekly' && (
                                   <div>
                                       <label className="block text-[10px] font-bold text-muted mb-2 uppercase tracking-widest">Select Days</label>
                                       <div className="flex gap-1">
                                           {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, idx) => (
                                               <button
                                                   key={idx}
                                                   onClick={() => {
                                                       if (editRoutineDaysOfWeek.includes(idx)) {
                                                           setEditRoutineDaysOfWeek(editRoutineDaysOfWeek.filter(d => d !== idx));
                                                       } else {
                                                           setEditRoutineDaysOfWeek([...editRoutineDaysOfWeek, idx]);
                                                       }
                                                   }}
                                                   className={`flex-1 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all border ${editRoutineDaysOfWeek.includes(idx) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                                               >
                                                   {label}
                                               </button>
                                           ))}
                                       </div>
                                   </div>
                               )}

                               {/* Monthly Selector */}
                               {editRoutineInterval === 'monthly' && (
                                   <div>
                                       <label className="block text-[10px] font-bold text-muted mb-2 uppercase tracking-widest">Select Dates</label>
                                       <div className="grid grid-cols-7 gap-1">
                                           {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                               <button
                                                   key={day}
                                                   onClick={() => {
                                                       if (editRoutineDaysOfMonth.includes(day)) {
                                                           setEditRoutineDaysOfMonth(editRoutineDaysOfMonth.filter(d => d !== day));
                                                       } else {
                                                           setEditRoutineDaysOfMonth([...editRoutineDaysOfMonth, day]);
                                                       }
                                                   }}
                                                   className={`w-full aspect-square rounded-md flex items-center justify-center text-[9px] font-bold transition-all border ${editRoutineDaysOfMonth.includes(day) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                                               >
                                                   {day}
                                               </button>
                                           ))}
                                       </div>
                                   </div>
                               )}

                               {/* Yearly Selector */}
                               {editRoutineInterval === 'yearly' && (
                                   <div>
                                       <label className="block text-[10px] font-bold text-muted mb-2 uppercase tracking-widest">Select Months</label>
                                       <div className="grid grid-cols-4 gap-1.5">
                                           {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, idx) => (
                                               <button
                                                   key={idx}
                                                   onClick={() => {
                                                       if (editRoutineMonthsOfYear.includes(idx)) {
                                                           setEditRoutineMonthsOfYear(editRoutineMonthsOfYear.filter(m => m !== idx));
                                                       } else {
                                                           setEditRoutineMonthsOfYear([...editRoutineMonthsOfYear, idx]);
                                                       }
                                                   }}
                                                   className={`py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${editRoutineMonthsOfYear.includes(idx) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                                               >
                                                   {label}
                                               </button>
                                           ))}
                                       </div>
                                   </div>
                               )}
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
                        className="bg-acc-shopping text-white px-3 py-1.5 rounded-xl text-xs font-medium hover:opacity-90 flex items-center gap-1"
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