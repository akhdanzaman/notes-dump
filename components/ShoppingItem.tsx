import React, { useState, useEffect } from 'react';
import { BrainDumpItem, ItemType, ShoppingCategory, BudgetRule, Wallet, ShoppingLineItem } from '../types';
import { Circle, CheckCircle2, Trash2, Repeat, AlertCircle, Calendar, Clock, Edit2, ChevronDown, ChevronUp, Save, Tag, RotateCcw, Plus, X } from 'lucide-react';
import { calculateNextDueDate, getRoutineScheduleLabel, advanceRoutineDueDateToTodayOrFuture, advanceRecurringDueDateByDaysToTodayOrFuture, isSameLocalDay } from '../utils/selectors';
import { getShoppingDueDate, getShoppingTransactionDate, shouldShoppingDateEditCompletion } from '../utils/shoppingDateUtils';
import { createShoppingLineItemId, sanitizeShoppingLineItems, sumShoppingLineItems } from '../utils/shoppingLineItems';

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
    newRoutineMonthsOfYear?: number[],
    newSavingGoalId?: string,
    newDedicatedWalletId?: string,
    newPriority?: any,
    newStart?: string,
    newEnd?: string,
    newHideFromCalendar?: boolean,
    newInvestmentAssetType?: any,
    newInvestmentSymbol?: string,
    newInvestmentUnits?: number,
    newInvestmentAveragePrice?: number,
    newInvestmentCurrentPrice?: number,
    newInvestmentPlatform?: string,
    newCommodity?: string,
    newSubcommodity?: string,
    newNoteTitle?: string,
    newImageUrl?: string,
    newShoppingLineItems?: ShoppingLineItem[]
  ) => void;
  readonly?: boolean;
  handleUpdateItem?: any; // To match prop drilling, though we use onUpdate
  budgetRules?: BudgetRule[];
  wallets?: Wallet[];
  onResetRoutine?: (id: string) => void;
}

const ShoppingItem: React.FC<ShoppingItemProps> = ({ item, onToggleStatus, onDelete, onUpdate, readonly = false, handleUpdateItem, budgetRules = [], wallets = [], onResetRoutine }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { content, meta, status, completed_at } = item;
  
  // Edit State
  const [editContent, setEditContent] = useState(content);
  const [editQuantity, setEditQuantity] = useState(meta.quantity || '');
  const [editShoppingLineItems, setEditShoppingLineItems] = useState<ShoppingLineItem[]>(sanitizeShoppingLineItems(meta.shoppingLineItems));
  const [editAmount, setEditAmount] = useState(meta.amount ? meta.amount.toString() : '');
  const [editCategory, setEditCategory] = useState<ShoppingCategory>(meta.shoppingCategory || 'not_urgent');
  const [editRecurrence, setEditRecurrence] = useState(meta.recurrenceDays ? meta.recurrenceDays.toString() : '');
  const [editRoutineInterval, setEditRoutineInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(meta.routineInterval || 'daily');
  const [editRoutineDaysOfWeek, setEditRoutineDaysOfWeek] = useState<number[]>(meta.routineDaysOfWeek || []);
  const [editRoutineDaysOfMonth, setEditRoutineDaysOfMonth] = useState<number[]>(meta.routineDaysOfMonth || []);
  const [editRoutineMonthsOfYear, setEditRoutineMonthsOfYear] = useState<number[]>(meta.routineMonthsOfYear || []);
  const [editDate, setEditDate] = useState<string>('');
  const [editBudgetCategory, setEditBudgetCategory] = useState(meta.budgetCategory || '');
  const [editPaymentMethod, setEditPaymentMethod] = useState(meta.paymentMethod || '');
  const [editHideFromCalendar, setEditHideFromCalendar] = useState<boolean>(!!meta.hideFromCalendar);

  // Sync state
  useEffect(() => {
      setEditContent(content);
      setEditQuantity(meta.quantity || '');
      setEditShoppingLineItems(sanitizeShoppingLineItems(meta.shoppingLineItems));
      setEditAmount(meta.amount ? meta.amount.toString() : '');
      setEditCategory(meta.shoppingCategory || 'not_urgent');
      setEditRecurrence(meta.recurrenceDays ? meta.recurrenceDays.toString() : '');
      setEditRoutineInterval(meta.routineInterval || 'daily');
      setEditRoutineDaysOfWeek(meta.routineDaysOfWeek || []);
      setEditRoutineDaysOfMonth(meta.routineDaysOfMonth || []);
      setEditRoutineMonthsOfYear(meta.routineMonthsOfYear || []);
      setEditBudgetCategory(meta.budgetCategory || '');
      setEditPaymentMethod(meta.paymentMethod || '');
      setEditHideFromCalendar(!!meta.hideFromCalendar);
      
      // Date Init
      const editableDate = shouldShoppingDateEditCompletion(item) ? getShoppingTransactionDate(item) : getShoppingDueDate(item);
      if (editableDate) {
        const dateObj = new Date(editableDate);
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
      const sanitizedEditLineItems = sanitizeShoppingLineItems(editShoppingLineItems);
      const hasEditLineItems = sanitizedEditLineItems.length > 0;
      const numAmount = hasEditLineItems ? sumShoppingLineItems(sanitizedEditLineItems) : (editAmount ? parseFloat(editAmount) : undefined);
      const numRecurrence = editRecurrence ? parseInt(editRecurrence) : undefined;
      
      let finalDate: string | undefined = undefined;
      if (editDate) finalDate = new Date(editDate).toISOString();

      updateFn(
          item.id,
          editContent,
          meta.tags || [],
          numAmount,
          finalDate, // Pass the new date
          editPaymentMethod,
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
          editRoutineMonthsOfYear,
          undefined,
          meta.dedicatedWalletId,
          meta.priority,
          meta.start,
          meta.end,
          editHideFromCalendar,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          hasEditLineItems ? sanitizedEditLineItems : undefined
      );
  };

  const isDone = status === 'done';
  const isRoutine = meta?.shoppingCategory === 'routine';
  const isUrgent = meta?.shoppingCategory === 'urgent';
  const routineNow = new Date();
  const routineStoredDateRaw = getShoppingDueDate(item);
  const routineStoredDate = routineStoredDateRaw ? new Date(routineStoredDateRaw) : null;
  const getRoutineDateOnOrAfterToday = (date: Date): Date => {
      if (!isRoutine) return date;
      if (meta.routineInterval) {
          return advanceRoutineDueDateToTodayOrFuture(
              date,
              meta.routineInterval,
              meta.routineDaysOfWeek,
              meta.routineDaysOfMonth,
              meta.routineMonthsOfYear,
              routineNow
          );
      }
      return advanceRecurringDueDateByDaysToTodayOrFuture(
          date,
          Math.max(Number(meta.recurrenceDays || 7), 1),
          routineNow
      );
  };
  const routineCurrentDueDate = isRoutine && routineStoredDate && !Number.isNaN(routineStoredDate.getTime())
      ? getRoutineDateOnOrAfterToday(routineStoredDate)
      : null;
  const isRoutineScheduledToday = !!routineCurrentDueDate && isSameLocalDay(routineCurrentDueDate, routineNow);
  const isRoutineUnavailable = isRoutine && !isRoutineScheduledToday;
  const canResetRoutine = isRoutine && !!onResetRoutine && !readonly && (isDone || isRoutineUnavailable);
  const lineItems = sanitizeShoppingLineItems(meta.shoppingLineItems);
  const lineItemsTotal = sumShoppingLineItems(lineItems);
  const hasLineItems = lineItems.length > 0;
  const editLineItemsTotal = sumShoppingLineItems(editShoppingLineItems);
  const hasEditLineItems = sanitizeShoppingLineItems(editShoppingLineItems).length > 0;

  const addLineItem = () => {
      setEditShoppingLineItems(prev => [...prev, { id: createShoppingLineItemId(), name: '', quantity: '', amount: undefined }]);
  };

  const updateLineItem = (id: string, changes: Partial<ShoppingLineItem>) => {
      setEditShoppingLineItems(prev => prev.map(line => line.id === id ? { ...line, ...changes } : line));
  };

  const removeLineItem = (id: string) => {
      setEditShoppingLineItems(prev => prev.filter(line => line.id !== id));
  };
  
  // Date Logic for Display
  let dateDisplay = null;
  let isOverdue = false;
  let isToday = false;

  // Routine next cycle logic
  let nextDueText = null;
  let isWaitingForNextCycle = false;
  let isRoutineLockedUntilNextDue = false;
  let routineNextDueDate: Date | null = null;
  if (isRoutine && isDone && completed_at) {
     const completedDate = new Date(completed_at);
     const scheduledDate = meta.date ? new Date(meta.date) : completedDate;
     const manualNextDueDateRaw = (meta as typeof meta & { routineManualNextDueDate?: string }).routineManualNextDueDate;
     const manualNextDueDate = manualNextDueDateRaw ? new Date(manualNextDueDateRaw) : null;
     const hasValidCompletedDate = !Number.isNaN(completedDate.getTime());
     const hasValidScheduledDate = !Number.isNaN(scheduledDate.getTime());
     const hasValidManualNextDueDate = !!manualNextDueDate && !Number.isNaN(manualNextDueDate.getTime());
     const doneDate = hasValidScheduledDate ? scheduledDate : completedDate;

     if (hasValidCompletedDate && hasValidManualNextDueDate && manualNextDueDate.getTime() > completedDate.getTime() && !isSameLocalDay(manualNextDueDate, completedDate)) {
         routineNextDueDate = getRoutineDateOnOrAfterToday(manualNextDueDate);
     } else if (hasValidCompletedDate && hasValidScheduledDate && scheduledDate.getTime() > completedDate.getTime()) {
         routineNextDueDate = getRoutineDateOnOrAfterToday(scheduledDate);
     } else if (meta.routineInterval) {
         routineNextDueDate = getRoutineDateOnOrAfterToday(calculateNextDueDate(
             doneDate,
             meta.routineInterval,
             meta.routineDaysOfWeek,
             meta.routineDaysOfMonth,
             meta.routineMonthsOfYear
         ));
     } else {
         const recurrenceDays = Math.max(Number(meta.recurrenceDays || 7), 1);
         routineNextDueDate = getRoutineDateOnOrAfterToday(new Date(doneDate.getTime() + (recurrenceDays * 24 * 60 * 60 * 1000)));
     }
     
     isWaitingForNextCycle = true;
     isRoutineLockedUntilNextDue = !isSameLocalDay(routineNextDueDate, routineNow);
     nextDueText = `Next: ${routineNextDueDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  }

  const displayDate = isRoutine && routineCurrentDueDate
      ? routineCurrentDueDate.toISOString()
      : (shouldShoppingDateEditCompletion(item) ? getShoppingTransactionDate(item) : getShoppingDueDate(item));
  if (displayDate) {
      const d = new Date(displayDate);
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
              dateDisplay = shouldShoppingDateEditCompletion(item) ? `Done: ${datePart}` : `Due: ${datePart}`;
          }
      } else {
          dateDisplay = shouldShoppingDateEditCompletion(item) ? `Done: ${datePart}` : `Due: ${datePart}`;
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
        ${(isDone || isRoutineUnavailable)
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
                        if (!readonly && !isRoutineUnavailable) onToggleStatus(item.id);
                    }}
                    disabled={readonly || isRoutineUnavailable}
                    title={isRoutineUnavailable ? 'Routine is not scheduled for today' : (isRoutine && isDone ? 'Mark undone and remove the latest routine history' : undefined)}
                    className={`transition-colors shrink-0 ${(readonly || isRoutineUnavailable) ? 'cursor-not-allowed opacity-70' : 'hover:opacity-80'}`}
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
                {canResetRoutine && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onResetRoutine(item.id);
                        }}
                        title={isRoutineUnavailable ? 'Activate this routine for today without changing the next scheduled due date' : (routineNextDueDate ? `Reset for today and keep history. Next scheduled due: ${routineNextDueDate.toLocaleDateString()}` : 'Reset routine and keep history')}
                        className="ml-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500"
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
                {(meta.quantity || hasLineItems) && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-muted">
                        {meta.quantity && (
                            <span className="px-1.5 py-0.5 rounded bg-muted/10 font-mono">
                                Qty: {meta.quantity}
                            </span>
                        )}
                        {hasLineItems && (
                            <span className="px-1.5 py-0.5 rounded bg-acc-shopping/10 text-acc-shopping font-bold">
                                {lineItems.length} line items
                            </span>
                        )}
                    </div>
                )}
                {hasLineItems && (
                    <div className="mt-2 space-y-1">
                        {lineItems.slice(0, 3).map(line => (
                            <div key={line.id} className="flex items-center justify-between gap-2 rounded-xl bg-background/60 px-2 py-1 text-[11px] text-muted">
                                <span className="truncate">{line.name || 'Untitled item'}{line.quantity ? ` · ${line.quantity}` : ''}</span>
                                <span className="shrink-0 font-bold text-primary">
                                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(line.amount || 0)}
                                </span>
                            </div>
                        ))}
                        {lineItems.length > 3 && (
                            <div className="text-[10px] font-bold text-muted">+{lineItems.length - 3} more</div>
                        )}
                    </div>
                )}
            </div>

            {(meta.amount || hasLineItems) && (
                <div className="text-base font-bold text-primary shrink-0 mt-0.5">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(hasLineItems ? lineItemsTotal : (meta.amount || 0))}
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

                  <div className="rounded-2xl border border-border bg-background/60 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                          <div>
                              <div className="text-[10px] uppercase text-muted font-bold tracking-wider">Line Items</div>
                              <div className="text-[10px] text-muted">Optional detail rows; total is auto-summed.</div>
                          </div>
                          <div className="text-xs font-bold text-acc-shopping">
                              {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(editLineItemsTotal)}
                          </div>
                      </div>
                      {editShoppingLineItems.map((line, index) => (
                          <div key={line.id} className="grid grid-cols-[1fr_64px_96px_auto] gap-2 items-center">
                              <input
                                  className="bg-surface border border-border rounded-xl p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping"
                                  value={line.name}
                                  onChange={(e) => updateLineItem(line.id, { name: e.target.value })}
                                  placeholder={`Item ${index + 1}`}
                              />
                              <input
                                  className="bg-surface border border-border rounded-xl p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping"
                                  value={line.quantity || ''}
                                  onChange={(e) => updateLineItem(line.id, { quantity: e.target.value })}
                                  placeholder="Qty"
                              />
                              <input
                                  type="number"
                                  className="bg-surface border border-border rounded-xl p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping"
                                  value={line.amount ?? ''}
                                  onChange={(e) => updateLineItem(line.id, { amount: e.target.value === '' ? undefined : Number(e.target.value) })}
                                  placeholder="0"
                              />
                              <button
                                  onClick={() => removeLineItem(line.id)}
                                  className="p-2 rounded-full text-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                  aria-label="Remove line item"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                          </div>
                      ))}
                      <button
                          onClick={addLineItem}
                          className="px-3 py-2 rounded-xl bg-acc-shopping/10 text-acc-shopping text-xs font-bold hover:bg-acc-shopping/20 transition-colors flex items-center gap-1"
                      >
                          <Plus className="w-3 h-3" /> Add line item
                      </button>
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
                           <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Payment Method</label>
                           <select
                                className="w-full bg-background border border-border rounded-xl p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping"
                                value={editPaymentMethod}
                                onChange={(e) => setEditPaymentMethod(e.target.value)}
                           >
                               <option value="">Select Wallet</option>
                               {wallets.map(w => (
                                   <option key={w.id} value={w.name}>{w.name}</option>
                               ))}
                           </select>
                      </div>
                      <div>
                           <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Est. Cost</label>
                           <input 
                              type="number"
                              className={`w-full bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping ${hasEditLineItems ? 'opacity-80 cursor-not-allowed' : ''}`}
                              value={hasEditLineItems ? editLineItemsTotal || '' : editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              readOnly={hasEditLineItems}
                              placeholder="0"
                           />
                           {hasEditLineItems && <p className="mt-1 text-[10px] text-muted">Auto-summed from line items.</p>}
                      </div>
                      <div className="col-span-2">
                           <label className="text-[10px] uppercase text-muted font-bold mb-1 block">{shouldShoppingDateEditCompletion(item) ? 'Completed date' : 'Due date'}</label>
                           <input
                                type="datetime-local"
                                className="w-full bg-background border border-border rounded-lg p-2 text-xs text-primary focus:outline-none focus:border-acc-shopping [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                            />
                      </div>
                      <div className="col-span-2 flex items-center gap-2 mt-1">
                           <input
                                type="checkbox"
                                id={`hideFromCalendarShopping-${item.id}`}
                                checked={editHideFromCalendar}
                                onChange={(e) => setEditHideFromCalendar(e.target.checked)}
                                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                           />
                           <label htmlFor={`hideFromCalendarShopping-${item.id}`} className="text-xs font-medium text-primary">
                                Hide from Calendar
                           </label>
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
