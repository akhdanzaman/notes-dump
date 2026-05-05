import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotebookPen, BookText, Library, Plus, CheckCircle2, ShoppingBag, CalendarDays, Wallet } from 'lucide-react';
import { BrainDumpItem, Skill, NotesSubTab, AppSettings, SortOrder, ItemType, FinanceType, Tab, Priority } from '../../types';
import { getJournalDayGroups, getNoteItems, JournalDayGroup } from '../../utils/selectors';
import Card from '../Card';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { formatFinanceTypeLabel } from '../../utils/financeTypeUtils';
import { contentSurface } from '../layout/contentSurface';

interface NotesViewProps {
    items: BrainDumpItem[];
    skills: Skill[];
    notesSubTab: NotesSubTab;
    setNotesSubTab: (tab: NotesSubTab) => void;
    appSettings: AppSettings;
    handleDelete: (id: string) => void;
    handleUpdateItem: (
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
        newRoutineInterval?: any,
        newRoutineDaysOfWeek?: number[],
        newRoutineDaysOfMonth?: number[],
        newRoutineMonthsOfYear?: number[],
        newSavingGoalId?: string,
        newDedicatedWalletId?: string,
        newPriority?: Priority
    ) => void;
    
    // Filters
    selectedTag: string;
    filterDate: string;
    filterDateTo: string;
    searchQuery: string;
    sortOrder: SortOrder;
    setActiveTab: (tab: Tab) => void;
    onAddItem: (type: ItemType) => void;
}

const NotesView: React.FC<NotesViewProps> = ({
    items, skills, notesSubTab, setNotesSubTab, appSettings,
    handleDelete, handleUpdateItem, selectedTag, filterDate, filterDateTo, searchQuery, sortOrder, setActiveTab, onAddItem
}) => {
    
    // Data Preparation
    const generalItems = getNoteItems(items, 'general', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const journalItems = getNoteItems(items, 'journal', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const journalDayGroups = getJournalDayGroups(items, selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const skillItems = getNoteItems(items, 'skills', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);

    const formatCurrency = (amount?: number) => new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount || 0);

    const formatJournalDate = (value?: string) => {
        if (!value) return '';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderJournalSectionCard = (
        title: string,
        icon: React.ReactNode,
        accentClass: string,
        children: React.ReactNode,
        count?: number
    ) => (
        <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accentClass}`}>
                        {icon}
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-primary">{title}</h4>
                        {typeof count === 'number' && <p className="text-xs text-muted">{count} item{count === 1 ? '' : 's'}</p>}
                    </div>
                </div>
            </div>
            {children}
        </div>
    );

    const renderJournalDay = (group: JournalDayGroup) => {
        const date = new Date(group.dateKey);
        const friendlyDate = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        const mergedJournalText = group.journalEntries
            .slice()
            .reverse()
            .map(entry => entry.content.trim())
            .filter(Boolean)
            .join('\n\n');

        return (
            <div key={group.dateKey} className="relative pl-6 border-l border-border/50">
                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-fuchsia-400/50 border border-fuchsia-400"></div>
                <h3 className="text-sm font-serif font-bold text-fuchsia-600 dark:text-fuchsia-200 mb-4">{friendlyDate}</h3>
                <div className="space-y-4">
                    {mergedJournalText && renderJournalSectionCard(
                        'Daily Journal',
                        <BookText className="w-5 h-5 text-fuchsia-700 dark:text-fuchsia-200" />,
                        'bg-fuchsia-100 dark:bg-fuchsia-500/20',
                        <div className="space-y-3">
                            <p className="whitespace-pre-wrap text-sm leading-6 text-primary">{mergedJournalText}</p>
                            {group.journalEntries.length > 0 && (
                                <p className="text-xs text-muted">
                                    Last updated {formatJournalDate(group.journalEntries[0].completed_at || group.journalEntries[0].meta.date || group.journalEntries[0].created_at)}
                                </p>
                            )}
                        </div>,
                        group.journalEntries.length
                    )}

                    {group.todos.length > 0 && renderJournalSectionCard(
                        'Completed Todos',
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-200" />,
                        'bg-emerald-100 dark:bg-emerald-500/20',
                        <div className="space-y-2">
                            {group.todos.map(item => (
                                <div key={item.id} className="rounded-2xl bg-background px-3 py-2">
                                    <div className="text-sm font-medium text-primary">{item.content}</div>
                                    <div className="text-xs text-muted">Done {formatJournalDate(item.completed_at)}</div>
                                </div>
                            ))}
                        </div>,
                        group.todos.length
                    )}

                    {group.shopping.length > 0 && renderJournalSectionCard(
                        'Shopping Done',
                        <ShoppingBag className="w-5 h-5 text-amber-700 dark:text-amber-200" />,
                        'bg-amber-100 dark:bg-amber-500/20',
                        <div className="space-y-2">
                            {group.shopping.map(item => (
                                <div key={item.id} className="rounded-2xl bg-background px-3 py-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-medium text-primary">{item.content}</div>
                                            <div className="text-xs text-muted">{item.meta.quantity || item.meta.shoppingCategory || 'Shopping item'}</div>
                                        </div>
                                        <div className="text-sm font-semibold text-primary">{formatCurrency(item.meta.amount)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>,
                        group.shopping.length
                    )}

                    {group.events.length > 0 && renderJournalSectionCard(
                        'Events',
                        <CalendarDays className="w-5 h-5 text-sky-700 dark:text-sky-200" />,
                        'bg-sky-100 dark:bg-sky-500/20',
                        <div className="space-y-2">
                            {group.events.map(item => (
                                <div key={item.id} className="rounded-2xl bg-background px-3 py-2">
                                    <div className="text-sm font-medium text-primary">{item.content}</div>
                                    <div className="text-xs text-muted">
                                        {[formatJournalDate(item.meta.start || item.meta.date), item.meta.end ? `→ ${formatJournalDate(item.meta.end)}` : ''].filter(Boolean).join(' ')}
                                    </div>
                                </div>
                            ))}
                        </div>,
                        group.events.length
                    )}

                    {group.transactions.length > 0 && renderJournalSectionCard(
                        'Transactions',
                        <Wallet className="w-5 h-5 text-violet-700 dark:text-violet-200" />,
                        'bg-violet-100 dark:bg-violet-500/20',
                        <div className="space-y-2">
                            {group.transactions.map(item => (
                                <div key={item.id} className="rounded-2xl bg-background px-3 py-2">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-medium text-primary">{item.content}</div>
                                            <div className="text-xs text-muted">
                                                {[formatFinanceTypeLabel(item.meta.financeType || 'expense'), item.meta.paymentMethod].filter(Boolean).join(' • ')}
                                            </div>
                                        </div>
                                        <div className="text-sm font-semibold text-primary">{formatCurrency(item.meta.amount)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>,
                        group.transactions.length
                    )}
                </div>
            </div>
        );
    };

    // Main Tab Swipe Logic
    const swipeHandlers = useSwipeTabs('library', setActiveTab);

    // Sub-Tab Swipe State
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartRef = React.useRef<{ x: number, y: number } | null>(null);
    const isHorizontalSwipe = React.useRef<boolean | null>(null);

    const subTabs: NotesSubTab[] = ['general', 'journal', 'skills'];
    const activeIndex = subTabs.indexOf(notesSubTab);

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsDragging(true);
        isHorizontalSwipe.current = null;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = e.touches[0].clientY - touchStartRef.current.y;

        if (isHorizontalSwipe.current === null) {
             if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
                 isHorizontalSwipe.current = true;
             } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
                 isHorizontalSwipe.current = false;
             }
        }

        if (isHorizontalSwipe.current) {
            // Resistance
            if ((activeIndex === 0 && dx > 0) || (activeIndex === subTabs.length - 1 && dx < 0)) {
                setDragOffset(dx * 0.3);
            } else {
                setDragOffset(dx);
            }
        }
    };

    const onTouchEnd = () => {
        setIsDragging(false);
        const threshold = window.innerWidth * 0.25;

        if (isHorizontalSwipe.current && Math.abs(dragOffset) > threshold) {
            if (dragOffset < 0 && activeIndex < subTabs.length - 1) {
                setNotesSubTab(subTabs[activeIndex + 1]);
            }
            if (dragOffset > 0 && activeIndex > 0) {
                setNotesSubTab(subTabs[activeIndex - 1]);
            }
        }
        
        setDragOffset(0);
        touchStartRef.current = null;
        isHorizontalSwipe.current = null;
    };
              
    const renderContent = (data: BrainDumpItem[], type: 'general' | 'journal' | 'skills') => {
        const isEmpty = type === 'journal' ? journalDayGroups.length === 0 : data.length === 0;
        if (isEmpty) {
            return (
                <div className="text-center text-muted py-10">
                   {searchQuery 
                    ? "No matching notes." 
                    : (type === 'general' 
                        ? "No notes found." 
                        : (type === 'journal' ? "Write your first entry: \"Journal: Today was...\"" : "No skill logs found."))}
                </div>
            );
        }

        const commonProps = {
            onUpdate: handleUpdateItem,
            onDelete: handleDelete,
            enableCollapse: true,
            defaultCollapsed: appSettings.defaultCollapsed,
            hideMoney: appSettings.hideMoney,
            skills,
            className: "mb-4 break-inside-avoid" // Fix layout breaking in columns
        };

        if (type === 'journal') {
            return (
                <div className="space-y-8">
                    {journalDayGroups.map(renderJournalDay)}
                </div>
            );
        }

        return (
            <div
                data-tablet-masonry="legacy-notes"
                data-ndz-tablet-baseline="masonry"
                className={contentSurface.tabletMasonryGrid}
            >
                {data?.map(item => {
                    const skillName = item.type === ItemType.SKILL_LOG 
                        ? (skills.find(s => s.id === item.meta.skillId)?.name || item.meta.skillName)
                        : undefined;
                    return <Card key={item.id} item={item} {...commonProps} skillName={skillName} />;
                })}
            </div>
        );
    };

    return (
        <div className="min-h-[50vh] overflow-hidden pb-20">
            {/* Top Container */}
            <motion.div 
                layoutId="top-container"
                className="bg-white dark:bg-zinc-100 text-black rounded-b-[32px] p-6 pt-12 shadow-sm mb-4 touch-pan-y relative"
                transition={{ type: "tween", duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                onTouchStart={swipeHandlers.onTouchStart}
                onTouchMove={swipeHandlers.onTouchMove}
                onTouchEnd={swipeHandlers.onTouchEnd}
                style={{ x: swipeHandlers.dragOffset }}
            >
                <div>
                    <div className="flex bg-black/5 rounded-2xl p-1 mb-6">
                        {subTabs.map((tab) => (
                            <button 
                                key={tab}
                                onClick={() => setNotesSubTab(tab)}
                                className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${notesSubTab === tab ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-black/40 hover:text-black'}`}
                            >
                                {tab === 'general' && <NotebookPen className="w-4 h-4" />}
                                {tab === 'journal' && <BookText className="w-4 h-4" />}
                                {tab === 'skills' && <Library className="w-4 h-4" />}
                                <span className="capitalize hidden sm:inline">{tab === 'skills' ? 'Skill Logs' : tab}</span>
                            </button>
                        ))}
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={notesSubTab}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: "linear" }}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h1 className="text-3xl font-bold tracking-tight capitalize">
                                    {notesSubTab === 'skills' ? 'Skill Logs' : notesSubTab}
                                </h1>
                            </div>
                            <p className="text-lg font-medium opacity-80">
                                {notesSubTab === 'general' && `${generalItems.length} notes captured`}
                                {notesSubTab === 'journal' && `${journalDayGroups.length} journal days`}
                                {notesSubTab === 'skills' && `${skillItems.length} skill logs recorded`}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Quick Add Button */}
                <button 
                    onClick={() => onAddItem(
                        notesSubTab === 'skills' ? ItemType.SKILL_LOG : 
                        notesSubTab === 'journal' ? ItemType.JOURNAL : 
                        ItemType.NOTE
                    )}
                    className="absolute bottom-6 right-6 w-10 h-10 flex items-center justify-center bg-black dark:bg-zinc-800 text-white dark:text-white rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all z-10"
                >
                    <Plus className="w-6 h-6" />
                </button>
            </motion.div>

            {/* Lower Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } }}
                className="touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <motion.div 
                    className="flex w-full will-change-transform"
                    style={{
                        transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
                        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                >
                    {/* VIEW: General */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full flex-shrink-0 px-4"
                    >
                        {renderContent(generalItems, 'general')}
                    </motion.div>

                    {/* VIEW: Journal */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full flex-shrink-0 px-4"
                    >
                        {renderContent(journalItems, 'journal')}
                    </motion.div>

                    {/* VIEW: Skills */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full flex-shrink-0 px-4"
                    >
                        {renderContent(skillItems, 'skills')}
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default NotesView;
