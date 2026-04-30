import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotebookPen, BookText, Library, Plus, Pencil, Trash2, Target, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
import { BrainDumpItem, Skill, LibrarySubTab, AppSettings, SortOrder, ItemType, FinanceType, Tab, Priority } from '../../types';
import { getNoteItems, getJournalGroups } from '../../utils/selectors';
import Card from '../Card';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';

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
    clearLibraryFilters?: () => void;
    setActiveTab: (tab: Tab) => void;
    onAddItem: (type: ItemType) => void;
}

type LibrarySkillStat = Skill & {
    totalHours: number;
    weeklyHours: number;
    weeklyProgress: number;
    hasWeeklyTarget: boolean;
};

const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setHours(0, 0, 0, 0);
    return new Date(d.setDate(diff));
};

const formatDateLabel = (dateInput?: string) => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return null;

    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

const formatJournalHeading = (dateKey: string) => {
    const date = new Date(dateKey);
    if (Number.isNaN(date.getTime())) return dateKey;

    return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
};

const getItemPrimaryDate = (item: BrainDumpItem) => {
    return item.meta.date || item.completed_at || item.created_at;
};

const LibraryView: React.FC<LibraryViewProps> = ({
    items, skills, librarySubTab, setLibrarySubTab, appSettings,
    handleDelete, handleUpdateItem, handleOpenEditSkill, handleOpenAddSkill, setDeleteId, setDeleteType,
    selectedTag, filterDate, filterDateTo, searchQuery, sortOrder, clearLibraryFilters, setActiveTab, onAddItem
}) => {
    const generalItems = useMemo(
        () => getNoteItems(items, 'general', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder),
        [items, selectedTag, filterDate, filterDateTo, searchQuery, sortOrder]
    );
    const journalItems = useMemo(
        () => getNoteItems(items, 'journal', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder),
        [items, selectedTag, filterDate, filterDateTo, searchQuery, sortOrder]
    );

    const skillStats = useMemo<LibrarySkillStat[]>(() => {
        const weekStart = getStartOfWeek(new Date()).getTime();

        return skills
            .map((skill) => {
                const relatedItems = items.filter((item) => {
                    const itemSkillId = item.meta.skillId;
                    const itemSkillName = item.meta.skillName?.trim().toLowerCase();
                    const matchesId = itemSkillId && itemSkillId === skill.id;
                    const matchesName = itemSkillName && itemSkillName === skill.name.trim().toLowerCase();
                    return Boolean(matchesId || matchesName);
                });

                const totalMinutes = relatedItems.reduce((sum, item) => sum + (item.meta.durationMinutes || 0), 0);
                const weeklyMinutes = relatedItems.reduce((sum, item) => {
                    const dateValue = getItemPrimaryDate(item);
                    const date = dateValue ? new Date(dateValue) : null;
                    if (!date || Number.isNaN(date.getTime())) return sum;
                    return date.getTime() >= weekStart ? sum + (item.meta.durationMinutes || 0) : sum;
                }, 0);

                const weeklyProgress = skill.weeklyTargetMinutes && skill.weeklyTargetMinutes > 0
                    ? (weeklyMinutes / skill.weeklyTargetMinutes) * 100
                    : 0;

                return {
                    ...skill,
                    totalHours: totalMinutes / 60,
                    weeklyHours: weeklyMinutes / 60,
                    weeklyProgress,
                    hasWeeklyTarget: Boolean(skill.weeklyTargetMinutes && skill.weeklyTargetMinutes > 0)
                };
            })
            .sort((a, b) => {
                if (b.weeklyProgress !== a.weeklyProgress) return b.weeklyProgress - a.weeklyProgress;
                if (b.weeklyHours !== a.weeklyHours) return b.weeklyHours - a.weeklyHours;
                return a.name.localeCompare(b.name);
            });
    }, [items, skills]);

    const journalGroups = useMemo(() => getJournalGroups(journalItems, sortOrder), [journalItems, sortOrder]);
    const activeFilters = useMemo(() => {
        const filters: string[] = [];
        if (selectedTag) filters.push(`#${selectedTag}`);
        if (searchQuery) filters.push(`Search: ${searchQuery}`);
        if (filterDate && filterDateTo) filters.push(`${formatDateLabel(filterDate)} → ${formatDateLabel(filterDateTo)}`);
        else if (filterDate) filters.push(`Date: ${formatDateLabel(filterDate)}`);
        return filters;
    }, [selectedTag, searchQuery, filterDate, filterDateTo]);

    const latestJournalDate = useMemo(() => {
        const firstEntry = journalItems[0];
        return firstEntry ? formatDateLabel(getItemPrimaryDate(firstEntry)) : null;
    }, [journalItems]);

    const onTrackSkillsCount = skillStats.filter(skill => skill.hasWeeklyTarget && skill.weeklyProgress >= 100).length;
    const activeSkillsThisWeek = skillStats.filter(skill => skill.weeklyHours > 0).length;

    const swipeHandlers = useSwipeTabs('library', setActiveTab);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [skillActionId, setSkillActionId] = useState<string | null>(null);

    const commonCardProps = {
        onUpdate: handleUpdateItem,
        onDelete: handleDelete,
        enableCollapse: true,
        defaultCollapsed: appSettings.defaultCollapsed,
        hideMoney: appSettings.hideMoney,
        skills,
        className: 'mb-0',
    };

    const heroConfig = useMemo(() => {
        if (librarySubTab === 'journal') {
            return {
                icon: <BookText className="w-5 h-5" />,
                title: 'Journal',
                support: latestJournalDate
                    ? `${journalItems.length} entries • Last written ${latestJournalDate}`
                    : 'Start a calmer running record of your days',
                actionLabel: '+ Entry',
                onAction: () => onAddItem(ItemType.JOURNAL),
            };
        }

        if (librarySubTab === 'skills') {
            const support = skillStats.length === 0
                ? 'Track skills and build a steady practice rhythm'
                : onTrackSkillsCount > 0
                    ? `${skillStats.length} skills • ${onTrackSkillsCount} on track this week`
                    : `${skillStats.length} skills • ${activeSkillsThisWeek} active this week`;

            return {
                icon: <Target className="w-5 h-5" />,
                title: 'Skills',
                support,
                actionLabel: '+ Track',
                onAction: handleOpenAddSkill,
            };
        }

        const generalSupportParts = [`${generalItems.length} notes`];
        if (activeFilters.length > 0) generalSupportParts.push('Filtered view');
        else generalSupportParts.push('All notes');

        return {
            icon: <Library className="w-5 h-5" />,
            title: 'Library',
            support: generalSupportParts.join(' • '),
            actionLabel: '+ New',
            onAction: () => onAddItem(ItemType.NOTE),
        };
    }, [librarySubTab, latestJournalDate, journalItems.length, onAddItem, skillStats.length, onTrackSkillsCount, activeSkillsThisWeek, handleOpenAddSkill, generalItems.length, activeFilters.length]);

    const toggleExpandedItem = (id: string) => {
        setExpandedItemId(current => (current === id ? null : id));
    };

    const renderNoteRow = (item: BrainDumpItem, type: 'general' | 'journal') => {
        const itemDateLabel = formatDateLabel(getItemPrimaryDate(item));
        const tags = (item.meta.tags || []).filter(Boolean);
        const previewMeta: string[] = [];

        if (itemDateLabel) previewMeta.push(itemDateLabel);
        if (type === 'general') {
            if (tags.length === 1) previewMeta.push(`#${tags[0]}`);
            else if (tags.length > 1) previewMeta.push(`${tags.length} tags`);
        }

        if (type === 'journal' && item.type === ItemType.TODO) {
            previewMeta.push('Completed task');
        }

        const isExpanded = expandedItemId === item.id;

        return (
            <div key={item.id} className="border-b border-border/70 last:border-b-0 py-3 first:pt-0 last:pb-0">
                <button
                    type="button"
                    onClick={() => toggleExpandedItem(item.id)}
                    className="w-full text-left"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm leading-6 text-primary line-clamp-2 whitespace-pre-wrap">
                                {item.content}
                            </p>
                            {previewMeta.length > 0 && (
                                <p className="mt-1 text-xs text-muted">
                                    {previewMeta.join(' • ')}
                                </p>
                            )}
                        </div>
                        <span className="mt-1 shrink-0 text-muted">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                    </div>
                </button>

                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-3">
                                <Card
                                    item={item}
                                    {...commonCardProps}
                                    enableCollapse={false}
                                    embedded
                                    noStrikethrough={type === 'journal'}
                                    noDarken={type === 'journal'}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const renderGeneralNotes = () => {
        if (generalItems.length === 0) {
            return (
                <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                    <p className="text-sm text-muted">
                        {searchQuery || selectedTag || filterDate
                            ? 'No notes match the current filters.'
                            : 'No notes yet. Start with one clean thought.'}
                    </p>
                    <button
                        onClick={() => onAddItem(ItemType.NOTE)}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" /> New Note
                    </button>
                </div>
            );
        }

        return <div>{generalItems.map(item => renderNoteRow(item, 'general'))}</div>;
    };

    const renderJournal = () => {
        if (journalItems.length === 0) {
            return (
                <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                    <p className="text-sm text-muted">
                        {searchQuery || selectedTag || filterDate
                            ? 'No journal entries match the current filters.'
                            : 'Write your first entry and start building a readable archive.'}
                    </p>
                    <button
                        onClick={() => onAddItem(ItemType.JOURNAL)}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" /> New Entry
                    </button>
                </div>
            );
        }

        return (
            <div className="space-y-8">
                {Object.entries(journalGroups).map(([dateKey, entries]) => (
                    <section key={dateKey}>
                        <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                            {formatJournalHeading(dateKey)}
                        </h3>
                        <div className="rounded-3xl border border-border/70 bg-surface px-4 py-4">
                            {entries.map(item => renderNoteRow(item, 'journal'))}
                        </div>
                    </section>
                ))}
            </div>
        );
    };

    const renderSkills = () => {
        if (skillStats.length === 0) {
            return (
                <div className="rounded-3xl border border-dashed border-border px-6 py-12 text-center">
                    <p className="text-sm text-muted">No skills tracked yet. Add one target and keep the weekly rhythm visible.</p>
                    <button
                        onClick={handleOpenAddSkill}
                        className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-500 transition-colors hover:bg-indigo-500/20"
                    >
                        <Plus className="w-4 h-4" /> Track Skill
                    </button>
                </div>
            );
        }

        return (
            <div className="rounded-3xl border border-border/70 bg-surface divide-y divide-border/70">
                {skillStats.map((skill) => {
                    const weeklyText = skill.weeklyHours > 0
                        ? `${skill.weeklyHours.toFixed(1)}h this week`
                        : 'No practice logged this week';
                    const targetText = skill.hasWeeklyTarget && skill.weeklyTargetMinutes
                        ? `target ${(skill.weeklyTargetMinutes / 60).toFixed(1)}h`
                        : `${skill.totalHours.toFixed(1)}h total`;

                    return (
                        <div key={skill.id} className="px-4 py-4 first:pt-5 last:pb-5">
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-primary">{skill.name}</h3>
                                            <p className="mt-1 text-xs text-muted">{weeklyText} • {targetText}</p>
                                        </div>
                                        {skill.hasWeeklyTarget ? (
                                            <span className="shrink-0 text-sm font-semibold text-primary">
                                                {Math.round(skill.weeklyProgress)}%
                                            </span>
                                        ) : (
                                            <span className="shrink-0 text-xs text-muted">Tracked</span>
                                        )}
                                    </div>

                                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
                                        <div
                                            className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                                            style={{ width: `${Math.min(skill.hasWeeklyTarget ? skill.weeklyProgress : 100, 100)}%` }}
                                        />
                                    </div>

                                    <AnimatePresence initial={false}>
                                        {skillActionId === skill.id && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3 flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleOpenEditSkill(skill.id, skill.name, skill.weeklyTargetMinutes)}
                                                        className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted/10"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setDeleteId(skill.id);
                                                            setDeleteType('skill');
                                                        }}
                                                        className="inline-flex items-center gap-1 rounded-xl border border-red-500/20 px-3 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" /> Delete
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSkillActionId(current => (current === skill.id ? null : skill.id))}
                                    className="mt-0.5 rounded-xl p-2 text-muted transition-colors hover:bg-muted/10 hover:text-primary"
                                    aria-label={`Actions for ${skill.name}`}
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const content = librarySubTab === 'journal'
        ? renderJournal()
        : librarySubTab === 'skills'
            ? renderSkills()
            : renderGeneralNotes();

    return (
        <div
            className="min-h-[50vh] pb-24"
            onTouchStart={swipeHandlers.onTouchStart}
            onTouchMove={swipeHandlers.onTouchMove}
            onTouchEnd={swipeHandlers.onTouchEnd}
        >
            <motion.div style={swipeHandlers.style} className="will-change-transform">
                <div className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 pb-3 pt-safe backdrop-blur">
                    <div className="flex items-start justify-between gap-3 pb-4 pt-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-primary">
                                <div className="rounded-2xl bg-indigo-500/10 p-2 text-indigo-500">
                                    {heroConfig.icon}
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight">{heroConfig.title}</h1>
                            </div>
                            <p className="mt-2 text-sm text-muted">{heroConfig.support}</p>
                        </div>
                        <button
                            onClick={heroConfig.onAction}
                            className="shrink-0 rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                        >
                            {heroConfig.actionLabel}
                        </button>
                    </div>

                    <div className="flex rounded-2xl bg-black/5 p-1 dark:bg-white/10">
                        {[
                            { id: 'general' as LibrarySubTab, label: 'General', icon: <Library className="w-4 h-4" /> },
                            { id: 'journal' as LibrarySubTab, label: 'Journal', icon: <BookText className="w-4 h-4" /> },
                            { id: 'skills' as LibrarySubTab, label: 'Skills', icon: <NotebookPen className="w-4 h-4" /> },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setLibrarySubTab(tab.id);
                                    setExpandedItemId(null);
                                    setSkillActionId(null);
                                }}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                                    librarySubTab === tab.id
                                        ? 'bg-surface text-primary shadow-sm'
                                        : 'text-primary/50 hover:text-primary'
                                }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {activeFilters.length > 0 && librarySubTab !== 'skills' && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            {activeFilters.map(filter => (
                                <span
                                    key={filter}
                                    className="rounded-full bg-muted/10 px-3 py-1 text-xs font-medium text-muted"
                                >
                                    {filter}
                                </span>
                            ))}
                            {clearLibraryFilters && (
                                <button
                                    onClick={clearLibraryFilters}
                                    className="text-xs font-semibold text-indigo-500 transition-opacity hover:opacity-80"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={librarySubTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18 }}
                        className="px-4 pt-4"
                    >
                        {content}
                    </motion.div>
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default LibraryView;
