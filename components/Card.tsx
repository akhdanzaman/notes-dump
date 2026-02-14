
import React, { useState, useEffect } from 'react';
import { ItemType, BrainDumpItem } from '../types';
import { CheckCircle2, ShoppingCart, Calendar, StickyNote, Tag, Clock, Circle, Edit2, Trash2, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, BookOpen, Hourglass, ArrowRight, BookText, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';

interface CardProps {
  item: BrainDumpItem;
  onToggleStatus?: (id: string) => void;
  onEdit?: (item: BrainDumpItem) => void;
  onDelete?: (id: string) => void;
  readonly?: boolean;
  skillName?: string; // Optional: Pass resolved skill name
  noStrikethrough?: boolean;
  enableCollapse?: boolean;
  defaultCollapsed?: boolean;
  hideMoney?: boolean;
}

const Card: React.FC<CardProps> = ({ 
    item, 
    onToggleStatus, 
    onEdit, 
    onDelete, 
    readonly = false, 
    skillName, 
    noStrikethrough = false,
    enableCollapse = false,
    defaultCollapsed = false,
    hideMoney = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Sync state if default changes (e.g. from settings) only on mount or strict reset required
  // For now, we respect the internal state once initialized to prevent jarring jumps while using app
  
  const { type, content, meta, isOptimistic, status, created_at, completed_at } = item;
  const isDone = status === 'done';
  
  const toggleCollapse = () => {
      if (enableCollapse) setIsCollapsed(!isCollapsed);
  };

  // Helper to mask money
  const formatMoney = (amount?: number) => {
      if (amount === undefined || amount === null) return null;
      if (hideMoney) return 'Rp •••••••';
      return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  // Visual variants based on Type
  const getStyles = () => {
    switch (type) {
      case ItemType.TODO:
        return {
          border: 'border-l-4 border-l-acc-todo',
          icon: <CheckCircle2 className="w-4 h-4 text-acc-todo" />,
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
        // Color depends on subtype
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

  // Smart Date Formatting
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
        const timePart = dateObj.toLocaleTimeString(undefined, { 
          hour: '2-digit', 
          minute:'2-digit' 
        });
        displayDate = `${datePart} • ${timePart}`;
      } else {
        displayDate = datePart;
      }
    }
  }

  const validTags = meta?.tags?.filter(t => t && t !== 'null' && t !== 'undefined') || [];
  const displayAmount = formatMoney(meta?.amount);

  return (
    <div 
        className={`${style.bg} ${style.border} rounded-r-lg border-y border-r border-border/50 shadow-sm transition-all hover:shadow-md hover:border-border ${isOptimistic ? 'opacity-50' : ''}`}
    >
      <div className={`p-3 ${enableCollapse && isCollapsed ? 'pb-3' : 'pb-1'}`}>
        
        {/* Header Row: Always visible */}
        <div 
            className={`flex items-start gap-3 ${enableCollapse ? 'cursor-pointer' : ''}`}
            onClick={toggleCollapse}
        >
          {/* Checkbox / Status Toggle */}
          <button 
            onClick={(e) => {
              e.stopPropagation(); // Prevent collapse trigger
              if (!readonly && onToggleStatus) onToggleStatus(item.id);
            }}
            disabled={readonly}
            className={`mt-0.5 transition-colors shrink-0 ${readonly ? 'cursor-default' : 'hover:opacity-70'}`}
          >
             {status === 'done' ? (
                 <CheckCircle2 className={`w-4 h-4 ${style.icon.props.className.replace('w-4 h-4', '')}`} />
             ) : (
                 style.icon
             )}
          </button>
          
          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
             <div className="flex justify-between items-start gap-2">
                 {/* Title / Content */}
                 <div className={`text-sm ${isDone && !noStrikethrough ? 'line-through text-muted' : 'text-gray-200'} ${enableCollapse && isCollapsed ? 'truncate' : 'whitespace-pre-wrap'}`}>
                    {content}
                 </div>
                 
                 {/* Collapse Chevron */}
                 {enableCollapse && (
                     <div className="text-muted/50 ml-1 mt-0.5">
                         {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                     </div>
                 )}
             </div>

             {/* Collapsed Preview Metadata */}
             {enableCollapse && isCollapsed && (
                 <div className="flex items-center gap-2 mt-1 text-[10px] text-muted h-4">
                     {displayDate && <span>{displayDate}</span>}
                     {displayAmount && (
                         <>
                            <span>•</span>
                            <span className={`${type === 'FINANCE' && meta.financeType === 'income' ? 'text-emerald-500' : 'text-amber-400'}`}>
                                {displayAmount}
                            </span>
                         </>
                     )}
                     {skillName && (
                         <>
                           <span>•</span>
                           <span className="text-indigo-400">{skillName}</span>
                         </>
                     )}
                 </div>
             )}
          </div>
        </div>
      </div>

      {/* Expanded Body */}
      {(!enableCollapse || !isCollapsed) && (
          <div className="px-3 pb-3 pl-10">
               
               {/* Meta Row */}
               <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-1">
                   
                   {/* Date */}
                   {displayDate && (
                      <div className="flex items-center gap-1 text-[10px] text-muted">
                        <Clock className="w-3 h-3" />
                        <span>{displayDate}</span>
                      </div>
                   )}

                   {/* Finance Details */}
                   {displayAmount && (
                       <div className={`flex items-center gap-1 text-[10px] font-medium ${type === 'FINANCE' && meta.financeType === 'income' ? 'text-emerald-500' : 'text-amber-400'}`}>
                           {type === 'FINANCE' && meta.financeType === 'transfer' ? <ArrowRightLeft className="w-3 h-3" /> : (type === 'FINANCE' ? <Wallet className="w-3 h-3" /> : <Tag className="w-3 h-3" />)}
                           <span>{displayAmount}</span>
                       </div>
                   )}

                   {/* Payment Method / Wallet Info */}
                   {(meta.paymentMethod || meta.toWallet) && (
                       <div className="flex items-center gap-1 text-[10px] text-muted">
                           <span className="bg-white/5 px-1.5 py-0.5 rounded text-gray-300">{meta.paymentMethod || 'Cash'}</span>
                           {meta.toWallet && (
                               <>
                                <ArrowRight className="w-3 h-3 text-muted" />
                                <span className="bg-white/5 px-1.5 py-0.5 rounded text-gray-300">{meta.toWallet}</span>
                               </>
                           )}
                       </div>
                   )}

                   {/* Skill Info */}
                   {skillName && (
                       <div className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                           <BookOpen className="w-3 h-3" />
                           <span>{skillName}</span>
                           {meta.durationMinutes && <span className="text-muted ml-1">({meta.durationMinutes}m)</span>}
                       </div>
                   )}

                   {/* Tags */}
                   {validTags.map((tag, idx) => (
                      <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
                        #{tag}
                      </span>
                   ))}
               </div>

               {/* Actions */}
               {!readonly && (
                   <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-border/30">
                       {onEdit && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onEdit(item); }} 
                          className="flex items-center gap-1 text-[10px] text-muted hover:text-white transition-colors"
                        >
                           <Edit2 className="w-3 h-3" /> Edit
                        </button>
                       )}
                       {onDelete && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} 
                          className="flex items-center gap-1 text-[10px] text-muted hover:text-red-400 transition-colors"
                        >
                           <Trash2 className="w-3 h-3" /> Delete
                        </button>
                       )}
                   </div>
               )}
          </div>
      )}
    </div>
  );
};

export default Card;
