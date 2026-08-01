import React, { useMemo, useState } from 'react';
import { BrainDumpItem, ItemType, AppSettings, Tab } from '../../types';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Calendar as CalendarIcon, Plus, X } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useSwipeDate } from '../../hooks/useSwipeDate';
import { contentSurface, responsiveModal } from '../layout/contentSurface';
import { getShoppingDueDate } from '../../utils/shoppingDateUtils';
import PresencePanel from '../../motion/PresencePanel';
import ActiveIndicator from '../../motion/ActiveIndicator';
import { getAppLocale, normalizeAppLanguage } from '../../utils/i18n';
import {
    highlightedListItemVariants,
    staggerContainerVariants,
} from '../../motion/variants';

interface CalendarViewProps {
    items: BrainDumpItem[];
    handleToggleStatus: (id: string) => void;
    handleDelete: (id: string, type: 'item' | 'wallet' | 'skill') => void;
    appSettings: AppSettings;
    setActiveTab: (tab: Tab) => void;
    handleOpenAddTask?: (date: string) => void;
}

const WEEK_DAYS = {
    id: ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
} as const;

const getDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const isSameDay = (left: Date, right: Date) => (
    left.getDate() === right.getDate() &&
    left.getMonth() === right.getMonth() &&
    left.getFullYear() === right.getFullYear()
);

const getItemTypeLabel = (type: ItemType, isEnglish: boolean) => {
    switch (type) {
        case ItemType.TODO:
            return isEnglish ? 'Task' : 'Tugas';
        case ItemType.EVENT:
            return isEnglish ? 'Event' : 'Acara';
        case ItemType.SHOPPING:
            return isEnglish ? 'Shopping' : 'Belanja';
        default:
            return isEnglish ? 'Item' : 'Item';
    }
};

const CalendarView: React.FC<CalendarViewProps> = ({ items, handleToggleStatus, handleDelete, appSettings, setActiveTab, handleOpenAddTask }) => {
    const isEnglish = normalizeAppLanguage(appSettings.language) === 'en';
    const locale = getAppLocale(appSettings.language);
    const calendarCopy = isEnglish ? {
        title: 'Calendar', subtitle: 'Plans, routines, and upcoming commitments', today: 'Today', month: 'Month', agenda: 'Agenda',
        scheduled: 'Scheduled', done: 'Done', routine: 'Routine', busiest: 'Busiest', selectedAgenda: 'Selected agenda', chooseDate: 'Choose a date',
        noItems: 'No scheduled items for this date.', itemDetail: 'Item detail', type: 'Type', status: 'Status', schedule: 'Schedule', tags: 'Tags',
        previousMonth: 'Previous month', nextMonth: 'Next month', add: 'Add for this date', selectDate: 'Select', until: 'until',
        markPending: 'Mark pending', markDone: 'Mark done', pending: 'Pending', calendarSections: 'Calendar views',
    } : {
        title: 'Kalender', subtitle: 'Agenda, rutinitas, dan komitmen mendatang', today: 'Hari ini', month: 'Bulan', agenda: 'Agenda',
        scheduled: 'Terjadwal', done: 'Selesai', routine: 'Rutinitas', busiest: 'Terpadat', selectedAgenda: 'Agenda terpilih', chooseDate: 'Pilih tanggal',
        noItems: 'Belum ada agenda untuk tanggal ini.', itemDetail: 'Detail agenda', type: 'Jenis', status: 'Status', schedule: 'Jadwal', tags: 'Tag',
        previousMonth: 'Bulan sebelumnya', nextMonth: 'Bulan berikutnya', add: 'Tambah untuk tanggal ini', selectDate: 'Pilih', until: 'sampai',
        markPending: 'Tandai belum selesai', markDone: 'Tandai selesai', pending: 'Belum selesai', calendarSections: 'Tampilan kalender',
    };
    const weekDays = isEnglish ? WEEK_DAYS.en : WEEK_DAYS.id;
    const [currentDate, setCurrentDate] = useState(new Date());
    const [monthDirection, setMonthDirection] = useState(0);
    const [selectedDateKey, setSelectedDateKey] = useState(() => getDateKey(new Date()));
    const [selectedItem, setSelectedItem] = useState<BrainDumpItem | null>(null);
    const [viewMode, setViewMode] = useState<'month' | 'agenda'>(() =>
        typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'agenda' : 'month'
    );
    const swipeHandlers = useSwipeTabs('calendar', setActiveTab);

    const nextMonth = () => {
        const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        setMonthDirection(1);
        setSelectedDateKey(getDateKey(nextDate));
        setCurrentDate(nextDate);
    };

    const prevMonth = () => {
        const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        setMonthDirection(-1);
        setSelectedDateKey(getDateKey(nextDate));
        setCurrentDate(nextDate);
    };

    const goToToday = () => {
        const now = new Date();
        const currentKey = currentDate.getFullYear() * 12 + currentDate.getMonth();
        const nextKey = now.getFullYear() * 12 + now.getMonth();
        setMonthDirection(Math.sign(nextKey - currentKey));
        setSelectedDateKey(getDateKey(now));
        setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    };

    const calendarDateSwipeHandlers = useSwipeDate(prevMonth, nextMonth);

    const today = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

    const getItemsForDate = (date: Date): BrainDumpItem[] => {
        return items.flatMap<BrainDumpItem>((item) => {
            if (item.type !== ItemType.TODO && item.type !== ItemType.EVENT && item.type !== ItemType.SHOPPING) {
                return [];
            }

            if (item.meta.hideFromCalendar) {
                return [];
            }

            if (item.meta.isRoutine || item.meta.shoppingCategory === 'routine') {
                const anchorStr = item.meta.start || (item.type === ItemType.SHOPPING ? getShoppingDueDate(item) : (item.meta.date || item.meta.dateTime)) || item.created_at;
                const anchorDate = anchorStr ? new Date(anchorStr) : new Date(item.created_at);
                anchorDate.setHours(0, 0, 0, 0);

                const compareDate = new Date(date);
                compareDate.setHours(12, 0, 0, 0);

                const interval = item.meta.routineInterval;
                let occursOnDate = false;

                if (interval === 'daily') occursOnDate = compareDate >= anchorDate;
                else if (interval === 'weekly' && item.meta.routineDaysOfWeek) {
                    occursOnDate = compareDate >= anchorDate && item.meta.routineDaysOfWeek.includes(compareDate.getDay());
                } else if (interval === 'monthly' && item.meta.routineDaysOfMonth) {
                    occursOnDate = compareDate >= anchorDate && item.meta.routineDaysOfMonth.includes(compareDate.getDate());
                } else if (interval === 'yearly' && item.meta.routineMonthsOfYear && item.meta.routineDaysOfMonth) {
                    occursOnDate = compareDate >= anchorDate &&
                        item.meta.routineMonthsOfYear.includes(compareDate.getMonth()) &&
                        item.meta.routineDaysOfMonth.includes(compareDate.getDate());
                } else if (!interval && item.meta.recurrenceDays) {
                    const diffDays = Math.floor((compareDate.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
                    occursOnDate = diffDays >= 0 && diffDays % item.meta.recurrenceDays === 0;
                } else if (!interval) {
                    occursOnDate = isSameDay(anchorDate, compareDate);
                }

                if (!occursOnDate) return [];

                const completedDate = item.completed_at ? new Date(item.completed_at) : null;
                if (completedDate) completedDate.setHours(0, 0, 0, 0);

                const occurrenceStatus: BrainDumpItem['status'] = completedDate && isSameDay(completedDate, compareDate)
                    ? 'done'
                    : 'pending';

                return [{
                    ...item,
                    status: occurrenceStatus,
                    completed_at: occurrenceStatus === 'done' ? item.completed_at : undefined,
                    meta: {
                        ...item.meta,
                        date: compareDate.toISOString()
                    }
                }];
            }

            const startStr = item.meta.start;
            const endStr = item.meta.end;
            const dateStr = item.type === ItemType.SHOPPING ? getShoppingDueDate(item) : (item.meta.date || item.meta.dateTime);

            if (startStr) {
                const startDate = new Date(startStr);
                startDate.setHours(0, 0, 0, 0);

                let endDate = new Date(startStr);
                if (endStr) {
                    endDate = new Date(endStr);
                }
                endDate.setHours(23, 59, 59, 999);

                const compareDate = new Date(date);
                compareDate.setHours(12, 0, 0, 0);

                return compareDate >= startDate && compareDate <= endDate ? [item] : [];
            }

            if (dateStr) {
                const itemDate = new Date(dateStr);
                return isSameDay(itemDate, date) ? [item] : [];
            }

            return [];
        });
    };

    const calendarDays = useMemo(() => {
        const days: { date: Date; isCurrentMonth: boolean; items: BrainDumpItem[] }[] = [];

        const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const date = new Date(currentYear, currentMonth - 1, prevMonthDays - i);
            days.push({
                date,
                isCurrentMonth: false,
                items: getItemsForDate(date),
            });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(currentYear, currentMonth, i);
            days.push({
                date,
                isCurrentMonth: true,
                items: getItemsForDate(date),
            });
        }

        const remainingCells = 42 - days.length;
        for (let i = 1; i <= remainingCells; i++) {
            const date = new Date(currentYear, currentMonth + 1, i);
            days.push({
                date,
                isCurrentMonth: false,
                items: getItemsForDate(date),
            });
        }

        return days;
    }, [currentMonth, currentYear, daysInMonth, firstDayOfMonth, items]);

    const currentMonthCells = calendarDays.filter(day => day.isCurrentMonth);
    const scheduledCount = currentMonthCells.reduce((sum, day) => sum + day.items.length, 0);
    const doneCount = currentMonthCells.reduce((sum, day) => sum + day.items.filter(item => item.status === 'done').length, 0);
    const routineCount = currentMonthCells.reduce((sum, day) => sum + day.items.filter(item => item.meta.isRoutine || item.meta.shoppingCategory === 'routine').length, 0);
    const busiestDay = currentMonthCells.reduce<{ date: Date | null; count: number }>((best, day) => {
        if (day.items.length > best.count) {
            return { date: day.date, count: day.items.length };
        }
        return best;
    }, { date: null, count: 0 });

    const selectedItemDate = selectedItem?.meta.start || selectedItem?.meta.date || selectedItem?.meta.dateTime;
    const selectedDay = calendarDays.find(day => getDateKey(day.date) === selectedDateKey);
    const selectedAgendaItems = selectedDay?.items || [];

    return (
        <div className={contentSurface.pageShell}>
            <motion.div
                data-swipe-tabs="calendar"
                className={contentSurface.headerHero}
                onTouchStart={swipeHandlers.onTouchStart}
                onTouchMove={swipeHandlers.onTouchMove}
                onTouchEnd={swipeHandlers.onTouchEnd}
                style={{ x: swipeHandlers.dragOffset }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                            <CalendarIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-primary">{calendarCopy.title}</h1>
                            <p className="text-xs text-muted">{calendarCopy.subtitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={goToToday}
                        className="shrink-0 whitespace-nowrap rounded-xl border border-border/70 bg-background/55 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:border-indigo-500/25"
                    >
                        {calendarCopy.today}
                    </button>
                </div>

                <div className={`${contentSurface.workspaceTabList} mb-5 overflow-visible`} role="tablist" aria-label={calendarCopy.calendarSections}>
                    {(['month', 'agenda'] as const).map(mode => (
                        <button
                            key={mode}
                            id={`calendar-tab-${mode}`}
                            type="button"
                            role="tab"
                            aria-selected={viewMode === mode}
                            onClick={() => setViewMode(mode)}
                            className={`${contentSurface.workspaceTabButton} flex-1 ${viewMode === mode ? 'text-primary' : 'text-muted hover:bg-black/[0.035] hover:text-primary dark:hover:bg-white/[0.055]'}`}
                        >
                            {viewMode === mode && <ActiveIndicator className={contentSurface.workspaceTabIndicator} />}
                            <span className="relative z-10">{mode === 'month' ? calendarCopy.month : calendarCopy.agenda}</span>
                        </button>
                    ))}
                </div>

                <div
                    data-swipe-date="calendar-month"
                    className={`${contentSurface.workspacePeriodControl} mb-4 sm:w-full`}
                    onTouchStart={calendarDateSwipeHandlers.onTouchStart}
                    onTouchMove={calendarDateSwipeHandlers.onTouchMove}
                    onTouchEnd={calendarDateSwipeHandlers.onTouchEnd}
                >
                    <div className="flex items-center justify-between gap-1">
                        <button onClick={prevMonth} aria-label={calendarCopy.previousMonth} className={contentSurface.workspacePeriodButton}>
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <AnimatePresence initial={false} mode="wait" custom={monthDirection}>
                            <motion.div
                                key={`${currentYear}-${currentMonth}`}
                                custom={monthDirection}
                                initial={{ opacity: 0, x: monthDirection * 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: monthDirection * -8 }}
                                className={contentSurface.workspacePeriodLabel}
                            >
                                <span className={contentSurface.workspacePeriodKicker}>{calendarCopy.month}</span>
                                <span className={contentSurface.workspacePeriodTitle}>{currentDate.toLocaleString(locale, { month: 'long', year: 'numeric' })}</span>
                            </motion.div>
                        </AnimatePresence>
                        <button onClick={nextMonth} aria-label={calendarCopy.nextMonth} className={contentSurface.workspacePeriodButton}>
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className={contentSurface.workspaceMetric}>
                        <div className="text-xs font-medium text-muted">{calendarCopy.scheduled}</div>
                        <div className="mt-1 text-lg font-semibold text-primary">{scheduledCount}</div>
                    </div>
                    <div className={contentSurface.workspaceMetric}>
                        <div className="text-xs font-medium text-muted">{calendarCopy.done}</div>
                        <div className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-300">{doneCount}</div>
                    </div>
                    <div className={contentSurface.workspaceMetric}>
                        <div className="text-xs font-medium text-muted">{calendarCopy.routine}</div>
                        <div className="mt-1 text-lg font-semibold text-indigo-600 dark:text-indigo-300">{routineCount}</div>
                    </div>
                    <div className={contentSurface.workspaceMetric}>
                        <div className="text-xs font-medium text-muted">{calendarCopy.busiest}</div>
                        <div className="mt-1 text-sm font-semibold text-primary">
                            {busiestDay.date ? `${busiestDay.date.getDate()} (${busiestDay.count})` : '—'}
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className={`${contentSurface.contentPad} pb-2 pt-3`} data-ndz-calendar-width-policy="validated-standard-cap">
                {viewMode === 'month' && (
                <div className={contentSurface.calendarFrame}>
                    <div className="grid grid-cols-7 border-b border-border bg-background/40">
                        {weekDays.map(day => (
                            <div key={day} className="py-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                                <span className="sm:hidden">{day.slice(0, 1)}</span>
                                <span className="hidden sm:inline">{day}</span>
                            </div>
                        ))}
                    </div>

                    <LayoutGroup id="calendar-selected-date">
                    <div className="relative overflow-hidden">
                        <AnimatePresence initial={false} mode="popLayout" custom={monthDirection}>
                            <motion.div
                                key={`${currentYear}-${currentMonth}`}
                                custom={monthDirection}
                                initial={{ opacity: 0, x: monthDirection * 12 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: monthDirection * -12 }}
                                className="grid grid-cols-7 auto-rows-[minmax(132px,auto)] sm:auto-rows-[minmax(148px,auto)] lg:auto-rows-[minmax(168px,auto)]"
                            >
                            {calendarDays.map((dayObj, idx) => {
                            const isToday = dayObj.date.getDate() === today.getDate() &&
                                dayObj.date.getMonth() === today.getMonth() &&
                                dayObj.date.getFullYear() === today.getFullYear();
                            const isSelected = getDateKey(dayObj.date) === selectedDateKey;

                            const visibleItems = dayObj.items.slice(0, 4);
                            const hiddenCount = Math.max(0, dayObj.items.length - visibleItems.length);

                            return (
                                <div
                                    key={`${getDateKey(dayObj.date)}-${idx}`}
                                    className={[
                                        'min-w-0 border-r border-b border-border/80 px-1 py-1.5 lg:px-2 lg:py-2 flex flex-col gap-1 overflow-hidden transition-colors last:border-r-0',
                                        idx % 7 === 6 ? 'border-r-0' : '',
                                        dayObj.isCurrentMonth
                                            ? 'bg-surface/70'
                                            : 'bg-background/30 text-muted/50',
                                        isToday ? 'bg-indigo-500/5' : '',
                                        isSelected ? 'bg-indigo-500/[0.07] ring-2 ring-inset ring-indigo-500/35' : '',
                                    ].join(' ')}
                                >
                                    <div className="flex items-center justify-between min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedDateKey(getDateKey(dayObj.date))}
                                            aria-pressed={isSelected}
                                            aria-label={`${calendarCopy.selectDate} ${dayObj.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
                                            className={[
                                                'relative flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none transition-colors',
                                                isSelected ? 'text-white' : isToday ? 'bg-primary text-background' : dayObj.isCurrentMonth ? 'text-primary hover:bg-indigo-500/10' : 'text-muted/50 hover:bg-indigo-500/10',
                                            ].join(' ')}
                                        >
                                            {isSelected && (
                                                <ActiveIndicator
                                                    layoutId="calendar-date-highlight"
                                                    className="absolute inset-0 rounded-full bg-indigo-600 shadow-sm"
                                                />
                                            )}
                                            <span className="relative z-10">{dayObj.date.getDate()}</span>
                                        </button>
                                        {hiddenCount > 0 && (
                                            <div className="text-[9px] font-semibold text-muted">
                                                +{hiddenCount}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-1 overflow-hidden">
                                        {visibleItems.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => {
                                                    setSelectedDateKey(getDateKey(dayObj.date));
                                                    setSelectedItem(item);
                                                }}
                                                className={[
                                                    'block w-full min-w-0 rounded-md px-1.5 py-1 lg:px-2 text-left text-[9px] lg:text-[10px] leading-[1.15] transition-colors',
                                                    item.status === 'done'
                                                        ? 'bg-muted/10 text-muted line-through opacity-70'
                                                        : item.type === ItemType.EVENT
                                                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25'
                                                            : item.type === ItemType.SHOPPING
                                                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
                                                                : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/25',
                                                ].join(' ')}
                                                title={`${getItemTypeLabel(item.type, isEnglish)} · ${item.content}`}
                                            >
                                                <span className="line-clamp-2 break-words font-medium">
                                                    {item.content}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                            })}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                    </LayoutGroup>
                </div>
                )}

                <section className={`${viewMode === 'month' ? 'mt-4' : ''} ${contentSurface.workspaceCard}`} aria-label={calendarCopy.selectedAgenda}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs font-semibold text-muted">{calendarCopy.selectedAgenda}</div>
                            <h2 className="mt-1 text-base font-semibold text-primary">
                                {selectedDay?.date.toLocaleDateString(locale, {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                }) || calendarCopy.chooseDate}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-bold text-indigo-600">
                                {selectedAgendaItems.length}
                            </span>
                            {handleOpenAddTask && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenAddTask(selectedDateKey)}
                                    className="flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">{calendarCopy.add}</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <AnimatePresence initial={false} mode="wait">
                        <motion.div
                            key={selectedDateKey}
                            variants={staggerContainerVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="space-y-2"
                        >
                            {selectedAgendaItems.length > 0 ? (
                                selectedAgendaItems.map(item => (
                                    <motion.button
                                        key={item.id}
                                        type="button"
                                        variants={highlightedListItemVariants}
                                        onClick={() => setSelectedItem(item)}
                                        className={`flex w-full items-center justify-between gap-3 rounded-2xl p-3 text-left ${contentSurface.workspaceListRow}`}
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
                                                {getItemTypeLabel(item.type, isEnglish)}
                                            </span>
                                            <span className={`mt-1 block truncate text-sm font-semibold ${item.status === 'done' ? 'text-muted line-through' : 'text-primary'}`}>
                                                {item.content}
                                            </span>
                                        </span>
                                        {item.status === 'done' ? (
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                        ) : (
                                            <Circle className="h-4 w-4 shrink-0 text-indigo-500" />
                                        )}
                                    </motion.button>
                                ))
                            ) : (
                                <motion.div
                                    variants={highlightedListItemVariants}
                                    className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted"
                                >
                                    {calendarCopy.noItems}
                                </motion.div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </section>
            </div>

            <PresencePanel
                isOpen={Boolean(selectedItem)}
                onClose={() => setSelectedItem(null)}
                overlayClassName={responsiveModal.sheetOverlay}
                panelClassName={`${responsiveModal.formPanel} lg:max-w-xl`}
                ariaLabel={calendarCopy.itemDetail}
            >
                {selectedItem && (
                    <>
                            <div className="flex items-center justify-between border-b border-border px-4 py-4">
                                <div>
                                    <div className="text-xs font-semibold text-muted">{calendarCopy.itemDetail}</div>
                                    <div className="mt-1 text-base font-semibold text-primary">{selectedItem.content}</div>
                                </div>
                                <button onClick={() => setSelectedItem(null)} className="rounded-full border border-border p-2 text-muted transition-colors hover:bg-muted/10 hover:text-primary">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="space-y-4 p-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-border p-3">
                                        <div className="text-xs font-medium text-muted">{calendarCopy.type}</div>
                                        <div className="mt-1 text-sm font-semibold text-primary">{getItemTypeLabel(selectedItem.type, isEnglish)}</div>
                                    </div>
                                    <div className="rounded-2xl border border-border p-3">
                                        <div className="text-xs font-medium text-muted">{calendarCopy.status}</div>
                                        <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-primary">
                                            {selectedItem.status === 'done' ? (
                                                <CheckCircle2 className="h-4 w-4" />
                                            ) : (
                                                <Circle className="h-4 w-4" />
                                            )}
                                            {selectedItem.status === 'done' ? calendarCopy.done : calendarCopy.pending}
                                        </div>
                                    </div>
                                </div>

                                {selectedItemDate && (
                                    <div className="rounded-2xl border border-border p-3">
                                        <div className="text-xs font-medium text-muted">{calendarCopy.schedule}</div>
                                        <div className="mt-1 text-sm text-primary">
                                            {new Date(selectedItemDate).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                        {selectedItem.meta.end && (
                                            <div className="text-xs text-muted">
                                                {calendarCopy.until} {new Date(selectedItem.meta.end).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedItem.meta.tags && selectedItem.meta.tags.length > 0 && (
                                    <div className="rounded-2xl border border-border p-3">
                                        <div className="text-xs font-medium text-muted">{calendarCopy.tags}</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {selectedItem.meta.tags.map(tag => (
                                                <span key={tag} className="rounded-full border border-border px-2 py-1 text-xs text-primary">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 border-t border-border pt-4">
                                    <button
                                        onClick={() => {
                                            handleToggleStatus(selectedItem.id);
                                            setSelectedItem({ ...selectedItem, status: selectedItem.status === 'done' ? 'pending' : 'done' });
                                        }}
                                        className="rounded-full border border-border px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted/10"
                                    >
                                        {selectedItem.status === 'done' ? calendarCopy.markPending : calendarCopy.markDone}
                                    </button>
                                </div>
                            </div>
                    </>
                )}
            </PresencePanel>
        </div>
    );
};

export default CalendarView;
