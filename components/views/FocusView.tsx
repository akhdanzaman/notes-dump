import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Sprout, Pencil, Trash2, Plus, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { BrainDumpItem, FocusSubTab, Skill, AppSettings, FinanceType, Wallet, BudgetRule, Tab } from '../../types';
import { getFocusMonthData, getSkillItems } from '../../utils/selectors';
import Card from '../Card';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useSwipeDate } from '../../hooks/useSwipeDate';

interface FocusViewProps {
    items: BrainDumpItem[];
    skills: Skill[];
    focusSubTab: FocusSubTab;
    setFocusSubTab: (tab: FocusSubTab) => void;
    
    focusDate: Date;
    setFocusDate: (d: Date) => void;
    
    appSettings: AppSettings;
    handleToggleStatus: (id: string) => void;
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
        newRoutineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly',
        newRoutineDaysOfWeek?: number[],
        newRoutineDaysOfMonth?: number[],
        newRoutineMonthsOfYear?: number[]
    ) => void;
    handleOpenAddRoutine: () => void;
    handleOpenAddTask: (initialDate?: string) => void;
    handleOpenEditSkill: (id: string, name: string, target?: number) => void;
    handleOpenAddSkill: () => void;
    setDeleteId: (id: string) => void;
    setDeleteType: (type: 'skill' | 'wallet' | null) => void;
    
    searchQuery: string;
    selectedTag: string;
    
    // Context
    wallets: Wallet[];
    budgetRules: BudgetRule[];
    handleResetRoutine: (id: string) => void;
    setActiveTab: (tab: Tab) => void;
}

const FocusView: React.FC<FocusViewProps> = ({
    items, skills, focusSubTab, setFocusSubTab,
    focusDate, setFocusDate,
    appSettings, handleToggleStatus, handleDelete, handleUpdateItem,
    handleOpenAddRoutine, handleOpenAddTask, handleOpenEditSkill, handleOpenAddSkill, setDeleteId, setDeleteType,
    searchQuery, selectedTag,
    wallets, budgetRules, handleResetRoutine, setActiveTab
}) => {
    
    // Data Preparation
    const { summary, pendingGroups, doneList } = getFocusMonthData(items, focusDate, searchQuery, selectedTag);
    const { today, tomorrow, later, routines } = pendingGroups;
    const { stats, logs } = getSkillItems(items, skills);

    // Main Tab Swipe Logic
    const swipeHandlers = useSwipeTabs('focus', setActiveTab);

    // Date Swipe Logic
    const changeMonth = (offset: number) => {
        const newDate = new Date(focusDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setFocusDate(newDate);
    };

    const dateSwipeHandlers = useSwipeDate(
        () => changeMonth(-1),
        () => changeMonth(1)
    );

    // Sub-Tab Swipe State
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartRef = React.useRef<{ x: number, y: number } | null>(null);
    const isHorizontalSwipe = React.useRef<boolean | null>(null);

    const tabs: FocusSubTab[] = ['tasks', 'skills'];
    const activeIndex = tabs.indexOf(focusSubTab);

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
            if ((activeIndex === 0 && dx > 0) || (activeIndex === tabs.length - 1 && dx < 0)) {
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
            if (dragOffset < 0 && activeIndex < tabs.length - 1) {
                setFocusSubTab(tabs[activeIndex + 1]);
            }
            if (dragOffset > 0 && activeIndex > 0) {
                setFocusSubTab(tabs[activeIndex - 1]);
            }
        }
        
        setDragOffset(0);
        touchStartRef.current = null;
        isHorizontalSwipe.current = null;
    };

    const cardProps = {
        onToggleStatus: handleToggleStatus,
        onUpdate: handleUpdateItem,
        onDelete: handleDelete,
        enableCollapse: true,
        defaultCollapsed: appSettings.defaultCollapsed,
        hideMoney: appSettings.hideMoney,
        skills,
        wallets,
        budgetRules,
        onResetRoutine: handleResetRoutine
    };

    return (
        <div className="min-h-[50vh] overflow-hidden pb-20">
            {/* Top Container */}
            <motion.div 
                layoutId="top-container"
                className="bg-white dark:bg-zinc-100 text-black rounded-b-[32px] p-6 pt-12 shadow-sm mb-4 touch-pan-y"
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
                    <div className="flex bg-black/5 rounded-2xl p-1 mb-6">
                        <button 
                            onClick={() => setFocusSubTab('tasks')}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${focusSubTab === 'tasks' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-black/40 hover:text-black'}`}
                        >
                            <CheckCircle2 className="w-4 h-4" /> Tasks
                        </button>
                        <button 
                            onClick={() => setFocusSubTab('skills')}
                            className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${focusSubTab === 'skills' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-black/40 hover:text-black'}`}
                        >
                            <Sprout className="w-4 h-4" /> Skill Growth
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={focusSubTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2, ease: "linear" }}
                        >
                            {focusSubTab === 'tasks' ? (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <h1 className="text-3xl font-bold tracking-tight">Focus</h1>
                                        <div className="flex items-center gap-2">
                                            <div 
                                                className="flex items-center bg-black/5 rounded-full p-1 touch-pan-y"
                                                onTouchStart={dateSwipeHandlers.onTouchStart}
                                                onTouchMove={dateSwipeHandlers.onTouchMove}
                                                onTouchEnd={dateSwipeHandlers.onTouchEnd}
                                            >
                                                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-black/5 rounded-full"><ChevronLeft className="w-4 h-4" /></button>
                                                <AnimatePresence mode="wait">
                                                    <motion.span 
                                                        key={focusDate.toISOString()}
                                                        initial={{ opacity: 0, x: 10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -10 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="px-2 text-sm font-bold"
                                                    >
                                                        {focusDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                                                    </motion.span>
                                                </AnimatePresence>
                                                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-black/5 rounded-full"><ChevronRight className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold opacity-60 uppercase tracking-wider mb-1">To Do</p>
                                            <p className="text-3xl font-bold">{summary.todo}</p>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold opacity-60 uppercase tracking-wider mb-1">Done</p>
                                            <p className="text-3xl font-bold">{summary.done}</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <h1 className="text-3xl font-bold tracking-tight">Skills</h1>
                                        <button onClick={handleOpenAddSkill} className="p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors">
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <p className="text-lg font-medium opacity-80">
                                        Track your learning progress
                                    </p>
                                </>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </motion.div>
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
                    {/* VIEW: Tasks */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full flex-shrink-0 px-4"
                    >
                        <div className="space-y-6">
                            {/* Pending Tasks Sections */}
                            {(today.length > 0 || tomorrow.length > 0 || later.length > 0 || (routines && routines.length > 0)) ? (
                                <div className="space-y-6">
                                    <section>
                                        <div className="flex items-center justify-between mb-3 pl-1">
                                            <h3 className="text-sm font-bold text-acc-todo uppercase tracking-wider">Today / Overdue</h3>
                                            <button 
                                                onClick={() => handleOpenAddTask(new Date().toISOString().split('T')[0])} 
                                                className="p-1 hover:bg-acc-todo/10 text-acc-todo rounded-md transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {today.length > 0 ? (
                                            <div className="space-y-3">{today.map(item => <Card key={item.id} item={item} {...cardProps} />)}</div>
                                        ) : (
                                            <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                                        )}
                                    </section>

                                    <section>
                                        <div className="flex items-center justify-between mb-3 pl-1">
                                            <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2">
                                                <span className="bg-indigo-500/10 p-1 rounded-md"><CheckCircle2 className="w-3 h-3" /></span> Routines
                                            </h3>
                                            <button 
                                                onClick={handleOpenAddRoutine}
                                                className="p-1 hover:bg-indigo-500/10 text-indigo-500 rounded-md transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {routines && routines.length > 0 ? (
                                            <div className="space-y-3">{routines.map(item => <Card key={item.id} item={item} {...cardProps} />)}</div>
                                        ) : (
                                            <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                                        )}
                                    </section>

                                    <section>
                                        <div className="flex items-center justify-between mb-3 pl-1">
                                            <h3 className="text-sm font-bold text-acc-event uppercase tracking-wider">Tomorrow</h3>
                                            <button 
                                                onClick={() => handleOpenAddTask(new Date(Date.now() + 86400000).toISOString().split('T')[0])} 
                                                className="p-1 hover:bg-acc-event/10 text-acc-event rounded-md transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {tomorrow.length > 0 ? (
                                            <div className="space-y-3">{tomorrow.map(item => <Card key={item.id} item={item} {...cardProps} />)}</div>
                                        ) : (
                                            <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                                        )}
                                    </section>

                                    <section>
                                        <div className="flex items-center justify-between mb-3 pl-1">
                                            <h3 className="text-sm font-bold text-muted uppercase tracking-wider">Later</h3>
                                            <button 
                                                onClick={() => handleOpenAddTask(new Date(Date.now() + 172800000).toISOString().split('T')[0])} 
                                                className="p-1 hover:bg-muted/10 text-muted rounded-md transition-colors"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                        {later.length > 0 ? (
                                            <div className="space-y-3">{later.map(item => <Card key={item.id} item={item} {...cardProps} />)}</div>
                                        ) : (
                                            <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                                        )}
                                    </section>
                                </div>
                            ) : (
                                summary.todo === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-[32px] gap-4">
                                        <p className="text-muted font-medium">No pending tasks for this month.</p>
                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => handleOpenAddTask()} 
                                                className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 text-primary rounded-2xl text-sm font-bold transition-colors"
                                            >
                                                <Plus className="w-4 h-4" /> Add Task
                                            </button>
                                            <button 
                                                onClick={handleOpenAddRoutine}
                                                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-2xl text-sm font-bold transition-colors"
                                            >
                                                <Plus className="w-4 h-4" /> Add Routine
                                            </button>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </motion.div>

                    {/* VIEW: Skills */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full flex-shrink-0 px-4"
                    >
                        <div>
                            {/* Skill Dashboard Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-6">
                                {stats.map(skill => (
                                    <div key={skill.id} className="bg-surface border border-border p-4 rounded-[24px] relative group hover:border-indigo-500/50 transition-colors">
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button 
                                            onClick={() => handleOpenEditSkill(skill.id, skill.name, skill.weeklyTargetMinutes)}
                                            className="p-1.5 hover:bg-muted/10 rounded-xl text-muted hover:text-primary transition-colors"
                                            title="Edit Skill"
                                            >
                                            <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                            onClick={() => { setDeleteId(skill.id); setDeleteType('skill'); }}
                                            className="p-1.5 hover:bg-red-900/30 rounded-xl text-muted hover:text-red-400 transition-colors"
                                            title="Delete"
                                            >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            </button>

                                        </div>
                                        <h4 className="text-sm font-medium text-muted mb-1 truncate pr-16">{skill.name}</h4>
                                        <div className="flex items-end justify-between mb-2">
                                        <div className="text-2xl font-bold text-primary flex items-baseline gap-1">
                                            {skill.weeklyHours} <span className="text-xs font-normal text-muted">hrs this week</span>
                                        </div>
                                        <div className="text-xs text-muted font-mono">
                                            Total: {skill.totalHours}h
                                        </div>
                                        </div>
                                        
                                        {/* Progress Bar */}
                                        <div className="w-full h-1.5 bg-black/10 dark:bg-black/30 rounded-full overflow-hidden flex relative">
                                            {skill.weeklyTargetMinutes ? (
                                                <>
                                                <div 
                                                    className={`h-full ${skill.weeklyProgress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'} transition-all duration-500`} 
                                                    style={{ width: `${Math.min(100, skill.weeklyProgress)}%` }}
                                                ></div>
                                                </>
                                            ) : (
                                            <div className="h-full bg-indigo-500/30 w-full"></div>
                                            )}
                                        </div>
                                        {skill.weeklyTargetMinutes && (
                                            <div className="text-[10px] text-right mt-1 text-muted">
                                                Target: {(skill.weeklyTargetMinutes / 60).toFixed(1)}h / week
                                            </div>
                                        )}
                                    </div>
                                ))}
                                
                                {/* Add Skill Button */}
                                <button onClick={handleOpenAddSkill} className="border border-dashed border-border rounded-[24px] flex flex-col items-center justify-center p-4 hover:border-indigo-500/50 hover:bg-surface/50 transition-all text-muted hover:text-primary min-h-[106px]">
                                    <Plus className="w-6 h-6 mb-1" />
                                    <span className="text-xs font-medium">Add Skill</span>
                                </button>
                            </div>

                            {/* Log List */}
                            <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 pl-1 flex items-center gap-2">
                                <History className="w-4 h-4" /> Recent Logs (Proof of Output)
                            </h3>
                            {logs.length === 0 ? (
                                <div className="text-center text-muted py-10 bg-surface/30 rounded-[24px] border border-dashed border-border">
                                    <p>No study sessions logged yet.</p>
                                    <p className="text-xs mt-2 opacity-70">Try typing: "Belajar Python 45 menit tentang loops"</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {logs.map(log => {
                                        const skill = skills.find(s => s.id === log.meta.skillId);
                                        return (
                                            <Card 
                                            key={log.id} 
                                            item={log} 
                                            skillName={skill?.name || log.meta.skillName || 'Unknown'} 
                                            {...cardProps}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    );
};

export default FocusView;
