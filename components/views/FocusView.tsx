
import React from 'react';
import { CheckCircle2, Sprout, Pencil, Trash2, Plus, History, ChevronLeft, ChevronRight, ListTodo, CheckSquare } from 'lucide-react';
import { BrainDumpItem, FocusSubTab, Skill, AppSettings } from '../../types';
import { getFocusMonthData, getSkillItems } from '../../utils/selectors';
import Card from '../Card';

interface FocusViewProps {
    items: BrainDumpItem[];
    skills: Skill[];
    focusSubTab: FocusSubTab;
    setFocusSubTab: (tab: FocusSubTab) => void;
    
    // New Props for Focus Date & Filtering
    focusDate: Date;
    setFocusDate: (d: Date) => void;
    
    appSettings: AppSettings;
    handleToggleStatus: (id: string) => void;
    handleDelete: (id: string) => void;
    setEditingItem: (item: BrainDumpItem) => void;
    handleOpenEditSkill: (id: string, name: string, target?: number) => void;
    handleOpenAddSkill: () => void;
    setDeleteId: (id: string) => void;
    setDeleteType: (type: 'skill' | 'wallet' | null) => void;
    
    searchQuery: string;
    selectedTag: string;
}

const FocusView: React.FC<FocusViewProps> = ({
    items, skills, focusSubTab, setFocusSubTab,
    focusDate, setFocusDate,
    appSettings, handleToggleStatus, handleDelete, setEditingItem,
    handleOpenEditSkill, handleOpenAddSkill, setDeleteId, setDeleteType,
    searchQuery, selectedTag
}) => {

    const changeMonth = (offset: number) => {
        const newDate = new Date(focusDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setFocusDate(newDate);
    };

    const renderSubTab = () => (
        <div className="flex bg-surface rounded-lg p-1 mb-6 border border-border">
          <button 
              onClick={() => setFocusSubTab('tasks')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${focusSubTab === 'tasks' ? 'bg-background text-primary shadow-sm' : 'text-muted hover:text-primary'}`}
          >
              <CheckCircle2 className="w-3.5 h-3.5" /> Tasks
          </button>
          <button 
              onClick={() => setFocusSubTab('skills')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-2 transition-colors ${focusSubTab === 'skills' ? 'bg-background text-primary shadow-sm' : 'text-muted hover:text-primary'}`}
          >
              <Sprout className="w-3.5 h-3.5" /> Skill Growth
          </button>
        </div>
    );

    // Sub-tab: TASKS
    if (focusSubTab === 'tasks') {
        const { summary, pendingGroups, doneList } = getFocusMonthData(items, focusDate, searchQuery, selectedTag);
        const { today, tomorrow, later } = pendingGroups;
        
        return (
          <div className="space-y-6">
            {renderSubTab()}

            {/* Month Navigation */}
            <div className="flex items-center justify-between bg-surface border border-border rounded-xl p-3">
                <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-muted/10 rounded-full text-muted hover:text-primary"><ChevronLeft className="w-5 h-5" /></button>
                <span className="font-semibold text-primary">
                    {focusDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => changeMonth(1)} className="p-1 hover:bg-muted/10 rounded-full text-muted hover:text-primary"><ChevronRight className="w-5 h-5" /></button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface border border-border p-4 rounded-xl flex items-center gap-3">
                    <div className="p-3 bg-acc-todo/10 rounded-full text-acc-todo">
                        <ListTodo className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-primary">{summary.todo}</div>
                        <div className="text-[10px] text-muted uppercase tracking-wider font-medium">To Do</div>
                    </div>
                </div>
                <div className="bg-surface border border-border p-4 rounded-xl flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-500">
                        <CheckSquare className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-primary">{summary.done}</div>
                        <div className="text-[10px] text-muted uppercase tracking-wider font-medium">Done</div>
                    </div>
                </div>
            </div>

            {/* Pending Tasks Sections */}
            {(today.length > 0 || tomorrow.length > 0 || later.length > 0) ? (
                <div className="space-y-6">
                    {today.length > 0 && (
                    <section>
                        <h3 className="text-sm font-bold text-acc-todo uppercase tracking-wider mb-3 pl-1">Today / Overdue</h3>
                        <div className="space-y-3">{today.map(item => <Card key={item.id} item={item} onToggleStatus={handleToggleStatus} onEdit={setEditingItem} onDelete={handleDelete} enableCollapse={true} defaultCollapsed={appSettings.defaultCollapsed} hideMoney={appSettings.hideMoney} />)}</div>
                    </section>
                    )}
                    {tomorrow.length > 0 && (
                    <section>
                        <h3 className="text-sm font-bold text-acc-event uppercase tracking-wider mb-3 pl-1">Tomorrow</h3>
                        <div className="space-y-3">{tomorrow.map(item => <Card key={item.id} item={item} onToggleStatus={handleToggleStatus} onEdit={setEditingItem} onDelete={handleDelete} enableCollapse={true} defaultCollapsed={appSettings.defaultCollapsed} hideMoney={appSettings.hideMoney} />)}</div>
                    </section>
                    )}
                    {later.length > 0 && (
                    <section>
                        <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 pl-1">Later</h3>
                        <div className="space-y-3">{later.map(item => <Card key={item.id} item={item} onToggleStatus={handleToggleStatus} onEdit={setEditingItem} onDelete={handleDelete} enableCollapse={true} defaultCollapsed={appSettings.defaultCollapsed} hideMoney={appSettings.hideMoney} />)}</div>
                    </section>
                    )}
                </div>
            ) : (
                summary.todo === 0 && (
                    <div className="text-center text-muted py-8 border border-dashed border-border rounded-xl">
                        No pending tasks for this month.
                    </div>
                )
            )}

            {/* History Section */}
            {doneList.length > 0 && (
                <div className="pt-6 border-t border-border">
                    <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-wider mb-3 pl-1 flex items-center gap-2">
                        <History className="w-4 h-4" /> History ({doneList.length})
                    </h3>
                    <div className="space-y-3 opacity-75">
                        {doneList.map(item => (
                            <Card key={item.id} item={item} onToggleStatus={handleToggleStatus} onEdit={setEditingItem} onDelete={handleDelete} enableCollapse={true} defaultCollapsed={true} hideMoney={appSettings.hideMoney} />
                        ))}
                    </div>
                </div>
            )}
          </div>
        );
    }

    // Sub-tab: SKILL GROWTH
    if (focusSubTab === 'skills') {
        const { stats, logs } = getSkillItems(items, skills);
        
        return (
            <div>
                {renderSubTab()}
                
                {/* Skill Dashboard Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-6">
                    {stats.map(skill => (
                        <div key={skill.id} className="bg-surface border border-border p-4 rounded-xl relative group hover:border-indigo-500/50 transition-colors">
                            <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleOpenEditSkill(skill.id, skill.name, skill.weeklyTargetMinutes)}
                                  className="p-1.5 hover:bg-muted/10 rounded-md text-muted hover:text-primary transition-colors"
                                  title="Edit Skill"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => { setDeleteId(skill.id); setDeleteType('skill'); }}
                                  className="p-1.5 hover:bg-red-900/30 rounded-md text-muted hover:text-red-400 transition-colors"
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
                    <button onClick={handleOpenAddSkill} className="border border-dashed border-border rounded-xl flex flex-col items-center justify-center p-4 hover:border-indigo-500/50 hover:bg-surface/50 transition-all text-muted hover:text-primary min-h-[106px]">
                        <Plus className="w-6 h-6 mb-1" />
                        <span className="text-xs font-medium">Add Skill</span>
                    </button>
                </div>

                {/* Log List */}
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-3 pl-1 flex items-center gap-2">
                   <History className="w-4 h-4" /> Recent Logs (Proof of Output)
                </h3>
                {logs.length === 0 ? (
                    <div className="text-center text-muted py-10 bg-surface/30 rounded-xl border border-dashed border-border">
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
                                  onEdit={setEditingItem} 
                                  onDelete={handleDelete}
                                  enableCollapse={true} defaultCollapsed={appSettings.defaultCollapsed} hideMoney={appSettings.hideMoney}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }
    return null;
};

export default FocusView;
