import { useState, useEffect } from 'react';
import { AppSettings, BudgetConfig, BudgetRule, BrainDumpItem, Skill, Wallet, SyncStatus } from '../types';
import { checkServiceAccountSpreadsheetAccess, getSpreadsheetConfig, saveSpreadsheetConfig, clearSpreadsheetConfig, SpreadsheetConfig, ServiceAccountSpreadsheetStatus, SERVICE_ACCOUNT_EMAIL } from '../services/spreadsheetService';
import { saveGeminiKey } from '../services/geminiService';
import { exportToExcel } from '../services/exportService';
import { BackHandler } from '../utils/backHandler';

export interface UseControlCenterProps {
    isOpen: boolean;
    appSettings: AppSettings;
    setAppSettings: (settings: AppSettings) => void;
    onSave: (newBudgetConfig?: BudgetConfig, newPrompt?: string, newAppSettings?: AppSettings) => void;
    onRefreshClick?: () => void;
    onSyncClick: (forceOverwrite?: boolean) => void;
    allItems: BrainDumpItem[];
    allSkills: Skill[];
    allWallets: Wallet[];
    monthlyThemes: Record<string, string>;
    currentBudgetConfig?: BudgetConfig;
    currentPrompt?: string;
}

export const useControlCenter = ({
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
}: UseControlCenterProps) => {
    // --- Settings State ---
    const [activeTab, setActiveTab] = useState<'main' | 'appearance' | 'behavior' | 'budget' | 'data' | 'connect' | 'notifications' | 'changelog'>('main');
    const [direction, setDirection] = useState(1); // 1 for forward, -1 for back
    const [settingsSaveStatus, setSettingsSaveStatus] = useState<'idle' | 'saved'>('idle');

    useEffect(() => {
        if (isOpen && activeTab !== 'main') {
            return BackHandler.register(() => {
                handleTabChange('main');
                return true;
            });
        }
    }, [isOpen, activeTab]);

    const handleTabChange = (tab: typeof activeTab) => {
        if (tab === 'main') {
            setDirection(-1);
        } else {
            setDirection(1);
        }
        setActiveTab(tab);
    };

    // Spreadsheet
    const [spreadsheetLink, setSpreadsheetLink] = useState('');

    const [spreadsheetConfig, setSpreadsheetConfig] = useState<SpreadsheetConfig | null>(null);
    const [isConnectingSpreadsheet, setIsConnectingSpreadsheet] = useState(false);
    
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
    useEffect(() => {
        if (currentBudgetConfig) {
            setMonthlyIncome(currentBudgetConfig.monthlyIncome || 0);
            setBudgetRules(currentBudgetConfig.rules || []);
        }
    }, [currentBudgetConfig]);

    useEffect(() => {
        if (currentPrompt) {
            setPrompt(currentPrompt);
        }
    }, [currentPrompt]);

    useEffect(() => {
        setLocalAppSettings(appSettings);
    }, [appSettings]);

    // --- Initialization ---
    useEffect(() => {
        if (isOpen) {
            // Load Gemini Key
            const savedGeminiKey = localStorage.getItem('braindump_gemini_key') || '';
            setGeminiKey(savedGeminiKey);

            // Load GCal Keys
            const savedGCalKey = localStorage.getItem('braindump_gcal_key') || '';
            const savedGCalId = localStorage.getItem('braindump_gcal_id') || '';
            setGCalKey(savedGCalKey);
            setGCalId(savedGCalId);

            // Load Spreadsheet
            const ss = getSpreadsheetConfig();
            if (ss) {
                setSpreadsheetConfig(ss);
                setSpreadsheetLink(ss.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${ss.spreadsheetId}/edit`);
            }
        }
    }, [isOpen]);


    const handleConnectSpreadsheet = async () => {
        if (!spreadsheetLink) {
            alert("Please enter a spreadsheet link first.");
            return;
        }
        
        const match = spreadsheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (!match) {
            alert("Invalid spreadsheet link. Please make sure it contains /d/SPREADSHEET_ID");
            return;
        }

        const spreadsheetId = match[1];
        let serviceAccountStatus: ServiceAccountSpreadsheetStatus | null = null;

        setIsConnectingSpreadsheet(true);
        try {
            serviceAccountStatus = await checkServiceAccountSpreadsheetAccess(spreadsheetId);
            if (serviceAccountStatus.accessible) {
                const newConfig: SpreadsheetConfig = {
                    spreadsheetId,
                    spreadsheetUrl: spreadsheetLink,
                    authMode: 'service_account',
                    serviceAccountEmail: serviceAccountStatus.serviceAccountEmail || SERVICE_ACCOUNT_EMAIL
                };

                saveSpreadsheetConfig(newConfig);
                setSpreadsheetConfig(newConfig);
                alert("Spreadsheet connected via service account. No Google sign-in needed.");
                onSyncClick(false);
                return;
            }

            if (serviceAccountStatus.configured && serviceAccountStatus.needsSharing) {
                alert(`Service account belum punya akses. Share spreadsheet ini ke ${serviceAccountStatus.serviceAccountEmail || SERVICE_ACCOUNT_EMAIL} sebagai Editor, lalu klik Connect Spreadsheet lagi.`);
                return;
            }

            if (serviceAccountStatus.configured && serviceAccountStatus.error) {
                console.warn("Service account spreadsheet check failed", serviceAccountStatus);
            }
        } catch (error) {
            console.warn("Service account spreadsheet check failed", error);
        } finally {
            setIsConnectingSpreadsheet(false);
        }

        if (!serviceAccountStatus?.configured) {
            alert("Service account belum dikonfigurasi di server. Tambahkan GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_KEY / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY di hosting, lalu coba lagi.");
            return;
        }

        alert(`Belum bisa connect via service account. Pastikan spreadsheet sudah di-share sebagai Editor ke ${serviceAccountStatus.serviceAccountEmail || SERVICE_ACCOUNT_EMAIL}, lalu coba lagi.`);
    };

    const handleDisconnectSpreadsheet = () => {
        if (window.confirm("Are you sure you want to disconnect your spreadsheet?")) {
            clearSpreadsheetConfig();
            setSpreadsheetConfig(null);
            setSpreadsheetLink('');
            if (onRefreshClick) onRefreshClick();
        }
    };

    const handleSave = async () => {
        // Save Gemini
        saveGeminiKey(geminiKey);

        // Save GCal
        localStorage.setItem('braindump_gcal_key', gCalKey);
        localStorage.setItem('braindump_gcal_id', gCalId);

        // Prepare Objects
        const newBudgetConfig: BudgetConfig = { monthlyIncome, rules: budgetRules };

        setSettingsSaveStatus('saved');
        
        // Propagate changes
        onSave(newBudgetConfig, prompt, localAppSettings);
        
        setTimeout(() => {
            setSettingsSaveStatus('idle');
        }, 2000);
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
        const newTheme: 'light' | 'dark' = localAppSettings.theme === 'dark' ? 'light' : 'dark';
        const newSettings = { ...localAppSettings, theme: newTheme };
        setLocalAppSettings(newSettings);
        setAppSettings(newSettings); // Apply immediately for instant feedback
        onSave(undefined, undefined, newSettings); // Persist
    };

    return {
        activeTab,
        direction,
        settingsSaveStatus,
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
        handleTabChange,
        setSpreadsheetLink,
        setGeminiKey,
        setPrompt,
        setGCalKey,
        setGCalId,
        setMonthlyIncome,
        setLocalAppSettings,
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
    };
};
