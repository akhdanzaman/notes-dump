import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotebookPen, BookText, Library, Plus } from 'lucide-react';
import { BrainDumpItem, Skill, NotesSubTab, AppSettings, SortOrder, ItemType, FinanceType, Tab } from '../../types';
import { getNoteItems, getJournalGroups } from '../../utils/selectors';
import Card from '../Card';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';

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
        newQuantity?: string
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
    const skillItems = getNoteItems(items, 'skills', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);

    // Main Tab Swipe Logic
    const swipeHandlers = useSwipeTabs('notes', setActiveTab);

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
        if (data.length === 0) {
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
                    {Object.entries(getJournalGroups(data, sortOrder)).map(([dateKey, entries]) => {
                        const date = new Date(dateKey);
                        const friendlyDate = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                        
                        return (
                            <div key={dateKey} className="relative pl-6 border-l border-border/50">
                                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-fuchsia-400/50 border border-fuchsia-400"></div>
                                <h3 className="text-sm font-serif font-bold text-fuchsia-600 dark:text-fuchsia-200 mb-4">{friendlyDate}</h3>
                                <div className="space-y-4">
                                    {entries.map(item => (
                                        <Card key={item.id} item={item} {...commonProps} noStrikethrough={true} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        }

        return (
            <div className="columns-1 sm:columns-2 gap-4">
                {data.map(item => {
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
                                {notesSubTab === 'journal' && `${journalItems.length} journal entries`}
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