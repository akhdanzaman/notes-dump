import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotebookPen, BookText, Library, Plus, Pencil, Trash2, Target, CheckCircle2, ShoppingBag, CalendarDays, Wallet } from 'lucide-react';
import { BrainDumpItem, Skill, LibrarySubTab, AppSettings, SortOrder, ItemType, FinanceType, Tab, Priority } from '../../types';
import { getJournalDayGroups, getNoteItems, getSkillItems, JournalDayGroup } from '../../utils/selectors';
import Card from '../Card';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { formatFinanceTypeLabel } from '../../utils/financeTypeUtils';

interface LibraryViewProps {
    items: BrainDumpItem[];
    skills: Skill[];
    librarySubTab: LibrarySubTab;
    setLibrarySubTab: (tab: LibrarySubTab) => void;
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
    handleOpenEditSkill: (id: string, name: string, target?: number) => void;
    handleOpenAddSkill: () => void;
    setDeleteId: (id: string) => void;
    setDeleteType: (type: 'skill' | 'wallet' | null) => void;
    
    // Filters
    selectedTag: string;
    filterDate: string;
    filterDateTo: string;
    searchQuery: string;
    sortOrder: SortOrder;
    setActiveTab: (tab: Tab) => void;
    onAddItem: (type: ItemType) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({
    items, skills, librarySubTab, setLibrarySubTab, appSettings,
    handleDelete, handleUpdateItem, handleOpenEditSkill, handleOpenAddSkill, setDeleteId, setDeleteType,
    selectedTag, filterDate, filterDateTo, searchQuery, sortOrder, setActiveTab, onAddItem
}) => {
    
    // Data Preparation
    const generalItems = getNoteItems(items, 'general', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const journalItems = getNoteItems(items, 'journal', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const journalDayGroups = getJournalDayGroups(items, selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const { stats: skillStats } = getSkillItems(items, skills);

    const formatCurrency = (amount?: number) => new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
    }).format(amount || 0);

    const formatJournalTime = (value?: string) => {
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
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${accentClass}`}>{icon}</div>
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
        const friendlyDate = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const mergedJournalText = group.journalEntries.slice().reverse().map(entry => entry.content.trim()).filter(Boolean).join('\n\n');

        return (
            <section key={group.dateKey}>
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 pl-1 sticky top-0 bg-background/80 backdrop-blur-md py-2 z-10">
                    {friendlyDate}
                </h3>
                <div className="space-y-3">
                    {mergedJournalText && renderJournalSectionCard(
                        'Daily Journal',
                        <BookText className="w-5 h-5 text-fuchsia-700 dark:text-fuchsia-200" />,
                        'bg-fuchsia-100 dark:bg-fuchsia-500/20',
                        <div className="space-y-3">
                            <p className="whitespace-pre-wrap text-sm leading-6 text-primary">{mergedJournalText}</p>
                            {group.journalEntries.length > 0 && (
                                <p className="text-xs text-muted">
                                    Last updated {formatJournalTime(group.journalEntries[0].completed_at || group.journalEntries[0].meta.date || group.journalEntries[0].created_at)}
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
                                    <div className="text-xs text-muted">Done {formatJournalTime(item.completed_at)}</div>
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
                                        {[formatJournalTime(item.meta.start || item.meta.date), item.meta.end ? `→ ${formatJournalTime(item.meta.end)}` : ''].filter(Boolean).join(' ')}
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
                                            <div className="text-xs text-muted">{[formatFinanceTypeLabel(item.meta.financeType || 'expense'), item.meta.paymentMethod].filter(Boolean).join(' • ')}</div>
                                        </div>
                                        <div className="text-sm font-semibold text-primary">{formatCurrency(item.meta.amount)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>,
                        group.transactions.length
                    )}
                </div>
            </section>
        );
    };

    // Main Tab Swipe Logic
    const swipeHandlers = useSwipeTabs('library', setActiveTab);

    // Sub-Tab Swipe State
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartRef = React.useRef<{ x: number, y: number } | null>(null);
    const isHorizontalSwipe = React.useRef<boolean | null>(null);

    const subTabs: LibrarySubTab[] = ['general', 'skills', 'journal'];
    const activeIndex = subTabs.indexOf(librarySubTab);

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
                setLibrarySubTab(subTabs[activeIndex + 1]);
            }
            if (dragOffset > 0 && activeIndex > 0) {
                setLibrarySubTab(subTabs[activeIndex - 1]);
            }
        }
        
        setDragOffset(0);
        touchStartRef.current = null;
        isHorizontalSwipe.current = null;
    };
              
    const renderContent = (data: BrainDumpItem[], type: 'general' | 'journal') => {
        const isEmpty = type === 'journal' ? journalDayGroups.length === 0 : data.length === 0;
        if (isEmpty) {
            return (
                <div className="text-center text-muted py-10">
                   {searchQuery 
                    ? "No matching notes." 
                    : (type === 'general' 
                        ? "No notes found." 
                        : "Write your first entry: \"Journal: Today was...\"")}
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
            className: "mb-4 break-inside-avoid",
            noStrikethrough: type === 'journal',
            noDarken: type === 'journal'
        };

        if (type === 'journal') {
            return (
                <div className="space-y-8">
                    {journalDayGroups.map(renderJournalDay)}
                </div>
            );
        }

        // Masonry layout for general notes
        return (
            <div className="columns-1 sm:columns-2 gap-4">
                {data.map(item => (
                    <Card key={item.id} item={item} {...commonProps} />
                ))}
            </div>
        );
    };

    const renderSkills = () => {
        if (skillStats.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-[32px] gap-4">
                    <p className="text-muted font-medium">No skills tracked yet.</p>
                    <button 
                        onClick={handleOpenAddSkill} 
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-2xl text-sm font-bold transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Track Skill
                    </button>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {skillStats.map(skill => {
                    const progress = skill.weeklyProgress;
                    return (
                        <motion.div 
                            key={skill.id}
                            layout
                            className="bg-surface border border-border rounded-[24px] p-5"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-lg text-primary">{skill.name}</h4>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-xl font-bold text-indigo-500">{skill.totalHours.toFixed(1)}h</span>
                                        <span className="text-sm text-muted font-medium">total</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleOpenEditSkill(skill.id, skill.name, skill.weeklyTargetMinutes)}
                                        className="p-2 bg-black/5 hover:bg-black/10 rounded-xl transition-colors"
                                    >
                                        <Pencil className="w-4 h-4 text-muted" />
                                    </button>
                                    <button 
                                        onClick={() => { setDeleteId(skill.id); setDeleteType('skill'); }}
                                        className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                            </div>

                            {skill.weeklyTargetMinutes && (
                                <>
                                    <div className="w-full h-3 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center mt-3">
                                        <span className="text-xs font-bold text-muted uppercase tracking-wider">{progress.toFixed(0)}% Weekly Progress</span>
                                        <span className="text-xs font-medium text-muted flex items-center gap-1">
                                            <Target className="w-3 h-3" />
                                            Target: {skill.weeklyTargetMinutes}m/wk
                                        </span>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-[50vh] overflow-hidden pb-20">
            {/* Top Container */}
            <motion.div 
                layoutId="top-container"
                className="bg-surface text-primary rounded-b-[32px] p-6 pt-12 mb-4 touch-pan-y"
                transition={{ type: "tween", duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                onTouchStart={swipeHandlers.onTouchStart}
                onTouchMove={swipeHandlers.onTouchMove}
                onTouchEnd={swipeHandlers.onTouchEnd}
                style={{ x: swipeHandlers.dragOffset }}
            >
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "linear" }}
                >
                    <div className="flex bg-black/5 dark:bg-white/20 rounded-2xl p-1 mb-6">
                        <button 
                            onClick={() => setLibrarySubTab('general')}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${librarySubTab === 'general' ? 'bg-surface text-primary' : 'text-primary/40 hover:text-primary'}`}
                        >
                            <Library className="w-4 h-4" /> Notes
                        </button>
                        <button 
                            onClick={() => setLibrarySubTab('skills')}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${librarySubTab === 'skills' ? 'bg-surface text-primary' : 'text-primary/40 hover:text-primary'}`}
                        >
                            <Target className="w-4 h-4" /> Skills
                        </button>
                        <button 
                            onClick={() => setLibrarySubTab('journal')}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${librarySubTab === 'journal' ? 'bg-surface text-primary' : 'text-primary/40 hover:text-primary'}`}
                        >
                            <BookText className="w-4 h-4" /> Journal
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={librarySubTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center justify-between"
                        >
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">
                                    {librarySubTab === 'general' ? 'All Notes' : librarySubTab === 'skills' ? 'Skill Growth' : 'Journal Entries'}
                                </h2>
                                <p className="text-sm text-muted font-medium flex items-center gap-2 mt-1">
                                    {librarySubTab === 'general' && (
                                        <>
                                            <span>{generalItems.length} Notes</span>
                                            {new Set(generalItems.flatMap(i => i.meta.tags || []).filter(t => t && t !== 'null' && t !== 'undefined')).size > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span>{new Set(generalItems.flatMap(i => i.meta.tags || []).filter(t => t && t !== 'null' && t !== 'undefined')).size} Tags</span>
                                                </>
                                            )}
                                        </>
                                    )}
                                    {librarySubTab === 'skills' && (
                                        <>
                                            <span>{skillStats.length} Skills</span>
                                            <span>•</span>
                                            <span className="text-indigo-500">{skillStats.reduce((acc, curr) => acc + curr.totalHours, 0).toFixed(1)}h Total Time</span>
                                        </>
                                    )}
                                    {librarySubTab === 'journal' && (
                                        <>
                                            <span>{journalItems.length} Journal Entries</span>
                                            <span>•</span>
                                            <span>Across {journalDayGroups.length} Days</span>
                                        </>
                                    )}
                                </p>
                            </div>
                            <button 
                                onClick={() => {
                                    if (librarySubTab === 'general') onAddItem(ItemType.NOTE);
                                    if (librarySubTab === 'skills') handleOpenAddSkill();
                                    if (librarySubTab === 'journal') onAddItem(ItemType.JOURNAL);
                                }}
                                className="p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
            </motion.div>

            {/* Sliding Container */}
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
                {/* VIEW: General Notes */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex-shrink-0 px-4"
                >
                    {renderContent(generalItems, 'general')}
                </motion.div>

                {/* VIEW: Skills */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex-shrink-0 px-4"
                >
                    {renderSkills()}
                </motion.div>

                {/* VIEW: Journal */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex-shrink-0 px-4"
                >
                    {renderContent(journalItems, 'journal')}
                </motion.div>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default LibraryView;
