
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Settings, RefreshCw, CloudCheck, CloudOff, Save, 
    Moon, Sun, X, AlertTriangle, Github,
    Monitor, Layout, Eye, EyeOff, Database, Download, Upload, Trash2,
    Check, Smartphone, WifiOff, CheckCircle2, PieChart, Plus, Sparkles,
    MessageSquare, Calendar, AlertCircle, ChevronRight, ArrowLeft
} from 'lucide-react';
import { SyncStatus, AppSettings, BudgetConfig, BudgetRule, BrainDumpItem, Skill, Wallet } from '../types';
import { getGithubConfig, saveGithubConfig, clearGithubConfig, GithubConfig } from '../services/githubService';
import { getGeminiKey, saveGeminiKey, DEFAULT_PROMPT } from '../services/geminiService';
import { exportToExcel } from '../services/exportService';

interface ControlCenterProps {
    isOpen: boolean;
    onClose: () => void;
    syncStatus: SyncStatus;
    onSyncClick: () => void;
    onRefreshClick?: () => void;
    
    // App State & Settings
    appSettings: AppSettings;
    setAppSettings: (settings: AppSettings) => void;
    error: string | null;
    pendingCount: number;

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
    isOpen, onClose, syncStatus, onSyncClick, onRefreshClick, 
    appSettings, setAppSettings, error, pendingCount,
    onSave, currentBudgetConfig, currentPrompt,
    allItems, allSkills, allWallets, monthlyThemes,
    onImportData, onClearData
}) => {
    
    // --- Settings State ---
    const [activeTab, setActiveTab] = useState<'main' | 'appearance' | 'behavior' | 'budget' | 'data' | 'connect'>('main');
    const [direction, setDirection] = useState(1); // 1 for forward, -1 for back
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

    const handleTabChange = (tab: typeof activeTab) => {
        if (tab === 'main') {
            setDirection(-1);
        } else {
            setDirection(1);
        }
        setActiveTab(tab);
    };

    // GitHub
    const [githubConfig, setGithubConfig] = useState<GithubConfig>({ token: '', owner: '', repo: '', path: 'db.json' });
    
    // Gemini
    const [geminiKey, setGeminiKey] = useState('');
    const [prompt, setPrompt] = useState('');
    
    // Google Calendar
    const [gCalKey, setGCalKey] = useState('');
    const [gCalId, setGCalId] = useState('');

    // Budget
    const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
    const [budgetRules, setBudgetRules] = useState<BudgetRule[]>([]);

    // Local App Settings (buffered)
    const [localAppSettings, setLocalAppSettings] = useState<AppSettings>(appSettings);

    // --- Initialization ---
    useEffect(() => {
        if (isOpen) {
            // Load GitHub
            const gh = getGithubConfig();
            if (gh) setGithubConfig(gh);

            // Load Gemini
            setGeminiKey(getGeminiKey());
            
            // Load GCal
            setGCalKey(localStorage.getItem('braindump_gcal_key') || '');
            setGCalId(localStorage.getItem('braindump_gcal_id') || '');

            // Load Budget
            if (currentBudgetConfig) {
                setMonthlyIncome(currentBudgetConfig.monthlyIncome || 0);
                setBudgetRules(currentBudgetConfig.rules || []);
            } else {
                setBudgetRules([
                    { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
                    { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
                    { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
                ]);
            }

            // Load Prompt
            setPrompt(currentPrompt || DEFAULT_PROMPT);

            // Load App Settings
            setLocalAppSettings(appSettings);

            setSaveStatus('idle');
            setActiveTab('main'); // Reset to main view on open
        }
    }, [isOpen, currentBudgetConfig, currentPrompt, appSettings]);

    // --- Handlers ---

    const handleSave = () => {
        // Save GitHub
        if (githubConfig.token && githubConfig.owner && githubConfig.repo) {
            saveGithubConfig(githubConfig);
        }

        // Save Gemini
        saveGeminiKey(geminiKey);

        // Save GCal
        localStorage.setItem('braindump_gcal_key', gCalKey);
        localStorage.setItem('braindump_gcal_id', gCalId);

        // Prepare Objects
        const newBudgetConfig: BudgetConfig = { monthlyIncome, rules: budgetRules };

        setSaveStatus('saved');
        
        // Propagate changes
        onSave(newBudgetConfig, prompt, localAppSettings);
        
        setTimeout(() => {
            setSaveStatus('idle');
        }, 800);
    };

    const handleDisconnectGithub = () => {
        if (window.confirm("Disconnect GitHub? The app will switch to Local Mode.")) {
            clearGithubConfig();
            setGithubConfig({ token: '', owner: '', repo: '', path: 'db.json' });
        }
    };

    const handleExportExcel = () => {
        exportToExcel(
            allItems, 
            allSkills, 
            allWallets, 
            { monthlyIncome, rules: budgetRules }, 
            monthlyThemes, 
            localAppSettings
        );
    };

    const handleExportJSON = () => {
        const data = {
            items: allItems,
            skills: allSkills,
            wallets: allWallets,
            budgetConfig: { monthlyIncome, rules: budgetRules },
            monthlyThemes,
            appSettings: localAppSettings,
            customPrompt: prompt
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `braindump-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Budget Handlers
    const handleAddRule = () => {
        setBudgetRules([...budgetRules, { id: `cat-${Date.now()}`, name: 'New Category', percentage: 0, color: 'bg-gray-500' }]);
    };
    const handleRemoveRule = (index: number) => {
        const newRules = [...budgetRules];
        newRules.splice(index, 1);
        setBudgetRules(newRules);
    };
    const handleUpdateRule = (index: number, field: keyof BudgetRule, value: any) => {
        const newRules = [...budgetRules];
        newRules[index] = { ...newRules[index], [field]: value };
        setBudgetRules(newRules);
    };
    const totalPercentage = budgetRules.reduce((sum, r) => sum + r.percentage, 0);

    const toggleTheme = () => {
        const newTheme = localAppSettings.theme === 'dark' ? 'light' : 'dark';
        const newSettings = { ...localAppSettings, theme: newTheme };
        setLocalAppSettings(newSettings);
        setAppSettings(newSettings); // Apply immediately for instant feedback
        onSave(undefined, undefined, newSettings); // Persist
    };

    const renderSyncStatus = () => {
        switch(syncStatus) {
            case 'synced':
                return <div className="flex items-center gap-2 text-emerald-500"><CloudCheck className="w-5 h-5" /><span className="font-medium">Synced</span></div>;
            case 'syncing':
                return <div className="flex items-center gap-2 text-blue-500"><RefreshCw className="w-5 h-5 animate-spin" /><span className="font-medium">Syncing...</span></div>;
            case 'error':
                return <div className="flex items-center gap-2 text-red-500"><CloudOff className="w-5 h-5" /><span className="font-medium">Failed</span></div>;
            case 'local':
                return <div className="flex items-center gap-2 text-amber-500"><Save className="w-5 h-5" /><span className="font-medium">Local</span></div>;
        }
    };

    const menuItems = [
        { id: 'appearance', label: 'Appearance', icon: <Monitor className="w-5 h-5" />, desc: 'Theme, UI options' },
        { id: 'behavior', label: 'Behavior', icon: <Smartphone className="w-5 h-5" />, desc: 'Prompts, defaults' },
        { id: 'budget', label: 'Budget', icon: <PieChart className="w-5 h-5" />, desc: 'Income, categories' },
        { id: 'data', label: 'Data', icon: <Database className="w-5 h-5" />, desc: 'Export, import, reset' },
        { id: 'connect', label: 'Connect', icon: <Layout className="w-5 h-5" />, desc: 'GitHub, Gemini, APIs' },
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
                                            disabled={saveStatus === 'saved'}
                                            className={`p-2 rounded-full transition-all ${saveStatus === 'saved' ? 'bg-green-500 text-white' : 'hover:bg-muted/10 text-primary'}`}
                                        >
                                            {saveStatus === 'saved' ? <CheckCircle2 className="w-6 h-6" /> : <Save className="w-6 h-6" />}
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
                                            <div className="bg-background border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
                                                <div className="flex items-center gap-6">
                                                    {pendingCount > 0 && (
                                                        <div className="flex flex-col gap-1 border-r border-border pr-6">
                                                            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Pending</span>
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
                                                    {(syncStatus === 'error' || syncStatus === 'local') && (
                                                        <button onClick={onSyncClick} className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors">
                                                            <RefreshCw className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                    {syncStatus === 'synced' && onRefreshClick && (
                                                        <button onClick={onRefreshClick} className="p-2 bg-surface border border-border text-muted hover:text-primary rounded-xl transition-colors">
                                                            <RefreshCw className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
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
                                                    <span>BrainDump AI v0.2.0</span>
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
                                                            <div className="relative w-11 h-6 bg-muted/30 peer-focus:outline-none rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
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
                                                            <div className="relative w-11 h-6 bg-muted/30 peer-focus:outline-none rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
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
                                                                    className="w-12 bg-black/10 dark:bg-black/20 text-xs text-right text-primary rounded p-1 focus:outline-none"
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

                                            <section>
                                                <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 ml-1">Danger Zone</h3>
                                                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
                                                    <div className="flex items-start gap-3 mb-4">
                                                        <div className="p-2 bg-red-500/10 rounded-xl text-red-500 shrink-0">
                                                            <Trash2 className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-red-600 dark:text-red-400 text-sm">Clear All Data</div>
                                                            <div className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">
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
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ControlCenter;
