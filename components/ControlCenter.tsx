
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Settings, RefreshCw, CloudCheck, CloudOff, Save, 
    Moon, Sun, X, AlertTriangle,
    Monitor, Layout, Eye, EyeOff, Database, Download, Upload, Trash2,
    Check, Smartphone, CheckCircle2, PieChart, Plus, Sparkles, Languages,
    MessageSquare, Calendar, AlertCircle, ChevronRight, ArrowLeft, CheckSquare, Bell, History, Shield, Lock, Wrench
} from 'lucide-react';
import { SyncProgress, SyncStatus, AppSettings, BudgetConfig, BudgetRule, BrainDumpItem, Skill, Wallet, CanonicalRule, ParserResultV2, EnrichmentTask } from '../types';
import { DEFAULT_PROMPT } from '../services/geminiService';
import { useControlCenter } from '../hooks/useControlCenter';
import { getDatabaseHistory } from '../services/syncFacade';
import { SERVICE_ACCOUNT_EMAIL, SpreadsheetHistoryEntry } from '../services/spreadsheetService';
import { CHANGELOG_ENTRIES, LATEST_CHANGELOG_VERSION } from '../utils/changelog';
import { contentSurface, controlCenterSurface } from './layout/contentSurface';
import PresencePanel from '../motion/PresencePanel';
import { buildParserHealthSummary } from '../utils/parserHealth';
import { LocalSecuritySettings, SecurityPasswordRequestOptions } from '../utils/securitySettings';
import { notifyUser, requestUserConfirmation } from '../utils/uiFeedback';
import { getAppLocale, normalizeAppLanguage } from '../utils/i18n';

interface ControlCenterProps {
    isOpen: boolean;
    onClose: () => void;
    saveStatus: SyncStatus;
    saveProgress?: SyncProgress | null;
    fetchProgress?: SyncProgress | null;
    fetchStatus: SyncStatus;
    onSyncClick: (forceOverwrite?: boolean) => void;
    onRefreshClick?: () => void;
    onRunCanonicalBackfill?: () => { autoAppliedCount: number; reviewSuggestionCount: number; changedItemIds: string[]; reviews: unknown[] };
    canonicalRules?: CanonicalRule[];
    pendingReviews?: { id: string; text: string; results: ParserResultV2[] }[];
    onToggleCanonicalRuleDisabled?: (ruleId: string) => void;
    
    // App State & Settings
    appSettings: AppSettings;
    setAppSettings: (settings: AppSettings) => void;
    error: string | null;
    pendingCount: number;
    parsingTasks?: import('../types').ParsingTask[];
    enrichmentTasks?: EnrichmentTask[];
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
    monthlyThemeImages: Record<string, string>;

    // External handlers
    onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClearData: () => void;

    // Local security settings (device-only)
    securitySettings: LocalSecuritySettings;
    onSecuritySettingsChange: (settings: LocalSecuritySettings) => void;
    authorizeSecurityPassword: (options?: SecurityPasswordRequestOptions) => Promise<boolean>;
}

// Preset colors for budget categories
const COLOR_PRESETS = [
    { name: 'Biru', class: 'bg-blue-500' },
    { name: 'Hijau', class: 'bg-emerald-500' },
    { name: 'Amber', class: 'bg-amber-500' },
    { name: 'Ungu', class: 'bg-purple-500' },
    { name: 'Merah muda', class: 'bg-pink-500' },
    { name: 'Merah', class: 'bg-red-500' },
    { name: 'Sian', class: 'bg-cyan-500' },
    { name: 'Abu-abu', class: 'bg-gray-500' },
];

const ClockDisplay = ({ language }: { language?: AppSettings['language'] }) => {
    const [time, setTime] = useState(new Date());
    const locale = getAppLocale(language);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col items-center text-center">
            <div className="text-2xl font-bold text-primary font-mono tracking-wider">
                {time.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <div className="text-xs font-medium text-muted uppercase tracking-wider mt-1">
                {time.toLocaleDateString(locale, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
        </div>
    );
};

const ControlCenter: React.FC<ControlCenterProps> = ({ 
    isOpen, onClose, saveStatus, saveProgress, fetchProgress, fetchStatus, onSyncClick, onRefreshClick, onRunCanonicalBackfill, canonicalRules = [], pendingReviews = [], onToggleCanonicalRuleDisabled,
    appSettings, setAppSettings, error, pendingCount, parsingTasks, enrichmentTasks = [], retryParsing,
    onSave, currentBudgetConfig, currentPrompt,
    allItems, allSkills, allWallets, monthlyThemes, monthlyThemeImages,
    onImportData, onClearData,
    securitySettings, onSecuritySettingsChange, authorizeSecurityPassword
}) => {
    
    const [syncMode, setSyncMode] = useState<'merge' | 'overwrite'>('merge');
    const [isParsingTasksExpanded, setIsParsingTasksExpanded] = useState(false);
    const [history, setHistory] = useState<SpreadsheetHistoryEntry[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [canonicalBackfillSummary, setCanonicalBackfillSummary] = useState<string | null>(null);
    const [securityToggleBusy, setSecurityToggleBusy] = useState<keyof LocalSecuritySettings | null>(null);

    const handleSecurityToggle = async (key: keyof LocalSecuritySettings, enabled: boolean) => {
        setSecurityToggleBusy(key);
        try {
            const ok = await authorizeSecurityPassword({
                allowCreate: true,
                actionLabel: enabled ? 'mengaktifkan pengaturan keamanan' : 'menonaktifkan pengaturan keamanan',
            });
            if (!ok) return;
            onSecuritySettingsChange({ ...securitySettings, [key]: enabled });
        } finally {
            setSecurityToggleBusy(null);
        }
    };

    const canonicalRuleStats = {
        learned: canonicalRules.filter(rule => rule.source === 'learned').length,
        activeLearned: canonicalRules.filter(rule => rule.source === 'learned' && !rule.disabled).length,
        disabled: canonicalRules.filter(rule => rule.disabled).length,
        rejected: canonicalRules.filter(rule => rule.rejectionCount > 0).length,
    };
    const canonicalizedItemCount = allItems.filter(item => Object.keys(item.meta.canonical || {}).length > 0).length;
    const usefulEnrichmentTasks = enrichmentTasks.filter(task => task.status === 'running' || task.status === 'failed' || task.reviewCount || (task.appliedFields?.length || 0) > 0);
    const runningEnrichmentCount = enrichmentTasks.filter(task => task.status === 'pending' || task.status === 'running').length;
    const pendingCanonicalSuggestionCount = pendingReviews.reduce((sum, review) =>
        sum + review.results.reduce((inner, result) => inner + (result.canonicalReview?.length || 0), 0), 0);
    const parserHealth = buildParserHealthSummary({ parsingTasks, pendingReviews });
    const parserHealthToneLabel = {
        empty: 'belum ada data',
        good: 'baik',
        watch: 'perlu dipantau',
        bad: 'perlu diperiksa',
    }[parserHealth.healthTone] || parserHealth.healthTone;
    const parserHealthToneClass = parserHealth.healthTone === 'bad'
        ? 'text-red-500 bg-red-500/10 border-red-500/20'
        : parserHealth.healthTone === 'watch'
            ? 'text-amber-500 bg-amber-500/10 border-amber-500/20'
            : parserHealth.healthTone === 'good'
                ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                : 'text-muted bg-surface border-border';
    const learnedCanonicalRules = canonicalRules
        .filter(rule => rule.source === 'learned')
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        .slice(0, 5);

    const fetchHistory = async () => {
        setIsFetchingHistory(true);
        setHistoryError(null);
        try {
            const hist = await getDatabaseHistory();
            setHistory(hist);
        } catch (e: any) {
            setHistoryError(e.message || 'Riwayat belum dapat dimuat.');
        } finally {
            setIsFetchingHistory(false);
        }
    };

    const handleRestoreHistory = async (entry: SpreadsheetHistoryEntry) => {
        const confirmed = await requestUserConfirmation({
            title: 'Pulihkan cadangan?',
            message: `Data saat ini akan diganti dengan versi ${new Date(entry.timestamp).toLocaleString('id-ID')}.`,
            confirmLabel: 'Pulihkan',
            tone: 'danger',
        });
        if (confirmed) {
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
        spreadsheetLink,
        spreadsheetConfig,
        isConnectingSpreadsheet,
        geminiKey,
        prompt,
        gCalId,
        monthlyIncome,
        budgetRules,
        localAppSettings,
        googleProfile,
        isSyncingProfile,
        calendarSyncStatus,
        calendarSyncError,
        handleTabChange,
        setSpreadsheetLink,
        setGeminiKey,
        setPrompt,
        setGCalId,
        setMonthlyIncome,
        setLocalAppSettings,
        handleGoogleLogin,
        handleGoogleSignOut,
        handleToggleCalendarSync,
        handleSyncCalendarNow,
        handleConnectSpreadsheet,
        handleDisconnectSpreadsheet,
        handleSave,
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
        monthlyThemeImages,
        currentBudgetConfig,
        currentPrompt
    });

    const isEnglish = normalizeAppLanguage(localAppSettings.language) === 'en';
    const controlCopy = isEnglish ? {
        settings: 'Settings', close: 'Close settings', back: 'Back to settings overview',
        save: 'Save settings', saved: 'Settings saved', overview: 'Overview',
        overviewDescription: 'Status, theme, and settings sections', status: 'Status', systemStatus: 'System status', pending: 'Pending',
        synced: 'Synced', syncing: 'Loading data…', saving: 'Saving changes…', syncCheck: 'Sync needs attention', local: 'Saved on this device',
        appearance: 'Appearance', appearanceDescription: 'Language, theme, and card display',
        behavior: 'AI & automation', behaviorDescription: 'AI review and app behavior',
        notifications: 'Notifications', notificationsDescription: 'Reminders and notification types',
        budget: 'Budget', budgetDescription: 'Income and budget categories',
        connect: 'Account & sync', connectDescription: 'Google Sheets and Calendar',
        data: 'Data & backup', dataDescription: 'Sync, export, and restore',
        security: 'Privacy & security', securityDescription: 'App lock and private money values',
        advanced: 'Advanced settings', advancedDescription: 'AI models and diagnostics',
        theme: 'Theme', language: 'Interface language', languageDescription: 'Choose the language used in navigation and primary controls.',
        indonesian: 'Bahasa Indonesia', english: 'English', light: 'Light', dark: 'Dark', system: 'System', display: 'App display',
        darkMode: 'Dark mode', lightMode: 'Light mode',
        merge: 'Merge', overwrite: 'Replace data', mergeTitle: 'Merge with cloud data', overwriteTitle: 'Replace cloud data',
    } : {
        settings: 'Pengaturan', close: 'Tutup pusat pengaturan', back: 'Kembali ke ringkasan pengaturan',
        save: 'Simpan pengaturan', saved: 'Pengaturan tersimpan', overview: 'Ringkasan',
        overviewDescription: 'Status, tema, dan bagian pengaturan', status: 'Status', systemStatus: 'Status sistem', pending: 'Menunggu',
        synced: 'Tersinkron', syncing: 'Mengambil data…', saving: 'Menyimpan perubahan…', syncCheck: 'Sinkronisasi perlu diperiksa', local: 'Disimpan di perangkat',
        appearance: 'Tampilan', appearanceDescription: 'Bahasa, tema, dan tampilan kartu',
        behavior: 'AI dan otomatisasi', behaviorDescription: 'Tinjauan AI dan perilaku aplikasi',
        notifications: 'Notifikasi', notificationsDescription: 'Pengingat dan jenis pemberitahuan',
        budget: 'Budget', budgetDescription: 'Pemasukan dan kategori budget',
        connect: 'Akun dan sinkronisasi', connectDescription: 'Google Sheets dan Kalender',
        data: 'Data dan cadangan', dataDescription: 'Sinkronisasi, ekspor, dan pemulihan',
        security: 'Privasi dan keamanan', securityDescription: 'Kunci aplikasi dan privasi nilai uang',
        advanced: 'Pengaturan lanjutan', advancedDescription: 'Model AI dan diagnostik',
        theme: 'Tema', language: 'Bahasa antarmuka', languageDescription: 'Pilih bahasa untuk navigasi dan kontrol utama.',
        indonesian: 'Bahasa Indonesia', english: 'English', light: 'Terang', dark: 'Gelap', system: 'Sistem', display: 'Tampilan aplikasi',
        darkMode: 'Mode gelap', lightMode: 'Mode terang',
        merge: 'Gabungkan', overwrite: 'Ganti data', mergeTitle: 'Gabungkan dengan data cloud', overwriteTitle: 'Ganti data cloud',
    };

    const applyLanguage = (language: NonNullable<AppSettings['language']>) => {
        if (normalizeAppLanguage(localAppSettings.language) === language) return;
        const settings = { ...localAppSettings, language };
        setLocalAppSettings(settings);
        setAppSettings(settings);
        onSave(undefined, undefined, settings);
    };

    useEffect(() => {
        if (activeTab === 'data' && spreadsheetConfig) {
            fetchHistory();
        }
    }, [activeTab, spreadsheetConfig]);

    const renderProgressDetail = (progress?: SyncProgress | null) => {
        const diagnostic = [progress?.label, progress?.detail].filter(Boolean).join(' — ');
        if (!diagnostic) return null;

        return (
            <details className="group relative">
                <summary className="cursor-pointer list-none rounded-md px-1.5 py-1 text-[10px] font-semibold text-muted hover:bg-surface focus-visible:outline-none">
                    Detail
                </summary>
                <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-border bg-surface-raised p-3 text-left text-xs font-normal leading-relaxed text-muted shadow-lg">
                    <span className="mb-1 block font-semibold text-primary">Detail teknis</span>
                    {diagnostic}
                </div>
            </details>
        );
    };

    const renderSyncStatus = () => {
        const activeStatus = saveStatus === 'saving' ? 'saving' 
                           : fetchStatus === 'syncing' ? 'syncing'
                           : saveStatus === 'error' ? 'error'
                           : fetchStatus === 'error' ? 'error'
                           : saveStatus === 'local' || fetchStatus === 'local' ? 'local'
                           : 'synced';

        switch(activeStatus) {
            case 'synced':
                return <div className="flex items-center gap-2 text-[var(--finance-positive)]"><CloudCheck className="w-5 h-5" /><span className="font-medium">{controlCopy.synced}</span></div>;
            case 'syncing':
                return (
                  <div className="flex min-w-0 items-center gap-2 text-[var(--finance-info)]">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="font-medium">{controlCopy.syncing}</span>
                    {renderProgressDetail(fetchProgress)}
                  </div>
                );
            case 'saving':
                return (
                    <div className="flex min-w-0 items-center gap-2 text-[var(--finance-warning)]">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span className="font-medium">{controlCopy.saving}</span>
                        {renderProgressDetail(saveProgress)}
                    </div>
                );
            case 'error':
                const errorDetail = saveStatus === 'error' ? saveProgress : fetchStatus === 'error' ? fetchProgress : null;
                return (
                  <div className="flex min-w-0 items-center gap-2 text-[var(--finance-negative)]">
                    <CloudOff className="w-5 h-5" />
                    <span className="font-medium">{controlCopy.syncCheck}</span>
                    {renderProgressDetail(errorDetail)}
                  </div>
                );
            case 'local':
                return <div className="flex items-center gap-2 text-[var(--finance-warning)]"><Save className="w-5 h-5" /><span className="font-medium">{controlCopy.local}</span></div>;
        }
    };

    const menuItems = [
        { id: 'connect', label: controlCopy.connect, icon: <Layout className="w-5 h-5" />, desc: controlCopy.connectDescription },
        { id: 'data', label: controlCopy.data, icon: <Database className="w-5 h-5" />, desc: controlCopy.dataDescription },
        { id: 'behavior', label: controlCopy.behavior, icon: <Smartphone className="w-5 h-5" />, desc: controlCopy.behaviorDescription },
        { id: 'notifications', label: controlCopy.notifications, icon: <Bell className="w-5 h-5" />, desc: controlCopy.notificationsDescription },
        { id: 'appearance', label: controlCopy.appearance, icon: <Monitor className="w-5 h-5" />, desc: controlCopy.appearanceDescription },
        { id: 'security', label: controlCopy.security, icon: <Shield className="w-5 h-5" />, desc: controlCopy.securityDescription },
        { id: 'budget', label: controlCopy.budget, icon: <PieChart className="w-5 h-5" />, desc: controlCopy.budgetDescription },
        { id: 'advanced', label: controlCopy.advanced, icon: <Wrench className="w-5 h-5" />, desc: controlCopy.advancedDescription },
    ];

    return (
        <PresencePanel
            isOpen={isOpen}
            onClose={onClose}
            overlayClassName="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            panelClassName={controlCenterSurface.panel}
            presentation="sheet"
            ariaLabel={controlCopy.settings}
            panelProps={{ 'data-control-center-panel': 'true' }}
        >
                        
                        {/* Header */}
                        <div className={controlCenterSurface.header}>
                            <div className={controlCenterSurface.handle} />
                            
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    {activeTab !== 'main' && (
                                        <button onClick={() => handleTabChange('main')} className="p-2 -ml-2 hover:bg-muted/10 rounded-full transition-colors lg:hidden">
                                            <span className="sr-only">{controlCopy.back}</span>
                                            <ArrowLeft className="w-6 h-6 text-primary" />
                                        </button>
                                    )}
                                    <h2 className="text-2xl font-bold tracking-tight text-primary">
                                        {activeTab === 'main' ? controlCopy.settings : menuItems.find(m => m.id === activeTab)?.label}
                                    </h2>
                                </div>
                                <div className="flex gap-2">
                                    {activeTab !== 'main' && (
                                        <button 
                                            onClick={handleSave}
                                            disabled={settingsSaveStatus === 'saved'}
                                            className={`p-2 rounded-full transition-[color,background-color,opacity] ${settingsSaveStatus === 'saved' ? 'bg-[var(--finance-positive)] text-white' : 'hover:bg-muted/10 text-primary'}`}
                                            aria-label={settingsSaveStatus === 'saved' ? controlCopy.saved : controlCopy.save}
                                        >
                                            {settingsSaveStatus === 'saved' ? <CheckCircle2 className="w-6 h-6" /> : <Save className="w-6 h-6" />}
                                        </button>
                                    )}
                                    <button onClick={onClose} className="p-2 hover:bg-muted/10 rounded-full transition-colors" aria-label={controlCopy.close}>
                                        <X className="w-6 h-6 text-muted" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className={controlCenterSurface.contentWrap}>
                            <div className={controlCenterSurface.desktopWorkspace}>
                                <aside className={controlCenterSurface.desktopSidebar} aria-label={controlCopy.settings}>
                                    <div className={`${contentSurface.card} p-4 space-y-3`}>
                                        <div className="text-xs font-bold text-muted">{controlCopy.status}</div>
                                        <div className="flex items-center justify-between gap-3">
                                            <div aria-live="polite">{renderSyncStatus()}</div>
                                            <div className="flex flex-wrap justify-end gap-1.5">
                                                {pendingCount > 0 && (
                                                    <span className="rounded-full bg-[var(--finance-warning-soft)] px-2 py-1 text-xs font-bold text-[var(--finance-warning)]">{pendingCount} menunggu</span>
                                                )}
                                                {runningEnrichmentCount > 0 && (
                                                    <span className="rounded-full bg-[var(--finance-info-soft)] px-2 py-1 text-xs font-bold text-[var(--finance-info)]">{runningEnrichmentCount} diperkaya</span>
                                                )}
                                                {usefulEnrichmentTasks.some(task => task.reviewCount) && (
                                                    <span className="rounded-full bg-[var(--finance-info-soft)] px-2 py-1 text-xs font-bold text-[var(--finance-info)]">perlu tinjauan pengayaan</span>
                                                )}
                                            </div>
                                        </div>
                                        {(saveStatus === 'error' || fetchStatus === 'error' || saveStatus === 'local') && (
                                            <button
                                                onClick={() => onSyncClick(syncMode === 'overwrite')}
                                                className="w-full rounded-xl bg-primary px-3 py-2 text-sm font-bold text-background hover:opacity-90"
                                            >
                                                Sinkronkan sekarang
                                            </button>
                                        )}
                                    </div>

                                    <div className={`${contentSurface.card} p-2`}>
                                        <button
                                            type="button"
                                            onClick={() => handleTabChange('main')}
                                            className={`${controlCenterSurface.desktopNavButton} ${activeTab === 'main' ? 'border-primary/30 bg-primary text-background' : 'border-transparent text-muted hover:bg-surface hover:text-primary'}`}
                                            aria-current={activeTab === 'main' ? 'page' : undefined}
                                        >
                                            <Settings className="w-5 h-5 shrink-0" />
                                            <span>
                                                    <span className="block text-sm font-bold">{controlCopy.overview}</span>
                                                    <span className={`block text-xs ${activeTab === 'main' ? 'text-background/70' : 'text-muted/80'}`}>{controlCopy.overviewDescription}</span>
                                            </span>
                                        </button>
                                        <div className="my-2 h-px bg-border" />
                                        <nav className="space-y-1">
                                            {menuItems.map(item => {
                                                const isActive = activeTab === item.id;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => handleTabChange(item.id as any)}
                                                        className={`${controlCenterSurface.desktopNavButton} ${isActive ? 'border-primary/30 bg-primary text-background' : 'border-transparent text-muted hover:bg-surface hover:text-primary'}`}
                                                        aria-current={isActive ? 'page' : undefined}
                                                    >
                                                        <span className="shrink-0">{item.icon}</span>
                                                        <span className="min-w-0">
                                                            <span className="block text-sm font-bold">{item.label}</span>
                                                            <span className={`block truncate text-xs ${isActive ? 'text-background/70' : 'text-muted/80'}`}>{item.desc}</span>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </nav>
                                    </div>

                                    <div className="px-2 text-xs text-muted flex items-center gap-2">
                                        <Database className="w-3 h-3" />
                                        <span>Arkaiv {LATEST_CHANGELOG_VERSION}</span>
                                    </div>
                                </aside>

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
                                    className={controlCenterSurface.contentPane}
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
                                                                    <span className="text-xs font-semibold text-muted">{controlCopy.pending}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-primary">
                                                                    <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                                                                    <span className="font-bold text-sm">{pendingCount}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-xs font-semibold text-muted">{controlCopy.systemStatus}</span>
                                                            <div aria-live="polite">{renderSyncStatus()}</div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex gap-2">
                                                        {(saveStatus === 'error' || fetchStatus === 'error' || saveStatus === 'local') && (
                                                            <button 
                                                                onClick={() => onSyncClick(syncMode === 'overwrite')} 
                                                                className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                                                                title={syncMode === 'overwrite' ? controlCopy.overwriteTitle : controlCopy.mergeTitle}
                                                                aria-label={syncMode === 'overwrite' ? controlCopy.overwriteTitle : controlCopy.mergeTitle}
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
                                                            {controlCopy.merge}
                                                        </button>
                                                        <div className="w-px h-4 bg-border"></div>
                                                        <button 
                                                            onClick={() => setSyncMode('overwrite')}
                                                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${syncMode === 'overwrite' ? 'bg-[var(--finance-negative-soft)] text-[var(--finance-negative)]' : 'text-muted hover:text-[var(--finance-negative)]'}`}
                                                        >
                                                            {controlCopy.overwrite}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {error && (
                                                <div className="flex items-start gap-3 rounded-2xl border border-[var(--finance-negative)]/20 bg-[var(--finance-negative-soft)] p-4 text-[var(--finance-negative)]">
                                                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium">Perubahan belum tersinkron. Data tetap aman di perangkat.</p>
                                                        <details className="mt-1 text-xs">
                                                            <summary className="cursor-pointer font-semibold">Detail teknis</summary>
                                                            <p className="mt-1 break-words text-muted">{error}</p>
                                                        </details>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Quick Actions */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <button 
                                                    onClick={toggleTheme}
                                                    className="flex flex-col items-center justify-center gap-3 p-6 bg-background border border-border rounded-2xl hover:bg-muted/5 active:scale-95 transition-all shadow-sm"
                                                >
                                                    {localAppSettings.theme === 'dark' ? <Moon className="w-8 h-8 text-indigo-400" /> : <Sun className="w-8 h-8 text-amber-500" />}
                                                    <span className="font-medium text-primary">{localAppSettings.theme === 'dark' ? controlCopy.darkMode : controlCopy.lightMode}</span>
                                                </button>
                                                
                                                {/* Clock & Date */}
                                                <div className="flex flex-col items-center justify-center gap-2 p-6 bg-background border border-border rounded-2xl shadow-sm">
                                                    <ClockDisplay language={localAppSettings.language} />
                                                </div>
                                            </div>

                                            <section className="rounded-2xl bg-background p-4 shadow-sm ring-1 ring-inset ring-border/70" aria-labelledby="quick-language-title">
                                                <div className="mb-3 flex items-start gap-3">
                                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                                                        <Languages className="h-4 w-4" />
                                                    </span>
                                                    <div>
                                                        <h3 id="quick-language-title" className="text-sm font-semibold text-primary">{controlCopy.language}</h3>
                                                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{controlCopy.languageDescription}</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={controlCopy.language}>
                                                    {([['id', controlCopy.indonesian], ['en', controlCopy.english]] as const).map(([value, label]) => {
                                                        const selected = normalizeAppLanguage(localAppSettings.language) === value;
                                                        return (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                role="radio"
                                                                aria-checked={selected}
                                                                onClick={() => applyLanguage(value)}
                                                                className={`flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${selected ? 'bg-indigo-600 text-white shadow-sm' : 'bg-surface-soft text-primary ring-1 ring-inset ring-border/60 hover:ring-indigo-500/30'}`}
                                                            >
                                                                <span className="leading-tight">{label}</span>
                                                                {selected && <Check className="h-4 w-4 shrink-0" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </section>

                                            {/* Menu List */}
                                            <div className="space-y-2 lg:hidden">
                                                <h3 className="mb-2 ml-1 text-xs font-semibold text-muted">{controlCopy.settings}</h3>
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
                                                    <Database className="w-3 h-3" />
                                                    <span>Arkaiv {LATEST_CHANGELOG_VERSION}</span>
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* APPEARANCE TAB */}
                                    {activeTab === 'appearance' && (
                                        <div className={contentSurface.desktopSettingsGrid}>
                                            <section className={contentSurface.desktopSettingsWide}>
                                                <div className="mb-3 flex items-start gap-3 px-1">
                                                    <Languages className="mt-0.5 h-5 w-5 text-indigo-500" />
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-primary">{controlCopy.language}</h3>
                                                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{controlCopy.languageDescription}</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={controlCopy.language}>
                                                    {([
                                                        ['id', controlCopy.indonesian],
                                                        ['en', controlCopy.english],
                                                    ] as const).map(([value, label]) => {
                                                        const selected = normalizeAppLanguage(localAppSettings.language) === value;
                                                        return (
                                                            <button
                                                                key={value}
                                                                type="button"
                                                                role="radio"
                                                                aria-checked={selected}
                                                                onClick={() => {
                                                                    applyLanguage(value);
                                                                }}
                                                                className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${selected ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-border bg-background text-primary hover:border-indigo-500/35'}`}
                                                            >
                                                                <span>{label}</span>
                                                                {selected && <Check className="h-4 w-4 shrink-0" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </section>

                                            <section>
                                                <h3 className="mb-3 ml-1 text-sm font-semibold text-primary">{controlCopy.theme}</h3>
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
                                                        <span className="text-xs font-medium">{controlCopy.light}</span>
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
                                                        <span className="text-xs font-medium">{controlCopy.dark}</span>
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
                                                        <span className="text-xs font-medium">{controlCopy.system}</span>
                                                    </button>
                                                </div>
                                            </section>


                                            <section>
                                                <h3 className="mb-3 ml-1 text-sm font-semibold text-primary">{controlCopy.display}</h3>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                                                                <EyeOff className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Sembunyikan nilai uang</div>
                                                                <div className="text-xs text-muted">Samarkan nominal secara default</div>
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
                                                                <div className="font-medium text-primary text-sm">Wawasan AI harian</div>
                                                                <div className="text-xs text-muted">Buat wawasan harian secara otomatis</div>
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
                                                                <div className="font-medium text-primary text-sm">Kartu ringkas</div>
                                                                <div className="text-xs text-muted">Tampilkan catatan dalam keadaan tertutup</div>
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

                                    {/* SECURITY TAB */}
                                    {activeTab === 'security' && (
                                        <div className={contentSurface.desktopSettingsGrid}>
                                            <section className={contentSurface.desktopSettingsWide}>
                                                <h3 className="mb-3 ml-1 text-xs font-bold uppercase tracking-wider text-muted">Keamanan perangkat</h3>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="rounded-xl bg-red-500/10 p-2 text-red-500"><Lock className="h-5 w-5" /></div>
                                                            <div>
                                                                <div className="text-sm font-medium text-primary">Kunci tab Uang</div>
                                                                <div className="text-xs text-muted">Minta kata sandi sebelum membuka dompet, anggaran, dan transaksi pada perangkat ini.</div>
                                                            </div>
                                                        </div>
                                                        <label className={`relative inline-flex items-center ${securityToggleBusy === 'lockTabTransaction' ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>
                                                            <input type="checkbox" className="sr-only peer" disabled={securityToggleBusy === 'lockTabTransaction'} checked={securitySettings.lockTabTransaction} onChange={(e) => handleSecurityToggle('lockTabTransaction', e.target.checked)} />
                                                            <div className="relative h-6 w-11 overflow-hidden rounded-full bg-muted/30 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-500"><Shield className="h-5 w-5" /></div>
                                                            <div>
                                                                <div className="text-sm font-medium text-primary">Selalu sembunyikan nilai uang</div>
                                                                <div className="text-xs text-muted">Samarkan saldo dan nominal pada perangkat ini, terlepas dari pengaturan tampilan umum.</div>
                                                            </div>
                                                        </div>
                                                        <label className={`relative inline-flex items-center ${securityToggleBusy === 'forceHideMoneyValue' ? 'cursor-wait opacity-60' : 'cursor-pointer'}`}>
                                                            <input type="checkbox" className="sr-only peer" disabled={securityToggleBusy === 'forceHideMoneyValue'} checked={securitySettings.forceHideMoneyValue} onChange={(e) => handleSecurityToggle('forceHideMoneyValue', e.target.checked)} />
                                                            <div className="relative h-6 w-11 overflow-hidden rounded-full bg-muted/30 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>
                                                    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs leading-relaxed text-muted">
                                                        Kata sandi keamanan disimpan melalui konfigurasi yang terhubung, sedangkan status kunci hanya berlaku pada perangkat ini.
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    )}

                                    {/* BEHAVIOR TAB */}
                                    {activeTab === 'behavior' && (
                                        <div className={contentSurface.desktopSettingsGrid}>
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Alur input AI</h3>
                                                <div className="flex flex-col gap-3">
                                                    <div className="hidden items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                                                                <Sparkles className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Mode parsing pro</div>
                                                                <div className="text-xs text-muted">Gunakan tiga tahap parsing untuk akurasi yang lebih baik</div>
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
                                                                <div className="font-medium text-primary text-sm">Tinjau draf AI sebelum disimpan</div>
                                                                <div className="text-xs text-muted">Jika aktif, hasil parsing percakapan dan nota menunggu persetujuan di Pusat Tinjauan.</div>
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
                                            <section className={`${contentSurface.desktopSettingsWide} hidden`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="text-xs font-bold text-muted uppercase tracking-wider ml-1">Instruksi sistem</h3>
                                                    <button 
                                                        onClick={() => setPrompt(DEFAULT_PROMPT)}
                                                        className="text-[10px] text-acc-todo hover:underline disabled:opacity-50"
                                                        disabled={prompt === DEFAULT_PROMPT}
                                                    >
                                                        Pulihkan bawaan
                                                    </button>
                                                </div>
                                                <div className="bg-background border border-border rounded-2xl p-4">
                                                    <div className="flex items-start gap-3 mb-3">
                                                        <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500 shrink-0">
                                                            <MessageSquare className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-primary text-sm">Logika kategorisasi AI</div>
                                                            <div className="text-xs text-muted">Instruksi untuk Gemini dalam membaca input Anda.</div>
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        className="w-full bg-black/5 dark:bg-black/30 border border-border rounded-xl p-3 text-xs text-primary focus:outline-none focus:border-acc-note h-[450px] resize-y font-mono"
                                                        value={prompt}
                                                        onChange={(e) => setPrompt(e.target.value)}
                                                        placeholder="Masukkan instruksi khusus..."
                                                    />
                                                </div>
                                            </section>
                                            <section className="hidden">
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Model AI</h3>
                                                <div className="bg-background border border-border rounded-2xl p-4 space-y-4">
                                                    <div>
                                                        <label className="block text-xs font-medium text-muted mb-1">Parsing percakapan (geminiService)</label>
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
                                                        <label className="block text-xs font-medium text-muted mb-1">Bilah percakapan AI (chatService)</label>
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
                                                        <label className="block text-xs font-medium text-muted mb-1">Wawasan AI (insightService)</label>
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

                                    {/* ADVANCED TAB */}
                                    {activeTab === 'advanced' && (
                                        <div className={contentSurface.desktopSettingsGrid}>
                                            <section>
                                                <h3 className="mb-3 ml-1 text-xs font-bold uppercase tracking-wider text-muted">Mesin parsing</h3>
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between rounded-2xl border border-border bg-background p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500"><Sparkles className="h-5 w-5" /></div>
                                                            <div>
                                                                <div className="text-sm font-medium text-primary">Mode parsing pro</div>
                                                                <div className="text-xs text-muted">Gunakan parsing bertahap untuk input yang lebih kompleks.</div>
                                                            </div>
                                                        </div>
                                                        <label className="relative inline-flex cursor-pointer items-center">
                                                            <input type="checkbox" className="sr-only peer" checked={localAppSettings.useProParser ?? false} onChange={(e) => setLocalAppSettings({ ...localAppSettings, useProParser: e.target.checked })} />
                                                            <div className="relative h-6 w-11 overflow-hidden rounded-full bg-muted/30 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-[18px]"></div>
                                                        </label>
                                                    </div>
                                                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-muted">
                                                        Pengaturan di halaman ini ditujukan untuk diagnosis dan eksperimen. Pengguna umum tidak perlu mengubahnya.
                                                    </div>
                                                </div>
                                            </section>

                                            <section>
                                                <h3 className="mb-3 ml-1 text-xs font-bold uppercase tracking-wider text-muted">Model AI</h3>
                                                <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                                                    {[
                                                        ['Parser input', 'parsingModel'],
                                                        ['Percakapan AI', 'chatModel'],
                                                        ['Wawasan', 'insightModel'],
                                                    ].map(([label, key]) => (
                                                        <label key={key} className="block">
                                                            <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
                                                            <select
                                                                className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-primary focus:border-indigo-500 focus:outline-none"
                                                                value={(localAppSettings as any)[key] || 'gemini-3-flash-preview'}
                                                                onChange={(e) => setLocalAppSettings({ ...localAppSettings, [key]: e.target.value })}
                                                            >
                                                                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                                                <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                                                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                                                <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                                                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro Preview</option>
                                                            </select>
                                                        </label>
                                                    ))}
                                                </div>
                                            </section>

                                            <section className={contentSurface.desktopSettingsWide}>
                                                <div className="mb-3 flex items-center justify-between">
                                                    <h3 className="ml-1 text-xs font-bold uppercase tracking-wider text-muted">Instruksi parser</h3>
                                                    <button type="button" onClick={() => setPrompt(DEFAULT_PROMPT)} disabled={prompt === DEFAULT_PROMPT} className="text-[10px] font-bold text-indigo-500 disabled:opacity-40">Pulihkan bawaan</button>
                                                </div>
                                                <textarea
                                                    className="h-72 w-full resize-y rounded-2xl border border-border bg-background p-4 font-mono text-xs text-primary focus:border-indigo-500 focus:outline-none"
                                                    value={prompt}
                                                    onChange={(e) => setPrompt(e.target.value)}
                                                    placeholder="Instruksi khusus untuk parser..."
                                                />
                                            </section>

                                            <section>
                                                <h3 className="mb-3 ml-1 text-xs font-bold uppercase tracking-wider text-muted">Kesehatan parser</h3>
                                                <div className="rounded-2xl border border-border bg-background p-4 space-y-3" data-testid="parser-health-card">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div className="text-sm font-bold text-primary">Aktivitas terbaru</div>
                                                            <div className="text-xs text-muted">Ringkasan performa parsing, bukan pengaturan harian.</div>
                                                        </div>
                                                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${parserHealthToneClass}`}>{parserHealthToneLabel}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                                                        <div className="rounded-xl bg-surface p-3"><div className="text-lg font-black text-primary">{parserHealth.fastPathRate}%</div><div className="text-[10px] text-muted">jalur cepat</div></div>
                                                        <div className="rounded-xl bg-surface p-3"><div className="text-lg font-black text-primary">{parserHealth.aiCallCount}</div><div className="text-[10px] text-muted">panggilan AI</div></div>
                                                        <div className="rounded-xl bg-surface p-3"><div className="text-lg font-black text-primary">{parserHealth.averageLatencyMs === null ? '—' : `${parserHealth.averageLatencyMs}ms`}</div><div className="text-[10px] text-muted">latensi rata-rata</div></div>
                                                        <div className="rounded-xl bg-surface p-3"><div className="text-lg font-black text-primary">{parserHealth.reviewRate}%</div><div className="text-[10px] text-muted">perlu ditinjau</div></div>
                                                    </div>
                                                </div>
                                            </section>

                                            <section>
                                                <h3 className="mb-3 ml-1 text-xs font-bold uppercase tracking-wider text-muted">Kualitas data</h3>
                                                <div className="space-y-3 rounded-2xl border border-border bg-background p-4">
                                                    <div className="grid grid-cols-2 gap-2 text-center">
                                                        <div className="rounded-xl bg-surface p-3"><div className="text-lg font-black text-primary">{canonicalizedItemCount}</div><div className="text-[10px] text-muted">catatan dinormalisasi</div></div>
                                                        <div className="rounded-xl bg-surface p-3"><div className="text-lg font-black text-primary">{canonicalRuleStats.activeLearned}</div><div className="text-[10px] text-muted">aturan aktif</div></div>
                                                    </div>
                                                    {onRunCanonicalBackfill && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const result = onRunCanonicalBackfill();
                                                                setCanonicalBackfillSummary(`${result.autoAppliedCount} perubahan diterapkan dan ${result.reviewSuggestionCount} saran dikirim ke Pusat Tinjauan.`);
                                                            }}
                                                            className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-background hover:opacity-90"
                                                        >
                                                            Periksa ulang data lama
                                                        </button>
                                                    )}
                                                    {canonicalBackfillSummary && <p className="text-xs leading-relaxed text-muted">{canonicalBackfillSummary}</p>}
                                                </div>
                                            </section>
                                        </div>
                                    )}

                                    {/* NOTIFICATIONS TAB */}
                                    {activeTab === 'notifications' && (
                                        <div className={contentSurface.desktopSettingsGrid}>
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Izin sistem</h3>
                                                <div className="bg-background border border-border rounded-2xl p-4">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-start gap-3">
                                                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
                                                                <Bell className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Notifikasi browser</div>
                                                                <div className="text-xs text-muted mb-3">Izinkan Arkaiv mengirim notifikasi di desktop dan perangkat seluler.</div>
                                                                <div className="flex gap-2">
                                                                    <button 
                                                                        onClick={async () => {
                                                                            const { requestNotificationPermission } = await import('../utils/notificationHandler');
                                                                            const granted = await requestNotificationPermission();
                                                                            if (granted) {
                                                                                notifyUser('Izin notifikasi diberikan.', 'success');
                                                                            } else {
                                                                                notifyUser('Izin notifikasi ditolak atau tidak didukung.', 'error');
                                                                            }
                                                                        }}
                                                                        className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600 transition-colors"
                                                                    >
                                                                        Minta izin
                                                                    </button>
                                                                    <button 
                                                                        onClick={async () => {
                                                                            const { sendTestNotification } = await import('../utils/notificationHandler');
                                                                            sendTestNotification();
                                                                        }}
                                                                        className="px-3 py-1.5 bg-surface border border-border text-primary text-xs font-medium rounded-lg hover:bg-muted/10 transition-colors"
                                                                    >
                                                                        Uji notifikasi
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </section>

                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Jenis notifikasi</h3>
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex flex-col gap-2 p-4 bg-background border border-border rounded-2xl">
                                                        <div className="font-medium text-primary text-sm">Mode notifikasi</div>
                                                        <div className="text-xs text-muted mb-2">Pilih cara notifikasi memberi tahu Anda</div>
                                                        <select
                                                            className="w-full bg-surface border border-border rounded-xl p-2 text-sm text-primary focus:outline-none focus:border-indigo-500 transition-colors"
                                                            value={localAppSettings.notificationMode || 'both'}
                                                            onChange={(e) => setLocalAppSettings({ ...localAppSettings, notificationMode: e.target.value as any })}
                                                        >
                                                            <option value="both">Suara & getar</option>
                                                            <option value="sound">Suara saja</option>
                                                            <option value="vibrate">Getar saja</option>
                                                            <option value="silent">Senyap</option>
                                                        </select>
                                                    </div>

                                                    <div className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                                                <MessageSquare className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Input cepat tetap aktif</div>
                                                                <div className="text-xs text-muted">Pertahankan notifikasi untuk mencatat dengan cepat</div>
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
                                                                <div className="font-medium text-primary text-sm">Pengingat kebiasaan</div>
                                                                <div className="text-xs text-muted">Beri tahu berdasarkan waktu input yang biasa Anda gunakan</div>
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
                                                                <div className="font-medium text-primary text-sm">Wawasan AI</div>
                                                                <div className="text-xs text-muted">Beri tahu saat wawasan harian baru tersedia</div>
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
                                                                <div className="font-medium text-primary text-sm">Pengingat</div>
                                                                <div className="text-xs text-muted">Beri tahu untuk tugas dan acara yang terjadwal</div>
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
                                        <div className={contentSurface.desktopSettingsGrid}>
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Pendapatan</h3>
                                                <div>
                                                    <label className="block text-xs font-medium text-muted mb-1">Pendapatan bulanan (IDR)</label>
                                                    <input
                                                    type="number"
                                                    className="w-full bg-background border border-border rounded-xl p-3 text-primary focus:outline-none focus:border-acc-shopping transition-colors"
                                                    value={monthlyIncome}
                                                    onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                                                    placeholder="mis. 10000000"
                                                    />
                                                </div>
                                            </section>

                                            <section>
                                                <div className="flex justify-between items-center mb-3">
                                                    <h3 className="text-xs font-bold text-muted uppercase tracking-wider ml-1">Kategori</h3>
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
                                                                placeholder="Nama kategori"
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
                                                        <Plus className="w-3 h-3" /> Tambah kategori
                                                    </button>

                                                    {totalPercentage !== 100 && (
                                                        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 p-2 rounded-xl">
                                                            <AlertCircle className="w-3 h-3" />
                                                            <span>Total persentase harus tepat 100%.</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </section>
                                        </div>
                                    )}

                                    {/* DATA TAB */}
                                    {activeTab === 'data' && (
                                        <div className={contentSurface.desktopSettingsGrid}>
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Ekspor & impor</h3>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button 
                                                        onClick={handleExportExcel}
                                                        className="flex flex-col items-center justify-center gap-2 p-4 bg-background border border-border rounded-2xl hover:bg-muted/5 hover:border-primary/30 transition-all"
                                                    >
                                                        <Download className="w-6 h-6 text-emerald-500" />
                                                        <span className="text-xs font-medium text-primary">Ekspor Excel</span>
                                                    </button>
                                                    <button 
                                                        onClick={handleExportJSON}
                                                        className="flex flex-col items-center justify-center gap-2 p-4 bg-background border border-border rounded-2xl hover:bg-muted/5 hover:border-primary/30 transition-all"
                                                    >
                                                        <Database className="w-6 h-6 text-blue-500" />
                                                        <span className="text-xs font-medium text-primary">Ekspor JSON</span>
                                                    </button>
                                                    <label className="col-span-2 flex flex-col items-center justify-center gap-2 p-4 bg-background border border-border rounded-2xl hover:bg-muted/5 hover:border-primary/30 transition-all cursor-pointer">
                                                        <Upload className="w-6 h-6 text-indigo-500" />
                                                        <span className="text-xs font-medium text-primary">Impor cadangan JSON</span>
                                                        <input type="file" accept=".json" onChange={onImportData} className="hidden" />
                                                    </label>
                                                </div>
                                            </section>

                                            {onRunCanonicalBackfill && (
                                                <section className={`${contentSurface.desktopSettingsWide} hidden`}>
                                                    <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Kesehatan parser</h3>
                                                    <div className="bg-background border border-border rounded-2xl p-4 space-y-3 mb-4" data-testid="parser-health-card">
                                                        <div className="flex items-start gap-3">
                                                            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
                                                                <Sparkles className="w-5 h-5" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <div className="font-medium text-primary text-sm">Kesehatan parser</div>
                                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${parserHealthToneClass}`}>
                                                                        {parserHealthToneLabel}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-muted mt-1">
                                                                    Metrik agregat hanya tersimpan di perangkat. Teks dan konten privat tidak meninggalkan perangkat ini.
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                            <div className="bg-surface border border-border rounded-xl p-3">
                                                                <div className="text-[10px] text-muted uppercase tracking-wide">Jalur cepat</div>
                                                                <div className="text-lg font-bold text-emerald-500">{parserHealth.fastPathRate}%</div>
                                                                <div className="text-[10px] text-muted">{parserHealth.localSavedUnits} penyimpanan lokal</div>
                                                            </div>
                                                            <div className="bg-surface border border-border rounded-xl p-3">
                                                                <div className="text-[10px] text-muted uppercase tracking-wide">Cadangan AI</div>
                                                                <div className="text-lg font-bold text-primary">{parserHealth.aiCallCount}</div>
                                                                <div className="text-[10px] text-muted">{parserHealth.aiFallbackUnits} catatan dialihkan</div>
                                                            </div>
                                                            <div className="bg-surface border border-border rounded-xl p-3">
                                                                <div className="text-[10px] text-muted uppercase tracking-wide">Latensi rata-rata</div>
                                                                <div className="text-lg font-bold text-primary">{parserHealth.averageLatencyMs === null ? '—' : `${parserHealth.averageLatencyMs}ms`}</div>
                                                                <div className="text-[10px] text-muted">tugas parser selesai</div>
                                                            </div>
                                                            <div className="bg-surface border border-border rounded-xl p-3">
                                                                <div className="text-[10px] text-muted uppercase tracking-wide">Tingkat tinjauan</div>
                                                                <div className="text-lg font-bold text-amber-500">{parserHealth.reviewRate}%</div>
                                                                <div className="text-[10px] text-muted">{parserHealth.reviewUnits} unit tinjauan</div>
                                                            </div>
                                                        </div>
                                                        {parserHealth.warnings.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {parserHealth.warnings.map(warning => (
                                                                    <div key={warning} className="flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2">
                                                                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                                        <span>{warning}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-muted bg-surface border border-border rounded-xl p-3">
                                                                Pemeriksaan aman: tidak ada kegagalan parser berulang atau antrean tinjauan yang berlebihan.
                                                            </div>
                                                        )}
                                                    </div>
                                                    <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Pembersihan data kanonis</h3>
                                                    <div className="bg-background border border-border rounded-2xl p-4 space-y-3">
                                                        <div className="flex items-start gap-3">
                                                            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500 shrink-0">
                                                                <Sparkles className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-primary text-sm">Kualitas data kanonis</div>
                                                                <div className="text-xs text-muted mt-1">
                                                                    Pantau alias yang dipelajari, antrean tinjauan, dan cakupan riwayat sebelum memproses ulang data lama.
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                            <div className="bg-surface border border-border rounded-xl p-3">
                                                                <div className="text-[10px] text-muted uppercase tracking-wide">Dinormalisasi</div>
                                                                <div className="text-lg font-bold text-primary">{canonicalizedItemCount}</div>
                                                                <div className="text-[10px] text-muted">catatan</div>
                                                            </div>
                                                            <div className="bg-surface border border-border rounded-xl p-3">
                                                                <div className="text-[10px] text-muted uppercase tracking-wide">Dipelajari</div>
                                                                <div className="text-lg font-bold text-primary">{canonicalRuleStats.activeLearned}</div>
                                                                <div className="text-[10px] text-muted">aturan aktif</div>
                                                            </div>
                                                            <div className="bg-surface border border-border rounded-xl p-3">
                                                                <div className="text-[10px] text-muted uppercase tracking-wide">Tinjauan</div>
                                                                <div className="text-lg font-bold text-amber-500">{pendingCanonicalSuggestionCount}</div>
                                                                <div className="text-[10px] text-muted">saran</div>
                                                            </div>
                                                            <div className="bg-surface border border-border rounded-xl p-3">
                                                                <div className="text-[10px] text-muted uppercase tracking-wide">Batas pengaman</div>
                                                                <div className="text-lg font-bold text-primary">{canonicalRuleStats.rejected}</div>
                                                                <div className="text-[10px] text-muted">aturan ditolak</div>
                                                            </div>
                                                        </div>
                                                        {(canonicalRuleStats.disabled > 0 || canonicalRuleStats.learned > canonicalRuleStats.activeLearned) && (
                                                            <div className="text-[10px] text-muted bg-surface border border-border rounded-xl p-2">
                                                                {canonicalRuleStats.disabled} aturan dinonaktifkan; {canonicalRuleStats.learned - canonicalRuleStats.activeLearned} aturan belum diterapkan otomatis.
                                                            </div>
                                                        )}
                                                        {learnedCanonicalRules.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Aturan terbaru yang dipelajari</div>
                                                                {learnedCanonicalRules.map(rule => (
                                                                    <div key={rule.id} className="bg-surface border border-border rounded-xl p-3 flex items-start justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border border-border text-muted uppercase">{rule.field}</span>
                                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${rule.disabled ? 'bg-red-500/10 text-red-500 border-red-500/20' : rule.autoApplyDisabled ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                                                                                    {rule.disabled ? 'nonaktif' : rule.autoApplyDisabled ? 'tinjau saja' : 'terapkan otomatis'}
                                                                                </span>
                                                                            </div>
                                                                            <div className="text-xs font-semibold text-primary truncate">{rule.aliases.slice(0, 2).join(', ') || '—'} → {rule.canonicalValue}</div>
                                                                            <div className="text-[10px] text-muted mt-1">
                                                                                {rule.approvalCount} persetujuan, {rule.rejectionCount} penolakan{rule.disabledReason ? ` • ${rule.disabledReason}` : ''}
                                                                            </div>
                                                                        </div>
                                                                        {onToggleCanonicalRuleDisabled && (
                                                                            <button
                                                                                onClick={() => onToggleCanonicalRuleDisabled(rule.id)}
                                                                                className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${rule.disabled ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'}`}
                                                                            >
                                                                                {rule.disabled ? 'Aktifkan' : 'Nonaktifkan'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                const result = onRunCanonicalBackfill();
                                                                setCanonicalBackfillSummary(`${result.autoAppliedCount} perubahan diterapkan otomatis pada ${result.changedItemIds.length} catatan. ${result.reviewSuggestionCount} saran menunggu tinjauan.`);
                                                            }}
                                                            className="w-full py-2.5 bg-indigo-500/10 text-indigo-500 font-medium rounded-xl hover:bg-indigo-500/20 transition-colors"
                                                        >
                                                            Periksa ulang riwayat data kanonis
                                                        </button>
                                                        {canonicalBackfillSummary && (
                                                            <div className="text-xs text-muted bg-surface border border-border rounded-xl p-3">
                                                                {canonicalBackfillSummary}
                                                            </div>
                                                        )}
                                                    </div>
                                                </section>
                                            )}

                                            {spreadsheetConfig && (
                                                <section className={contentSurface.desktopSettingsWide}>
                                                    <div className="flex items-center justify-between mb-3 ml-1">
                                                        <h3 className="text-xs font-bold text-muted uppercase tracking-wider">Riwayat database</h3>
                                                        <div className="flex items-center gap-3">
                                                            <button 
                                                                onClick={async () => {
                                                                    const confirmed = await requestUserConfirmation({
                                                                        title: 'Buat cadangan sekarang?',
                                                                        message: 'Arkaiv akan menyimpan versi database saat ini ke riwayat Google Sheets.',
                                                                        confirmLabel: 'Buat cadangan',
                                                                        tone: 'primary',
                                                                    });
                                                                    if (!confirmed) return;
                                                                    onSyncClick(true);
                                                                    setTimeout(fetchHistory, 2000);
                                                                }}
                                                                className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1"
                                                            >
                                                                <Save className="w-3 h-3" />
                                                                Buat cadangan
                                                            </button>
                                                            <button 
                                                                onClick={fetchHistory}
                                                                disabled={isFetchingHistory}
                                                                className="text-xs text-indigo-500 hover:text-indigo-400 flex items-center gap-1"
                                                            >
                                                                <RefreshCw className={`w-3 h-3 ${isFetchingHistory ? 'animate-spin' : ''}`} />
                                                                Muat ulang
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="bg-background border border-border rounded-2xl overflow-hidden">
                                                        {isFetchingHistory && history.length === 0 ? (
                                                            <div className="p-6 text-center text-muted text-sm">Memuat riwayat…</div>
                                                        ) : historyError ? (
                                                            <div className="flex flex-col items-center gap-2 p-6 text-center text-sm text-[var(--finance-negative)]">
                                                                <AlertCircle className="w-5 h-5" />
                                                                <span>Riwayat belum dapat dimuat.</span>
                                                                <details className="text-xs">
                                                                    <summary className="cursor-pointer font-semibold">Detail teknis</summary>
                                                                    <p className="mt-1 max-w-md break-words text-muted">{historyError}</p>
                                                                </details>
                                                            </div>
                                                        ) : history.length === 0 ? (
                                                            <div className="p-6 text-center text-muted text-sm">Belum ada riwayat. Cadangan dibuat setiap hari.</div>
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
                                                                                    {new Date(entry.timestamp).toLocaleDateString('id-ID', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                                                </div>
                                                                                <div className="text-xs text-muted">
                                                                                    {new Date(entry.timestamp).toLocaleTimeString('id-ID')} • {entry.data.data?.length || 0} catatan
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleRestoreHistory(entry)}
                                                                            className="px-3 py-1.5 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 rounded-lg text-xs font-medium transition-colors"
                                                                        >
                                                                            Pulihkan
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </section>
                                            )}

                                            <section className={contentSurface.desktopSettingsWide} data-ndz-danger-zone="separated-from-form-workflows">
                                                <h3 className="text-xs font-bold text-[var(--finance-negative)] uppercase tracking-wider mb-3 ml-1">Zona berisiko</h3>
                                                <div className="max-w-xl bg-red-500/5 border border-red-500/20 rounded-2xl p-4 ring-1 ring-red-500/10">
                                                    <div className="flex items-start gap-3 mb-4">
                                                        <div className="p-2 bg-red-500/10 rounded-xl text-red-500 shrink-0">
                                                            <Trash2 className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-[var(--finance-negative)] text-sm">Hapus seluruh data</div>
                                                            <div className="text-xs text-red-500/70 mt-1">
                                                                Semua catatan, dompet, dan pengaturan akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                                                            </div>
                                                            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-500/70">
                                                                Tindakan sensitif dengan konfirmasi
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={async () => {
                                                            const confirmed = await requestUserConfirmation({
                                                                title: 'Hapus seluruh data?',
                                                                message: 'Semua catatan, dompet, dan pengaturan akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.',
                                                                confirmLabel: 'Hapus seluruh data',
                                                                tone: 'danger',
                                                            });
                                                            if (confirmed) onClearData();
                                                        }}
                                                        className="w-full py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors shadow-sm"
                                                    >
                                                        Hapus seluruh data
                                                    </button>
                                                </div>
                                            </section>
                                        </div>
                                    )}

                                    {/* CONNECT TAB */}
                                    {activeTab === 'connect' && (
                                        <div className={contentSurface.desktopSettingsGrid}>
                                            {/* Google Profile Section */}
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Akun Google</h3>
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
                                                                onClick={handleGoogleSignOut}
                                                                className="text-xs text-red-500 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                                                            >
                                                                Keluar
                                                            </button>
                                                        </div>
                                                    ) : spreadsheetConfig?.authMode === 'service_account' ? (
                                                        <div className="space-y-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 shrink-0">
                                                                    <CheckCircle2 className="w-5 h-5" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-primary text-sm">Akun layanan aktif</div>
                                                                    <p className="text-xs text-muted mt-1 leading-relaxed">
                                                                        Sinkronisasi spreadsheet memakai akun layanan di server. Login Google tetap terpisah untuk sinkronisasi Kalender dan cadangan profil.
                                                                    </p>
                                                                    <div className="mt-2 text-[11px] font-mono text-muted break-all">
                                                                        {spreadsheetConfig.serviceAccountEmail || SERVICE_ACCOUNT_EMAIL}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={handleGoogleLogin}
                                                                className="w-full py-2.5 bg-surface border border-border text-primary font-medium rounded-xl hover:bg-muted/10 transition-colors text-xs"
                                                            >
                                                                Login untuk sinkronisasi Kalender dan profil
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-4">
                                                            <p className="text-sm text-muted mb-4">Login Google terpisah dari spreadsheet. Gunakan untuk sinkronisasi Kalender dan cadangan profil; Sheets tetap dapat memakai akun layanan di bawah.</p>
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
                                                                Login dengan Google
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </section>

                                            {/* Spreadsheet Config */}
                                            <section>
                                                    <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Koneksi spreadsheet</h3>
                                                    <div className="bg-background border border-border rounded-2xl p-4 space-y-4">
                                                        <div className="text-xs text-muted bg-surface border border-border rounded-xl p-3 leading-relaxed">
                                                            Bagikan spreadsheet kepada <span className="font-mono text-primary">{SERVICE_ACCOUNT_EMAIL}</span> sebagai Editor, tempel tautannya, lalu hubungkan. Login Google tidak diperlukan untuk sinkronisasi spreadsheet.
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-muted mb-1">Tautan spreadsheet</label>
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
                                                                        notifyUser('Link tidak valid.', 'error');
                                                                        return;
                                                                    }
                                                                    handleConnectSpreadsheet(); 
                                                                }}
                                                                disabled={!spreadsheetLink || isConnectingSpreadsheet}
                                                                className="w-full py-2.5 bg-primary text-background font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isConnectingSpreadsheet ? 'Memeriksa akses akun layanan…' : 'Hubungkan spreadsheet'}
                                                            </button>
                                                        )}
                                                        {spreadsheetConfig && (
                                                            <button 
                                                                onClick={handleDisconnectSpreadsheet}
                                                                className="w-full py-2.5 bg-red-500/10 text-red-500 font-medium rounded-xl hover:bg-red-500/20 transition-colors"
                                                            >
                                                                Putuskan spreadsheet
                                                            </button>
                                                        )}
                                                    </div>
                                                </section>

                                            {/* Gemini */}
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Kecerdasan AI</h3>
                                                <div className="bg-background border border-border rounded-2xl p-4">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                                                            <Sparkles className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-primary text-sm">Google Gemini API</div>
                                                            <div className="text-xs text-muted">Diperlukan untuk kategorisasi.</div>
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

                                            {/* Google Calendar */}
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Integrasi</h3>
                                                <div className="bg-background border border-border rounded-2xl p-4 space-y-3">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                                                            <Calendar className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-primary text-sm">Google Calendar</div>
                                                            <div className="text-xs text-muted">
                                                                {localAppSettings.googleCalendarSyncEnabled ? 'Sinkronisasi aktif' : 'Sinkronkan tugas, belanja, dan acara bertanggal'}
                                                            </div>
                                                        </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            role="switch"
                                                            aria-checked={!!localAppSettings.googleCalendarSyncEnabled}
                                                            onClick={() => handleToggleCalendarSync(!localAppSettings.googleCalendarSyncEnabled)}
                                                            disabled={calendarSyncStatus === 'syncing'}
                                                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${localAppSettings.googleCalendarSyncEnabled ? 'bg-blue-500' : 'bg-muted/30'}`}
                                                        >
                                                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${localAppSettings.googleCalendarSyncEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            className="w-full bg-surface border border-border rounded-xl p-3 text-primary focus:outline-none focus:border-blue-500 transition-colors placeholder:text-muted/20 text-xs"
                                                            value={gCalId}
                                                            onChange={(e) => setGCalId(e.target.value)}
                                                            placeholder="ID Kalender (mis. primary atau email)"
                                                        />
                                                        <div className="text-[11px] text-muted leading-relaxed">
                                                            Menggunakan akses OAuth akun Google yang terhubung, bukan kunci API terpisah. Gunakan <span className="font-mono text-primary">primary</span> untuk kalender bawaan.
                                                        </div>
                                                        {calendarSyncError && (
                                                            <div className="rounded-xl border border-[var(--finance-negative)]/20 bg-[var(--finance-negative-soft)] p-3 text-xs leading-relaxed text-[var(--finance-negative)]">
                                                                <span className="font-semibold">Kalender belum dapat disinkronkan.</span>
                                                                <details className="mt-1">
                                                                    <summary className="cursor-pointer font-semibold">Detail teknis</summary>
                                                                    <p className="mt-1 break-words text-muted">{calendarSyncError}</p>
                                                                </details>
                                                            </div>
                                                        )}
                                                        {calendarSyncStatus === 'success' && !calendarSyncError && (
                                                            <div className="rounded-xl border border-[var(--finance-positive)]/20 bg-[var(--finance-positive-soft)] p-3 text-xs text-[var(--finance-positive)]">
                                                                Kalender tersinkron.
                                                            </div>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSyncCalendarNow()}
                                                            disabled={calendarSyncStatus === 'syncing'}
                                                            className="w-full py-2.5 bg-blue-500/10 text-blue-500 font-medium rounded-xl hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                        >
                                                            {calendarSyncStatus === 'syncing' && <RefreshCw className="w-4 h-4 animate-spin" />}
                                                            {calendarSyncStatus === 'syncing' ? 'Menyinkronkan Kalender…' : 'Sinkronkan Kalender sekarang'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </section>
                                        </div>
                                    )}
                                    {/* CHANGELOG TAB */}
                                    {activeTab === 'changelog' && (
                                        <div className={contentSurface.pageStack}>
                                            <section>
                                                <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3 ml-1">Riwayat versi</h3>
                                                <div className="space-y-4">
                                                    {CHANGELOG_ENTRIES.map((entry) => (
                                                        <div key={entry.version} className="bg-background border border-border rounded-2xl p-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <div className="font-bold text-primary flex items-center gap-2">
                                                                    {entry.version}
                                                                    {entry.version === LATEST_CHANGELOG_VERSION && (
                                                                        <span className="text-[10px] uppercase tracking-wider bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full">Baru</span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-muted">{entry.date}</div>
                                                            </div>
                                                            <ul className="text-sm text-muted space-y-2 list-disc pl-4">
                                                                {entry.items.map((item) => (
                                                                    <li key={item}>{item}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                            </div>
                        </div>
        </PresencePanel>
    );
};

export default ControlCenter;
