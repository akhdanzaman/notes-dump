import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookText, Library, Plus, Pencil, Trash2, Target, CheckCircle2, ShoppingBag, CalendarDays, Wallet, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { BrainDumpItem, Skill, LibrarySubTab, AppSettings, SortOrder, ItemType, FinanceType, Tab, Priority } from '../../types';
import { getJournalDayGroups, getNoteItems, getSkillItems, JournalDayGroup } from '../../utils/selectors';
import Card from '../Card';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useSwipeDate } from '../../hooks/useSwipeDate';
import { useLazyItems } from '../../hooks/useLazyItems';
import LoadMoreButton from '../LoadMoreButton';
import { contentSurface } from '../layout/contentSurface';
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
    const libraryTabs: { key: LibrarySubTab; label: string; title: string; icon: React.ReactNode }[] = [
        { key: 'general', label: 'Notes', title: 'All Notes', icon: <Library className="w-4 h-4" /> },
        { key: 'skills', label: 'Skills', title: 'Skill Growth', icon: <Target className="w-4 h-4" /> },
        { key: 'journal', label: 'Journal', title: 'Journal Entries', icon: <BookText className="w-4 h-4" /> },
    ];


    // Data Preparation
    const generalItems = getNoteItems(items, 'general', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const journalItems = getNoteItems(items, 'journal', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const journalDayGroups = getJournalDayGroups(items, selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const { stats: skillStats } = getSkillItems(items, skills);
    const [journalDate, setJournalDate] = useState(new Date());

    const changeJournalMonth = (offset: number) => {
        const next = new Date(journalDate);
        next.setMonth(next.getMonth() + offset);
        setJournalDate(next);
    };

    const journalDateSwipeHandlers = useSwipeDate(
        () => changeJournalMonth(-1),
        () => changeJournalMonth(1)
    );

    const isWithinJournalMonth = (value?: string) => {
        if (!value) return false;
        const date = new Date(value);
        return !Number.isNaN(date.getTime())
            && date.getMonth() === journalDate.getMonth()
            && date.getFullYear() === journalDate.getFullYear();
    };

    const filteredJournalDayGroups = React.useMemo(
        () => journalDayGroups.filter(group => isWithinJournalMonth(group.dateKey)),
        [journalDayGroups, journalDate]
    );

    const filteredJournalItems = React.useMemo(
        () => journalItems.filter(item => isWithinJournalMonth(item.completed_at || item.meta.date || item.created_at)),
        [journalItems, journalDate]
    );

    const visibleGeneralItems = useLazyItems(generalItems, {
        resetKey: `library-general-${selectedTag}-${filterDate}-${filterDateTo}-${searchQuery}-${sortOrder}-${generalItems.length}`,
    });
    const visibleSkillItems = useLazyItems(skillStats, {
        resetKey: `library-skills-${skillStats.length}`,
    });
    const visibleJournalGroups = useLazyItems(filteredJournalDayGroups, {
        resetKey: `library-journal-${journalDate.getFullYear()}-${journalDate.getMonth()}-${selectedTag}-${filterDate}-${filterDateTo}-${searchQuery}-${sortOrder}-${filteredJournalDayGroups.length}`,
    });

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

    const subTabs: LibrarySubTab[] = libraryTabs.map(tab => tab.key);
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
        const isEmpty = type === 'journal' ? filteredJournalDayGroups.length === 0 : data.length === 0;
        if (isEmpty) {
            const isJournal = type === 'journal';
            return (
                <div className={`${contentSurface.emptyStateCard} ${contentSurface.libraryEmptyState}`} data-ndz-library-empty-state="intentional">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 lg:mx-0">
                        {isJournal ? <BookText className="w-6 h-6" /> : <Library className="w-6 h-6" />}
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-primary">
                        {searchQuery ? 'No matching notes' : (isJournal ? "Start this month's journal" : 'No notes yet')}
                    </h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted lg:mx-0">
                        {searchQuery
                            ? 'Try another search or capture the thought now so this space has something useful to scan.'
                            : (isJournal
                                ? 'Journal entries will group by day with completed tasks, shopping, events, and transactions alongside the reflection.'
                                : 'Notes will use the wider desktop masonry grid once captured, instead of leaving the library as a blank field.')}
                    </p>
                    <div className={contentSurface.libraryEmptyActions}>
                        <button
                            onClick={() => onAddItem(isJournal ? ItemType.JOURNAL : ItemType.NOTE)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-600"
                        >
                            <Plus className="w-4 h-4" /> {isJournal ? 'Write journal' : 'Add note'}
                        </button>
                        {!isJournal && (
                            <span className="rounded-full border border-border bg-background/60 px-3 py-2 text-xs font-medium text-muted">
                                Search stays anchored to this content frame from the composer edge.
                            </span>
                        )}
                    </div>
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
                <div className="space-y-8 lg:space-y-10">
                    {visibleJournalGroups.visibleItems.map(renderJournalDay)}
                    <LoadMoreButton remainingCount={visibleJournalGroups.remainingCount} onClick={visibleJournalGroups.loadMore} />
                </div>
            );
        }

        // Masonry layout for general notes
        return (
            <div className="space-y-4">
                <div
                    data-tablet-masonry="library-notes"
                    data-ndz-tablet-baseline="masonry"
                    className={contentSurface.masonryGrid}
                >
                    {visibleGeneralItems.visibleItems.map(item => (
                        <Card key={item.id} item={item} {...commonProps} />
                    ))}
                </div>
                <LoadMoreButton remainingCount={visibleGeneralItems.remainingCount} onClick={visibleGeneralItems.loadMore} />
            </div>
        );
    };

    const renderSkills = () => {
        const scheduleRows = skillStats
            .flatMap(skill => (skill.scheduleSessions || []).map(session => ({ skill, session })))
            .sort((a, b) => a.session.start.getTime() - b.session.start.getTime());

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        weekStart.setHours(0, 0, 0, 0);
        const weekDays = Array.from({ length: 7 }, (_, i) => {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            return day;
        });

        if (skillStats.length === 0) {
            return (
                <div className={`${contentSurface.emptyStateCard} flex flex-col items-center justify-center gap-4`}>
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

        const formatTime = (date: Date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

        return (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
                <div className="space-y-4">
                    {visibleSkillItems.visibleItems.map(skill => {
                        const progress = skill.weeklyProgress || 0;
                        const target = skill.schedule?.enabled
                            ? (skill.effectiveWeeklyTargetMinutes || 0)
                            : (skill.effectiveWeeklyTargetMinutes || skill.weeklyTargetMinutes || 0);
                        const nextSession = (skill.scheduleSessions || []).find(session => session.start.getTime() >= Date.now()) || (skill.scheduleSessions || [])[0];

                        return (
                            <motion.div
                                key={skill.id}
                                layout={!isDragging}
                                transition={{ type: "tween", duration: 0.3 }}
                                className="group bg-surface border border-border rounded-[28px] p-4 sm:p-5 shadow-sm hover:border-indigo-500/40 transition-colors"
                            >
                                <div className="grid grid-cols-[92px_minmax(0,1fr)] sm:grid-cols-[150px_minmax(0,1fr)_auto] gap-4 items-center">
                                    <div className="h-24 sm:h-32 rounded-[24px] bg-background border border-border overflow-hidden flex items-center justify-center">
                                        {skill.imageUrl ? (
                                            <img src={skill.imageUrl} alt={skill.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted bg-indigo-500/5">
                                                <Target className="w-7 h-7 text-indigo-500" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">No image</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-lg text-primary truncate">{skill.name}</h4>
                                                <p className="text-xs text-muted mt-1 line-clamp-2">
                                                    {skill.description || 'No description yet. Add one from edit skill.'}
                                                </p>
                                            </div>
                                            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-amber-500">
                                                ★ {(progress / 20).toFixed(1)}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <span className="px-3 py-1 rounded-full bg-background border border-border text-[10px] font-bold text-muted">Skills</span>
                                            {skill.schedule?.enabled && (
                                                <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-500 capitalize">
                                                    {skill.schedule.interval}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-muted">
                                            <span>{skill.weeklyMinutes || 0}m this week</span>
                                            {nextSession && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatTime(nextSession.start)} - {formatTime(nextSession.end)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-4">
                                            <div className="w-full h-2.5 bg-background border border-border rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
                                                    style={{ width: `${Math.min(100, progress)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{progress.toFixed(0)}% Weekly Progress</span>
                                                <span className="text-[10px] font-medium text-muted flex items-center gap-1">
                                                    <Target className="w-3 h-3" />
                                                    Target: {target || 0}m/wk
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex sm:flex-col gap-2 justify-end sm:justify-start col-span-2 sm:col-span-1">
                                        <button
                                            onClick={() => handleOpenEditSkill(skill.id, skill.name, skill.weeklyTargetMinutes)}
                                            className="p-2 bg-background hover:bg-muted/10 rounded-xl transition-colors"
                                            title="Edit Skill"
                                        >
                                            <Pencil className="w-4 h-4 text-muted" />
                                        </button>
                                        <button
                                            onClick={() => { setDeleteId(skill.id); setDeleteType('skill'); }}
                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors"
                                            title="Delete Skill"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                    <LoadMoreButton remainingCount={visibleSkillItems.remainingCount} onClick={visibleSkillItems.loadMore} />
                </div>

                <aside className="xl:sticky xl:top-4 bg-surface border border-border rounded-[28px] p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-lg font-bold text-primary">Schedule</h3>
                            <p className="text-xs text-muted">Skill routines this week</p>
                        </div>
                        <button onClick={handleOpenAddSkill} className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-7 gap-2 mb-5">
                        {weekDays.map(day => {
                            const hasSchedule = scheduleRows.some(row => row.session.start.toDateString() === day.toDateString());
                            const isToday = day.toDateString() === new Date().toDateString();
                            return (
                                <div key={day.toISOString()} className={`rounded-2xl p-2 text-center border ${isToday ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-background'}`}>
                                    <div className="text-[10px] text-muted font-bold">{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                                    <div className="text-sm font-bold text-primary">{day.getDate()}</div>
                                    {hasSchedule && <div className="mx-auto mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                                </div>
                            );
                        })}
                    </div>

                    {scheduleRows.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
                            No skill schedule yet. Edit a skill and enable Schedule Skill Routine.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {scheduleRows.map(({ skill, session }) => {
                                const target = skill.effectiveWeeklyTargetMinutes || 0;
                                const achieved = target ? Math.min(100, ((skill.weeklyMinutes || 0) / target) * 100) : 0;
                                return (
                                    <div key={`${skill.id}-${session.start.toISOString()}`} className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-3 items-center rounded-2xl bg-background border border-border p-3">
                                        <div className="text-center border-r border-border pr-3">
                                            <div className="text-sm font-bold text-primary">{session.start.getDate().toString().padStart(2, '0')}</div>
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-sm font-bold text-primary truncate">{skill.name}</h4>
                                            <p className="text-xs text-muted">{session.durationMinutes}m session</p>
                                            <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden border border-border">
                                                <div className="h-full bg-indigo-500" style={{ width: `${achieved}%` }} />
                                            </div>
                                        </div>
                                        <div className="text-right text-xs font-medium text-muted">
                                            {formatTime(session.start)} - {formatTime(session.end)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </aside>
            </div>
        );
    };

    return (
        <div className={contentSurface.pageShell}>
            {/* Top Container */}
            <motion.div
                layoutId="top-container"
                data-swipe-tabs="library"
                className={contentSurface.headerHero}
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
                    <div data-library-subtabs="true" className="flex bg-black/5 dark:bg-white/20 rounded-2xl p-1 mb-6">
                        {libraryTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setLibrarySubTab(tab.key)}
                                className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${librarySubTab === tab.key ? 'bg-surface text-primary' : 'text-primary/40 hover:text-primary'}`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
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
                                    {libraryTabs.find(tab => tab.key === librarySubTab)?.title || 'Library'}
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
                                            <span>{filteredJournalItems.length} Journal Entries</span>
                                            <span>•</span>
                                            <span>Across {filteredJournalDayGroups.length} Days</span>
                                        </>
                                    )}
                                </p>
                            </div>
                            <button
                                data-library-add-button="true"
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

                    {librarySubTab === 'journal' && (
                        <div
                            data-swipe-date="library-journal-month"
                            className="mt-4 bg-black/5 rounded-[24px] p-4 touch-pan-y"
                            onTouchStart={journalDateSwipeHandlers.onTouchStart}
                            onTouchMove={journalDateSwipeHandlers.onTouchMove}
                            onTouchEnd={journalDateSwipeHandlers.onTouchEnd}
                        >
                            <div className="flex items-center justify-between">
                                <button onClick={() => changeJournalMonth(-1)} className="p-2 hover:bg-black/10 rounded-full transition-colors">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={journalDate.toISOString()}
                                        data-library-journal-month-label="true"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="text-center"
                                    >
                                        <div className="text-xs font-bold opacity-60 uppercase tracking-wider">Journal Month</div>
                                        <div className="text-xl font-bold leading-none mt-1">
                                            {journalDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                                        </div>
                                    </motion.div>
                                </AnimatePresence>
                                <button onClick={() => changeJournalMonth(1)} className="p-2 hover:bg-black/10 rounded-full transition-colors">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>

            {/* Sliding Container */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } }}
                className="touch-pan-y overflow-hidden"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <motion.div
                    className="flex will-change-transform"
                    style={{
                        transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
                        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                >
                {/* VIEW: General Notes */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`w-full flex-shrink-0 overflow-hidden ${contentSurface.contentPad}`}
                >
                    {renderContent(generalItems, 'general')}
                </motion.div>

                {/* VIEW: Skills */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`w-full flex-shrink-0 overflow-hidden ${contentSurface.contentPad}`}
                >
                    {renderSkills()}
                </motion.div>

                {/* VIEW: Journal */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`w-full flex-shrink-0 overflow-hidden ${contentSurface.contentPad}`}
                >
                    {renderContent(journalItems, 'journal')}
                </motion.div>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default LibraryView;
