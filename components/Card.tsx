import React, { useState, useEffect } from 'react';
import { ItemType, BrainDumpItem, FinanceType, Skill, Wallet, BudgetRule } from '../types';
import { CheckCircle2, ShoppingCart, Calendar, StickyNote, Tag, Clock, Circle, Trash2, TrendingUp, TrendingDown, Wallet as WalletIcon, ArrowRightLeft, BookOpen, ArrowRight, BookText, ChevronDown, ChevronUp, Save, DollarSign, Type, Hourglass, X, Activity, Repeat, RotateCcw } from 'lucide-react';

import { calculateNextDueDate, getRoutineScheduleLabel } from '../utils/selectors';

// Helper to calculate next due date based on schedule (Same as RoutineTaskModal)
const calculateNextDate = (
    int: 'daily' | 'weekly' | 'monthly' | 'yearly',
    dOfWeek: number[],
    dOfMonth: number[],
    mOfYear: number[]
) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (int === 'daily') {
        return today;
    }

    if (int === 'weekly' && dOfWeek.length > 0) {
        // Find next occurrence of any selected day
        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            if (dOfWeek.includes(d.getDay())) {
                return d;
            }
        }
    }

    if (int === 'monthly' && dOfMonth.length > 0) {
        // Find next occurrence of any selected date
        // Check current month first
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // Sort selected days
        const sortedDays = [...dOfMonth].sort((a, b) => a - b);
        
        // Check remaining days in current month
        for (const day of sortedDays) {
            if (day >= today.getDate() && day <= daysInMonth) {
                return new Date(currentYear, currentMonth, day);
            }
        }
        
        // If not found, get first available day in next month
        const nextMonth = new Date(currentYear, currentMonth + 1, 1);
        const nextMonthDays = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
        for (const day of sortedDays) {
            if (day <= nextMonthDays) {
                return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), day);
            }
        }
    }

    if (int === 'yearly' && mOfYear.length > 0) {
            // Find next occurrence of any selected month
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const sortedMonths = [...mOfYear].sort((a, b) => a - b);

            // Check remaining months in current year
            for (const month of sortedMonths) {
                if (month >= currentMonth) {
                    if (month > currentMonth) {
                        return new Date(currentYear, month, 1);
                    } else {
                        // Current month
                        return today;
                    }
                }
            }

            // If not found, go to next year
            return new Date(currentYear + 1, sortedMonths[0], 1);
    }

    return today;
};

interface CardProps {
  item: BrainDumpItem;
  onToggleStatus?: (id: string) => void;
  onDelete?: (id: string) => void;
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
    newFinanceType?: FinanceType, 
    newProgress?: number, 
    newProgressNotes?: string,
    newShoppingCategory?: any,
    newRecurrenceDays?: number,
    newQuantity?: string,
    newIsRoutine?: boolean,
    newRoutineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly',
    newRoutineDaysOfWeek?: number[],
    newRoutineDaysOfMonth?: number[],
    newRoutineMonthsOfYear?: number[],
    newSavingGoalId?: string
  ) => void;
  onResetRoutine?: (id: string) => void;
  readonly?: boolean;
  skillName?: string;
  categoryName?: string;
  noStrikethrough?: boolean;
  noDarken?: boolean;
  enableCollapse?: boolean;
  defaultCollapsed?: boolean;
  hideMoney?: boolean;
  className?: string;
  
  // Context Props
  skills?: Skill[];
  wallets?: Wallet[];
  budgetRules?: BudgetRule[];
  savingGoals?: BrainDumpItem[];
}

const Card: React.FC<CardProps> = ({ 
    item, 
    onToggleStatus, 
    onDelete, 
    onUpdate,
    onResetRoutine,
    readonly = false, 
    skillName, 
    categoryName, 
    noStrikethrough = false,
    noDarken = false,
    enableCollapse = false,
    defaultCollapsed = false,
    hideMoney = false,
    className = '',
    skills = [],
    wallets = [],
    budgetRules = [],
    savingGoals = []
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showFullText, setShowFullText] = useState(false);
  const { type, content, meta, isOptimistic, status, created_at, completed_at } = item;
  
  // --- Edit State ---
  const [editContent, setEditContent] = useState(content);
  const [editAmount, setEditAmount] = useState<string>(meta.amount ? meta.amount.toString() : '');
  const [editTags, setEditTags] = useState(meta.tags?.join(', ') || '');
  const [editDate, setEditDate] = useState<string>('');
  
  // Specifics
  const [editFinanceType, setEditFinanceType] = useState<FinanceType>(meta.financeType || 'expense');
  const [editPaymentMethod, setEditPaymentMethod] = useState(meta.paymentMethod || '');
  const [editToWallet, setEditToWallet] = useState(meta.toWallet || '');
  const [editBudgetCategory, setEditBudgetCategory] = useState(meta.budgetCategory || '');
  const [editDuration, setEditDuration] = useState<string>(meta.durationMinutes ? meta.durationMinutes.toString() : '');
  const [editSkillId, setEditSkillId] = useState(meta.skillId || '');
  const [editSavingGoalId, setEditSavingGoalId] = useState(meta.savingGoalId || '');

  // Routine
  const [editRecurrenceDays, setEditRecurrenceDays] = useState<string>(meta.recurrenceDays ? meta.recurrenceDays.toString() : '1');
  const [editRoutineInterval, setEditRoutineInterval] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(meta.routineInterval || 'daily');
  const [editRoutineDaysOfWeek, setEditRoutineDaysOfWeek] = useState<number[]>(meta.routineDaysOfWeek || []);
  const [editRoutineDaysOfMonth, setEditRoutineDaysOfMonth] = useState<number[]>(meta.routineDaysOfMonth || []);
  const [editRoutineMonthsOfYear, setEditRoutineMonthsOfYear] = useState<number[]>(meta.routineMonthsOfYear || []);

  // Progress
  const [editProgress, setEditProgress] = useState(meta.progress || 0);
  const [editProgressNotes, setEditProgressNotes] = useState(meta.progressNotes || '');

  const updateDateFromSchedule = (
    int: 'daily' | 'weekly' | 'monthly' | 'yearly',
    dOfWeek: number[],
    dOfMonth: number[],
    mOfYear: number[]
  ) => {
    const nextDate = calculateNextDate(int, dOfWeek, dOfMonth, mOfYear);
    // Adjust for timezone offset to ensure YYYY-MM-DD is correct
    const offset = nextDate.getTimezoneOffset() * 60000;
    // We want to preserve the time if it was set, but for routine start date, usually 00:00 or current time is fine.
    // However, editDate is datetime-local string (YYYY-MM-DDTHH:mm).
    // Let's keep the current time from editDate if possible, or default to 09:00
    
    let timePart = '09:00';
    if (editDate && editDate.includes('T')) {
        timePart = editDate.split('T')[1];
    }
    
    const localISODate = (new Date(nextDate.getTime() - offset)).toISOString().slice(0, 10);
    setEditDate(`${localISODate}T${timePart}`);
  };

  // Initialize Edit State on Expand or Item Change
  useEffect(() => {
    setEditContent(content);
    setEditAmount(meta.amount ? meta.amount.toString() : '');
    setEditTags(meta.tags?.join(', ') || '');
    setEditFinanceType(meta.financeType || 'expense');
    setEditPaymentMethod(meta.paymentMethod || '');
    setEditToWallet(meta.toWallet || '');
    setEditBudgetCategory(meta.budgetCategory || '');
    setEditDuration(meta.durationMinutes ? meta.durationMinutes.toString() : '');
    setEditSkillId(meta.skillId || '');
    setEditSavingGoalId(meta.savingGoalId || '');
    setEditProgress(meta.progress || 0);
    setEditProgressNotes(meta.progressNotes || '');
    
    setEditRecurrenceDays(meta.recurrenceDays ? meta.recurrenceDays.toString() : '1');
    setEditRoutineInterval(meta.routineInterval || 'daily');
    setEditRoutineDaysOfWeek(meta.routineDaysOfWeek || []);
    setEditRoutineDaysOfMonth(meta.routineDaysOfMonth || []);
    setEditRoutineMonthsOfYear(meta.routineMonthsOfYear || []);
    
    // Date Init
    const isoDate = (meta.date && meta.date !== 'null') ? meta.date : (completed_at || created_at);
    if (isoDate) {
        const dateObj = new Date(isoDate);
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

  }, [item, isCollapsed]); // Reset when collapsing/expanding or item changes

  const handleSave = () => {
      if (!onUpdate) return;

      const tagArray = editTags.split(',').map(t => t.trim()).filter(t => t);
      const numAmount = editAmount ? parseFloat(editAmount) : undefined;
      const numDuration = editDuration ? parseFloat(editDuration) : undefined;
      
      let finalDate: string | undefined = undefined;
      if (editDate) finalDate = new Date(editDate).toISOString();

      const finalBudgetCategory = editBudgetCategory === '' ? undefined : editBudgetCategory;
      const finalSkillId = editSkillId === '' ? undefined : editSkillId;
      const finalToWallet = editFinanceType === 'transfer' && editToWallet ? editToWallet : undefined;
      const finalSavingGoalId = editFinanceType === 'saving' && editSavingGoalId ? editSavingGoalId : undefined;

      const numRecurrence = editRecurrenceDays ? parseInt(editRecurrenceDays) : undefined;

      onUpdate(
          item.id,
          editContent,
          tagArray,
          numAmount,
          finalDate,
          editPaymentMethod,
          finalBudgetCategory,
          numDuration,
          finalSkillId,
          finalToWallet,
          editFinanceType,
          showProgress ? editProgress : undefined,
          showProgress ? editProgressNotes : undefined,
          item.meta.shoppingCategory,
          numRecurrence,
          item.meta.quantity,
          // Routine params
          item.meta.isRoutine,
          editRoutineInterval,
          editRoutineDaysOfWeek,
          editRoutineDaysOfMonth,
          editRoutineMonthsOfYear,
          finalSavingGoalId
      );
      
      if (enableCollapse) {
          setIsCollapsed(true);
      }
  };

  const shouldStrike = status === 'done' && !noStrikethrough && type !== ItemType.SKILL_LOG;

  const toggleCollapse = () => {
      if (enableCollapse) setIsCollapsed(!isCollapsed);
  };

  const formatMoney = (amount?: number) => {
      if (amount === undefined || amount === null) return null;
      if (hideMoney) return 'Rp •••••••';
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const getStyles = () => {
    switch (type) {
      case ItemType.TODO:
        return { textColor: 'text-acc-todo', bg: 'bg-surface' };
      case ItemType.SHOPPING:
        return { textColor: 'text-purple-500', bg: 'bg-surface' };
      case ItemType.EVENT:
        return { textColor: 'text-acc-event', bg: 'bg-surface' };
      case ItemType.SKILL_LOG:
        return { textColor: 'text-indigo-500', bg: 'bg-surface' };
      case ItemType.JOURNAL:
        return { textColor: 'text-fuchsia-400', bg: 'bg-surface' };
      case ItemType.FINANCE:
        const isIncome = meta?.financeType === 'income';
        const isTransfer = meta?.financeType === 'transfer';
        const isSaving = meta?.financeType === 'saving';
        const iconColor = isTransfer ? 'text-blue-400' : (isIncome ? 'text-emerald-500' : (isSaving ? 'text-[#6366F1]' : 'text-red-500'));
        
        return {
            textColor: iconColor,
            bg: 'bg-surface'
        };
      case ItemType.NOTE:
      default:
        return {
          textColor: 'text-acc-note',
          bg: 'bg-surface'
        };
    }
  };

  const style = getStyles();

  // --- Display Logic for Collapsed State ---
  let displayDate = null;
  const rawDate = readonly && completed_at ? completed_at : (meta?.date && meta.date !== 'null' ? meta.date : created_at);
  const isCreatedDate = !meta?.date || meta.date === 'null';

  // Routine next cycle logic
  let nextDueText = null;
  let isWaitingForNextCycle = false;
  if (meta.isRoutine && status === 'done' && completed_at) {
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

  if (rawDate) {
    const dateObj = new Date(rawDate);
    if (!isNaN(dateObj.getTime())) {
      const now = new Date();
      const isToday = dateObj.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const isTomorrow = dateObj.toDateString() === tomorrow.toDateString();

      const hasTimeComponent = rawDate.includes('T') && !rawDate.endsWith('00:00:00.000Z');
      
      let datePart = '';
      if (isToday) datePart = 'Today';
      else if (isTomorrow) datePart = 'Tomorrow';
      else datePart = dateObj.toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });

      if (meta.isRoutine) {
          // For routines, show next due date if done, otherwise show current due date
          if (isWaitingForNextCycle && nextDueText) {
              displayDate = nextDueText;
          } else {
              displayDate = datePart;
          }
      } else if (hasTimeComponent || isCreatedDate) {
        displayDate = `${datePart} • ${dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute:'2-digit' })}`;
      } else {
        displayDate = datePart;
      }
    }
  }

  const validTags = meta?.tags?.filter(t => t && t !== 'null' && t !== 'undefined') || [];
  const displayAmount = type !== ItemType.TODO ? formatMoney(meta?.amount) : null;

  // Field visibilities
  const isNote = type === ItemType.NOTE || type === ItemType.JOURNAL || type === ItemType.SKILL_LOG;
  const showAmountField = type === ItemType.FINANCE || type === ItemType.SHOPPING;
  const showDateField = type === ItemType.TODO || type === ItemType.EVENT || type === ItemType.SHOPPING || type === ItemType.FINANCE || type === ItemType.SKILL_LOG || type === ItemType.JOURNAL;
  const showFinanceExtras = type === ItemType.FINANCE || (type === ItemType.SHOPPING && showAmountField);
  const showSkillExtras = type === ItemType.SKILL_LOG;
  const showProgress = type === ItemType.TODO && status === 'pending';

  // Read More Logic
  const charLimit = 280;
  const lineLimit = 8;
  const isLongText = content.length > charLimit || (content.match(/\n/g) || []).length > lineLimit;

  // Helper to get normalized wallet options to avoid duplicates
  const getWalletOptions = () => {
    const unique = new Map<string, {name: string, id: string}>();
    
    // Add registered wallets
    wallets.forEach(w => unique.set(w.name.toLowerCase(), {name: w.name, id: w.id}));
    
    // Check if current items have a custom method not in register
    if (editPaymentMethod && !unique.has(editPaymentMethod.toLowerCase())) {
        unique.set(editPaymentMethod.toLowerCase(), {name: editPaymentMethod, id: 'custom-payment'});
    }
    if (editToWallet && !unique.has(editToWallet.toLowerCase())) {
        unique.set(editToWallet.toLowerCase(), {name: editToWallet, id: 'custom-to'});
    }

    return Array.from(unique.values()).map(w => (
        <option key={w.id} value={w.name}>{w.name}</option>
    ));
  };

  // Determine if we should show the date next to the icon (For Notes/Journals/SkillLogs)
  const showDateInHeader = isNote && displayDate && isCollapsed;

  // Compact Transaction Mode
  const isTransaction = type === ItemType.FINANCE || (type === ItemType.SHOPPING && meta.amount);

  const isRecentlyDone = status === 'done' && completed_at && (new Date().getTime() - new Date(completed_at).getTime() < 86400000);
  const isRoutineDone = meta.isRoutine && status === 'done';
  
  const isDarkened = !noDarken && isRecentlyDone;
  const bgClass = isDarkened ? 'bg-zinc-100 dark:bg-zinc-900/50 opacity-75' : style.bg;

  return (
    <div 
        className={`${bgClass} rounded-[24px] p-4 shadow-sm transition-all hover:bg-surface/80 ${isOptimistic ? 'opacity-50' : ''} break-inside-avoid ${className} ${enableCollapse ? 'cursor-pointer' : ''}`}
        onClick={toggleCollapse}
    >
      <div className="flex flex-col gap-1">
        
        {/* COLLAPSED HEADER */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!readonly && onToggleStatus) onToggleStatus(item.id);
                }}
                disabled={readonly}
                className={`transition-colors shrink-0 ${readonly ? 'cursor-default' : 'hover:opacity-80'}`}
              >
                {status === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-muted" />
                ) : (
                    <Circle className={`w-4 h-4 ${style.textColor}`} />
                )}
              </button>
              <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${shouldStrike ? 'text-muted' : style.textColor}`}>
                      {categoryName || type.toLowerCase()}
                  </span>
                  {meta.isRoutine && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
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
                  {isRoutineDone && onResetRoutine && (
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
          </div>
          
          <div className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {displayDate ? displayDate.split('•')[0].trim() : ''}
          </div>
        </div>
        
        {/* COLLAPSED CONTENT */}
        {enableCollapse && isCollapsed ? (
            <div className="flex justify-between items-start gap-4 mt-1">
                <div className="flex flex-col min-w-0 flex-1">
                    <div className={`text-base font-medium text-primary ${isNote ? 'line-clamp-3' : 'line-clamp-2'} ${shouldStrike ? 'line-through text-muted' : ''}`}>
                        {content}
                    </div>
                    
                    {/* Extra Metadata Row */}
                    {(meta.paymentMethod || meta.toWallet || validTags.length > 0 || skillName) && (
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-muted">
                            {(meta.paymentMethod || meta.toWallet || (meta.financeType === 'saving' && meta.savingGoalId)) && (
                                <span className="flex items-center gap-0.5">
                                    <WalletIcon className="w-3 h-3" />
                                    {meta.financeType === 'saving' && meta.savingGoalId ? (() => {
                                        const goal = savingGoals.find(g => g.id === meta.savingGoalId);
                                        const walletId = goal?.meta.dedicatedWalletId;
                                        const wallet = wallets.find(w => w.id === walletId);
                                        return wallet ? wallet.name : (meta.paymentMethod || 'Linked to Goal');
                                    })() : meta.paymentMethod}
                                    {meta.financeType === 'transfer' && meta.toWallet && (
                                        <>
                                            <ArrowRight className="w-3 h-3" />
                                            {meta.toWallet}
                                        </>
                                    )}
                                </span>
                            )}
                            {skillName && (
                                <span className="text-indigo-500">{skillName}</span>
                            )}
                            {validTags.map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 rounded bg-muted/10">#{tag}</span>
                            ))}
                        </div>
                    )}
                    
                    {/* Progress Bar */}
                    {showProgress && meta.progress !== undefined && meta.progress > 0 && meta.progress < 100 && (
                        <div className="mt-2 w-full max-w-[200px]">
                            <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                                <div className="h-full bg-acc-todo" style={{ width: `${Math.max(2, meta.progress)}%` }}></div>
                            </div>
                        </div>
                    )}
                </div>

                {(displayAmount || meta.durationMinutes) && (
                    <div className={`text-base font-bold shrink-0 mt-0.5 ${type === 'FINANCE' && meta.financeType === 'income' ? 'text-emerald-500' : (type === 'FINANCE' && meta.financeType === 'transfer' ? 'text-blue-400' : 'text-primary')}`}>
                        {displayAmount || `${meta.durationMinutes}m`}
                    </div>
                )}
            </div>
        ) : null}
      </div>

      {/* EXPANDED EDIT BODY */}
      {(!enableCollapse || !isCollapsed) && (
          <div className="pt-4 mt-2 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
               
               {/* Content Edit */}
               <textarea
                   className={`w-full bg-background border border-border rounded-2xl p-3 text-sm text-primary focus:outline-none focus:border-primary mb-3 resize-none ${isNote ? 'h-48' : 'h-20'}`}
                   value={editContent}
                   onChange={(e) => setEditContent(e.target.value)}
                   placeholder="Content..."
               />

               {/* Dynamic Fields Grid */}
               <div className="grid grid-cols-2 gap-3 mb-3">
                   {/* Finance Type Switcher */}
                   {type === ItemType.FINANCE && (
                       <div className="col-span-2 flex bg-background border border-border rounded-2xl p-1 overflow-x-auto no-scrollbar">
                           {(['expense', 'income', 'transfer', 'saving'] as FinanceType[]).map(ft => (
                               <button
                                   key={ft}
                                   onClick={() => setEditFinanceType(ft)}
                                   className={`flex-1 py-1 px-2 text-[10px] font-medium rounded-xl capitalize whitespace-nowrap ${editFinanceType === ft ? 'bg-[#6366F1] text-white' : 'text-muted hover:text-primary'}`}
                               >
                                   {ft}
                               </button>
                           ))}
                       </div>
                   )}

                   {/* Amount */}
                   {showAmountField && (
                        <div className={type === ItemType.FINANCE && editFinanceType === 'transfer' ? "col-span-2" : ""}>
                            <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Amount</label>
                            <div className="relative">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                                <input
                                    type="number"
                                    className="w-full bg-background border border-border rounded-2xl pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                   )}

                   {/* Date */}
                   {showDateField && !meta.isRoutine && (
                        <div className={(!showAmountField && !showSkillExtras) ? "col-span-2" : ""}>
                            <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                                <input
                                    type="datetime-local"
                                    className="w-full bg-background border border-border rounded-2xl pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:border-primary [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                />
                            </div>
                        </div>
                   )}

                   {/* Routine Settings */}
                   {meta.isRoutine && (
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
                                           onClick={() => {
                                               setEditRoutineInterval(int);
                                               updateDateFromSchedule(int, editRoutineDaysOfWeek, editRoutineDaysOfMonth, editRoutineMonthsOfYear);
                                           }}
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
                                                       let newDays;
                                                       if (editRoutineDaysOfWeek.includes(idx)) {
                                                           newDays = editRoutineDaysOfWeek.filter(d => d !== idx);
                                                       } else {
                                                           newDays = [...editRoutineDaysOfWeek, idx];
                                                       }
                                                       setEditRoutineDaysOfWeek(newDays);
                                                       updateDateFromSchedule(editRoutineInterval, newDays, editRoutineDaysOfMonth, editRoutineMonthsOfYear);
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
                                                       let newDays;
                                                       if (editRoutineDaysOfMonth.includes(day)) {
                                                           newDays = editRoutineDaysOfMonth.filter(d => d !== day);
                                                       } else {
                                                           newDays = [...editRoutineDaysOfMonth, day];
                                                       }
                                                       setEditRoutineDaysOfMonth(newDays);
                                                       updateDateFromSchedule(editRoutineInterval, editRoutineDaysOfWeek, newDays, editRoutineMonthsOfYear);
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

                   {/* Skill Fields */}
                   {showSkillExtras && (
                       <>
                           <div>
                                <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Duration (Min)</label>
                                <div className="relative">
                                    <Hourglass className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                                    <input
                                        type="number"
                                        className="w-full bg-background border border-border rounded-2xl pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                        value={editDuration}
                                        onChange={(e) => setEditDuration(e.target.value)}
                                    />
                                </div>
                           </div>
                           <div>
                                <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Skill</label>
                                <select
                                    className="w-full bg-background border border-border rounded-2xl px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                    value={editSkillId}
                                    onChange={(e) => setEditSkillId(e.target.value)}
                                >
                                    <option value="">Uncategorized</option>
                                    {skills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                           </div>
                       </>
                   )}

                   {/* Finance Extras (Payment/Budget) */}
                   {showFinanceExtras && (
                       <>
                           {editFinanceType !== 'saving' && (
                               <div>
                                   <label className="text-[10px] uppercase text-muted font-bold mb-1 block">
                                       {editFinanceType === 'transfer' ? 'From' : 'Method'}
                                   </label>
                                   <select
                                       className="w-full bg-background border border-border rounded-2xl px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                       value={editPaymentMethod}
                                       onChange={(e) => setEditPaymentMethod(e.target.value)}
                                   >
                                       <option value="">Undefined</option>
                                       {getWalletOptions()}
                                   </select>
                               </div>
                           )}

                           {editFinanceType === 'transfer' ? (
                               <div>
                                   <label className="text-[10px] uppercase text-muted font-bold mb-1 block">To</label>
                                   <select
                                       className="w-full bg-background border border-border rounded-2xl px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                       value={editToWallet}
                                       onChange={(e) => setEditToWallet(e.target.value)}
                                   >
                                       <option value="">Select...</option>
                                       {getWalletOptions()}
                                   </select>
                               </div>
                           ) : editFinanceType === 'saving' ? (
                               <>
                                   <div>
                                       <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Saving Goal</label>
                                       <select
                                           className="w-full bg-background border border-border rounded-2xl px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                           value={editSavingGoalId}
                                           onChange={(e) => setEditSavingGoalId(e.target.value)}
                                       >
                                           <option value="">Select Goal...</option>
                                           {savingGoals.map(g => <option key={g.id} value={g.id}>{g.content}</option>)}
                                       </select>
                                   </div>
                                   <div>
                                       <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Wallet</label>
                                       <div className="w-full bg-background border border-border rounded-2xl px-3 py-2 text-xs text-muted flex items-center gap-2">
                                           <WalletIcon className="w-3 h-3" />
                                           {(() => {
                                               const goal = savingGoals.find(g => g.id === editSavingGoalId);
                                               const walletId = goal?.meta.dedicatedWalletId;
                                               const wallet = wallets.find(w => w.id === walletId);
                                               return wallet ? wallet.name : (editPaymentMethod || 'Linked to Goal');
                                           })()}
                                       </div>
                                   </div>
                                   <div className="col-span-2">
                                       <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Budget Category</label>
                                       <select
                                           className="w-full bg-background border border-border rounded-2xl px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                           value={editBudgetCategory}
                                           onChange={(e) => setEditBudgetCategory(e.target.value)}
                                       >
                                           <option value="">None</option>
                                           {budgetRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                       </select>
                                   </div>
                               </>
                           ) : (
                               <div>
                                   <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Budget</label>
                                   <select
                                       className="w-full bg-background border border-border rounded-2xl px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                       value={editBudgetCategory}
                                       onChange={(e) => setEditBudgetCategory(e.target.value)}
                                   >
                                       <option value="">None</option>
                                       {budgetRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                   </select>
                               </div>
                           )}
                       </>
                   )}
               </div>

               {/* Progress Control (Only for Todo) */}
               {showProgress && (
                   <div className="bg-acc-todo/5 border border-acc-todo/20 rounded-2xl p-3 mb-3">
                       <div className="flex justify-between items-center mb-2">
                           <span className="text-xs uppercase font-bold text-acc-todo flex items-center gap-1">
                               <Activity className="w-3.5 h-3.5" /> Progress
                           </span>
                           <span className="text-lg font-bold text-primary">{editProgress}%</span>
                       </div>
                       <input 
                           type="range"
                           min="0" max="100" step="5"
                           value={editProgress}
                           onChange={(e) => setEditProgress(parseInt(e.target.value))}
                           className="w-full h-2 bg-background rounded-xl appearance-none cursor-pointer accent-acc-todo mb-3"
                       />
                       <div>
                            <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Latest Update</label>
                            <input 
                                type="text"
                                value={editProgressNotes}
                                onChange={(e) => setEditProgressNotes(e.target.value)}
                                className="w-full bg-background border border-border rounded-2xl px-3 py-2 text-sm text-primary placeholder-muted/50 focus:outline-none focus:border-acc-todo"
                                placeholder="Add a progress note..."
                            />
                       </div>
                   </div>
               )}

               {/* Tags */}
               <div className="relative mb-3">
                    <Tag className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                    <input
                        type="text"
                        className="w-full bg-background border border-border rounded-2xl pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:border-primary placeholder-muted/50"
                        value={editTags}
                        onChange={(e) => setEditTags(e.target.value)}
                        placeholder="Tags (comma separated)..."
                    />
               </div>

               {/* Actions */}
               <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
                   {onDelete && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} 
                      className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-2xl text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                       <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                   )}
                   
                   {!readonly && onUpdate && (
                       <button
                           onClick={(e) => { e.stopPropagation(); handleSave(); }}
                           className="px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-2xl text-xs font-medium flex items-center gap-1 transition-colors shadow-sm"
                       >
                           <Save className="w-3.5 h-3.5" /> Save Changes
                       </button>
                   )}
               </div>
          </div>
      )}
    </div>
  );
};

export default Card;
