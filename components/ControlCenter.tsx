import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    Bell,
    Calendar,
    Check,
    CheckCircle2,
    ChevronRight,
    CloudCheck,
    CloudOff,
    Database,
    Download,
    Github,
    History,
    Layout,
    MessageSquare,
    Monitor,
    Moon,
    PieChart,
    Plus,
    RefreshCw,
    Save,
    Smartphone,
    Sparkles,
    Sun,
    Trash2,
    Upload,
    WifiOff,
    X,
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
    appSettings: AppSettings;
    setAppSettings: (settings: AppSettings) => void;
    error: string | null;
    pendingCount: number;
    parsingTasks?: import('../types').ParsingTask[];
    retryParsing?: (taskId: string) => void;
    onSave: (newBudgetConfig?: BudgetConfig, newPrompt?: string, newAppSettings?: AppSettings) => void;
    currentBudgetConfig?: BudgetConfig;
    currentPrompt?: string;
    allItems: BrainDumpItem[];
    allSkills: Skill[];
    allWallets: Wallet[];
    monthlyThemes: Record<string, string>;
    onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClearData: () => void;
}

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

const CHANGELOG_ENTRIES = [
    {
        version: 'v0.3.1',
        date: 'April 2026',
        bullets: [
            'Stabilized Gemini-based AI services with shared key handling and retry logic.',
            'Hardened JSON parsing so fenced or prose-wrapped AI responses fail less often.',
            'Improved Google Sheets sync with token refresh retry, backoff, and chunked writes.',
            'Expanded spreadsheet history handling for larger backups and safer local fallbacks.',
        ],
    },
    {
        version: 'v0.3.0',
        date: 'April 2026',
        bullets: [
            'Fixed sub-tab motion and navigation consistency issues.',
            'Improved light and dark theme consistency across the app.',
            'Adjusted defaults for draft review and collapsed card behavior.',
        ],
    },
    {
        version: 'v0.2.0',
        date: 'April 2026',
        bullets: [
            'Added changelog section to Control Center.',
            'Refined light mode styling and navbar consistency.',
            'Removed the old Life tab.',
        ],
    },
    {
        version: 'v0.1.0',
        date: 'Initial release',
        bullets: [
            'Initial BrainDump AI release.',
            'Added Gemini parsing support.',
            'Added budget and money tracking.',
        ],
    },
];

const SectionLabel: React.FC<{ title: string; detail?: string }> = ({ title, detail }) => (
    <div className="mb-3 flex items-center justify-between gap-3">
        <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{title}</h3>
            {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
        </div>
    </div>
);

const GroupCard: React.FC<{ children: React.ReactNode; danger?: boolean }> = ({ children, danger = false }) => (
    <div className={`overflow-hidden rounded-3xl border ${danger ? 'border-red-500/25 bg-red-500/5' : 'border-border/70 bg-background'}`}>
        {children}
    </div>
);

const Toggle: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="h-6 w-11 rounded-full bg-muted/25 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-[18px]" />
    </label>
);

const Row: React.FC<{
    title: string;
    description?: string;
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    onClick?: () => void;
    danger?: boolean;
}> = ({ title, description, leading, trailing, onClick, danger = false }) => {
    const Comp = onClick ? 'button' : 'div';
    return (
        <Comp
            {...(onClick ? { onClick, type: 'button' as const } : {})}
            className={`flex w-full items-start justify-between gap-3 px-4 py-4 text-left ${onClick ? 'transition-colors hover:bg-muted/5' : ''}`}
        >
            <div className="flex min-w-0 flex-1 items-start gap-3">
                {leading && <div className="mt-0.5 shrink-0 text-muted">{leading}</div>}
                <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${danger ? 'text-red-500' : 'text-primary'}`}>{title}</p>
                    {description && <p className={`mt-1 text-xs ${danger ? 'text-red-500/80' : 'text-muted'}`}>{description}</p>}
                </div>
            </div>
            {trailing && <div className="shrink-0">{trailing}</div>}
        </Comp>
    );
};

const Divider = () => <div className="h-px bg-border/70" />;

const Field: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input
        {...props}
        className={`w-full rounded-2xl border border-border bg-surface px-3 py-3 text-sm text-primary placeholder:text-muted/50 focus:border-primary focus:outline-none ${props.className || ''}`}
    />
);

const Area: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => (
    <textarea
        {...props}
        className={`w-full rounded-2xl border border-border bg-surface px-3 py-3 text-sm text-primary placeholder:text-muted/50 focus:border-primary focus:outline-none ${props.className || ''}`}
    />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
    <select
        {...props}
        className={`w-full rounded-2xl border border-border bg-surface px-3 py-3 text-sm text-primary focus:border-primary focus:outline-none ${props.className || ''}`}
    />
);

const ControlCenter: React.FC<ControlCenterProps> = ({
    isOpen, onClose, saveStatus, fetchStatus, onSyncClick, onRefreshClick,
    appSettings, setAppSettings, error, pendingCount, parsingTasks, retryParsing,
    onSave, currentBudgetConfig, currentPrompt,
    allItems, allSkills, allWallets, monthlyThemes,
    onImportData, onClearData,
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
            const jsonString = JSON.stringify(entry.data);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const file = new File([blob], 'backup.json', { type: 'application/json' });
            const event = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
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
        currentPrompt,
    });

    useEffect(() => {
        if (activeTab === 'data' && spreadsheetConfig) {
            fetchHistory();
        }
    }, [activeTab, spreadsheetConfig]);

    const menuItems = [
        { id: 'appearance', label: 'Appearance', icon: <Monitor className="h-5 w-5" />, desc: 'Theme, display, privacy' },
        { id: 'behavior', label: 'Behavior', icon: <Smartphone className="h-5 w-5" />, desc: 'Prompt flow, parsing, defaults' },
        { id: 'notifications', label: 'Notifications', icon: <Bell className="h-5 w-5" />, desc: 'Alerts and reminder behavior' },
        { id: 'budget', label: 'Budget', icon: <PieChart className="h-5 w-5" />, desc: 'Income and category allocation' },
        { id: 'data', label: 'Data', icon: <Database className="h-5 w-5" />, desc: 'Export, import, restore, reset' },
        { id: 'connect', label: 'Connect', icon: <Layout className="h-5 w-5" />, desc: 'Google, spreadsheet, GitHub, AI' },
        { id: 'changelog', label: 'Changelog', icon: <History className="h-5 w-5" />, desc: 'Recent product updates' },
    ];

    const activeStatus = saveStatus === 'saving'
        ? 'saving'
        : fetchStatus === 'syncing'
            ? 'syncing'
            : saveStatus === 'error' || fetchStatus === 'error'
                ? 'error'
                : saveStatus === 'local'
                    ? 'local'
                    : 'synced';

    const statusMeta = {
        synced: {
            title: 'Synced',
            support: 'Everything up to date',
            icon: <CloudCheck className="h-5 w-5 text-emerald-500" />,
        },
        syncing: {
            title: 'Fetching',
            support: 'Checking latest cloud state',
            icon: <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />,
        },
        saving: {
            title: 'Saving',
            support: 'Writing your latest changes',
            icon: <Save className="h-5 w-5 animate-spin text-amber-500" />,
        },
        error: {
            title: 'Sync failed',
            support: error || 'Something went wrong during sync',
            icon: <CloudOff className="h-5 w-5 text-red-500" />,
        },
        local: {
            title: pendingCount > 0 ? `${pendingCount} pending change${pendingCount === 1 ? '' : 's'}` : 'Local changes only',
            support: 'Your latest changes are not uploaded yet',
            icon: <Save className="h-5 w-5 text-amber-500" />,
        },
    } as const;

    const pageTitle = activeTab === 'main' ? 'Control Center' : menuItems.find((item) => item.id === activeTab)?.label || 'Control Center';
    const pageSubtitle = activeTab === 'main'
        ? 'Status first, settings second.'
        : menuItems.find((item) => item.id === activeTab)?.desc || '';

    const renderMainView = () => (
        <div className="space-y-5">
            <GroupCard>
                <div className="space-y-4 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                {statusMeta[activeStatus].icon}
                                <h3 className="text-lg font-semibold text-primary">{statusMeta[activeStatus].title}</h3>
                            </div>
                            <p className="mt-2 text-sm text-muted">{statusMeta[activeStatus].support}</p>
                            {pendingCount > 0 && activeStatus === 'synced' && (
                                <p className="mt-2 text-xs text-muted">{pendingCount} parser review item{pendingCount === 1 ? '' : 's'} waiting.</p>
                            )}
                        </div>
                        {settingsSaveStatus === 'saved' && (
                            <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-500">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        )}
                    </div>

                    {(activeStatus === 'error' || activeStatus === 'local') && (
                        <div className="flex items-center gap-2 rounded-2xl bg-surface p-1 text-xs font-medium text-muted">
                            <button
                                onClick={() => setSyncMode('merge')}
                                className={`flex-1 rounded-xl px-3 py-2 transition-colors ${syncMode === 'merge' ? 'bg-background text-primary' : 'hover:text-primary'}`}
                            >
                                Merge
                            </button>
                            <button
                                onClick={() => setSyncMode('overwrite')}
                                className={`flex-1 rounded-xl px-3 py-2 transition-colors ${syncMode === 'overwrite' ? 'bg-background text-red-500' : 'hover:text-red-500'}`}
                            >
                                Overwrite
                            </button>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        {(activeStatus === 'error' || activeStatus === 'local') && (
                            <button
                                onClick={() => onSyncClick(syncMode === 'overwrite')}
                                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                            >
                                {activeStatus === 'error' ? 'Retry sync' : 'Sync now'}
                            </button>
                        )}
                        {onRefreshClick && (
                            <button
                                onClick={onRefreshClick}
                                className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-muted/5"
                            >
                                Refresh
                            </button>
                        )}
                        <button
                            onClick={handleSave}
                            className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-muted/5"
                        >
                            Save settings
                        </button>
                    </div>
                </div>
            </GroupCard>

            {error && activeStatus !== 'error' && (
                <GroupCard danger>
                    <Row
                        title="Attention needed"
                        description={error}
                        leading={<AlertTriangle className="h-5 w-5 text-red-500" />}
                        danger
                    />
                </GroupCard>
            )}

            <GroupCard>
                <div className="divide-y divide-border/70">
                    {menuItems.map((item) => (
                        <Row
                            key={item.id}
                            title={item.label}
                            description={item.desc}
                            leading={item.icon}
                            trailing={<ChevronRight className="h-4 w-4 text-muted" />}
                            onClick={() => handleTabChange(item.id as any)}
                        />
                    ))}
                </div>
            </GroupCard>

            <div className="px-1 pt-1 text-xs text-muted">
                BrainDump AI v0.3.1
            </div>
        </div>
    );

    const renderAppearance = () => (
        <div className="space-y-5">
            <section>
                <SectionLabel title="Theme" detail="Pick the default theme for the app." />
                <GroupCard>
                    <div className="divide-y divide-border/70">
                        <Row
                            title="Light"
                            description="Bright interface"
                            leading={<Sun className="h-5 w-5 text-amber-500" />}
                            trailing={localAppSettings.theme === 'light' ? <Check className="h-4 w-4 text-primary" /> : undefined}
                            onClick={() => {
                                const next = { ...localAppSettings, theme: 'light' as const };
                                setLocalAppSettings(next);
                                setAppSettings(next);
                            }}
                        />
                        <Row
                            title="Dark"
                            description="Dim interface"
                            leading={<Moon className="h-5 w-5 text-indigo-400" />}
                            trailing={localAppSettings.theme === 'dark' ? <Check className="h-4 w-4 text-primary" /> : undefined}
                            onClick={() => {
                                const next = { ...localAppSettings, theme: 'dark' as const };
                                setLocalAppSettings(next);
                                setAppSettings(next);
                            }}
                        />
                        <Row
                            title="System"
                            description="Follow device appearance"
                            leading={<Monitor className="h-5 w-5" />}
                            trailing={!localAppSettings.theme ? <Check className="h-4 w-4 text-primary" /> : undefined}
                            onClick={() => {
                                const next = { ...localAppSettings, theme: undefined };
                                setLocalAppSettings(next);
                                setAppSettings(next);
                            }}
                        />
                    </div>
                </GroupCard>
            </section>

            <section>
                <SectionLabel title="Display" detail="Default UI behavior for daily use." />
                <GroupCard>
                    <div className="divide-y divide-border/70">
                        <Row
                            title="Hide money values"
                            description="Obfuscate amounts by default"
                            trailing={<Toggle checked={localAppSettings.hideMoney} onChange={(checked) => setLocalAppSettings({ ...localAppSettings, hideMoney: checked })} />}
                        />
                        <Row
                            title="Compact cards"
                            description="Start with items collapsed"
                            trailing={<Toggle checked={localAppSettings.defaultCollapsed} onChange={(checked) => setLocalAppSettings({ ...localAppSettings, defaultCollapsed: checked })} />}
                        />
                    </div>
                </GroupCard>
            </section>

            <section>
                <SectionLabel title="Privacy" detail="Optional automation that affects what the app surfaces." />
                <GroupCard>
                    <Row
                        title="Daily AI insights"
                        description="Automatically generate insights each day"
                        trailing={<Toggle checked={localAppSettings.enableDailyInsight ?? false} onChange={(checked) => setLocalAppSettings({ ...localAppSettings, enableDailyInsight: checked })} />}
                    />
                </GroupCard>
            </section>
        </div>
    );

    const renderBehavior = () => (
        <div className="space-y-5">
            <section>
                <SectionLabel title="Capture behavior" detail="How incoming text gets parsed and reviewed." />
                <GroupCard>
                    <div className="divide-y divide-border/70">
                        <Row
                            title="Pro parsing mode"
                            description="Use the 3-stage parsing flow for better accuracy"
                            trailing={<Toggle checked={localAppSettings.useProParser ?? false} onChange={(checked) => setLocalAppSettings({ ...localAppSettings, useProParser: checked })} />}
                        />
                        <Row
                            title="AI draft review"
                            description="Review parsed results before saving"
                            trailing={<Toggle checked={localAppSettings.enableDraftReview ?? false} onChange={(checked) => setLocalAppSettings({ ...localAppSettings, enableDraftReview: checked })} />}
                        />
                    </div>
                </GroupCard>
            </section>

            <section>
                <SectionLabel title="Models" detail="Choose the Gemini model used for each AI flow." />
                <GroupCard>
                    <div className="space-y-4 px-4 py-4">
                        <div>
                            <label className="mb-2 block text-xs font-medium text-muted">Parsing chat</label>
                            <Select value={localAppSettings.parsingModel || 'gemini-3-flash-preview'} onChange={(e) => setLocalAppSettings({ ...localAppSettings, parsingModel: e.target.value })}>
                                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                                <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Exp)</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                                <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite Preview</option>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-medium text-muted">Chat bar AI</label>
                            <Select value={localAppSettings.chatModel || 'gemini-3-flash-preview'} onChange={(e) => setLocalAppSettings({ ...localAppSettings, chatModel: e.target.value })}>
                                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                                <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Exp)</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                                <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite Preview</option>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-2 block text-xs font-medium text-muted">AI insights</label>
                            <Select value={localAppSettings.insightModel || 'gemini-3-flash-preview'} onChange={(e) => setLocalAppSettings({ ...localAppSettings, insightModel: e.target.value })}>
                                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                                <option value="gemini-2.0-pro-exp">Gemini 2.0 Pro (Exp)</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                                <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite Preview</option>
                            </Select>
                        </div>
                    </div>
                </GroupCard>
            </section>

            <section>
                <SectionLabel title="Prompt" detail="Advanced parsing instructions used by Gemini." />
                <GroupCard>
                    <div className="space-y-3 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-primary">System prompt</p>
                            <button
                                onClick={() => setPrompt(DEFAULT_PROMPT)}
                                disabled={prompt === DEFAULT_PROMPT}
                                className="text-xs font-medium text-primary transition-opacity hover:opacity-80 disabled:opacity-40"
                            >
                                Reset to default
                            </button>
                        </div>
                        <Area value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[280px] font-mono text-xs" />
                    </div>
                </GroupCard>
            </section>

            {parsingTasks && parsingTasks.length > 0 && retryParsing && (
                <section>
                    <SectionLabel title="Parser queue" detail="Retry or inspect items that still need review." />
                    <GroupCard>
                        <div className="px-4 py-3">
                            <button
                                onClick={() => setIsParsingTasksExpanded((prev) => !prev)}
                                className="flex w-full items-center justify-between text-left"
                            >
                                <span className="text-sm font-medium text-primary">{parsingTasks.length} parsing task{parsingTasks.length === 1 ? '' : 's'}</span>
                                <span className="text-xs text-muted">{isParsingTasksExpanded ? 'Hide' : 'Show'}</span>
                            </button>
                        </div>
                        {isParsingTasksExpanded && (
                            <>
                                <Divider />
                                <div className="divide-y divide-border/70">
                                    {parsingTasks.map((task: any) => (
                                        <div key={task.id} className="flex items-start justify-between gap-3 px-4 py-4">
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-primary">{task.originalText || task.text || 'Pending parse item'}</p>
                                                <p className="mt-1 text-xs text-muted">{task.error || task.status || 'Needs retry'}</p>
                                            </div>
                                            <button onClick={() => retryParsing(task.id)} className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted/5">
                                                Retry
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </GroupCard>
                </section>
            )}
        </div>
    );

    const renderNotifications = () => (
        <div className="space-y-5">
            <section>
                <SectionLabel title="Permission" detail="Allow desktop or mobile alerts from the browser." />
                <GroupCard>
                    <div className="space-y-3 px-4 py-4">
                        <p className="text-sm text-muted">Request permission once, then test whether alerts show up correctly.</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={async () => {
                                    const { requestNotificationPermission } = await import('../utils/notificationHandler');
                                    const granted = await requestNotificationPermission();
                                    alert(granted ? 'Permission granted!' : 'Permission denied or not supported.');
                                }}
                                className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
                            >
                                Request permission
                            </button>
                            <button
                                onClick={async () => {
                                    const { sendTestNotification } = await import('../utils/notificationHandler');
                                    sendTestNotification();
                                }}
                                className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-primary hover:bg-muted/5"
                            >
                                Test notification
                            </button>
                        </div>
                    </div>
                </GroupCard>
            </section>

            <section>
                <SectionLabel title="Mode" detail="Choose how notifications should alert you." />
                <GroupCard>
                    <div className="px-4 py-4">
                        <Select value={localAppSettings.notificationMode || 'both'} onChange={(e) => setLocalAppSettings({ ...localAppSettings, notificationMode: e.target.value as any })}>
                            <option value="both">Sound & vibrate</option>
                            <option value="sound">Sound only</option>
                            <option value="vibrate">Vibrate only</option>
                            <option value="silent">Silent</option>
                        </Select>
                    </div>
                </GroupCard>
            </section>

            <section>
                <SectionLabel title="Types" detail="Turn individual notification flows on or off." />
                <GroupCard>
                    <div className="divide-y divide-border/70">
                        <Row title="Persistent quick input" description="Keep a quick-thought notification active" trailing={<Toggle checked={localAppSettings.persistentNotification ?? false} onChange={(checked) => setLocalAppSettings({ ...localAppSettings, persistentNotification: checked })} />} />
                        <Row title="Smart behavior prompts" description="Suggest reminders based on your usual input times" trailing={<Toggle checked={localAppSettings.notifyBehavior ?? false} onChange={(checked) => setLocalAppSettings({ ...localAppSettings, notifyBehavior: checked })} />} />
                        <Row title="AI insights" description="Notify when a fresh daily insight is ready" trailing={<Toggle checked={localAppSettings.notifyInsights ?? false} onChange={(checked) => setLocalAppSettings({ ...localAppSettings, notifyInsights: checked })} />} />
                        <Row title="Reminders" description="Notify for scheduled tasks and events" trailing={<Toggle checked={localAppSettings.notifyReminders ?? false} onChange={(checked) => setLocalAppSettings({ ...localAppSettings, notifyReminders: checked })} />} />
                    </div>
                </GroupCard>
            </section>
        </div>
    );

    const renderBudget = () => (
        <div className="space-y-5">
            <section>
                <SectionLabel title="Monthly income" detail="Base amount used for your budget allocation." />
                <GroupCard>
                    <div className="px-4 py-4">
                        <Field type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)} placeholder="e.g. 10000000" />
                    </div>
                </GroupCard>
            </section>

            <section>
                <SectionLabel title="Allocation" detail={`Current total allocation: ${totalPercentage}%`} />
                <GroupCard>
                    <div className="divide-y divide-border/70">
                        {budgetRules.map((rule, idx) => (
                            <div key={rule.id} className="space-y-3 px-4 py-4">
                                <div className="flex items-center gap-3">
                                    <div className={`h-4 w-4 rounded-full ${rule.color}`} />
                                    <Field value={rule.name} onChange={(e) => handleUpdateRule(idx, 'name', e.target.value)} placeholder="Category name" className="flex-1" />
                                    <div className="flex w-24 items-center gap-2">
                                        <Field type="number" value={rule.percentage} onChange={(e) => handleUpdateRule(idx, 'percentage', parseFloat(e.target.value) || 0)} className="text-right" />
                                        <span className="text-sm text-muted">%</span>
                                    </div>
                                    <button onClick={() => handleRemoveRule(idx)} className="rounded-xl p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {COLOR_PRESETS.map((color) => (
                                        <button
                                            key={color.name}
                                            onClick={() => handleUpdateRule(idx, 'color', color.class)}
                                            className={`h-6 w-6 rounded-full ${color.class} ring-offset-2 transition-transform hover:scale-110 ${rule.color === color.class ? 'ring-2 ring-primary' : ''}`}
                                            title={color.name}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Divider />
                    <div className="space-y-3 px-4 py-4">
                        <button onClick={handleAddRule} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm font-medium text-primary hover:bg-muted/5">
                            <Plus className="h-4 w-4" /> Add category
                        </button>
                        {totalPercentage !== 100 && (
                            <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                                <AlertCircle className="h-4 w-4" /> Total percentage should equal 100%.
                            </div>
                        )}
                    </div>
                </GroupCard>
            </section>
        </div>
    );

    const renderData = () => (
        <div className="space-y-5">
            <section>
                <SectionLabel title="Export & import" detail="Move your data in or out safely." />
                <GroupCard>
                    <div className="divide-y divide-border/70">
                        <Row title="Export Excel" description="Download the current database as a spreadsheet" leading={<Download className="h-5 w-5 text-emerald-500" />} onClick={handleExportExcel} />
                        <Row title="Export JSON" description="Download a full JSON backup" leading={<Database className="h-5 w-5 text-blue-500" />} onClick={handleExportJSON} />
                        <label className="block cursor-pointer px-4 py-4 transition-colors hover:bg-muted/5">
                            <div className="flex items-start gap-3">
                                <Upload className="mt-0.5 h-5 w-5 text-indigo-500" />
                                <div>
                                    <p className="text-sm font-medium text-primary">Import JSON backup</p>
                                    <p className="mt-1 text-xs text-muted">Replace local data using an exported backup file</p>
                                </div>
                            </div>
                            <input type="file" accept=".json" onChange={onImportData} className="hidden" />
                        </label>
                    </div>
                </GroupCard>
            </section>

            {spreadsheetConfig && (
                <section>
                    <SectionLabel title="History & restore" detail="Backups created from the connected spreadsheet." />
                    <GroupCard>
                        <div className="flex items-center justify-between gap-3 px-4 py-4">
                            <div>
                                <p className="text-sm font-medium text-primary">Database history</p>
                                <p className="mt-1 text-xs text-muted">Refresh history or create a backup before restoring.</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        if (window.confirm('Create a new backup version now?')) {
                                            onSyncClick(true);
                                            setTimeout(fetchHistory, 2000);
                                        }
                                    }}
                                    className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-primary hover:bg-muted/5"
                                >
                                    Backup now
                                </button>
                                <button
                                    onClick={fetchHistory}
                                    disabled={isFetchingHistory}
                                    className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-primary hover:bg-muted/5 disabled:opacity-50"
                                >
                                    {isFetchingHistory ? 'Loading...' : 'Refresh'}
                                </button>
                            </div>
                        </div>
                        <Divider />
                        {isFetchingHistory && history.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-muted">Loading history...</div>
                        ) : historyError ? (
                            <div className="px-4 py-6 text-sm text-red-500">{historyError}</div>
                        ) : history.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-muted">No history available yet.</div>
                        ) : (
                            <div className="divide-y divide-border/70">
                                {history.map((entry, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-3 px-4 py-4">
                                        <div>
                                            <p className="text-sm font-medium text-primary">
                                                {new Date(entry.timestamp).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                            </p>
                                            <p className="mt-1 text-xs text-muted">
                                                {new Date(entry.timestamp).toLocaleTimeString()} • {entry.data.data?.length || 0} items
                                            </p>
                                        </div>
                                        <button onClick={() => handleRestoreHistory(entry)} className="rounded-xl border border-border px-3 py-2 text-xs font-medium text-primary hover:bg-muted/5">
                                            Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </GroupCard>
                </section>
            )}

            <section>
                <SectionLabel title="Danger zone" detail="Destructive actions are isolated here on purpose." />
                <GroupCard danger>
                    <div className="space-y-4 px-4 py-4">
                        <div>
                            <p className="text-sm font-semibold text-red-500">Clear all data</p>
                            <p className="mt-1 text-xs text-red-500/80">This permanently deletes items, wallets, and settings. This cannot be undone.</p>
                        </div>
                        <button
                            onClick={() => {
                                if (window.confirm('Are you absolutely sure? This will wipe all your data.')) {
                                    onClearData();
                                }
                            }}
                            className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
                        >
                            Reset everything
                        </button>
                    </div>
                </GroupCard>
            </section>
        </div>
    );

    const renderConnect = () => (
        <div className="space-y-5">
            <section>
                <SectionLabel title="Google" detail="Identity and settings sync." />
                <GroupCard>
                    {googleProfile ? (
                        <div className="flex items-center justify-between gap-3 px-4 py-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <img src={googleProfile.picture} alt={googleProfile.name} className="h-11 w-11 rounded-full border border-border" />
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-primary">{googleProfile.name}</p>
                                    <p className="truncate text-xs text-muted">{googleProfile.email}</p>
                                </div>
                            </div>
                            <button onClick={handleDisconnectSpreadsheet} className="rounded-xl border border-red-500/20 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-500/10">
                                Sign out
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3 px-4 py-4">
                            <p className="text-sm text-muted">Sign in to sync settings and connect spreadsheet features.</p>
                            <button onClick={handleGoogleLogin} className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-background hover:opacity-90">
                                {isSyncingProfile ? 'Signing in...' : 'Sign in with Google'}
                            </button>
                        </div>
                    )}
                </GroupCard>
            </section>

            {googleProfile && (
                <section>
                    <SectionLabel title="Spreadsheet" detail="Connect the main database spreadsheet." />
                    <GroupCard>
                        <div className="space-y-3 px-4 py-4">
                            <Field
                                type="text"
                                value={spreadsheetLink}
                                onChange={(e) => setSpreadsheetLink(e.target.value)}
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                disabled={!!spreadsheetConfig}
                            />
                            <div className="flex flex-wrap gap-2">
                                {!spreadsheetConfig ? (
                                    <button
                                        onClick={() => {
                                            if (!spreadsheetLink) return;
                                            const match = spreadsheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
                                            if (!match) {
                                                alert('Invalid link');
                                                return;
                                            }
                                            handleConnectSpreadsheet();
                                        }}
                                        disabled={!spreadsheetLink || isConnectingSpreadsheet}
                                        className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                                    >
                                        {isConnectingSpreadsheet ? 'Connecting...' : 'Connect spreadsheet'}
                                    </button>
                                ) : (
                                    <>
                                        <a href={spreadsheetConfig.spreadsheetUrl} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-border px-4 py-2 text-sm font-semibold text-primary hover:bg-muted/5">
                                            Open spreadsheet
                                        </a>
                                        <button onClick={handleDisconnectSpreadsheet} className="rounded-2xl border border-red-500/20 px-4 py-2 text-sm font-semibold text-red-500 hover:bg-red-500/10">
                                            Disconnect
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </GroupCard>
                </section>
            )}

            <section>
                <SectionLabel title="GitHub" detail="Optional private repo backup config." />
                <GroupCard>
                    <div className="space-y-3 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-primary">GitHub backup</p>
                                <p className="mt-1 text-xs text-muted">Save database snapshots to a private repository.</p>
                            </div>
                            {githubConfig.token && (
                                <button onClick={handleDisconnectGithub} className="rounded-xl p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500" title="Disconnect GitHub">
                                    <WifiOff className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <Field type="password" value={githubConfig.token} onChange={(e) => setGithubConfig({ ...githubConfig, token: e.target.value })} placeholder="Personal access token" />
                        <div className="grid grid-cols-2 gap-3">
                            <Field type="text" value={githubConfig.owner} onChange={(e) => setGithubConfig({ ...githubConfig, owner: e.target.value })} placeholder="Owner" />
                            <Field type="text" value={githubConfig.repo} onChange={(e) => setGithubConfig({ ...githubConfig, repo: e.target.value })} placeholder="Repository" />
                        </div>
                        <Field type="text" value={githubConfig.path} onChange={(e) => setGithubConfig({ ...githubConfig, path: e.target.value })} placeholder="db.json" />
                    </div>
                </GroupCard>
            </section>

            <section>
                <SectionLabel title="Gemini" detail="API key used for AI parsing and insights." />
                <GroupCard>
                    <div className="px-4 py-4">
                        <Field type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIzaSy..." />
                    </div>
                </GroupCard>
            </section>

            <section>
                <SectionLabel title="Calendar/API extras" detail="Reserved integration settings." />
                <GroupCard>
                    <div className="space-y-3 px-4 py-4">
                        <Field type="text" value={gCalKey} onChange={(e) => setGCalKey(e.target.value)} placeholder="Google Calendar API Key" />
                        <Field type="text" value={gCalId} onChange={(e) => setGCalId(e.target.value)} placeholder="Calendar ID" />
                    </div>
                </GroupCard>
            </section>
        </div>
    );

    const renderChangelog = () => (
        <div className="space-y-5">
            <section>
                <SectionLabel title="Version history" detail="Newest updates first." />
                <GroupCard>
                    <div className="divide-y divide-border/70">
                        {CHANGELOG_ENTRIES.map((entry) => (
                            <div key={entry.version} className="px-4 py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-primary">{entry.version}</p>
                                    <p className="text-xs text-muted">{entry.date}</p>
                                </div>
                                <ul className="mt-3 space-y-2 pl-4 text-sm text-muted list-disc">
                                    {entry.bullets.map((bullet) => (
                                        <li key={bullet}>{bullet}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </GroupCard>
            </section>
        </div>
    );

    const renderCurrentPage = () => {
        switch (activeTab) {
            case 'appearance':
                return renderAppearance();
            case 'behavior':
                return renderBehavior();
            case 'notifications':
                return renderNotifications();
            case 'budget':
                return renderBudget();
            case 'data':
                return renderData();
            case 'connect':
                return renderConnect();
            case 'changelog':
                return renderChangelog();
            default:
                return renderMainView();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                        className="fixed bottom-0 left-0 right-0 z-[70] mx-auto flex h-[85vh] max-w-2xl flex-col rounded-t-[32px] border-t border-border bg-surface shadow-2xl"
                    >
                        <div className="shrink-0 px-5 pb-3 pt-5">
                            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-border opacity-50" />
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        {activeTab !== 'main' && (
                                            <button onClick={() => handleTabChange('main')} className="rounded-full p-2 -ml-2 transition-colors hover:bg-muted/10">
                                                <ArrowLeft className="h-5 w-5 text-primary" />
                                            </button>
                                        )}
                                        <h2 className="text-2xl font-bold tracking-tight text-primary">{pageTitle}</h2>
                                    </div>
                                    <p className="mt-2 text-sm text-muted">{pageSubtitle}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {activeTab !== 'main' && (
                                        <button
                                            onClick={handleSave}
                                            disabled={settingsSaveStatus === 'saved'}
                                            className={`rounded-full p-2 transition-colors ${settingsSaveStatus === 'saved' ? 'bg-emerald-500 text-white' : 'text-primary hover:bg-muted/10'}`}
                                            title="Save settings"
                                        >
                                            {settingsSaveStatus === 'saved' ? <CheckCircle2 className="h-5 w-5" /> : <Save className="h-5 w-5" />}
                                        </button>
                                    )}
                                    <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-muted/10">
                                        <X className="h-5 w-5 text-muted" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="relative flex-1 overflow-y-auto px-5 pb-6">
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, x: direction * 18 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: direction * -18 }}
                                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                                    className="w-full pb-6"
                                >
                                    {renderCurrentPage()}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    {connectionModal?.isOpen && (
                        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
                            <div className="w-full max-w-sm rounded-[28px] border border-border bg-surface p-6 shadow-2xl">
                                <h3 className="text-xl font-bold text-primary">Connect database</h3>
                                <p className="mt-2 text-sm text-muted">
                                    How should data be handled when connecting to {connectionModal.provider === 'github' ? 'GitHub' : 'Google Sheets'}?
                                </p>
                                <div className="mt-6 space-y-3">
                                    <button onClick={() => handleConnectionChoice('merge')} className="w-full rounded-2xl border border-border px-4 py-4 text-left transition-colors hover:bg-muted/5">
                                        <p className="text-sm font-semibold text-primary">Merge data</p>
                                        <p className="mt-1 text-xs text-muted">Combine local data with cloud data.</p>
                                    </button>
                                    <button onClick={() => handleConnectionChoice('overwrite_cloud')} className="w-full rounded-2xl border border-border px-4 py-4 text-left transition-colors hover:bg-muted/5">
                                        <p className="text-sm font-semibold text-primary">Overwrite cloud</p>
                                        <p className="mt-1 text-xs text-muted">Replace cloud data with your current local data.</p>
                                    </button>
                                    <button onClick={() => handleConnectionChoice('overwrite_local')} className="w-full rounded-2xl border border-border px-4 py-4 text-left transition-colors hover:bg-muted/5">
                                        <p className="text-sm font-semibold text-primary">Overwrite local</p>
                                        <p className="mt-1 text-xs text-muted">Replace current local data with cloud data.</p>
                                    </button>
                                </div>
                                <button onClick={() => setConnectionModal(null)} className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold text-muted transition-colors hover:bg-muted/10 hover:text-primary">
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
