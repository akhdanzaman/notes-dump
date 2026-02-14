import React from 'react';
import { ItemType, BrainDumpItem } from '../types';
import { CheckCircle2, ShoppingCart, Calendar, StickyNote, Tag, Clock, Circle, Edit2, Trash2, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, BookOpen, Hourglass, ArrowRight, BookText } from 'lucide-react';

interface CardProps {
  item: BrainDumpItem;
  onToggleStatus?: (id: string) => void;
  onEdit?: (item: BrainDumpItem) => void;
  onDelete?: (id: string) => void;
  readonly?: boolean;
  skillName?: string; // Optional: Pass resolved skill name
  noStrikethrough?: boolean;
}

const Card: React.FC<CardProps> = ({ item, onToggleStatus, onEdit, onDelete, readonly = false, skillName, noStrikethrough = false }) => {
  const { type, content, meta, isOptimistic, status, created_at, completed_at } = item;
  const isDone = status === 'done';
  const isNote = type === ItemType.NOTE;
  const isFinance = type === ItemType.FINANCE;
  const isSkill = type === ItemType.SKILL_LOG;
  const isJournal = type === ItemType.JOURNAL;

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
  let showTime = false;

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
        showTime = true;
      } else {
        displayDate = datePart;
      }
    }
  }

  const validTags = meta?.tags?.filter(t => t && t !== 'null' && t !== 'undefined') || [];
  const quantity = meta?.quantity && meta.quantity !== 'null' ? meta.quantity : null;

  // Finance formatting
  const formattedAmount = meta?.amount 
    ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(meta.amount)
    : null;
    
  const financeTypeLabel = meta?.financeType === 'lending' ? 'Lending' : 
                           meta?.financeType === 'reimbursement' ? 'Reimbursed' : 
                           meta?.financeType === 'transfer' ? 'Transfer' : null;

  // Skill formatting
  const durationLabel = meta?.durationMinutes ? `${meta.durationMinutes}m` : null;

  // Determine strikethrough: isDone, not finance/skill/journal, and NOT explicitly suppressed
  const shouldStrikethrough = isDone && !isFinance && !isSkill && !isJournal && !noStrikethrough;

  // --- Simple Markdown Parser ---
  const renderFormattedContent = (text: string) => {
    // Split by newlines to handle paragraphs/lists
    const lines = text.split('\n');

    return lines.map((line, lineIndex) => {
        if (!line) return <div key={lineIndex} className="h-2"></div>;

        // Check for list item
        const isList = line.trim().startsWith('- ') || line.trim().startsWith('* ');
        const cleanLine = isList ? line.trim().substring(2) : line;

        // Split text by bold (**...**) and italic (_..._) markers
        // Regex logic: Capture (** text **) OR (_ text _)
        const parts = cleanLine.split(/(\*\*.*?\*\*|_.*?_)/g);

        const renderedLine = parts.map((part, partIndex) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={partIndex} className="text-white font-bold">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('_') && part.endsWith('_')) {
                return <em key={partIndex} className="italic text-gray-300">{part.slice(1, -1)}</em>;
            }
            return <span key={partIndex}>{part}</span>;
        });

        if (isList) {
            return (
                <div key={lineIndex} className="flex items-start gap-2 pl-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-current mt-2 opacity-50 shrink-0"></div>
                    <div className="flex-1">{renderedLine}</div>
                </div>
            );
        }

        return <div key={lineIndex} className="mb-0.5 min-h-[1.25rem]">{renderedLine}</div>;
    });
  };

  return (
    <div className={`group relative mb-4 break-inside-avoid rounded-xl border border-border ${style.bg} ${style.border} p-4 shadow-lg transition-all duration-300 ${isOptimistic ? 'opacity-50 animate-pulse' : 'opacity-100'} ${isDone && !isFinance && !isSkill && !isJournal && !noStrikethrough ? 'opacity-60 grayscale' : ''}`}>
      
      {/* Header Row */}
      <div className={`flex items-start justify-between ${isNote || isSkill || isJournal ? 'mb-1' : 'mb-2'} pr-12`}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Action Checkbox for TODO/EVENT */}
          {!readonly && !isFinance && !isSkill && !isJournal && (type === ItemType.TODO || type === ItemType.EVENT) && onToggleStatus ? (
            <button onClick={() => onToggleStatus(item.id)} className="transition-colors hover:text-white text-muted">
               {isDone ? <CheckCircle2 className="w-5 h-5 text-acc-todo" /> : <Circle className="w-5 h-5" />}
            </button>
          ) : (
             style.icon
          )}
          
          <span className="text-xs font-semibold tracking-wider text-muted opacity-80">
              {skillName ? skillName.toUpperCase() : (financeTypeLabel || (type === ItemType.FINANCE ? meta?.financeType?.toUpperCase() : type))}
          </span>
          
          {/* Payment Method Badge for Finance & Shopping */}
          {(isFinance || type === ItemType.SHOPPING) && meta?.paymentMethod && (
              <div className="flex items-center gap-1 text-[10px] text-muted bg-border px-1.5 py-0.5 rounded uppercase">
                  <span>{meta.paymentMethod}</span>
                  {meta.financeType === 'transfer' && meta.toWallet && (
                      <>
                        <ArrowRight className="w-3 h-3" />
                        <span>{meta.toWallet}</span>
                      </>
                  )}
              </div>
          )}

           {/* For SKILL: Display Date in Header */}
           {isSkill && (
             <>
                {displayDate && (
                  <span className="text-[10px] text-muted flex items-center gap-1 border-l border-border pl-2 ml-1">
                     {displayDate}
                  </span>
                )}
             </>
          )}

          {/* For NOTES/JOURNAL: Display Date and Tags in Header */}
          {(isNote || isJournal) && (
             <>
                {displayDate && (
                  <span className="text-[10px] text-muted flex items-center gap-1 border-l border-border pl-2 ml-1">
                     {displayDate}
                  </span>
                )}
                {validTags.map((tag, i) => (
                  <span key={i} className="text-[10px] text-acc-note/80 bg-acc-note/10 px-1.5 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
             </>
          )}
        </div>
        
        {/* Quantity for Shopping */}
        {!isNote && !isSkill && !isJournal && quantity && (
           <span className="text-xs bg-border px-2 py-1 rounded-full text-white">{quantity}</span>
        )}
        
        {/* Amount for Finance */}
        {!isNote && formattedAmount && (
            <span className={`text-sm font-bold ${meta?.financeType === 'income' || meta?.financeType === 'reimbursement' ? 'text-emerald-400' : 'text-white'}`}>
                {formattedAmount}
            </span>
        )}

        {/* Duration for Skill */}
        {isSkill && durationLabel && (
             <div className="flex items-center gap-1 text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-full">
                <Hourglass className="w-3 h-3" />
                {durationLabel}
             </div>
        )}
      </div>

      {/* Action Buttons (Top Right) */}
      {!readonly && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
           {onEdit && (
            <button 
              onClick={() => onEdit(item)}
              className="p-1.5 hover:bg-white/10 rounded-md text-muted hover:text-white transition-colors"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
           )}
           {onDelete && (
            <button 
              onClick={() => onDelete(item.id)}
              className="p-1.5 hover:bg-red-900/30 rounded-md text-muted hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
           )}
        </div>
      )}

      {/* Content Rendering with Custom Markdown Parser */}
      <div className={`text-sm text-gray-200 leading-relaxed font-medium ${shouldStrikethrough ? 'line-through text-muted' : ''} ${isJournal ? 'font-serif text-gray-100 italic' : ''}`}>
        {renderFormattedContent(content)}
      </div>

      {/* Metadata Footer */}
      {!isNote && !isSkill && !isJournal && (displayDate || validTags.length > 0) && (
        <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2 items-center">
          {displayDate && (
             <div className={`flex items-center gap-1 text-xs ${readonly ? 'text-acc-todo' : (type === ItemType.EVENT ? 'text-acc-event' : 'text-muted')}`}>
               {readonly ? <CheckCircle2 className="w-3 h-3" /> : (showTime ? <Clock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />)}
               <span>{readonly ? `Done: ${displayDate}` : (isCreatedDate ? `Added: ${displayDate}` : displayDate)}</span>
             </div>
          )}
          
          {validTags.map((tag, i) => (
             <div key={i} className="flex items-center gap-1 text-xs text-muted bg-black/20 px-2 py-0.5 rounded">
               <Tag className="w-3 h-3" />
               <span>{tag}</span>
             </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Card;