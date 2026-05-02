
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Settings, RefreshCw, CloudCheck, CloudOff, Save, 
    Moon, Sun, X, AlertTriangle, Github,
    Monitor, Layout, Eye, EyeOff, Database, Download, Upload, Trash2,
    Check, Smartphone, WifiOff, CheckCircle2, PieChart, Plus, Sparkles,
    MessageSquare, Calendar, AlertCircle, ChevronRight, ArrowLeft, CheckSquare, Bell, History
} from 'lucide-react';
import { SyncStatus, AppSettings, BudgetConfig, BudgetRule, BrainDumpItem, Skill, Wallet } from '../types';
import { DEFAULT_PROMPT } from '../services/geminiService';
import { useControlCenter } from '../hooks/useControlCenter';
import { getDatabaseHistory } from '../services/syncFacade';
import { SpreadsheetHistoryEntry } from '../services/spreadsheetService';

interface ControlCenterProps {
    isOpen: boolean;
    onClose: () => void;
    saveStatus: SyncStatus;
    fetchStatus: SyncStatus;
    onSyncClick: (forceOverwrite?: boolean) => void;
    onRefreshClick?: () => void;
    
    // App State & Settings
    appSettings: AppSettings;
    setAppSettings: (settings: AppSettings) => void;
    error: string | null;
    pendingCount: number;
    parsingTasks?: import('../types').ParsingTask[];
    retryParsing?: (taskId: string) => void;

    // Settings Props
    onSave: (newBudgetConfig?: BudgetConfig, newPrompt?: string, newAppSettings?: AppSettings) => void;
    currentBudgetConfig?: BudgetConfig;
    currentPrompt?: string;
    
    // Data for export
    allItems: BrainDumpItem[];
    allSkills: Skill[];
    allWallets: Wallet[];
    monthlyThemes: Record<string, string>;

    // External handlers
    onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClearData: () => void;
}

// Preset colors for budget categories
const COLOR_PRESETS = [
    { name: 'Blue', class: 'bg-blue-500' },
    { name: 'Green', class: 'bg-emerald-500' },
    { name: 'Amber', class: 'bg-amber-500' },
    { name: 'Purple', class: 'bg-purple-500' },
    { name: 'Pink', class: 'bg-pink-500' },
    { name: 'Red', class: 'bg-red-500' },
    { name: 'Cyan', class: 'bg-cyan-500' },
    { name: 'Gray', class: 'bg-gray-500' },
];

const ClockDisplay = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col items-center text-center">
            <div className="text-2xl font-bold text-primary font-mono tracking-wider">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <div className="text-xs font-medium text-muted uppercase tracking-wider mt-1">
                {time.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
        </div>
    );
};

const ControlCenter: React.FC<ControlCenterProps> = ({ 
    isOpen, onClose, saveStatus, fetchStatus, onSyncClick, onRefreshClick, 
    appSettings, setAppSettings, error, pendingCount, parsingTasks, retryParsing,
    onSave, currentBudgetConfig, currentPrompt,
    allItems, allSkills, allWallets, monthlyThemes,
    onImportData, onClearData
}) => {
    
    const [syncMode, setSyncMode] = useState<'merge' | 'overwrite'>('merge');
    const [isParsingTasksExpanded, setIsParsingTasksExpanded] = useState(false);
    const [history, setHistory] = useState<SpreadsheetHistoryEntry[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    const fetchHistory = async () => {
        setIsFetchingHistory(true);
        setHistoryError(null);
        try {
            const hist = await getDatabaseHistory();
            setHistory(hist);
        } catch (e: any) {
            setHistoryError(e.message || 'Failed to fetch history');
        } finally {
            setIsFetchingHistory(false);
        }
    };

    const handleRestoreHistory = (entry: SpreadsheetHistoryEntry) => {
        if (window.confirm(`Are you sure you want to restore the database to the version from ${new Date(entry.timestamp).toLocaleString()}? This will overwrite your current data.`)) {
            // Create a Blob from the JSON string
            const jsonString = JSON.stringify(entry.data);
            const blob = new Blob([jsonString], { type: 'application/json' });
            // Create a fake File object
            const file = new File([blob], 'backup.json', { type: 'application/json' });
            // Create a fake event
            const event = {
                target: {
                    files: [file]
                }
            } as unknown as React.ChangeEvent<HTMLInputElement>;
            
            onImportData(event);
        }
    };

    const {
        activeTab,
        direction,
        settingsSaveStatus,
        connectionModal,
        githubConfig,
        spreadsheetLink,
        spreadsheetConfig,
        isConnectingSpreadsheet,
        geminiKey,
        prompt,
        gCalKey,
        gCalId,
        monthlyIncome,
        budgetRules,
        localAppSettings,
        googleProfile,
        isSyncingProfile,
        handleTabChange,
        setGithubConfig,
        setSpreadsheetLink,
        setGeminiKey,
        setPrompt,
        setGCalKey,
        setGCalId,
        setMonthlyIncome,
        setLocalAppSettings,
        setConnectionModal,
        handleGoogleLogin,
        handleConnectSpreadsheet,
        handleDisconnectSpreadsheet,
        handleSave,
        handleDisconnectGithub,
        handleConnectionChoice,
        handleExportExcel,
        handleExportJSON,
        handleAddRule,
        handleRemoveRule,
        handleUpdateRule,
        totalPercentage,
        toggleTheme
    } = useControlCenter({
        isOpen,
        appSettings,
        setAppSettings,
        onSave,
        onRefreshClick,
        onSyncClick,
        allItems,
        allSkills,
        allWallets,
        monthlyThemes,
        currentBudgetConfig,
        currentPrompt
    });

    useEffect(() => {
        if (activeTab === 'data' && spreadsheetConfig) {
            fetchHistory();
        }
    }, [activeTab, spreadsheetConfig]);

    const renderSyncStatus = () => {
        const activeStatus = saveStatus === 'saving' ? 'saving' 
                           : fetchStatus === 'syncing' ? 'syncing'
                           : saveStatus === 'error' ? 'error'
                           : fetchStatus === 'error' ? 'error'
                           : saveStatus === 'local' ? 'local'
                           : 'synced';

        switch(activeStatus) {
            case 'synced':
                return <div className="flex items-center gap-2 text-emerald-500"><CloudCheck className="w-5 h-5" /><span className="font-medium">Synced</span></div>;
            case 'syncing':
                return <div className="flex items-center gap-2 text-blue-500"><RefreshCw className="w-5 h-5 animate-spin" /><span className="font-medium">Fetching...</span></div>;
            case 'saving':
                return <div className="flex items-center gap-2 text-amber-500"><Save className="w-5 h-5 animate-spin" /><span className="font-medium">Saving...</span></div>;
            case 'error':
                return <div className="flex items-center gap-2 text-red-500"><CloudOff className="w-5 h-5" /><span className="font-medium">Failed</span></div>;
            case 'local':
                return <div className="flex items-center gap-2 text-amber-500"><Save className="w-5 h-5" /><span className="font-medium">Local</span></div>;
        }
    };

    const menuItems = [
        { id: 'appearance', label: 'Appearance', icon: <Monitor className="w-5 h-5" />, desc: 'Theme, UI options' },
        { id: 'behavior', label: 'Behavior', icon: <Smartphone className="w-5 h-5" />, desc: 'Prompts, defaults' },
        { id: 'notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" />, desc: 'Alerts, reminders' },
        { id: 'budget', label: 'Budget', icon: <PieChart className="w-5 h-5" />, desc: 'Income, categories' },
        { id: 'data', label: 'Data', icon: <Database className="w-5 h-5" />, desc: 'Export, import, reset' },
        { id: 'connect', label: 'Connect', icon: <Layout className="w-5 h-5" />, desc: 'GitHub, Gemini, APIs' },
        { id: 'changelog', label: 'Changelog', icon: <History className="w-5 h-5" />, desc: 'Recent updates' },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                        onClick={onClose}
                    />
                    
                    {/* Sheet */}
                    <motion.div 
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ 
                            duration: 0.4, 
                            ease: [0.32, 0.72, 0, 1] 
                        }}
                        className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border rounded-t-3xl z-[70] shadow-2xl max-w-2xl mx-auto flex flex-col h-[85vh]"
                    >
                        
                        {/* Header */}
                        <div className="p-6 pb-2 shrink-0">
                            <div className="w-12 h-1.5 bg-border rounded-full mx-auto mb-6 opacity-50" />
                            
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    {activeTab !== 'main' && (
                                        <button onClick={() => handleTabChange('main')} className="p-2 -ml-2 hover:bg-muted/10 rounded-full transition-colors">
                                            <ArrowLeft className="w-6 h-6 text-primary" />
                                        </button>
                                    )}
                                    <h2 className="text-2xl font-bold tracking-tight text-primary">
                                        {activeTab === 'main' ? 'Control Center' : menuItems.find(m => m.id === activeTab)?.label}
                                    </h2>
                                </div>
                                <div className="flex gap-2">
                                    {activeTab !== 'main' && (
                                        <button 
                                            onClick={handleSave}
                                            disabled={settingsSaveStatus === 'saved'}
                                            className={`p-2 rounded-full transition-all ${settingsSaveStatus === 'saved' ? 'bg-green-500 text-white' : 'hover:bg-muted/10 text-primary'}`}
                                        >
                                            {settingsSaveStatus === 'saved' ? <CheckCircle2 className="w-6 h-6" /> : <Save className="w-6 h-6" />}
                                        </button>
                                    )}
                                    <button onClick={onClose} className="p-2 hover:bg-muted/10 rounded-full transition-colors">
                                        <X className="w-6 h-6 text-muted" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="overflow-y-auto p-6 pt-2 flex-1 relative">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, x: direction * 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: direction * -20 }}
                                    transition={{ 
                                        duration: 0.25,
                                        ease: "easeInOut"
                                    }}
                                    className="w-full"
                                >
                                    {/* MAIN VIEW */}
                                    {activeTab === 'main' && (
                                        <div className="space-y-6">
                                            {/* Status Card */}
                                            <div className="bg-background border border-border rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-6">
                                                        {pendingCount > 0 && (
                                                            <div className="flex flex-col gap-1 border-r border-border pr-6">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Pending</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-primary">
                                                                    <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                                                                    <span className="font-bold text-sm">{pendingCount}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">System Status</span>
                                                            {renderSyncStatus()}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex gap-2">
                                                        {(saveStatus === 'error' || fetchStatus === 'error' || saveStatus === 'local') && (
                                                            <button 
                                                                onClick={() => onSyncClick(syncMode === 'overwrite')} 
                                                                className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                                                                title={syncMode === 'overwrite' ? "Force Overwrite Cloud Data" : "Merge with Cloud Data"}
                                                            >
                                                                <RefreshCw className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                        {saveStatus === 'synced' && fetchStatus === 'synced' && onRefreshClick && (
                                                            <button onClick={onRefreshClick} className="p-2 bg-surface border border-border text-muted hover:text-primary rounded-xl transition-colors">
                                                                <RefreshCw className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Sync Mode Selector */}
                                                {(saveStatus === 'error' || fetchStatus === 'error' || saveStatus === 'local') && (
                                                    <div className="flex items-center bg-surface border border-border rounded-xl overflow-hidden self-end">
                                                        <button 
                                                            onClick={() => setSyncMode('merge')}
                                                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${syncMode === 'merge' ? 'bg-primary/10 text-primary' : 'text-muted hover:text-primary'}`}
                                                        >
                                                            Merge
                                                        </button>
                                                        <div className="w-px h-4 bg-border"></div>
                                                        <button 
                                                            onClick={() => setSyncMode('overwrite')}
                                                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${syncMode === 'overwrite' ? 'bg-red-500/10 text-red-500' : 'text-muted hover:text-red-500'}`}
                                                        >
                                                            Overwrite
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {error && (
                                                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3 text-red-600 dark:text-red-400">
                                                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                                    <p className="text-sm font-medium">{error}</p>
                                                </div>
                                            )}

                                            {/* Quick Actions */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <button 
                                                    onClick={toggleTheme}
                                                    className="flex flex-col items-center justify-center gap-3 p-6 bg-background border border-border rounded-2xl hover:bg-muted/5 active:scale-95 transition-all shadow-sm"
                                                >
                                                    {localAppSettings.theme === 'dark' ? <Moon className="w-8 h-8 text-indigo-400" /> : <Sun className="w-8 h-8 text-amber-500" />}
                                                    <span className="font-medium text-primary">{localAppSettings.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                                                </button>
                                                
                                                {/* Clock & Date */}
                                                <div className="flex flex-col items-center justify-center gap-2 p-6 bg-background border border-border rounded-2xl shadow-sm">
                                                    <ClockDisplay />
                                                </div>
                                            </div>

                                            {/* Menu List */}
                                            <div className="space-y-2">
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider ml-1 mb-2">Settings</h3>
                                                {menuItems.map(item => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => handleTabChange(item.id as any)}
                                                        className="w-full flex items-center justify-between p-4 bg-background border border-border rounded-2xl hover:bg-muted/5 active:scale-95 transition-all group"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-2 bg-surface border border-border rounded-xl text-muted group-hover:text-primary transition-colors">
                                                                {item.icon}
                                                            </div>
                                                            <div className="text-left">
                                                                <div className="font-medium text-primary">{item.label}</div>
                                                                <div className="text-xs text-muted">{item.desc}</div>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-5 h-5 text-muted/50" />
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Footer Info */}
                                            <div className="text-center pt-4">
                                                <p className="text-xs text-muted flex items-center justify-center gap-2">
                                                    <Github className="w-3 h-3" />
                                                    <span>BrainDump AI v0.3.1</span>
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* APPEARANCE TAB */}
                                    {activeTab === 'appearance' && (
                                        <div className="space-y-6">
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Theme</h3>
                                                <div className="grid grid-cols-3 gap-3">
                                                    <button
                                                        onClick={() => {
                                                            const s = { ...localAppSettings, theme: 'light' as const };
                                                            setLocalAppSettings(s);
                                                            setAppSettings(s);
                                                        }}
                                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                                                            localAppSettings.theme === 'light' 
                                                                ? 'bg-amber-500/10 border-amber-500 text-amber-600' 
                                                                : 'bg-background border-border text-muted hover:border-primary/50'
                                                        }`}
                                                    >
                                                        <Sun className="w-6 h-6" />
                                                        <span className="text-xs font-medium">Light</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const s = { ...localAppSettings, theme: 'dark' as const };
                                                            setLocalAppSettings(s);
                                                            setAppSettings(s);
                                                        }}
                                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                                                            localAppSettings.theme === 'dark' 
                                                                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' 
                                                                : 'bg-background border-border text-muted hover:border-primary/50'
                                                        }`}
                                                    >
                                                        <Moon className="w-6 h-6" />
                                                        <span className="text-xs font-medium">Dark</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const s = { ...localAppSettings, theme: undefined };
                                                            setLocalAppSettings(s);
                                                            setAppSettings(s);
                                                        }}
                                                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                                                            !localAppSettings.theme 
                                                                ? 'bg-primary/10 border-primary text-primary' 
                                                                : 'bg-background border-border text-muted hover:border-primary/50'
                                                        }`}
                                                    >
                                                        <Monitor className="w-6 h-6" />
                                                        <span className="text-xs font-medium">System</span>
                                                    </button>
                                                </div>
                                            </section>

                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Interface</h3>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                                                                <EyeOff className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Hide Money Values</div>
                                                                <div className="text-xs text-muted">Obfuscate amounts by default</div>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer"
                                                                checked={localAppSettings.hideMoney}
                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, hideMoney: e.target.checked })}
                                                            />
                                                            <div className="relative w-11 h-6 overflow-hidden rounded-full bg-muted/30 peer-focus:outline-none peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500">
                                                                <Sparkles className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Daily AI Insights</div>
                                                                <div className="text-xs text-muted">Automatically generate insights daily</div>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer"
                                                                checked={localAppSettings.enableDailyInsight ?? false}
                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, enableDailyInsight: e.target.checked })}
                                                            />
                                                            <div className="relative w-11 h-6 overflow-hidden rounded-full bg-muted/30 peer-focus:outline-none peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                                                                <Layout className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Compact Cards</div>
                                                                <div className="text-xs text-muted">Start with items collapsed</div>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer"
                                                                checked={localAppSettings.defaultCollapsed}
                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, defaultCollapsed: e.target.checked })}
                                                            />
                                                            <div className="relative w-11 h-6 overflow-hidden rounded-full bg-muted/30 peer-focus:outline-none peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    )}

                                    {/* BEHAVIOR TAB */}
                                    {activeTab === 'behavior' && (
                                        <div className="space-y-6">
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Parsing Mode</h3>
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                                                                <Sparkles className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Pro Parsing Mode</div>
                                                                <div className="text-xs text-muted">Use 3-stage parsing for better accuracy</div>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer"
                                                                checked={localAppSettings.useProParser ?? false}
                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, useProParser: e.target.checked })}
                                                            />
                                                            <div className="relative w-11 h-6 overflow-hidden rounded-full bg-muted/30 peer-focus:outline-none peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                                                <CheckSquare className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Enable AI Draft Review</div>
                                                                <div className="text-xs text-muted">Review AI parsing results before saving</div>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer"
                                                                checked={localAppSettings.enableDraftReview ?? false}
                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, enableDraftReview: e.target.checked })}
                                                            />
                                                            <div className="relative w-11 h-6 overflow-hidden rounded-full bg-muted/30 peer-focus:outline-none peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </section>
                                            <section>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-xs font-bold text-muted uppercase tracking-wider ml-1">System Prompt</h3>
                                                    <button 
                                                        onClick={() => setPrompt(DEFAULT_PROMPT)}
                                                        className="text-[10px] text-acc-todo hover:underline disabled:opacity-50"
                                                        disabled={prompt === DEFAULT_PROMPT}
                                                    >
                                                        Reset to Default
                                                    </button>
                                                </div>
                                                <div className="bg-background border border-border rounded-2xl p-4">
                                                    <div className="flex items-start gap-3 mb-3">
                                                        <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500 shrink-0">
                                                            <MessageSquare className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-primary text-sm">AI Categorization Logic</div>
                                                            <div className="text-xs text-muted">Instructions for Gemini on how to parse your input.</div>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        className="w-full bg-black/5 dark:bg-black/30 border border-border rounded-xl p-3 text-xs text-primary focus:outline-none focus:border-acc-note h-[450px] resize-y font-mono"
                                                        value={prompt}
                                                        onChange={(e) => setPrompt(e.target.value)}
                                                        placeholder="Enter custom prompt instructions..."
                                                    />
                                                </div>
                                            </section>
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">AI Models</h3>
                                                <div className="bg-background border border-border rounded-2xl p-4 space-y-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-muted mb-1">Parsing Chat (geminiService)</label>
                                                        <select
                                                            className="w-full bg-surface border border-border rounded-xl p-3 text-xs text-primary focus:outline-none focus:border-acc-note transition-colors"
                                                            value={localAppSettings.parsingModel || 'gemini-3-flash-preview'}
                                                            onChange={(e) => setLocalAppSettings({ ...localAppSettings, parsingModel: e.target.value })}
                                                        >
                                                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                                            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                                                            <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Exp)</option>
                                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                                            <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                                            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                                                            <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite Preview</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-muted mb-1">Chat Bar AI (chatService)</label>
                                                        <select
                                                            className="w-full bg-surface border border-border rounded-xl p-3 text-xs text-primary focus:outline-none focus:border-acc-note transition-colors"
                                                            value={localAppSettings.chatModel || 'gemini-3-flash-preview'}
                                                            onChange={(e) => setLocalAppSettings({ ...localAppSettings, chatModel: e.target.value })}
                                                        >
                                                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                                            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                                                            <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Exp)</option>
                                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                                            <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                                            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                                                            <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite Preview</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-muted mb-1">AI Insight (insightService)</label>
                                                        <select
                                                            className="w-full bg-surface border border-border rounded-xl p-3 text-xs text-primary focus:outline-none focus:border-acc-note transition-colors"
                                                            value={localAppSettings.insightModel || 'gemini-3-flash-preview'}
                                                            onChange={(e) => setLocalAppSettings({ ...localAppSettings, insightModel: e.target.value })}
                                                        >
                                                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                                            <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                                                            <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Exp)</option>
                                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                                            <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                                            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                                                            <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite Preview</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    )}

                                    {/* NOTIFICATIONS TAB */}
                                    {activeTab === 'notifications' && (
                                        <div className="space-y-6">
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">System Permission</h3>
                                                <div className="bg-background border border-border rounded-2xl p-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-start gap-3">
                                                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
                                                                <Bell className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Browser Notifications</div>
                                                                <div className="text-xs text-muted mb-3">Allow BrainDump to send you desktop and mobile notifications.</div>
                                                                <div className="flex gap-2">
                                                                    <button 
                                                                        onClick={async () => {
                                                                            const { requestNotificationPermission } = await import('../utils/notificationHandler');
                                                                            const granted = await requestNotificationPermission();
                                                                            if (granted) {
                                                                                alert('Permission granted!');
                                                                            } else {
                                                                                alert('Permission denied or not supported.');
                                                                            }
                                                                        }}
                                                                        className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600 transition-colors"
                                                                    >
                                                                        Request Permission
                                                                    </button>
                                                                    <button 
                                                                        onClick={async () => {
                                                                            const { sendTestNotification } = await import('../utils/notificationHandler');
                                                                            sendTestNotification();
                                                                        }}
                                                                        className="px-3 py-1.5 bg-surface border border-border text-primary text-xs font-medium rounded-lg hover:bg-muted/10 transition-colors"
                                                                    >
                                                                        Test Notification
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </section>

                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Notification Types</h3>
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex flex-col gap-2 p-4 bg-background border border-border rounded-2xl">
                                                        <div className="font-medium text-primary text-sm">Notification Mode</div>
                                                        <div className="text-xs text-muted mb-2">Choose how notifications alert you</div>
                                                        <select
                                                            className="w-full bg-surface border border-border rounded-xl p-2 text-sm text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                                                            value={localAppSettings.notificationMode || 'both'}
                                                            onChange={(e) => setLocalAppSettings({ ...localAppSettings, notificationMode: e.target.value as any })}
                                                        >
                                                            <option value="both">Sound & Vibrate</option>
                                                            <option value="sound">Sound Only</option>
                                                            <option value="vibrate">Vibrate Only</option>
                                                            <option value="silent">Silent</option>
                                                        </select>
                                                    </div>

                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                                                <MessageSquare className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Persistent Quick Input</div>
                                                                <div className="text-xs text-muted">Keep a notification active for quick thought entry</div>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer"
                                                                checked={localAppSettings.persistentNotification ?? false}
                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, persistentNotification: e.target.checked })}
                                                            />
                                                            <div className="relative w-11 h-6 overflow-hidden rounded-full bg-muted/30 peer-focus:outline-none peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                                                                <Sparkles className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Smart Behavior Prompts</div>
                                                                <div className="text-xs text-muted">Notify based on your usual input times</div>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer"
                                                                checked={localAppSettings.notifyBehavior ?? false}
                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, notifyBehavior: e.target.checked })}
                                                            />
                                                            <div className="relative w-11 h-6 overflow-hidden rounded-full bg-muted/30 peer-focus:outline-none peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500">
                                                                <Sparkles className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">AI Insights</div>
                                                                <div className="text-xs text-muted">Get notified when new daily insights are ready</div>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer"
                                                                checked={localAppSettings.notifyInsights ?? false}
                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, notifyInsights: e.target.checked })}
                                                            />
                                                            <div className="relative w-11 h-6 overflow-hidden rounded-full bg-muted/30 peer-focus:outline-none peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>

                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                                                                <Calendar className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Reminders</div>
                                                                <div className="text-xs text-muted">Get notified for scheduled tasks and events</div>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                className="sr-only peer"
                                                                checked={localAppSettings.notifyReminders ?? false}
                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, notifyReminders: e.target.checked })}
                                                            />
                                                            <div className="relative w-11 h-6 overflow-hidden rounded-full bg-muted/30 peer-focus:outline-none peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    )}

                                    {/* BUDGET TAB */}
                                    {activeTab === 'budget' && (
                                        <div className="space-y-6">
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Income</h3>
                                                <div>
                                                    <label className="block text-xs font-medium text-muted mb-1">Monthly Income (IDR)</label>
                                                    <input
                                                    type="number"
                                                    className="w-full bg-background border border-border rounded-xl p-3 text-primary focus:outline-none focus:border-acc-shopping transition-colors"
                                                    value={monthlyIncome}
                                                    onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                                                    placeholder="e.g. 10000000"
                                                    />
                                                </div>
                                            </section>

                                            <section>
                                                <div className="flex justify-between items-center mb-3">
                                                    <h3 className="text-xs font-bold text-muted uppercase tracking-wider ml-1">Categories</h3>
                                                    <span className={`text-xs font-bold ${totalPercentage === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                        Total: {totalPercentage}%
                                                    </span>
                                                </div>
                                                
                                                <div className="space-y-2">
                                                    {budgetRules.map((rule, idx) => (
                                                        <div key={rule.id} className="flex items-center gap-2 p-2 bg-background rounded-xl border border-border">
                                                            {/* Color Picker */}
                                                            <div className="dropdown relative group/color">
                                                                <div className={`w-6 h-6 rounded-full cursor-pointer ${rule.color} border border-border`}></div>
                                                                <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-xl p-2 grid grid-cols-4 gap-1 shadow-xl hidden group-hover/color:grid z-10 w-32">
                                                                    {COLOR_PRESETS.map(c => (
                                                                        <button 
                                                                            key={c.name} 
                                                                            onClick={() => handleUpdateRule(idx, 'color', c.class)}
                                                                            className={`w-5 h-5 rounded-full ${c.class} hover:scale-110 transition-transform`}
                                                                            title={c.name}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Name */}
                                                            <input 
                                                                type="text" 
                                                                value={rule.name}
                                                                onChange={(e) => handleUpdateRule(idx, 'name', e.target.value)}
                                                                className="flex-1 bg-transparent text-xs text-primary focus:outline-none border-b border-transparent focus:border-muted"
                                                                placeholder="Category Name"
                                                            />

                                                            {/* Percentage */}
                                                            <div className="flex items-center gap-1">
                                                                <input 
                                                                    type="number" 
                                                                    value={rule.percentage}
                                                                    onChange={(e) => handleUpdateRule(idx, 'percentage', parseFloat(e.target.value) || 0)}
                                                                    className="w-12 bg-black/10 dark:bg-white/10 text-xs text-right text-primary rounded p-1 focus:outline-none"
                                                                />
                                                                <span className="text-xs text-muted">%</span>
                                                            </div>

                                                            {/* Delete */}
                                                            <button onClick={() => handleRemoveRule(idx)} className="text-muted hover:text-red-400">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    
                                                    <button onClick={handleAddRule} className="w-full py-2 border border-dashed border-border rounded-xl text-xs text-muted hover:text-primary hover:border-muted flex items-center justify-center gap-1 transition-colors">
                                                        <Plus className="w-3 h-3" /> Add Category
                                                    </button>

                                                    {totalPercentage !== 100 && (
                                                        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 p-2 rounded-xl">
                                                            <AlertCircle className="w-3 h-3" />
                                                            <span>Total percentage should equal 100%.</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </section>
                                        </div>
                                    )}

                                    {/* DATA TAB */}
                                    {activeTab === 'data' && (
                                        <div className="space-y-6">
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Export & Import</h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button 
                                                        onClick={handleExportExcel}
                                                        className="flex flex-col items-center justify-center gap-2 p-4 bg-background border border-border rounded-2xl hover:bg-muted/5 hover:border-primary/30 transition-all"
                                                    >
                                                        <Download className="w-6 h-6 text-emerald-500" />
                                                        <span className="text-xs font-medium text-primary">Export Excel</span>
                                                    </button>
                                                    <button 
                                                        onClick={handleExportJSON}
                                                        className="flex flex-col items-center justify-center gap-2 p-4 bg-background border border-border rounded-2xl hover:bg-muted/5 hover:border-primary/30 transition-all"
                                                    >
                                                        <Database className="w-6 h-6 text-blue-500" />
                                                        <span className="text-xs font-medium text-primary">Export JSON</span>
                                                    </button>
                                                    <label className="col-span-2 flex flex-col items-center justify-center gap-2 p-4 bg-background border border-border rounded-2xl hover:bg-muted/5 hover:border-primary/30 transition-all cursor-pointer">
                                                        <Upload className="w-6 h-6 text-indigo-500" />
                                                        <span className="text-xs font-medium text-primary">Import JSON Backup</span>
                                                        <input type="file" accept=".json" onChange={onImportData} className="hidden" />
                                                    </label>
                                                </div>
                                            </section>

                                            {spreadsheetConfig && (
                                                <section>
                                                    <div className="flex items-center justify-between mb-3 ml-1">
                                                        <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Database History</h3>
                                                        <div className="flex items-center gap-3">
                                                            <button 
                                                                onClick={() => {
                                                                    if (window.confirm('Create a new backup version now?')) {
                                                                        onSyncClick(true);
                                                                        setTimeout(fetchHistory, 2000);
                                                                    }
                                                                }}
                                                                className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                                                            >
                                                                <Save className="w-3 h-3" />
                                                                Backup Now
                                                            </button>
                                                            <button 
                                                                onClick={fetchHistory}
                                                                disabled={isFetchingHistory}
                                                                className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                                                            >
                                                                <RefreshCw className={`w-3 h-3 ${isFetchingHistory ? 'animate-spin' : ''}`} />
                                                                Refresh
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-background border border-border rounded-2xl overflow-hidden">
                                                        {isFetchingHistory && history.length === 0 ? (
                                                            <div className="p-6 text-center text-muted text-sm">Loading history...</div>
                                                        ) : historyError ? (
                                                            <div className="p-6 text-center text-red-500 text-sm flex flex-col items-center gap-2">
                                                                <AlertCircle className="w-5 h-5" />
                                                                {historyError}
                                                            </div>
                                                        ) : history.length === 0 ? (
                                                            <div className="p-6 text-center text-muted text-sm">No history available yet. Backups are created daily.</div>
                                                        ) : (
                                                            <div className="divide-y divide-border max-h-[250px] overflow-y-auto custom-scrollbar">
                                                                {history.map((entry, idx) => (
                                                                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-muted/5 transition-colors">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
                                                                                <History className="w-4 h-4" />
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-sm font-medium text-primary">
                                                                                    {new Date(entry.timestamp).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                                                </div>
                                                                                <div className="text-xs text-muted">
                                                                                    {new Date(entry.timestamp).toLocaleTimeString()} • {entry.data.data?.length || 0} items
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleRestoreHistory(entry)}
                                                                            className="px-3 py-1.5 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 rounded-lg text-xs font-medium transition-colors"
                                                                        >
                                                                            Restore
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </section>
                                            )}

                                            <section>
                                                <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 ml-1">Danger Zone</h3>
                                                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
                                                    <div className="flex items-start gap-3 mb-4">
                                                        <div className="p-2 bg-red-500/10 rounded-xl text-red-500 shrink-0">
                                                            <Trash2 className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-red-500 text-sm">Clear All Data</div>
                                                            <div className="text-xs text-red-500/70 mt-1">
                                                                This will permanently delete all your items, wallets, and settings. This action cannot be undone.
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => {
                                                            if (window.confirm('Are you absolutely sure? This will wipe all your data.')) {
                                                                onClearData();
                                                            }
                                                        }}
                                                        className="w-full py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors shadow-sm"
                                                    >
                                                        Reset Everything
                                                    </button>
                                                </div>
                                            </section>
                                        </div>
                                    )}

                                    {/* CONNECT TAB */}
                                    {activeTab === 'connect' && (
                                        <div className="space-y-6">
                                            {/* Google Profile Section */}
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Google Account</h3>
                                                <div className="bg-background border border-border rounded-2xl p-4">
                                                    {googleProfile ? (
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <img 
                                                                    src={googleProfile.picture} 
                                                                    alt={googleProfile.name} 
                                                                    className="w-10 h-10 rounded-full border border-border"
                                                                />
                                                                <div>
                                                                    <div className="font-medium text-primary">{googleProfile.name}</div>
                                                                    <div className="text-xs text-muted">{googleProfile.email}</div>
                                                                </div>
                                                            </div>
                                                            <button 
                                                                onClick={handleDisconnectSpreadsheet}
                                                                className="text-xs text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                                                            >
                                                                Sign Out
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-4">
                                                            <p className="text-sm text-muted mb-4">Sign in to sync your settings and connect your spreadsheet.</p>
                                                            <button 
                                                                onClick={handleGoogleLogin}
                                                                className="w-full py-2.5 bg-primary text-background font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                                            >
                                                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                                                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                                                </svg>
                                                                Sign in with Google
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </section>

                                            {/* Spreadsheet Config (Only show if logged in) */}
                                            {googleProfile && (
                                                <section>
                                                    <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Spreadsheet Connection</h3>
                                                    <div className="bg-background border border-border rounded-2xl p-4 space-y-4">
                                                        <div>
                                                            <label className="block text-xs font-medium text-muted mb-1">Spreadsheet Link</label>
                                                            <div className="flex gap-2">
                                                                <input 
                                                                    type="text" 
                                                                    className="flex-1 bg-surface border border-border rounded-xl p-3 text-xs text-primary focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
                                                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                                                    value={spreadsheetLink}
                                                                    onChange={(e) => setSpreadsheetLink(e.target.value)}
                                                                    disabled={!!spreadsheetConfig}
                                                                />
                                                                {spreadsheetConfig && (
                                                                    <a 
                                                                        href={spreadsheetConfig.spreadsheetUrl} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="p-3 bg-surface border border-border rounded-xl text-primary hover:bg-muted/10 transition-colors"
                                                                    >
                                                                        <Layout className="w-4 h-4" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {!spreadsheetConfig && (
                                                            <button 
                                                                onClick={() => {
                                                                    if (!spreadsheetLink) return;
                                                                    const match = spreadsheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
                                                                    if (!match) {
                                                                        alert("Invalid link");
                                                                        return;
                                                                    }
                                                                    handleConnectSpreadsheet(); 
                                                                }}
                                                                disabled={!spreadsheetLink}
                                                                className="w-full py-2.5 bg-primary text-background font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                Connect Spreadsheet
                                                            </button>
                                                        )}
                                                        {spreadsheetConfig && (
                                                            <button 
                                                                onClick={handleDisconnectSpreadsheet}
                                                                className="w-full py-2.5 bg-red-500/10 text-red-500 font-medium rounded-xl hover:bg-red-500/20 transition-colors"
                                                            >
                                                                Disconnect Spreadsheet
                                                            </button>
                                                        )}
                                                    </div>
                                                </section>
                                            )}

                                            {/* Gemini */}
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">AI Intelligence</h3>
                                                <div className="bg-background border border-border rounded-2xl p-4">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                                            <Sparkles className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-primary text-sm">Google Gemini API</div>
                                                            <div className="text-xs text-muted">Required for categorization.</div>
                                                        </div>
                                                    </div>
                                                    <input
                                                        type="password"
                                                        className="w-full bg-surface border border-border rounded-xl p-3 text-primary focus:outline-none focus:border-acc-note transition-colors placeholder:text-muted/20 text-xs"
                                                        value={geminiKey}
                                                        onChange={(e) => setGeminiKey(e.target.value)}
                                                        placeholder="AIzaSy..."
                                                    />
                                                </div>
                                            </section>

                                            {/* GitHub */}
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Cloud Sync</h3>
                                                <div className="bg-background border border-border rounded-2xl p-4 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-black/10 dark:bg-white/10 rounded-xl">
                                                                <Github className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">GitHub</div>
                                                                <div className="text-xs text-muted">Sync data to a private repo.</div>
                                                            </div>
                                                        </div>
                                                        {githubConfig.token && (
                                                            <button onClick={handleDisconnectGithub} className="text-red-400 hover:bg-red-400/10 p-2 rounded-lg" title="Disconnect">
                                                                <WifiOff className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="space-y-2">
                                                        <input
                                                            type="password"
                                                            className="w-full bg-surface border border-border rounded-xl p-3 text-primary focus:outline-none focus:border-acc-todo transition-colors placeholder:text-muted/20 text-xs"
                                                            value={githubConfig.token}
                                                            onChange={(e) => setGithubConfig({ ...githubConfig, token: e.target.value })}
                                                            placeholder="Personal Access Token (ghp_...)"
                                                        />
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input
                                                                type="text"
                                                                className="w-full bg-surface border border-border rounded-xl p-3 text-primary focus:outline-none focus:border-acc-todo transition-colors text-xs"
                                                                value={githubConfig.owner}
                                                                onChange={(e) => setGithubConfig({ ...githubConfig, owner: e.target.value })}
                                                                placeholder="Owner (User/Org)"
                                                            />
                                                            <input
                                                                type="text"
                                                                className="w-full bg-surface border border-border rounded-xl p-3 text-primary focus:outline-none focus:border-acc-todo transition-colors text-xs"
                                                                value={githubConfig.repo}
                                                                onChange={(e) => setGithubConfig({ ...githubConfig, repo: e.target.value })}
                                                                placeholder="Repository"
                                                            />
                                                        </div>
                                                        <input
                                                            type="text"
                                                            className="w-full bg-surface border border-border rounded-xl p-3 text-primary focus:outline-none focus:border-acc-todo transition-colors text-xs"
                                                            value={githubConfig.path}
                                                            onChange={(e) => setGithubConfig({ ...githubConfig, path: e.target.value })}
                                                            placeholder="File Path (e.g. db.json)"
                                                        />
                                                    </div>
                                                </div>
                                            </section>

                                            {/* Google Calendar */}
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Integrations</h3>
                                                <div className="bg-background border border-border rounded-2xl p-4 space-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                                                            <Calendar className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-primary text-sm">Google Calendar</div>
                                                            <div className="text-xs text-muted">Sync events (Coming Soon)</div>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-surface border border-border rounded-xl p-3 text-primary focus:outline-none focus:border-blue-500 transition-colors placeholder:text-muted/20 text-xs"
                                                            value={gCalKey}
                                                            onChange={(e) => setGCalKey(e.target.value)}
                                                            placeholder="Google Calendar API Key"
                                                        />
                                                        <input
                                                            type="text"
                                                            className="w-full bg-surface border border-border rounded-xl p-3 text-primary focus:outline-none focus:border-blue-500 transition-colors placeholder:text-muted/20 text-xs"
                                                            value={gCalId}
                                                            onChange={(e) => setGCalId(e.target.value)}
                                                            placeholder="Calendar ID (e.g. primary or email)"
                                                        />
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    )}
                                    {/* CHANGELOG TAB */}
                                    {activeTab === 'changelog' && (
                                        <div className="space-y-6">
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Version History</h3>
                                                <div className="space-y-4">
                                                    <div className="bg-background border border-border rounded-2xl p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="font-bold text-primary">v0.3.3</div>
                                                            <div className="text-xs text-muted">May 2026</div>
                                                        </div>
                                                        <ul className="text-sm text-muted space-y-2 list-disc pl-4">
                                                            <li>Added Smart Canonicalizer foundations so parser results can store stable canonical merchant, payment method, and subcommodity metadata without changing raw user input.</li>
                                                            <li>Pending Review now surfaces canonical suggestions, and approved review corrections can teach the app new learned mappings for future parses.</li>
                                                            <li>Learned canonical aliases now merge deterministically, decay after rejection, and lose auto-apply when they become risky.</li>
                                                            <li>Money search, wallet filters, wallet balances, AI insights, and exports now read canonical merchant, payment method, commodity, and subcommodity clusters while preserving raw item text.</li>
                                                        </ul>
                                                    </div>
                                                    <div className="bg-background border border-border rounded-2xl p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="font-bold text-primary">v0.3.2</div>
                                                            <div className="text-xs text-muted">May 2026</div>
                                                        </div>
                                                        <ul className="text-sm text-muted space-y-2 list-disc pl-4">
                                                            <li>Added behavior drift alerts that flag real pattern changes instead of only static summaries.</li>
                                                            <li>New alerts can catch 3-day food spend runs, wants reactivation, task throughput dips, and 2-week skill stagnation.</li>
                                                            <li>Refreshed AI insight cache versioning so newly shipped insight logic shows up without waiting for yesterday's cached cards to expire.</li>
                                                        </ul>
                                                    </div>
                                                    <div className="bg-background border border-border rounded-2xl p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="font-bold text-primary">v0.3.1</div>
                                                            <div className="text-xs text-muted">April 2026</div>
                                                        </div>
                                                        <ul className="text-sm text-muted space-y-2 list-disc pl-4">
                                                            <li>Stabilized all Gemini-based AI services with shared key handling and retry logic.</li>
                                                            <li>Hardened AI JSON parsing so fenced/prose-wrapped responses no longer break flows easily.</li>
                                                            <li>Improved Google Sheets sync reliability with token refresh retry, rate-limit backoff, and chunked sheet writes.</li>
                                                            <li>Expanded spreadsheet history reads/writes to avoid truncated backups on larger databases.</li>
                                                            <li>Reduced silent localStorage failures with safer read/write guards.</li>
                                                        </ul>
                                                    </div>
                                                    <div className="bg-background border border-border rounded-2xl p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="font-bold text-primary">v0.3.0</div>
                                                            <div className="text-xs text-muted">April 2026</div>
                                                        </div>
                                                        <ul className="text-sm text-muted space-y-2 list-disc pl-4">
                                                            <li>Fixed wiggly animations when switching sub-tabs.</li>
                                                            <li>Enhanced summary numbers in Focus and Notes tabs.</li>
                                                            <li>Fixed navigation bar expansion on sub-tabs.</li>
                                                            <li>Improved dark and light mode theme consistency.</li>
                                                            <li>Fixed navbar width consistency.</li>
                                                            <li>Set AI draft review disabled by default.</li>
                                                            <li>Set collapsed card view enabled by default.</li>
                                                        </ul>
                                                    </div>
                                                    <div className="bg-background border border-border rounded-2xl p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="font-bold text-primary">v0.2.0</div>
                                                            <div className="text-xs text-muted">April 2026</div>
                                                        </div>
                                                        <ul className="text-sm text-muted space-y-2 list-disc pl-4">
                                                            <li>Added Changelog section to Control Center.</li>
                                                            <li>Refined UI theme for light mode consistency.</li>
                                                            <li>Fixed navbar background color in light mode.</li>
                                                            <li>Removed "Life" tab from navigation.</li>
                                                        </ul>
                                                    </div>
                                                    <div className="bg-background border border-border rounded-2xl p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="font-bold text-primary">v0.1.0</div>
                                                            <div className="text-xs text-muted">Initial Release</div>
                                                        </div>
                                                        <ul className="text-sm text-muted space-y-2 list-disc pl-4">
                                                            <li>Initial BrainDump AI release.</li>
                                                            <li>Added Gemini parsing support.</li>
                                                            <li>Added Budget and Money tracking.</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                    
                    {/* Connection Modal */}
                    {connectionModal?.isOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
                            <div className="bg-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-border">
                                <h3 className="text-xl font-bold text-primary mb-2">Connect Database</h3>
                                <p className="text-sm text-muted mb-6">How would you like to handle the data when connecting to {connectionModal.provider === 'github' ? 'GitHub' : 'Google Sheets'}?</p>
                                
                                <div className="space-y-3">
                                    <button 
                                        onClick={() => handleConnectionChoice('merge')}
                                        className="w-full text-left p-4 rounded-2xl border border-border hover:bg-muted/5 transition-colors group"
                                    >
                                        <div className="font-bold text-primary group-hover:text-emerald-500 transition-colors">Merge Data</div>
                                        <div className="text-xs text-muted mt-1">Combine local data with cloud data.</div>
                                    </button>
                                    <button 
                                        onClick={() => handleConnectionChoice('overwrite_cloud')}
                                        className="w-full text-left p-4 rounded-2xl border border-border hover:bg-muted/5 transition-colors group"
                                    >
                                        <div className="font-bold text-primary group-hover:text-blue-500 transition-colors">Overwrite Cloud</div>
                                        <div className="text-xs text-muted mt-1">Replace cloud data with your current local data.</div>
                                    </button>
                                    <button 
                                        onClick={() => handleConnectionChoice('overwrite_local')}
                                        className="w-full text-left p-4 rounded-2xl border border-border hover:bg-muted/5 transition-colors group"
                                    >
                                        <div className="font-bold text-primary group-hover:text-amber-500 transition-colors">Overwrite Local</div>
                                        <div className="text-xs text-muted mt-1">Replace your current local data with cloud data.</div>
                                    </button>
                                </div>
                                
                                <button 
                                    onClick={() => setConnectionModal(null)}
                                    className="mt-6 w-full py-3 text-sm font-bold text-muted hover:text-primary transition-colors rounded-xl hover:bg-muted/10"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </AnimatePresence>
    );
};

export default ControlCenter;
