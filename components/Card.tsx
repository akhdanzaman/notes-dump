import React, { useState, useEffect } from 'react';
import { ItemType, BrainDumpItem, FinanceType, Skill, Wallet, BudgetRule } from '../types';
import { CheckCircle2, ShoppingCart, Calendar, StickyNote, Tag, Clock, Circle, Trash2, TrendingUp, TrendingDown, Wallet as WalletIcon, ArrowRightLeft, BookOpen, ArrowRight, BookText, ChevronDown, ChevronUp, Save, DollarSign, Type, Hourglass, X, Activity } from 'lucide-react';

interface CardProps {
  item: BrainDumpItem;
  onToggleStatus?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, newContent: string, newTags: string[], newAmount?: number, newDate?: string, newPaymentMethod?: string, newBudgetCategory?: string, newDuration?: number, newSkillId?: string, newToWallet?: string, newFinanceType?: FinanceType, newProgress?: number, newProgressNotes?: string) => void;
  readonly?: boolean;
  skillName?: string;
  categoryName?: string;
  noStrikethrough?: boolean;
  enableCollapse?: boolean;
  defaultCollapsed?: boolean;
  hideMoney?: boolean;
  className?: string;
  
  // Context Props
  skills?: Skill[];
  wallets?: Wallet[];
  budgetRules?: BudgetRule[];
}

const Card: React.FC<CardProps> = ({ 
    item, 
    onToggleStatus, 
    onDelete, 
    onUpdate,
    readonly = false, 
    skillName, 
    categoryName, 
    noStrikethrough = false,
    enableCollapse = false,
    defaultCollapsed = false,
    hideMoney = false,
    className = '',
    skills = [],
    wallets = [],
    budgetRules = []
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

  // Progress
  const [editProgress, setEditProgress] = useState(meta.progress || 0);
  const [editProgressNotes, setEditProgressNotes] = useState(meta.progressNotes || '');

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
    setEditProgress(meta.progress || 0);
    setEditProgressNotes(meta.progressNotes || '');
    
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
          editProgress,
          editProgressNotes
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
        return {
          border: 'border-l-4 border-l-acc-todo',
          icon: <Circle className="w-4 h-4 text-acc-todo" />,
          bg: 'bg-surface'
        };
      case ItemType.SHOPPING:
        return {
          border: 'border-l-4 border-l-purple-500',
          icon: <ShoppingCart className="w-4 h-4 text-purple-500" />,
          bg: 'bg-surface'
        };
      case ItemType.EVENT:
        return {
          border: 'border-l-4 border-l-acc-event',
          icon: <Calendar className="w-4 h-4 text-acc-event" />,
          bg: 'bg-surface'
        };
      case ItemType.SKILL_LOG:
        return {
          border: 'border-l-4 border-l-indigo-500',
          icon: <BookOpen className="w-4 h-4 text-indigo-500" />,
          bg: 'bg-surface'
        };
      case ItemType.JOURNAL:
        return {
          border: 'border-l-4 border-l-fuchsia-400',
          icon: <BookText className="w-4 h-4 text-fuchsia-400" />,
          bg: 'bg-surface'
        };
      case ItemType.FINANCE:
        const isIncome = meta?.financeType === 'income' || meta?.financeType === 'reimbursement';
        const isTransfer = meta?.financeType === 'transfer';
        const colorClass = isTransfer ? 'border-l-blue-400' : (isIncome ? 'border-l-emerald-500' : 'border-l-red-500');
        const Icon = isTransfer ? ArrowRightLeft : (meta?.financeType === 'lending' ? ArrowRightLeft : (isIncome ? TrendingUp : TrendingDown));
        const iconColor = isTransfer ? 'text-blue-400' : (isIncome ? 'text-emerald-500' : 'text-red-500');
        
        return {
            border: `border-l-4 ${colorClass}`,
            icon: <Icon className={`w-4 h-4 ${iconColor}`} />,
            bg: 'bg-surface'
        };
      case ItemType.NOTE:
      default:
        return {
          border: 'border-l-4 border-l-acc-note',
          icon: <StickyNote className="w-4 h-4 text-acc-note" />,
          bg: 'bg-surface'
        };
    }
  };

  const style = getStyles();

  // --- Display Logic for Collapsed State ---
  let displayDate = null;
  const rawDate = readonly && completed_at ? completed_at : (meta?.date && meta.date !== 'null' ? meta.date : created_at);
  const isCreatedDate = !meta?.date || meta.date === 'null';

  if (rawDate) {
    const dateObj = new Date(rawDate);
    if (!isNaN(dateObj.getTime())) {
      const hasTimeComponent = rawDate.includes('T') && !rawDate.endsWith('00:00:00.000Z');
      const datePart = dateObj.toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      if (hasTimeComponent || isCreatedDate) {
        displayDate = `${datePart} • ${dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute:'2-digit' })}`;
      } else {
        displayDate = datePart;
      }
    }
  }

  const validTags = meta?.tags?.filter(t => t && t !== 'null' && t !== 'undefined') || [];
  const displayAmount = formatMoney(meta?.amount);

  // Field visibilities
  const isNote = type === ItemType.NOTE || type === ItemType.JOURNAL || type === ItemType.SKILL_LOG;
  const showAmountField = type === ItemType.FINANCE || type === ItemType.SHOPPING || type === ItemType.TODO;
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

  return (
    <div 
        className={`${style.bg} ${style.border} rounded-r-lg border-y border-r border-r-border/50 border-y-border/50 shadow-sm transition-all hover:shadow-md hover:border-border ${isOptimistic ? 'opacity-50' : ''} break-inside-avoid ${className}`}
    >
      <div className={`p-3 ${enableCollapse && isCollapsed ? 'pb-3' : 'pb-0'}`}>
        
        {/* COLLAPSED HEADER */}
        <div 
            className={`flex items-start gap-3 ${enableCollapse ? 'cursor-pointer' : ''}`}
            onClick={toggleCollapse}
        >
          <div className="flex flex-col items-center gap-1 mt-0.5 shrink-0">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (!readonly && onToggleStatus) onToggleStatus(item.id);
                }}
                disabled={readonly}
                className={`transition-colors ${readonly ? 'cursor-default' : 'hover:opacity-70'}`}
              >
                {status === 'done' ? (
                    <CheckCircle2 className={`w-4 h-4 ${style.icon.props.className.replace('w-4 h-4', '')}`} />
                ) : (
                    style.icon
                )}
              </button>
          </div>
          
          <div className="flex-1 min-w-0">
             <div className="flex justify-between items-start gap-2">
                 <div className="flex flex-col w-full">
                     {/* For Notes: Display Date in Header */}
                     {showDateInHeader && (
                        <span className="text-[10px] text-muted font-medium mb-1 block">
                            {displayDate}
                        </span>
                     )}

                     {/* Main Content Area */}
                     <div className={`text-sm ${shouldStrike ? 'line-through text-muted' : 'text-primary'} ${
                         isNote 
                            ? (!isCollapsed ? 'hidden' : 'whitespace-pre-wrap') // Notes: Hide when expanded (edit mode), show when collapsed
                            : (enableCollapse && isCollapsed ? 'truncate' : 'whitespace-pre-wrap') // Others: Truncate collapsed
                     } ${isNote && isCollapsed && isLongText && !showFullText ? 'line-clamp-[8]' : ''}`}>
                        {content}
                     </div>

                     {/* Read More Button for Notes */}
                     {isNote && isCollapsed && isLongText && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowFullText(!showFullText);
                            }}
                            className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 mt-1 self-start"
                        >
                            {showFullText ? 'Show Less' : 'Read More'}
                        </button>
                     )}
                 </div>
                 
                 {enableCollapse && (
                     <div className="text-muted/50 ml-1 mt-0.5 shrink-0">
                         {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                     </div>
                 )}
             </div>
             
             {/* Collapsed: Progress Bar */}
             {enableCollapse && isCollapsed && type === ItemType.TODO && status === 'pending' && meta.progress && meta.progress > 0 && meta.progress < 100 && (
                <div className="mt-2 mb-1">
                    <div className="h-1 w-full bg-muted/20 rounded-full overflow-hidden">
                        <div className="h-full bg-acc-todo" style={{ width: `${meta.progress}%` }}></div>
                    </div>
                </div>
             )}

             {/* Collapsed: Compact Metadata */}
             {enableCollapse && isCollapsed && (
                 <div className="flex items-center gap-2 mt-1 text-[10px] text-muted h-4 overflow-hidden">
                     {categoryName && (
                         <span className="text-blue-500 font-medium px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 capitalize">
                             {categoryName}
                         </span>
                     )}
                     
                     {/* Show date in footer if NOT shown in header */}
                     {!showDateInHeader && displayDate && <span>{displayDate}</span>}
                     
                     {displayAmount && (
                         <>
                            <span>•</span>
                            <span className={`${type === 'FINANCE' && meta.financeType === 'income' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {displayAmount}
                            </span>
                         </>
                     )}

                     {/* Payment Method Display */}
                     {(meta.paymentMethod || meta.toWallet) && (
                         <>
                            <span>•</span>
                            <span className="flex items-center gap-1 text-muted">
                                <WalletIcon className="w-3 h-3" />
                                {meta.paymentMethod}
                                {meta.financeType === 'transfer' && meta.toWallet && (
                                     <>
                                        <ArrowRight className="w-3 h-3" />
                                        {meta.toWallet}
                                     </>
                                )}
                            </span>
                         </>
                     )}

                     {skillName && (
                         <>
                           <span>•</span>
                           <span className="text-indigo-500">{skillName}</span>
                         </>
                     )}
                 </div>
             )}
          </div>
        </div>
      </div>

      {/* EXPANDED EDIT BODY */}
      {(!enableCollapse || !isCollapsed) && (
          <div className="px-3 pb-3 pt-3">
               
               {/* Content Edit */}
               <textarea
                   className={`w-full bg-background border border-border rounded-lg p-3 text-sm text-primary focus:outline-none focus:border-primary mb-3 resize-none ${isNote ? 'h-48' : 'h-20'}`}
                   value={editContent}
                   onChange={(e) => setEditContent(e.target.value)}
                   placeholder="Content..."
               />

               {/* Dynamic Fields Grid */}
               <div className="grid grid-cols-2 gap-3 mb-3">
                   {/* Finance Type Switcher */}
                   {type === ItemType.FINANCE && (
                       <div className="col-span-2 flex bg-background border border-border rounded-lg p-1">
                           {(['expense', 'income', 'transfer'] as FinanceType[]).map(ft => (
                               <button
                                   key={ft}
                                   onClick={() => setEditFinanceType(ft)}
                                   className={`flex-1 py-1 text-[10px] font-medium rounded capitalize ${editFinanceType === ft ? 'bg-indigo-600 text-white' : 'text-muted hover:text-primary'}`}
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
                                    className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                   )}

                   {/* Date */}
                   {showDateField && (
                        <div className={(!showAmountField && !showSkillExtras) ? "col-span-2" : ""}>
                            <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                                <input
                                    type="datetime-local"
                                    className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:border-primary [color-scheme:dark] dark:[color-scheme:dark] [color-scheme:light]"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                />
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
                                        className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                        value={editDuration}
                                        onChange={(e) => setEditDuration(e.target.value)}
                                    />
                                </div>
                           </div>
                           <div>
                                <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Skill</label>
                                <select
                                    className="w-full bg-background border border-border rounded-lg px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
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
                           <div>
                               <label className="text-[10px] uppercase text-muted font-bold mb-1 block">
                                   {editFinanceType === 'transfer' ? 'From' : 'Method'}
                               </label>
                               <select
                                   className="w-full bg-background border border-border rounded-lg px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                   value={editPaymentMethod}
                                   onChange={(e) => setEditPaymentMethod(e.target.value)}
                               >
                                   <option value="">Cash</option>
                                   {getWalletOptions()}
                               </select>
                           </div>

                           {editFinanceType === 'transfer' ? (
                               <div>
                                   <label className="text-[10px] uppercase text-muted font-bold mb-1 block">To</label>
                                   <select
                                       className="w-full bg-background border border-border rounded-lg px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
                                       value={editToWallet}
                                       onChange={(e) => setEditToWallet(e.target.value)}
                                   >
                                       <option value="">Select...</option>
                                       {getWalletOptions()}
                                   </select>
                               </div>
                           ) : (
                               <div>
                                   <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Budget</label>
                                   <select
                                       className="w-full bg-background border border-border rounded-lg px-2 py-2 text-xs text-primary focus:outline-none focus:border-primary"
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
                   <div className="bg-acc-todo/5 border border-acc-todo/20 rounded-xl p-3 mb-3">
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
                           className="w-full h-2 bg-background rounded-lg appearance-none cursor-pointer accent-acc-todo mb-3"
                       />
                       <div>
                            <label className="text-[10px] uppercase text-muted font-bold mb-1 block">Latest Update</label>
                            <input 
                                type="text"
                                value={editProgressNotes}
                                onChange={(e) => setEditProgressNotes(e.target.value)}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder-muted/50 focus:outline-none focus:border-acc-todo"
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
                        className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-primary focus:outline-none focus:border-primary placeholder-muted/50"
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
                      className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                       <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                   )}
                   
                   {!readonly && onUpdate && (
                       <button
                           onClick={(e) => { e.stopPropagation(); handleSave(); }}
                           className="px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors shadow-sm"
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