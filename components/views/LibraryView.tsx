import React, { useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { BookText, Library, Plus, Pencil, Trash2, Target, CheckCircle2, ShoppingBag, CalendarDays, Wallet, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { BrainDumpItem, Skill, LibrarySubTab, AppSettings, SortOrder, ItemType, FinanceType, Tab, Priority, SkillSessionLogInput } from '../../types';
import { getJournalDayGroups, getNoteItems, getSkillItems, getSkillLogActualRange, getSkillLogDurationMinutes, getSkillLogForSession, SkillScheduleSession, JournalDayGroup } from '../../utils/selectors';
import Card from '../Card';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import ActiveIndicator from '../../motion/ActiveIndicator';
import AnimatedProgress from '../../motion/AnimatedProgress';
import { useSwipeDate } from '../../hooks/useSwipeDate';
import { useLazyItems } from '../../hooks/useLazyItems';
import LoadMoreButton from '../LoadMoreButton';
import { contentSurface, responsiveModal } from '../layout/contentSurface';
import { formatFinanceTypeLabel } from '../../utils/financeTypeUtils';
import { directionalLabelVariants } from '../../motion/variants';
import PresencePanel from '../../motion/PresencePanel';
import { getAppLocale, normalizeAppLanguage } from '../../utils/i18n';

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
    handleUpsertSkillSessionLog: (input: SkillSessionLogInput) => void;
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

type SkillScheduleRowSkill = Skill & {
    weeklyMinutes?: number;
    weeklyProgress?: number;
    effectiveWeeklyTargetMinutes?: number;
    scheduleSessions?: SkillScheduleSession[];
};

type SkillSessionEditorState = {
    skill: SkillScheduleRowSkill;
    session: SkillScheduleSession;
    log?: BrainDumpItem;
};

const LibraryView: React.FC<LibraryViewProps> = ({
    items, skills, librarySubTab, setLibrarySubTab, appSettings,
    handleDelete, handleUpdateItem, handleOpenEditSkill, handleOpenAddSkill, handleUpsertSkillSessionLog, setDeleteId, setDeleteType,
    selectedTag, filterDate, filterDateTo, searchQuery, sortOrder, setActiveTab, onAddItem
}) => {
    const isEnglish = normalizeAppLanguage(appSettings.language) === 'en';
    const locale = getAppLocale(appSettings.language);
    const libraryCopy = isEnglish ? {
        sections: 'Library sections', notes: 'Notes', allNotes: 'All notes', skills: 'Skills', skillGrowth: 'Skill growth', journal: 'Journal', journalEntries: 'Journal entries',
        tags: 'Tags', totalTime: 'Total time', across: 'Across', days: 'days', addNote: 'Add note', addSkill: 'Add skill', writeJournal: 'Write journal',
        noMatch: 'No matching notes', startJournal: "Start this month's journal", noNotes: 'No notes yet', journalMonth: 'Journal month',
        emptySearch: 'Try another search or capture the thought now.', emptyJournal: 'Journal entries are grouped by day with completed activity beside your reflection.',
        emptyNotes: 'Capture a thought to start building your personal library.',
        notesSubtitle: 'Keep useful thoughts easy to find without turning them into tasks.',
        skillsSubtitle: 'See practice time, routines, and progress in one calm view.',
        journalSubtitle: 'Reflect by day while keeping related activity close at hand.',
        noSkills: 'No skills tracked yet.', trackSkill: 'Track skill', noImage: 'No image', noDescription: 'No description yet. Add one when editing the skill.',
        thisWeek: 'this week', weeklyProgress: 'Weekly progress', target: 'Target', perWeek: 'week', editSkill: 'Edit skill', deleteSkill: 'Delete skill',
        schedule: 'Schedule', scheduleSubtitle: 'Skill routines this week', noSchedule: 'No skill schedule yet. Edit a skill and enable its routine.', session: 'session',
        statusDone: 'Done', statusPartial: 'Partial', statusMissed: 'Missed', statusToday: 'Today', statusInProgress: 'In progress', statusReady: 'Ready to log', statusUpcoming: 'Upcoming',
        editSession: 'Edit skill session', close: 'Close', actualStart: 'Actual start', actualEnd: 'Actual end', duration: 'Duration',
        invalidActual: 'Actual end must be after actual start.', cancel: 'Cancel', saveActual: 'Save actual time',
        itemDetail: 'Library detail', editEntry: 'Edit entry', closeDetail: 'Close detail',
    } : {
        sections: 'Bagian Pustaka', notes: 'Catatan', allNotes: 'Semua catatan', skills: 'Skill', skillGrowth: 'Perkembangan skill', journal: 'Jurnal', journalEntries: 'Entri jurnal',
        tags: 'Tag', totalTime: 'Total waktu', across: 'Dalam', days: 'hari', addNote: 'Tambah catatan', addSkill: 'Tambah skill', writeJournal: 'Tulis jurnal',
        noMatch: 'Tidak ada catatan yang cocok', startJournal: 'Mulai jurnal bulan ini', noNotes: 'Belum ada catatan', journalMonth: 'Bulan jurnal',
        emptySearch: 'Coba pencarian lain atau catat pemikiran baru sekarang.', emptyJournal: 'Entri jurnal dikelompokkan per hari bersama aktivitas yang sudah selesai.',
        emptyNotes: 'Catat satu pemikiran untuk mulai membangun pustaka personal Anda.',
        notesSubtitle: 'Simpan pemikiran berguna agar mudah ditemukan tanpa menjadikannya tugas.',
        skillsSubtitle: 'Lihat waktu latihan, rutinitas, dan progres dalam satu tampilan tenang.',
        journalSubtitle: 'Refleksi per hari dengan aktivitas terkait tetap dekat dan mudah dipahami.',
        noSkills: 'Belum ada skill yang dipantau.', trackSkill: 'Tambah skill', noImage: 'Belum ada gambar', noDescription: 'Belum ada deskripsi. Tambahkan saat mengubah skill.',
        thisWeek: 'minggu ini', weeklyProgress: 'Progres mingguan', target: 'Target', perWeek: 'minggu', editSkill: 'Ubah skill', deleteSkill: 'Hapus skill',
        schedule: 'Jadwal', scheduleSubtitle: 'Rutinitas skill minggu ini', noSchedule: 'Belum ada jadwal skill. Ubah skill lalu aktifkan rutinitasnya.', session: 'sesi',
        statusDone: 'Selesai', statusPartial: 'Sebagian', statusMissed: 'Terlewat', statusToday: 'Hari ini', statusInProgress: 'Berlangsung', statusReady: 'Siap dicatat', statusUpcoming: 'Mendatang',
        editSession: 'Ubah sesi skill', close: 'Tutup', actualStart: 'Mulai aktual', actualEnd: 'Selesai aktual', duration: 'Durasi',
        invalidActual: 'Waktu selesai harus setelah waktu mulai.', cancel: 'Batal', saveActual: 'Simpan waktu aktual',
        itemDetail: 'Detail pustaka', editEntry: 'Ubah entri', closeDetail: 'Tutup detail',
    };
    const libraryTabs: { key: LibrarySubTab; label: string; title: string; icon: React.ReactNode }[] = [
        { key: 'general', label: libraryCopy.notes, title: libraryCopy.allNotes, icon: <Library className="w-4 h-4" /> },
        { key: 'skills', label: libraryCopy.skills, title: libraryCopy.skillGrowth, icon: <Target className="w-4 h-4" /> },
        { key: 'journal', label: libraryCopy.journal, title: libraryCopy.journalEntries, icon: <BookText className="w-4 h-4" /> },
    ];


    // Data Preparation
    const generalItems = getNoteItems(items, 'general', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const journalItems = getNoteItems(items, 'journal', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const journalDayGroups = getJournalDayGroups(items, selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const { stats: skillStats } = getSkillItems(items, skills);
    const [journalDate, setJournalDate] = useState(new Date());
    const [journalDirection, setJournalDirection] = useState(0);

    const changeJournalMonth = (offset: number) => {
        const next = new Date(journalDate);
        next.setMonth(next.getMonth() + offset);
        setJournalDirection(Math.sign(offset));
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

    const libraryTabOrder = libraryTabs.map(tab => tab.key);
    const libraryTagCount = new Set(
        generalItems.flatMap(item => item.meta.tags || []).filter(tag => tag && tag !== 'null' && tag !== 'undefined')
    ).size;
    const activeLibraryHeader = {
        general: {
            title: libraryCopy.allNotes,
            description: libraryCopy.notesSubtitle,
            metrics: [
                { label: libraryCopy.notes, value: generalItems.length },
                { label: libraryCopy.tags, value: libraryTagCount },
            ],
        },
        skills: {
            title: libraryCopy.skillGrowth,
            description: libraryCopy.skillsSubtitle,
            metrics: [
                { label: libraryCopy.skills, value: skillStats.length },
                { label: libraryCopy.totalTime, value: `${skillStats.reduce((total, skill) => total + skill.totalHours, 0).toFixed(1)}${isEnglish ? 'h' : 'j'}` },
            ],
        },
        journal: {
            title: libraryCopy.journalEntries,
            description: libraryCopy.journalSubtitle,
            metrics: [
                { label: libraryCopy.journalEntries, value: filteredJournalItems.length },
                { label: libraryCopy.days, value: filteredJournalDayGroups.length },
            ],
        },
    }[librarySubTab];

    const visibleGeneralItems = useLazyItems(generalItems, {
        resetKey: `library-general-${selectedTag}-${filterDate}-${filterDateTo}-${searchQuery}-${sortOrder}`,
    });
    const visibleSkillItems = useLazyItems(skillStats, {
        resetKey: 'library-skills',
    });
    const visibleJournalGroups = useLazyItems(filteredJournalDayGroups, {
        resetKey: `library-journal-${journalDate.getFullYear()}-${journalDate.getMonth()}-${selectedTag}-${filterDate}-${filterDateTo}-${searchQuery}-${sortOrder}`,
    });

    const [editingSkillSession, setEditingSkillSession] = useState<SkillSessionEditorState | null>(null);
    const [actualStartInput, setActualStartInput] = useState('');
    const [actualEndInput, setActualEndInput] = useState('');
    const [selectedLibraryItemId, setSelectedLibraryItemId] = useState<string | null>(null);
    const selectedLibraryItem = selectedLibraryItemId ? items.find(item => item.id === selectedLibraryItemId) || null : null;

    React.useEffect(() => {
        if (selectedLibraryItemId && !selectedLibraryItem) setSelectedLibraryItemId(null);
    }, [selectedLibraryItem, selectedLibraryItemId]);

    const toDateTimeLocalInputValue = (value?: Date | string) => {
        if (!value) return '';
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const offsetMs = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
    };

    const parseDateTimeLocalInput = (value: string) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    };

    const formatDurationDelta = (deltaMinutes: number) => {
        if (deltaMinutes === 0) return '';
        const abs = Math.abs(deltaMinutes);
        return deltaMinutes > 0 ? `+${abs}m bonus` : `-${abs}m`;
    };

    const formatSessionDateTime = (date: Date) => date.toLocaleString(locale, {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });

    const openSkillSessionEditor = (skill: SkillScheduleRowSkill, session: SkillScheduleSession, log?: BrainDumpItem) => {
        const actualRange = getSkillLogActualRange(log, session);
        setEditingSkillSession({ skill, session, log });
        setActualStartInput(toDateTimeLocalInputValue(actualRange?.start || session.start));
        setActualEndInput(toDateTimeLocalInputValue(actualRange?.end || session.end));
    };

    const closeSkillSessionEditor = () => {
        setEditingSkillSession(null);
        setActualStartInput('');
        setActualEndInput('');
    };

    const saveSkillSessionActualTime = () => {
        if (!editingSkillSession) return;
        const actualStart = parseDateTimeLocalInput(actualStartInput);
        const actualEnd = parseDateTimeLocalInput(actualEndInput);
        if (!actualStart || !actualEnd || actualEnd <= actualStart) return;

        handleUpsertSkillSessionLog({
            logId: editingSkillSession.log?.id,
            skillId: editingSkillSession.skill.id,
            skillName: editingSkillSession.skill.name,
            skillRoutineId: editingSkillSession.log?.meta.skillRoutineId,
            plannedStart: editingSkillSession.session.start.toISOString(),
            plannedEnd: editingSkillSession.session.end.toISOString(),
            actualStart: actualStart.toISOString(),
            actualEnd: actualEnd.toISOString(),
        });
        closeSkillSessionEditor();
    };

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
        count?: number,
        onOpen?: () => void
    ) => (
        <div
            className={`${contentSurface.workspaceCompactCard} p-4 ${onOpen ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
            data-card-behavior={onOpen ? 'detail-panel' : 'summary'}
            role={onOpen ? 'group' : undefined}
            tabIndex={onOpen ? 0 : undefined}
            onClick={onOpen}
            onKeyDown={event => {
                if (!onOpen || event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                onOpen();
            }}
        >
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
                        group.journalEntries.length,
                        () => setSelectedLibraryItemId(group.journalEntries[0].id)
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
                        {searchQuery ? libraryCopy.noMatch : (isJournal ? libraryCopy.startJournal : libraryCopy.noNotes)}
                    </h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted lg:mx-0">
                        {searchQuery
                            ? libraryCopy.emptySearch
                            : (isJournal
                                ? libraryCopy.emptyJournal
                                : libraryCopy.emptyNotes)}
                    </p>
                    <div className={contentSurface.libraryEmptyActions}>
                        <button
                            onClick={() => onAddItem(isJournal ? ItemType.JOURNAL : ItemType.NOTE)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-600"
                        >
                            <Plus className="w-4 h-4" /> {isJournal ? libraryCopy.writeJournal : libraryCopy.addNote}
                        </button>
                        {!isJournal && (
                            <span className="rounded-full border border-border bg-background/60 px-3 py-2 text-xs font-medium text-muted">
                                {isEnglish ? 'Search stays available from the composer.' : 'Pencarian tetap tersedia dari composer.'}
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
            defaultCollapsed: true,
            hideMoney: appSettings.hideMoney,
            skills,
            className: "mb-4 break-inside-avoid",
            noStrikethrough: type === 'journal',
            noDarken: type === 'journal',
            onOpen: (item: BrainDumpItem) => setSelectedLibraryItemId(item.id),
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
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(todayStart.getDate() + 1);

        const scheduleRows = skillStats
            .flatMap(skill => (skill.scheduleSessions || []).map(session => {
                const rowSkill = skill as SkillScheduleRowSkill;
                const log = getSkillLogForSession(items, rowSkill, session);
                const actualRange = getSkillLogActualRange(log, session);
                const actualMinutes = log ? getSkillLogDurationMinutes(log, session.durationMinutes) : 0;
                const plannedMinutes = session.durationMinutes;
                const deltaMinutes = log ? actualMinutes - plannedMinutes : 0;
                const sessionProgress = log
                    ? Math.min(100, plannedMinutes ? (actualMinutes / plannedMinutes) * 100 : 0)
                    : (now >= session.start && now <= session.end ? Math.min(100, ((now.getTime() - session.start.getTime()) / Math.max(session.end.getTime() - session.start.getTime(), 1)) * 100) : undefined);

                let status: 'done' | 'partial' | 'missed' | 'today' | 'in_progress' | 'ready_to_log' | 'upcoming';
                if (log) {
                    status = actualMinutes >= plannedMinutes ? 'done' : (actualMinutes > 0 ? 'partial' : 'missed');
                } else if (session.start < todayStart) {
                    status = 'missed';
                } else if (session.start >= tomorrowStart) {
                    status = 'upcoming';
                } else if (now >= session.start && now <= session.end) {
                    status = 'in_progress';
                } else if (now > session.end) {
                    status = 'ready_to_log';
                } else {
                    status = 'today';
                }

                return {
                    skill: rowSkill,
                    session,
                    log,
                    actualRange,
                    actualMinutes,
                    plannedMinutes,
                    deltaMinutes,
                    sessionProgress,
                    status,
                };
            }))
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
                    <p className="text-muted font-medium">{libraryCopy.noSkills}</p>
                    <button
                        onClick={handleOpenAddSkill}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-2xl text-sm font-bold transition-colors"
                    >
                        <Plus className="w-4 h-4" /> {libraryCopy.trackSkill}
                    </button>
                </div>
            );
        }

        const formatTime = (date: Date) => date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        const dayVisibilityClass = (index: number) => {
            if (index < 3) return '';
            if (index === 3) return 'hidden min-[420px]:block md:block';
            return 'hidden md:block';
        };

        return (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] gap-5 items-start">
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
                                layout={isDragging ? false : "position"}
                                layoutDependency={`${skill.weeklyMinutes || 0}-${skill.weeklyTargetMinutes || 0}`}
                                data-card-behavior="detail-panel"
                                role="group"
                                tabIndex={0}
                                aria-label={`${libraryCopy.editSkill} ${skill.name}`}
                                onClick={() => handleOpenEditSkill(skill.id, skill.name, skill.weeklyTargetMinutes)}
                                onKeyDown={event => {
                                    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                                    event.preventDefault();
                                    handleOpenEditSkill(skill.id, skill.name, skill.weeklyTargetMinutes);
                                }}
                                className="group cursor-pointer overflow-hidden rounded-[28px] bg-surface p-1 shadow-sm ring-1 ring-inset ring-border/70 transition-shadow hover:shadow-md"
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-[minmax(180px,240px)_minmax(0,1fr)_auto] gap-0 sm:gap-4 items-stretch">
                                    <div className="w-full aspect-[16/9] sm:aspect-auto sm:h-full sm:min-h-[184px] rounded-[26px] bg-background border border-border overflow-hidden flex items-center justify-center">
                                        {skill.imageUrl ? (
                                            <img src={skill.imageUrl} alt={skill.name} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted bg-indigo-500/5">
                                                <Target className="w-9 h-9 text-indigo-500" />
                                                <span className="text-[10px] font-semibold text-muted">{libraryCopy.noImage}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0 p-4 sm:py-4 sm:pl-0 sm:pr-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-xl text-primary truncate">{skill.name}</h4>
                                                <p className="text-xs text-muted mt-1 line-clamp-2 leading-5">
                                                    {skill.description || libraryCopy.noDescription}
                                                </p>
                                            </div>
                                            <div className="flex sm:hidden items-center gap-2 text-xs font-bold text-amber-500 shrink-0">
                                                ★ {(progress / 20).toFixed(1)}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 mt-3">
                                            <span className="px-3 py-1 rounded-full bg-background border border-border text-[10px] font-bold text-muted">{libraryCopy.skills}</span>
                                            {skill.schedule?.enabled && (
                                                <span className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-500 capitalize">
                                                    {skill.schedule.interval}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-muted">
                                            <span>{skill.weeklyMinutes || 0}m {libraryCopy.thisWeek}</span>
                                            {nextSession && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {formatTime(nextSession.start)} - {formatTime(nextSession.end)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-4">
                                            <div className="w-full h-2.5 bg-background border border-border rounded-full overflow-hidden">
                                                <AnimatedProgress
                                                    value={Math.min(100, progress)}
                                                    className="bg-indigo-500"
                                                    label={`${skill.name} weekly progress`}
                                                />
                                            </div>
                                            <div className="flex justify-between items-center mt-2 gap-3">
                                                <span className="text-[10px] font-semibold text-muted">{progress.toFixed(0)}% {libraryCopy.weeklyProgress}</span>
                                                <span className="text-[10px] font-medium text-muted flex items-center gap-1 whitespace-nowrap">
                                                    <Target className="w-3 h-3" />
                                                    {libraryCopy.target}: {target || 0}m/{libraryCopy.perWeek}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex sm:flex-col gap-2 justify-end sm:justify-start p-4 sm:pl-0">
                                        <div className="hidden sm:flex items-center justify-center text-xs font-bold text-amber-500 mb-1">
                                            ★ {(progress / 20).toFixed(1)}
                                        </div>
                                        <button
                                            onClick={event => {
                                                event.stopPropagation();
                                                handleOpenEditSkill(skill.id, skill.name, skill.weeklyTargetMinutes);
                                            }}
                                            className="p-2 bg-background hover:bg-muted/10 rounded-xl transition-colors"
                                            title={libraryCopy.editSkill}
                                            aria-label={`${libraryCopy.editSkill} ${skill.name}`}
                                        >
                                            <Pencil className="w-4 h-4 text-muted" />
                                        </button>
                                        <button
                                            onClick={event => {
                                                event.stopPropagation();
                                                setDeleteId(skill.id);
                                                setDeleteType('skill');
                                            }}
                                            className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-colors"
                                            title={libraryCopy.deleteSkill}
                                            aria-label={`${libraryCopy.deleteSkill} ${skill.name}`}
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

                <aside className={`${contentSurface.workspaceCard} overflow-hidden xl:sticky xl:top-4`}>
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-lg font-semibold text-primary">{libraryCopy.schedule}</h3>
                            <p className="text-xs text-muted">{libraryCopy.scheduleSubtitle}</p>
                        </div>
                        <button onClick={handleOpenAddSkill} className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 min-[420px]:grid-cols-4 md:grid-cols-7 gap-1.5 mb-5 overflow-hidden">
                        {weekDays.map((day, index) => {
                            const hasSchedule = scheduleRows.some(row => row.session.start.toDateString() === day.toDateString());
                            const isToday = day.toDateString() === new Date().toDateString();
                            return (
                                <div key={day.toISOString()} className={`${dayVisibilityClass(index)} rounded-2xl p-2 text-center border min-w-0 ${isToday ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-background'}`}>
                                    <div className="text-[10px] text-muted font-bold truncate">{day.toLocaleDateString(locale, { weekday: 'short' })}</div>
                                    <div className="text-sm font-bold text-primary">{day.getDate()}</div>
                                    {hasSchedule && <div className="mx-auto mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                                </div>
                            );
                        })}
                    </div>

                    {scheduleRows.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
                            {libraryCopy.noSchedule}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {scheduleRows.map(({ skill, session, log, actualRange, actualMinutes, plannedMinutes, deltaMinutes, sessionProgress, status }) => {
                                const statusMeta = {
                                    done: { label: libraryCopy.statusDone, className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
                                    partial: { label: libraryCopy.statusPartial, className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
                                    missed: { label: libraryCopy.statusMissed, className: 'bg-red-500/10 text-red-500 border-red-500/20' },
                                    today: { label: libraryCopy.statusToday, className: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
                                    in_progress: { label: libraryCopy.statusInProgress, className: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
                                    ready_to_log: { label: libraryCopy.statusReady, className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
                                    upcoming: { label: libraryCopy.statusUpcoming, className: 'bg-surface text-muted border-border' },
                                }[status];
                                const varianceText = log ? formatDurationDelta(deltaMinutes) : '';
                                const showProgress = status !== 'upcoming' && status !== 'today' && (sessionProgress !== undefined || status === 'missed' || status === 'ready_to_log');
                                const progressWidth = status === 'missed' || status === 'ready_to_log'
                                    ? 0
                                    : Math.min(100, Math.max(0, sessionProgress || 0));
                                return (
                                    <button
                                        key={`${skill.id}-${session.start.toISOString()}`}
                                        type="button"
                                        onClick={() => openSkillSessionEditor(skill, session, log)}
                                        className={`grid w-full min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-2xl p-3 text-left sm:grid-cols-[44px_minmax(0,1fr)_auto] ${contentSurface.workspaceListRow}`}
                                    >
                                        <div className="text-center border-r border-border pr-3">
                                            <div className="text-sm font-bold text-primary">{session.start.getDate().toString().padStart(2, '0')}</div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center justify-between gap-2 min-w-0">
                                                <h4 className="text-sm font-bold text-primary truncate">{skill.name}</h4>
                                                <span className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusMeta.className}`}>
                                                    {statusMeta.label}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                                                <span className="text-muted">{actualMinutes || plannedMinutes}m {libraryCopy.session}</span>
                                                {varianceText && (
                                                    <span className={deltaMinutes > 0 ? 'font-semibold text-emerald-500' : 'font-semibold text-amber-500'}>
                                                        {varianceText}
                                                    </span>
                                                )}
                                            </div>
                                            {showProgress && (
                                                <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden border border-border">
                                                    <AnimatedProgress
                                                        value={progressWidth}
                                                        className="bg-indigo-500"
                                                        label={`${skill.name} session progress`}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-2 sm:col-span-1 sm:text-right text-xs font-medium pl-[52px] sm:pl-0 space-y-0.5">
                                            {actualRange?.edited ? (
                                                <>
                                                    <div className="text-amber-500">{formatTime(session.start)} - {formatTime(session.end)}</div>
                                                    <div className="text-muted">{formatTime(actualRange.start)} - {formatTime(actualRange.end)}</div>
                                                </>
                                            ) : (
                                                <div className="text-muted">{formatTime(actualRange?.start || session.start)} - {formatTime(actualRange?.end || session.end)}</div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </aside>
            </div>
        );
    };

    const modalActualStart = parseDateTimeLocalInput(actualStartInput);
    const modalActualEnd = parseDateTimeLocalInput(actualEndInput);
    const isSkillSessionSaveDisabled = !modalActualStart || !modalActualEnd || modalActualEnd <= modalActualStart;

    return (
        <div className={contentSurface.pageShell}>
            {/* Top Container */}
            <motion.div
                data-swipe-tabs="library"
                className={contentSurface.headerHero}
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
                    <LayoutGroup id="library-subtabs">
                        <div data-library-subtabs="true" className={contentSurface.workspaceTabList} role="tablist" aria-label={libraryCopy.sections}>
                            {libraryTabs.map(tab => {
                                const isActive = librarySubTab === tab.key;
                                return (
                                    <button
                                        key={tab.key}
                                        id={`library-tab-${tab.key}`}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        aria-controls={`library-panel-${tab.key}`}
                                        tabIndex={isActive ? 0 : -1}
                                        onClick={() => setLibrarySubTab(tab.key)}
                                        onKeyDown={event => {
                                            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                                            event.preventDefault();
                                            const direction = event.key === 'ArrowRight' ? 1 : -1;
                                            const currentIndex = libraryTabOrder.indexOf(tab.key);
                                            const nextTab = libraryTabOrder[(currentIndex + direction + libraryTabOrder.length) % libraryTabOrder.length];
                                            setLibrarySubTab(nextTab);
                                            window.requestAnimationFrame(() => document.getElementById(`library-tab-${nextTab}`)?.focus());
                                        }}
                                        className={`${contentSurface.workspaceTabButton} flex-1 ${isActive ? 'text-primary' : 'text-muted hover:bg-black/[0.035] hover:text-primary dark:hover:bg-white/[0.055]'}`}
                                    >
                                        {isActive && <ActiveIndicator className={contentSurface.workspaceTabIndicator} />}
                                        <span className="relative z-10 flex min-w-0 items-center gap-1 sm:gap-2">
                                            <span className="shrink-0">{tab.icon}</span>
                                            <span className="truncate">{tab.label}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </LayoutGroup>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={librarySubTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className={contentSurface.workspaceHeaderGrid}
                        >
                            <div className="min-w-0 flex-1">
                                <h2 className={contentSurface.workspaceHeaderTitle}>{activeLibraryHeader.title}</h2>
                                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{activeLibraryHeader.description}</p>
                                <div className="mt-5 grid grid-cols-2 gap-2" aria-label={activeLibraryHeader.title}>
                                    {activeLibraryHeader.metrics.map(metric => (
                                        <div key={metric.label} className={contentSurface.workspaceMetric}>
                                            <div className="text-[11px] font-medium text-muted">{metric.label}</div>
                                            <div className="mt-0.5 text-lg font-semibold tabular-nums text-primary">{metric.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex min-w-0 flex-col gap-2 sm:min-w-60">
                                {librarySubTab === 'journal' && (
                                    <div
                                        data-swipe-date="library-journal-month"
                                        className={contentSurface.workspacePeriodControl}
                                        onTouchStart={journalDateSwipeHandlers.onTouchStart}
                                        onTouchMove={journalDateSwipeHandlers.onTouchMove}
                                        onTouchEnd={journalDateSwipeHandlers.onTouchEnd}
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            <button onClick={() => changeJournalMonth(-1)} aria-label={isEnglish ? 'Previous month' : 'Bulan sebelumnya'} className={contentSurface.workspacePeriodButton}>
                                                <ChevronLeft className="h-4 w-4" />
                                            </button>
                                            <AnimatePresence mode="wait" custom={journalDirection} initial={false}>
                                                <motion.div
                                                    key={`${journalDate.getFullYear()}-${journalDate.getMonth()}`}
                                                    data-library-journal-month-label="true"
                                                    custom={journalDirection}
                                                    variants={directionalLabelVariants}
                                                    initial="hidden"
                                                    animate="visible"
                                                    exit="exit"
                                                    className={contentSurface.workspacePeriodLabel}
                                                >
                                                    <span className={contentSurface.workspacePeriodKicker}>{libraryCopy.journalMonth}</span>
                                                    <span className={contentSurface.workspacePeriodTitle}>{journalDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</span>
                                                </motion.div>
                                            </AnimatePresence>
                                            <button onClick={() => changeJournalMonth(1)} aria-label={isEnglish ? 'Next month' : 'Bulan berikutnya'} className={contentSurface.workspacePeriodButton}>
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <button
                                    data-library-add-button="true"
                                    onClick={() => {
                                        if (librarySubTab === 'general') onAddItem(ItemType.NOTE);
                                        if (librarySubTab === 'skills') handleOpenAddSkill();
                                        if (librarySubTab === 'journal') onAddItem(ItemType.JOURNAL);
                                    }}
                                    className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 transition-colors hover:bg-indigo-500"
                                >
                                    <Plus className="w-5 h-5" />
                                    <span>{librarySubTab === 'general' ? libraryCopy.addNote : librarySubTab === 'skills' ? libraryCopy.addSkill : libraryCopy.writeJournal}</span>
                                </button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
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
                    className={`flex ${isDragging ? 'will-change-transform' : ''}`}
                    style={{
                        transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
                        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                    }}
                >
                {/* VIEW: General Notes */}
                <motion.div
                    id="library-panel-general"
                    role="tabpanel"
                    aria-labelledby="library-tab-general"
                    aria-hidden={librarySubTab !== 'general'}
                    inert={librarySubTab !== 'general'}
                    initial={false}
                    className={`w-full flex-shrink-0 overflow-hidden ${contentSurface.contentPad} ${librarySubTab !== 'general' ? 'pointer-events-none' : ''}`}
                >
                    {renderContent(generalItems, 'general')}
                </motion.div>

                {/* VIEW: Skills */}
                <motion.div
                    id="library-panel-skills"
                    role="tabpanel"
                    aria-labelledby="library-tab-skills"
                    aria-hidden={librarySubTab !== 'skills'}
                    inert={librarySubTab !== 'skills'}
                    initial={false}
                    className={`w-full flex-shrink-0 overflow-hidden ${contentSurface.contentPad} ${librarySubTab !== 'skills' ? 'pointer-events-none' : ''}`}
                >
                    {renderSkills()}
                </motion.div>

                {/* VIEW: Journal */}
                <motion.div
                    id="library-panel-journal"
                    role="tabpanel"
                    aria-labelledby="library-tab-journal"
                    aria-hidden={librarySubTab !== 'journal'}
                    inert={librarySubTab !== 'journal'}
                    initial={false}
                    className={`w-full flex-shrink-0 overflow-hidden ${contentSurface.contentPad} ${librarySubTab !== 'journal' ? 'pointer-events-none' : ''}`}
                >
                    {renderContent(journalItems, 'journal')}
                </motion.div>
                </motion.div>
            </motion.div>

            <PresencePanel
                isOpen={Boolean(selectedLibraryItem)}
                onClose={() => setSelectedLibraryItemId(null)}
                overlayClassName={contentSurface.workspaceDetailOverlay}
                panelClassName={contentSurface.workspaceDetailPanel}
                presentation="sheet"
                ariaLabel={libraryCopy.itemDetail}
            >
                <div className={contentSurface.workspaceDetailHeader}>
                    <div className="min-w-0">
                        <div className={contentSurface.workspaceDetailEyebrow}>{libraryCopy.editEntry}</div>
                        <h2 className="mt-1 truncate text-lg font-semibold text-primary">
                            {selectedLibraryItem?.meta.title || selectedLibraryItem?.content || libraryCopy.itemDetail}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSelectedLibraryItemId(null)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-soft hover:text-primary"
                        aria-label={libraryCopy.closeDetail}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className={contentSurface.workspaceDetailBody}>
                    {selectedLibraryItem && (
                        <Card
                            key={selectedLibraryItem.id}
                            item={selectedLibraryItem}
                            onUpdate={handleUpdateItem}
                            onDelete={id => {
                                handleDelete(id);
                                setSelectedLibraryItemId(null);
                            }}
                            enableCollapse={false}
                            defaultCollapsed={false}
                            hideMoney={appSettings.hideMoney}
                            skills={skills}
                            noStrikethrough={selectedLibraryItem.type === ItemType.JOURNAL}
                            noDarken={selectedLibraryItem.type === ItemType.JOURNAL}
                            onSaveComplete={() => setSelectedLibraryItemId(null)}
                            className="border-0 shadow-none ring-0 hover:shadow-none"
                        />
                    )}
                </div>
            </PresencePanel>

            <PresencePanel
                isOpen={Boolean(editingSkillSession)}
                onClose={closeSkillSessionEditor}
                overlayClassName={responsiveModal.sheetOverlay}
                panelClassName={`${responsiveModal.formPanel} max-w-md p-5`}
                presentation="form"
                ariaLabel={libraryCopy.editSession}
            >
                {editingSkillSession && (
                    <>
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-primary truncate">{editingSkillSession.skill.name}</h3>
                                     <p className="mt-1 text-xs text-muted">{formatSessionDateTime(editingSkillSession.session.start)} - {editingSkillSession.session.end.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeSkillSessionEditor}
                                    className="rounded-xl bg-background border border-border px-3 py-2 text-xs font-bold text-muted hover:text-primary transition-colors"
                                >
                                    {libraryCopy.close}
                                </button>
                            </div>

                            <div className="mt-5 space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-muted">{libraryCopy.actualStart}</label>
                                    <input
                                        type="datetime-local"
                                        value={actualStartInput}
                                        onChange={(event) => setActualStartInput(event.target.value)}
                                        className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm font-medium text-primary outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted">{libraryCopy.actualEnd}</label>
                                    <input
                                        type="datetime-local"
                                        value={actualEndInput}
                                        onChange={(event) => setActualEndInput(event.target.value)}
                                        className="mt-2 w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm font-medium text-primary outline-none focus:border-indigo-500"
                                    />
                                </div>
                                {modalActualStart && modalActualEnd && modalActualEnd > modalActualStart && (
                                    <div className="rounded-2xl bg-background border border-border p-3 text-xs text-muted">
                                        {libraryCopy.duration}: <span className="font-bold text-primary">{Math.round((modalActualEnd.getTime() - modalActualStart.getTime()) / 60000)}m {libraryCopy.session}</span>
                                    </div>
                                )}
                                {isSkillSessionSaveDisabled && (
                                    <p className="text-xs font-medium text-red-500">{libraryCopy.invalidActual}</p>
                                )}
                            </div>

                            <div className="mt-6 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeSkillSessionEditor}
                                    className="rounded-2xl border border-border bg-background px-4 py-2 text-sm font-bold text-muted hover:text-primary transition-colors"
                                >
                                    {libraryCopy.cancel}
                                </button>
                                <button
                                    type="button"
                                    onClick={saveSkillSessionActualTime}
                                    disabled={isSkillSessionSaveDisabled}
                                    className="rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {libraryCopy.saveActual}
                                </button>
                            </div>
                    </>
                )}
            </PresencePanel>
        </div>
    );
};

export default LibraryView;
