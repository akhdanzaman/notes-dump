import React, { useState, useRef } from 'react';
import { NotebookPen, BookText, Library } from 'lucide-react';
import { BrainDumpItem, Skill, NotesSubTab, AppSettings, SortOrder, ItemType, FinanceType } from '../../types';
import { getNoteItems, getJournalGroups } from '../../utils/selectors';
import Card from '../Card';

interface NotesViewProps {
    items: BrainDumpItem[];
    skills: Skill[];
    notesSubTab: NotesSubTab;
    setNotesSubTab: (tab: NotesSubTab) => void;
    appSettings: AppSettings;
    handleDelete: (id: string) => void;
    handleUpdateItem: (id: string, newContent: string, newTags: string[], newAmount?: number, newDate?: string, newPaymentMethod?: string, newBudgetCategory?: string, newDuration?: number, newSkillId?: string, newToWallet?: string, newFinanceType?: FinanceType, newProgress?: number, newProgressNotes?: string) => void;
    
    // Filters
    selectedTag: string;
    filterDate: string;
    filterDateTo: string;
    searchQuery: string;
    sortOrder: SortOrder;
}

const NotesView: React.FC<NotesViewProps> = ({
    items, skills, notesSubTab, setNotesSubTab, appSettings,
    handleDelete, handleUpdateItem, selectedTag, filterDate, filterDateTo, searchQuery, sortOrder
}) => {
    // Data Preparation
    const generalItems = getNoteItems(items, 'general', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const journalItems = getNoteItems(items, 'journal', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
    const skillItems = getNoteItems(items, 'skills', selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);

    // Swipe State
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const isHorizontalSwipe = useRef<boolean | null>(null);

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
            if ((activeIndex === 0 && dx > 0) || (activeIndex === 2 && dx < 0)) {
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
            if (dragOffset < 0 && activeIndex < 2) {
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
        <div className="min-h-[50vh] overflow-hidden">
            {/* Notes Sub-Tab Switcher */}
            <div className="flex bg-surface rounded-lg p-1 mb-6 border border-border">
                {subTabs.map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setNotesSubTab(tab)}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${notesSubTab === tab ? 'bg-background text-primary shadow-sm' : 'text-muted hover:text-primary'}`}
                    >
                        {tab === 'general' && <NotebookPen className="w-3.5 h-3.5" />}
                        {tab === 'journal' && <BookText className="w-3.5 h-3.5" />}
                        {tab === 'skills' && <Library className="w-3.5 h-3.5" />}
                        <span className="capitalize">{tab === 'skills' ? 'Skill Logs' : tab}</span>
                    </button>
                ))}
            </div>

            {/* Sliding Container */}
            <div 
                className="touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div 
                     className="flex w-full will-change-transform"
                     style={{
                         transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
                         transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                     }}
                >
                    {/* General */}
                    <div className="w-full flex-shrink-0 px-1">
                        {renderContent(generalItems, 'general')}
                    </div>
                    {/* Journal */}
                    <div className="w-full flex-shrink-0 px-1">
                        {renderContent(journalItems, 'journal')}
                    </div>
                    {/* Skills */}
                    <div className="w-full flex-shrink-0 px-1">
                        {renderContent(skillItems, 'skills')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NotesView;