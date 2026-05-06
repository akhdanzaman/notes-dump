import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ItemType, BrainDumpItem, FinanceType, Skill, Wallet, BudgetRule, Priority } from '../types';
import { CheckCircle2, ShoppingCart, Calendar, StickyNote, Tag, Clock, Circle, Trash2, TrendingUp, TrendingDown, Wallet as WalletIcon, ArrowRightLeft, BookOpen, ArrowRight, BookText, ChevronDown, ChevronUp, Save, DollarSign, Type, Hourglass, X, Activity, Repeat, RotateCcw, AlertCircle } from 'lucide-react';

import { calculateNextDueDate, getRoutineScheduleLabel } from '../utils/selectors';
import { ACHIEVED_GOAL_FINANCE_TYPE, formatFinanceTypeLabel } from '../utils/financeTypeUtils';
import { getShoppingDueDate, getShoppingTransactionDate, shouldShoppingDateEditCompletion } from '../utils/shoppingDateUtils';
import { taskEditSurface } from './layout/contentSurface';

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
    newSavingGoalId?: string,
    newDedicatedWalletId?: string,
    newPriority?: Priority,
    newStart?: string,
    newEnd?: string,
    newHideFromCalendar?: boolean
  ) => void;
  onResetRoutine?: (id: string) => void;
  onAcceptDeepWorkPlan?: (id: string) => void;
  onDismissDeepWorkPlan?: (id: string) => void;
  readonly?: boolean;
  skillName?: string;
  categoryName?: string;
  noStrikethrough?: boolean;
  noDarken?: boolean;
  enableCollapse?: boolean;
  defaultCollapsed?: boolean;
  hideMoney?: boolean;
  className?: string;
  editComfort?: 'default' | 'taskWorkspace';
  collapsibleEditPanel?: boolean;
  editPanelExpanded?: boolean;
  onEditPanelExpandedChange?: (id: string, expanded: boolean) => void;
  onCollapseChange?: (id: string, collapsed: boolean) => void;
  
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
    onAcceptDeepWorkPlan,
    onDismissDeepWorkPlan,
    readonly = false, 
    skillName, 
    categoryName, 
    noStrikethrough = false,
    noDarken = false,
    enableCollapse = false,
    defaultCollapsed = false,
    hideMoney = false,
    className = '',
    editComfort = 'default',
    collapsibleEditPanel = false,
    editPanelExpanded = false,
    onEditPanelExpandedChange,
    onCollapseChange,
    skills = [],
    wallets = [],
    budgetRules = [],
    savingGoals = []
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [showFullText, setShowFullText] = useState(false);
  const { type, content = '', meta = {}, isOptimistic, status, created_at, completed_at } = item;
  
  // --- Edit State ---
  const [editContent, setEditContent] = useState(content);
  const [editAmount, setEditAmount] = useState<string>(meta.amount ? meta.amount.toString() : '');
  const [editTags, setEditTags] = useState(meta.tags?.join(', ') || '');
  const [editDate, setEditDate] = useState<string>('');
  const [editStart, setEditStart] = useState<string>('');
  const [editEnd, setEditEnd] = useState<string>('');
  const [editHideFromCalendar, setEditHideFromCalendar] = useState<boolean>(meta.hideFromCalendar || false);
  
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
  const [editPriority, setEditPriority] = useState<Priority>(meta.priority || 'normal');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editContent, isCollapsed]);

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
    setEditPaymentMethod(getWalletValue(meta.paymentMethod) || '');
    setEditToWallet(getWalletValue(meta.toWallet) || '');
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
    setEditPriority(meta.priority || 'normal');
    setEditHideFromCalendar(meta.hideFromCalendar || false);
    
    // Date Init
    const isoDate = type === ItemType.SHOPPING
      ? (shouldShoppingDateEditCompletion(item) ? getShoppingTransactionDate(item) : getShoppingDueDate(item))
      : ((meta.date && meta.date !== 'null') ? meta.date : (completed_at || created_at));
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

    if (meta.start) {
        const startObj = new Date(meta.start);
        if (!isNaN(startObj.getTime())) {
            const offset = startObj.getTimezoneOffset() * 60000;
            const localStart = new Date(startObj.getTime() - offset);
            setEditStart(localStart.toISOString().slice(0, 16));
        } else {
            setEditStart('');
        }
    } else {
        setEditStart('');
    }

    if (meta.end) {
        const endObj = new Date(meta.end);
        if (!isNaN(endObj.getTime())) {
            const offset = endObj.getTimezoneOffset() * 60000;
            const localEnd = new Date(endObj.getTime() - offset);
            setEditEnd(localEnd.toISOString().slice(0, 16));
        } else {
            setEditEnd('');
        }
    } else {
        setEditEnd('');
    }

  }, [item, isCollapsed]); // Reset when collapsing/expanding or item changes

  const handleSave = () => {
      if (!onUpdate) return;

      const tagArray = editTags.split(',').map(t => t.trim()).filter(t => t);
      const numAmount = editAmount ? parseFloat(editAmount) : undefined;
      const numDuration = editDuration ? parseFloat(editDuration) : undefined;
      
      let finalDate: string | undefined = undefined;
      if (editDate) finalDate = new Date(editDate).toISOString();

      let finalStart: string | undefined = undefined;
      if (editStart) finalStart = new Date(editStart).toISOString();

      let finalEnd: string | undefined = undefined;
      if (editEnd) finalEnd = new Date(editEnd).toISOString();

      const finalBudgetCategory = editBudgetCategory === '' ? undefined : editBudgetCategory;
      const finalSkillId = editSkillId === '' ? undefined : editSkillId;
      const finalToWallet = editFinanceType === 'transfer' && editToWallet ? editToWallet : undefined;
      const finalSavingGoalId = (editFinanceType === 'saving' || editFinanceType === ACHIEVED_GOAL_FINANCE_TYPE) && editSavingGoalId ? editSavingGoalId : undefined;

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
          finalSavingGoalId,
          undefined, // newDedicatedWalletId
          editPriority,
          finalStart,
          finalEnd,
          editHideFromCalendar
      );
      
      if (enableCollapse) {
          setIsCollapsed(true);
      }
  };

  const shouldStrike = status === 'done' && !noStrikethrough && type !== ItemType.JOURNAL;

  const toggleCollapse = () => {
      if (!enableCollapse) return;
      const nextCollapsed = !isCollapsed;
      setIsCollapsed(nextCollapsed);
      onCollapseChange?.(item.id, nextCollapsed);
      if (nextCollapsed && collapsibleEditPanel) {
          onEditPanelExpandedChange?.(item.id, false);
      }
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
      case ItemType.JOURNAL:
        return { textColor: 'text-fuchsia-400', bg: 'bg-surface' };
      case ItemType.FINANCE:
        const isIncome = meta?.financeType === 'income';
        const isTransfer = meta?.financeType === 'transfer';
        const isSaving = meta?.financeType === 'saving';
        const isAchievedGoal = meta?.financeType === ACHIEVED_GOAL_FINANCE_TYPE;
        const iconColor = isTransfer ? 'text-blue-400' : (isIncome ? 'text-emerald-500' : (isSaving ? 'text-[#6366F1]' : (isAchievedGoal ? 'text-amber-500' : 'text-red-500')));
        
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
  const isShoppingItem = type === ItemType.SHOPPING;
  const rawDate = isShoppingItem
    ? (shouldShoppingDateEditCompletion(item) ? getShoppingTransactionDate(item) : getShoppingDueDate(item))
    : (readonly && completed_at ? completed_at : (meta?.date && meta.date !== 'null' ? meta.date : created_at));
  const isCreatedDate = !isShoppingItem && (!meta?.date || meta.date === 'null');

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
  const canToggleStatus = !readonly && !!onToggleStatus && type !== ItemType.FINANCE;
  const displayTypeLabel = type === ItemType.FINANCE ? formatFinanceTypeLabel(meta?.financeType) : type.toLowerCase();

  // Field visibilities
  const isNote = type === ItemType.NOTE || type === ItemType.JOURNAL;
  const showAmountField = type === ItemType.FINANCE || type === ItemType.SHOPPING;
  const showDateField = type === ItemType.TODO || type === ItemType.EVENT || type === ItemType.SHOPPING || type === ItemType.FINANCE || type === ItemType.JOURNAL;
  const showFinanceExtras = type === ItemType.FINANCE || (type === ItemType.SHOPPING && showAmountField);
  const showSkillExtras = false;
  const showProgress = type === ItemType.TODO && status === 'pending';

  // Read More Logic
  const charLimit = 280;
  const lineLimit = 8;
  const isLongText = content.length > charLimit || (content.match(/\n/g) || []).length > lineLimit;

  const getWalletName = (idOrName?: string) => {
      if (!idOrName) return '';
      const w = wallets.find(w => w.id === idOrName || w.name.toLowerCase() === idOrName.toLowerCase());
      return w ? w.name : idOrName;
  };

  const getWalletValue = (idOrName?: string) => {
      if (!idOrName) return '';
      const w = wallets.find(w => w.id === idOrName || w.name.toLowerCase() === idOrName.toLowerCase());
      return w ? w.id : idOrName;
  };

  const getWalletNameOptions = () => {
    const unique = new Map<string, {name: string, id: string}>();
    
    // Add registered wallets
    wallets.forEach(w => unique.set(w.id, {name: w.name, id: w.id}));
    
    // Check if current items have a custom method not in register
    if (editPaymentMethod && !unique.has(editPaymentMethod)) {
        unique.set(editPaymentMethod, {name: getWalletName(editPaymentMethod), id: editPaymentMethod});
    }
    if (editToWallet && !unique.has(editToWallet)) {
        unique.set(editToWallet, {name: getWalletName(editToWallet), id: editToWallet});
    }

    return Array.from(unique.values()).map(w => (
        <option key={w.id} value={w.id}>{w.name}</option>
    ));
  };

  // Determine if we should show the date next to the icon (For Notes/Journals/SkillLogs)
  const showDateInHeader = isNote && displayDate && isCollapsed;

  // Compact Transaction Mode
  const isTransaction = type === ItemType.FINANCE || (type === ItemType.SHOPPING && meta.amount);

  const isRecentlyDone = status === 'done' && completed_at && (new Date().getTime() - new Date(completed_at).getTime() < 86400000);
  const isRoutineDone = meta.isRoutine && status === 'done';
  const isParsingFailed = meta.tags?.includes('parsing_failed');
  const showDeepWorkSuggestion = type === ItemType.TODO && meta.deepWorkParent && meta.deepWorkStatus === 'suggested';
  const canShowMoneyMetadata = type === ItemType.FINANCE || type === ItemType.SHOPPING;
  const hasMoneyMetadata = canShowMoneyMetadata && (meta.paymentMethod || meta.toWallet || (meta.savingGoalId && (meta.financeType === 'saving' || meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE)));
  
  const isDarkened = !noDarken && (isRecentlyDone || isParsingFailed) && type !== ItemType.JOURNAL;
  const bgClass = isDarkened ? 'bg-zinc-100 dark:bg-zinc-900/50 opacity-75' : style.bg;
  const isTaskWorkspaceEdit = editComfort === 'taskWorkspace' && enableCollapse && !isCollapsed;
  const showInlineEditPanel = !enableCollapse || !isCollapsed;
  const showEditBody = showInlineEditPanel && (!collapsibleEditPanel || editPanelExpanded);
  const showPreviewContent = enableCollapse && (isCollapsed || (collapsibleEditPanel && !editPanelExpanded));
  const editGridClass = isTaskWorkspaceEdit ? taskEditSurface.fieldGrid : 'grid grid-cols-2 gap-3 mb-3';
  const actionRowClass = isTaskWorkspaceEdit ? taskEditSurface.actions : 'flex justify-end gap-2 pt-2 border-t border-border/30';
  const actionButtonComfort = isTaskWorkspaceEdit ? taskEditSurface.actionButton : '';

  return (
    <motion.div 
        initial={{ scale: 1 }}
        animate={{ scale: !isCollapsed ? 1.02 : 1 }}
        transition={{ type: "tween", ease: "easeInOut", duration: 0.2 }}
        data-edit-comfort={editComfort === 'taskWorkspace' ? 'task-workspace' : undefined}
        data-card-expanded={!isCollapsed ? 'true' : 'false'}
        className={`${bgClass} ${!isCollapsed ? 'ring-2 ring-indigo-500/20 shadow-lg' : ''} rounded-[16px] p-3 ${isTaskWorkspaceEdit ? taskEditSurface.cardExpanded : ''} shadow-sm transition-all hover:bg-surface/80 ${isOptimistic || isParsingFailed ? 'opacity-50' : ''} break-inside-avoid ${className} ${enableCollapse ? 'cursor-pointer' : ''}`}
        onClick={toggleCollapse}
    >
      <div className="flex flex-col gap-1">
        
        {/* COLLAPSED HEADER */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (canToggleStatus) onToggleStatus(item.id);
                }}
                disabled={!canToggleStatus}
                className={`transition-colors shrink-0 ${canToggleStatus ? 'hover:opacity-80' : 'cursor-default'}`}
              >
                {status === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-muted" />
                ) : (
                    <Circle className={`w-4 h-4 ${style.textColor}`} />
                )}
              </button>
              <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${shouldStrike ? 'text-muted' : style.textColor}`}>
                      {categoryName || displayTypeLabel}
                  </span>
                  {(meta.deepWorkParent || meta.parentTodoId) && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-500">
                          <span className="text-[9px] font-bold uppercase tracking-tight">
                              {meta.deepWorkParent ? `deep work ${meta.progress !== undefined ? `${meta.progress}%` : ''}` : `step ${meta.deepWorkStepIndex || ''}`}
                          </span>
                      </div>
                  )}
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
                  {meta.priority && meta.priority !== 'normal' && (
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${
                          meta.priority === 'high' 
                            ? 'bg-red-500/10 border-red-500/20 text-red-500' 
                            : 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                      }`}>
                          <AlertCircle className="w-2.5 h-2.5" />
                          <span className="text-[9px] font-bold uppercase tracking-tight">
                              {meta.priority}
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
          
          <div className="flex items-center gap-2">
            {validTags.map(tag => {
                if (tag === 'parsing_failed' && meta.parsingError) {
                    return (
                        <span key={tag} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 flex items-center gap-1 text-[10px]" title={meta.parsingError}>
                            <AlertCircle className="w-3 h-3" />
                            Parsing Failed
                        </span>
                    );
                }
                return (
                    <span key={tag} className="px-1.5 py-0.5 rounded bg-muted/10 text-[10px] text-muted">#{tag}</span>
                );
            })}
            {(meta.start || meta.end) && (
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider">
                    {meta.start ? new Date(meta.start).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}
                    {meta.start && meta.end ? ' - ' : ''}
                    {meta.end ? new Date(meta.end).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
            )}
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider">
                {displayDate ? displayDate.split('•')[0].trim() : ''}
            </div>
          </div>
        </div>
        
        {/* COLLAPSED CONTENT */}
        {showPreviewContent ? (
            <div className="flex justify-between items-start gap-4 mt-1">
                <div className="flex flex-col min-w-0 flex-1">
                    <div className={`text-base font-medium text-primary ${isNote ? 'line-clamp-1' : 'line-clamp-2'} ${shouldStrike ? 'line-through text-muted' : ''}`}>
                        {isNote ? content.split('\n')[0] : content}
                    </div>
                    
                    {/* Extra Metadata Row */}
                    {(hasMoneyMetadata || skillName) && (
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-muted">
                            {hasMoneyMetadata && (
                                <span className="flex items-center gap-0.5">
                                    <WalletIcon className="w-3 h-3" />
                                    {meta.savingGoalId && (meta.financeType === 'saving' || meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE) ? (() => {
                                        const goal = savingGoals.find(g => g.id === meta.savingGoalId);
                                        const walletId = goal?.meta.dedicatedWalletId;
                                        const wallet = wallets.find(w => w.id === walletId);
                                        return wallet ? wallet.name : (getWalletName(meta.paymentMethod) || 'Linked to Goal');
                                    })() : getWalletName(meta.paymentMethod)}
                                    {meta.financeType === 'transfer' && meta.toWallet && (
                                        <>
                                            <ArrowRight className="w-3 h-3" />
                                            {getWalletName(meta.toWallet)}
                                        </>
                                    )}
                                </span>
                            )}
                            {skillName && (
                                <span className="text-indigo-500">{skillName}</span>
                            )}
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
                    <div className={`text-base font-bold shrink-0 mt-0.5 ${type === 'FINANCE' && meta.financeType === 'income' ? 'text-emerald-500' : (type === 'FINANCE' && meta.financeType === 'transfer' ? 'text-blue-400' : (type === 'FINANCE' && meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE ? 'text-amber-500' : 'text-primary'))}`}>
                        {displayAmount || `${meta.durationMinutes}m`}
                    </div>
                )}
            </div>
        ) : null}
      </div>

      {/* EXPANDED EDIT BODY */}
      {enableCollapse && !isCollapsed && collapsibleEditPanel && !readonly && onUpdate && (
          <div className="mt-3 flex justify-end border-t border-border/30 pt-3" onClick={(e) => e.stopPropagation()}>
              <button
                  onClick={(e) => {
                      e.stopPropagation();
                      onEditPanelExpandedChange?.(item.id, !editPanelExpanded);
                  }}
                  className="px-3 py-2 rounded-xl bg-black/5 dark:bg-white/10 text-muted hover:text-primary hover:bg-black/10 dark:hover:bg-white/15 text-xs font-bold transition-colors flex items-center gap-1"
              >
                  {editPanelExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {editPanelExpanded ? 'Hide edit' : 'Edit details'}
              </button>
          </div>
      )}

      {showEditBody && (
          <div className={`${isNote ? 'pt-1' : 'pt-3 mt-2 border-t border-border/30'}`} onClick={(e) => e.stopPropagation()}>
               
               {/* Content Edit */}
               <textarea
                   ref={textareaRef}
                   className={`w-full text-primary focus:outline-none mb-3 resize-none overflow-hidden ${
                       isNote 
                           ? 'text-base bg-transparent border-none p-0 min-h-[120px] leading-relaxed' 
                           : `text-sm bg-background border border-border rounded-2xl p-3 focus:border-primary min-h-[80px] ${isTaskWorkspaceEdit ? taskEditSurface.textarea : ''}`
                   }`}
                   value={editContent}
                   onChange={(e) => setEditContent(e.target.value)}
                   placeholder="Content..."
               />

               {/* Dynamic Fields Grid */}
               <div className={editGridClass} data-edit-field-grid={isTaskWorkspaceEdit ? 'task-workspace' : undefined}>
                   {/* Finance Type Switcher */}
                   {type === ItemType.FINANCE && (
                       <div className="col-span-2 flex bg-background border border-border rounded-2xl p-1 overflow-x-auto no-scrollbar">
                           {(['expense', 'income', 'transfer', 'saving', 'achieved_goal'] as FinanceType[]).map(ft => (
                               <button
                                   key={ft}
                                   onClick={() => setEditFinanceType(ft)}
                                   className={`flex-1 py-1 px-2 text-[10px] font-medium rounded-xl capitalize whitespace-nowrap ${editFinanceType === ft ? 'bg-[#6366F1] text-white' : 'text-muted hover:text-primary'}`}
                               >
                                   {formatFinanceTypeLabel(ft)}
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
                            <label className="text-[10px] uppercase text-muted font-bold mb-1 block">{type === ItemType.SHOPPING ? (shouldShoppingDateEditCompletion(item) ? 'Completed date' : 'Due date') : 'Date'}</label>
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

                   {/* Start and End */}
                   {(type === ItemType.TODO || type === ItemType.EVENT) && !meta.isRoutine && (
                       <>
                           <div>
                               <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Start Time</label>
                               <div className="relative">
                                   <Clock className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                                   <input
                                       type="datetime-local"
                                       className="w-full bg-background border border-border rounded-2xl pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:border-primary [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                       value={editStart}
                                       onChange={(e) => setEditStart(e.target.value)}
                                   />
                               </div>
                           </div>
                           <div>
                               <label className="text-[10px] uppercase text-muted font-bold mb-1 block">End Time</label>
                               <div className="relative">
                                   <Clock className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                                   <input
                                       type="datetime-local"
                                       className="w-full bg-background border border-border rounded-2xl pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:border-primary [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                       value={editEnd}
                                       onChange={(e) => setEditEnd(e.target.value)}
                                   />
                               </div>
                           </div>
                       </>
                   )}

                   {/* Priority */}
                   {(type === ItemType.TODO || type === ItemType.EVENT) && (
                       <div className="col-span-2">
                           <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Priority</label>
                           <div className="grid grid-cols-3 gap-2">
                               {(['low', 'normal', 'high'] as Priority[]).map(p => (
                                   <button
                                       key={p}
                                       onClick={() => setEditPriority(p)}
                                       className={`py-2 ${isTaskWorkspaceEdit ? taskEditSurface.priorityButton : ''} rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                                           editPriority === p 
                                               ? 'bg-indigo-600 text-white shadow-sm' 
                                               : 'bg-background border border-border text-muted hover:border-indigo-500/50'
                                       }`}
                                   >
                                       {p}
                                   </button>
                               ))}
                           </div>
                       </div>
                   )}

                   {/* Hide from Calendar */}
                   {(type === ItemType.TODO || type === ItemType.EVENT || type === ItemType.SHOPPING) && (
                       <div className="col-span-2 flex items-center gap-2 mt-1">
                           <input 
                               type="checkbox" 
                               id={`hideFromCalendar-${item.id}`}
                               checked={editHideFromCalendar}
                               onChange={(e) => setEditHideFromCalendar(e.target.checked)}
                               className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
                           />
                           <label htmlFor={`hideFromCalendar-${item.id}`} className="text-xs font-medium text-primary">
                               Hide from Calendar
                           </label>
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
                           {editFinanceType !== 'saving' && editFinanceType !== ACHIEVED_GOAL_FINANCE_TYPE && (
                               <div>
                                   <label className="text-[10px] uppercase text-muted font-bold mb-1 block">
                                       {editFinanceType === 'transfer' ? 'From' : editFinanceType === 'income' ? 'To' : 'Wallet'}
                                   </label>
                                   <select
                                       className="w-full bg-background border border-border rounded-2xl px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                       value={editPaymentMethod}
                                       onChange={(e) => setEditPaymentMethod(e.target.value)}
                                   >
                                       <option value="">Undefined</option>
                                       {getWalletNameOptions()}
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
                                       {getWalletNameOptions()}
                                   </select>
                               </div>
                           ) : editFinanceType === 'saving' || editFinanceType === ACHIEVED_GOAL_FINANCE_TYPE ? (
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
                                               return wallet ? wallet.name : (getWalletName(editPaymentMethod) || 'Linked to Goal');
                                           })()}
                                       </div>
                                   </div>
                                   {editFinanceType === 'saving' && (
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
                                   )}
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
                   <div className={`bg-acc-todo/5 border border-acc-todo/20 rounded-2xl p-3 mb-3 ${isTaskWorkspaceEdit ? taskEditSurface.progressPanel : ''}`} data-edit-progress={isTaskWorkspaceEdit ? 'task-workspace' : undefined}>
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

               {showDeepWorkSuggestion && (
                   <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-3 mb-3">
                       <div className="flex items-start justify-between gap-3 mb-2">
                           <div>
                               <div className="text-xs uppercase font-bold text-purple-500 flex items-center gap-1">
                                   <BookOpen className="w-3.5 h-3.5" /> Deep Work suggestion
                               </div>
                               <p className="text-[11px] text-muted mt-1">
                                   {meta.deepWorkConfidence === 'low'
                                       ? 'Low confidence — review/edit this before creating steps.'
                                       : 'Detected a vague/stuck task and drafted a safer work breakdown.'}
                               </p>
                           </div>
                           {meta.deepWorkConfidence && (
                               <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${meta.deepWorkConfidence === 'low' ? 'bg-amber-500/10 text-amber-500' : 'bg-purple-500/10 text-purple-500'}`}>
                                   {meta.deepWorkConfidence}
                               </span>
                           )}
                       </div>
                       <div className="space-y-2 text-xs">
                           {meta.deepWorkNextAction && (
                               <div>
                                   <span className="block text-[10px] uppercase font-bold text-muted">First next action</span>
                                   <span className="text-primary">{meta.deepWorkNextAction}</span>
                               </div>
                           )}
                           {meta.deepWorkFinalOutput && (
                               <div>
                                   <span className="block text-[10px] uppercase font-bold text-muted">Final output</span>
                                   <span className="text-primary">{meta.deepWorkFinalOutput}</span>
                               </div>
                           )}
                           <div className="grid grid-cols-2 gap-2">
                               {meta.deepWorkSessionEstimateMinutes && (
                                   <div>
                                       <span className="block text-[10px] uppercase font-bold text-muted">Session</span>
                                       <span className="text-primary">{meta.deepWorkSessionEstimateMinutes} min</span>
                                   </div>
                               )}
                               {meta.deepWorkBlockerStatus && (
                                   <div>
                                       <span className="block text-[10px] uppercase font-bold text-muted">Blocker</span>
                                       <span className="text-primary capitalize">{meta.deepWorkBlockerStatus.replace('_', ' ')}</span>
                                   </div>
                               )}
                           </div>
                           {meta.deepWorkBlockerCheck && (
                               <div>
                                   <span className="block text-[10px] uppercase font-bold text-muted">Check before starting</span>
                                   <span className="text-primary">{meta.deepWorkBlockerCheck}</span>
                               </div>
                           )}
                           {meta.subtasks && meta.subtasks.length > 0 && (
                               <div>
                                   <span className="block text-[10px] uppercase font-bold text-muted mb-1">Suggested subtasks</span>
                                   <ol className="list-decimal list-inside space-y-1 text-primary">
                                       {meta.subtasks.map((subtask, index) => <li key={`${subtask}-${index}`}>{subtask}</li>)}
                                   </ol>
                               </div>
                           )}
                       </div>
                       <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-purple-500/10">
                           {onDismissDeepWorkPlan && (
                               <button
                                   onClick={(e) => { e.stopPropagation(); onDismissDeepWorkPlan(item.id); }}
                                   className="px-3 py-1.5 bg-background border border-border text-muted hover:text-primary rounded-2xl text-xs font-medium transition-colors"
                               >
                                   Dismiss
                               </button>
                           )}
                           {onAcceptDeepWorkPlan && (
                               <button
                                   onClick={(e) => { e.stopPropagation(); onAcceptDeepWorkPlan(item.id); }}
                                   className="px-3 py-1.5 bg-purple-600 text-white hover:bg-purple-500 rounded-2xl text-xs font-medium transition-colors"
                               >
                                   Create steps
                               </button>
                           )}
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
               <div className={actionRowClass} data-edit-actions={isTaskWorkspaceEdit ? 'task-workspace' : undefined}>
                   {onDelete && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} 
                      className={`px-3 py-1.5 ${actionButtonComfort} bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-2xl text-xs font-medium flex items-center gap-1 transition-colors`}
                    >
                       <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                   )}
                   
                   {!readonly && onUpdate && (
                       <button
                           onClick={(e) => { e.stopPropagation(); handleSave(); }}
                           className={`px-4 py-1.5 ${actionButtonComfort} bg-indigo-600 text-white hover:bg-indigo-500 rounded-2xl text-xs font-medium flex items-center gap-1 transition-colors shadow-sm`}
                       >
                           <Save className="w-3.5 h-3.5" /> Save Changes
                       </button>
                   )}
               </div>
          </div>
      )}
    </motion.div>
  );
};

export default Card;
