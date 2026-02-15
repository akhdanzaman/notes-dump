
import React from 'react';
import { NotebookPen, BookText, Library } from 'lucide-react';
import { BrainDumpItem, Skill, NotesSubTab, AppSettings, SortOrder, ItemType } from '../../types';
import { getNoteItems, getJournalGroups } from '../../utils/selectors';
import Card from '../Card';

interface NotesViewProps {
    items: BrainDumpItem[];
    skills: Skill[];
    notesSubTab: NotesSubTab;
    setNotesSubTab: (tab: NotesSubTab) => void;
    appSettings: AppSettings;
    handleDelete: (id: string) => void;
    setEditingItem: (item: BrainDumpItem) => void;
    
    // Filters
    selectedTag: string;
    filterDate: string;
    filterDateTo: string;
    searchQuery: string;
    sortOrder: SortOrder;
}

const NotesView: React.FC<NotesViewProps> = ({
    items, skills, notesSubTab, setNotesSubTab, appSettings,
    handleDelete, setEditingItem, selectedTag, filterDate, filterDateTo, searchQuery, sortOrder
}) => {
    const itemsToShow = getNoteItems(items, notesSubTab, selectedTag, filterDate, filterDateTo, searchQuery, sortOrder);
              
    return (
        <>
            {/* Notes Sub-Tab Switcher */}
            <div className="flex bg-surface rounded-lg p-1 mb-6 border border-border">
            <button 
                onClick={() => setNotesSubTab('general')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${notesSubTab === 'general' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
            >
                <NotebookPen className="w-3.5 h-3.5" /> General
            </button>
            <button 
                onClick={() => setNotesSubTab('journal')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${notesSubTab === 'journal' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
            >
                <BookText className="w-3.5 h-3.5" /> Journal
            </button>
            <button 
                onClick={() => setNotesSubTab('skills')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${notesSubTab === 'skills' ? 'bg-background text-white shadow-sm' : 'text-muted hover:text-white'}`}
            >
                <Library className="w-3.5 h-3.5" /> Skill Logs
            </button>
            </div>

            {/* Content Render */}
            {itemsToShow.length === 0 ? (
            <div className="text-center text-muted py-10">
                {searchQuery 
                    ? "No matching notes." 
                    : (notesSubTab === 'general' 
                        ? "No notes found." 
                        : (notesSubTab === 'journal' ? "Write your first entry: \"Journal: Today was...\"" : "No skill logs found."))}
            </div>
            ) : (
                // Different Layout for Journal vs Others
                notesSubTab === 'journal' ? (
                <div className="space-y-8">
                    {Object.entries(getJournalGroups(itemsToShow, sortOrder)).map(([dateKey, entries]) => {
                        const date = new Date(dateKey);
                        const friendlyDate = date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                        
                        return (
                            <div key={dateKey} className="relative pl-6 border-l border-border/50">
                                {/* Date Header */}
                                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-fuchsia-400/50 border border-fuchsia-400"></div>
                                <h3 className="text-sm font-serif font-bold text-fuchsia-200 mb-4">{friendlyDate}</h3>
                                
                                <div className="space-y-4">
                                    {entries.map(item => (
                                        <Card key={item.id} item={item} onEdit={setEditingItem} onDelete={handleDelete} noStrikethrough={true} enableCollapse={true} defaultCollapsed={appSettings.defaultCollapsed} hideMoney={appSettings.hideMoney} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                ) : (
                <div className="columns-1 sm:columns-2 gap-4 space-y-4">
                {itemsToShow.map(item => {
                    // Resolve skill name for display if it's a log
                    const skillName = item.type === ItemType.SKILL_LOG 
                        ? (skills.find(s => s.id === item.meta.skillId)?.name || item.meta.skillName)
                        : undefined;

                    return <Card key={item.id} item={item} onEdit={setEditingItem} onDelete={handleDelete} skillName={skillName} enableCollapse={true} defaultCollapsed={appSettings.defaultCollapsed} hideMoney={appSettings.hideMoney} />;
                })}
                </div>
                )
            )}
        </>
    );
};

export default NotesView;
