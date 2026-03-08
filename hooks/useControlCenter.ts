import { useState, useEffect, useRef } from 'react';
import { AppSettings, BudgetConfig, BudgetRule, BrainDumpItem, Skill, Wallet, SyncStatus } from '../types';
import { getGithubConfig, saveGithubConfig, clearGithubConfig, GithubConfig } from '../services/githubService';
import { getSpreadsheetConfig, saveSpreadsheetConfig, clearSpreadsheetConfig, SpreadsheetConfig } from '../services/spreadsheetService';
import { saveGeminiKey } from '../services/geminiService';
import { exportToExcel } from '../services/exportService';
import { fetchGoogleProfile, loadConfigFromDrive, saveConfigToDrive, saveGoogleSession, getGoogleSession, clearGoogleSession, GoogleProfile } from '../services/googleProfileService';

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
    const [activeTab, setActiveTab] = useState<'main' | 'appearance' | 'behavior' | 'budget' | 'data' | 'connect'>('main');
    const [direction, setDirection] = useState(1); // 1 for forward, -1 for back
    const [settingsSaveStatus, setSettingsSaveStatus] = useState<'idle' | 'saved'>('idle');

    type ConnectionAction = 'github' | 'spreadsheet';
    const [connectionModal, setConnectionModal] = useState<{
        isOpen: boolean;
        provider: ConnectionAction;
        config: any;
    } | null>(null);

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
    
    // Spreadsheet
    const [spreadsheetLink, setSpreadsheetLink] = useState('');
    const spreadsheetLinkRef = useRef(spreadsheetLink);
    useEffect(() => { spreadsheetLinkRef.current = spreadsheetLink; }, [spreadsheetLink]);

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
    const localAppSettingsRef = useRef(localAppSettings);
    useEffect(() => { localAppSettingsRef.current = localAppSettings; }, [localAppSettings]);

    // Google Profile
    const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null);
    const [isSyncingProfile, setIsSyncingProfile] = useState(false);

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

            // Check if already logged in
            // 1. Try Spreadsheet Config
            const ss = getSpreadsheetConfig();
            if (ss && ss.accessToken) {
                fetchGoogleProfile(ss.accessToken).then(setGoogleProfile).catch(() => {
                    // Token might be expired
                });
            } else {
                // 2. Try Session
                const session = getGoogleSession();
                if (session) {
                    fetchGoogleProfile(session.access_token).then(setGoogleProfile).catch(() => {
                        clearGoogleSession();
                    });
                }
            }

            // Load GitHub
            const gh = getGithubConfig();
            if (gh) setGithubConfig(gh);

            // Load Spreadsheet
            if (ss) {
                setSpreadsheetConfig(ss);
                setSpreadsheetLink(ss.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${ss.spreadsheetId}/edit`);
            }
        }
    }, [isOpen]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Validate origin is from AI Studio preview or localhost
            const origin = event.origin;
            if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
                return;
            }
            if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data.tokens) {
                handleGoogleLoginSuccess(event.data.tokens);
            }
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === 'oauth_tokens' && event.newValue) {
                try {
                    const tokens = JSON.parse(event.newValue);
                    if (tokens && tokens.access_token) {
                        handleGoogleLoginSuccess(tokens);
                        localStorage.removeItem('oauth_tokens');
                    }
                } catch (e) {
                    console.error("Failed to parse oauth tokens from storage", e);
                }
            }
        };

        window.addEventListener('message', handleMessage);
        window.addEventListener('storage', handleStorage);
        
        // Also check on mount in case the storage event was missed
        const checkStoredTokens = () => {
            const storedTokens = localStorage.getItem('oauth_tokens');
            if (storedTokens) {
                try {
                    const tokens = JSON.parse(storedTokens);
                    if (tokens && tokens.access_token) {
                        handleGoogleLoginSuccess(tokens);
                        localStorage.removeItem('oauth_tokens');
                    }
                } catch (e) {
                    console.error("Failed to parse stored oauth tokens", e);
                }
            }
        };
        
        checkStoredTokens();
        
        // Poll every second while waiting for login
        const pollInterval = setInterval(checkStoredTokens, 1000);

        return () => {
            window.removeEventListener('message', handleMessage);
            window.removeEventListener('storage', handleStorage);
            clearInterval(pollInterval);
        };
    }, []);

    const handleGoogleLoginSuccess = async (tokens: any) => {
        setIsSyncingProfile(true);
        try {
            // Save Session
            saveGoogleSession(tokens);

            // 1. Fetch Profile
            const profile = await fetchGoogleProfile(tokens.access_token);
            setGoogleProfile(profile);

            // 2. Try to load config from Drive
            const cloudConfig = await loadConfigFromDrive(tokens.access_token);
            
            if (cloudConfig) {
                // Restore settings from cloud
                if (cloudConfig.spreadsheetId) {
                    const newConfig: SpreadsheetConfig = {
                        spreadsheetId: cloudConfig.spreadsheetId,
                        spreadsheetUrl: cloudConfig.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${cloudConfig.spreadsheetId}/edit`,
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token,
                        tokenExpiresAt: Date.now() + (tokens.expires_in * 1000)
                    };
                    saveSpreadsheetConfig(newConfig);
                    setSpreadsheetConfig(newConfig);
                    setSpreadsheetLink(newConfig.spreadsheetUrl);
                    alert(`Welcome back, ${profile.name}! Settings synced from cloud.`);
                }
                
                if (cloudConfig.theme) {
                    const newSettings = { ...localAppSettingsRef.current, theme: cloudConfig.theme };
                    setLocalAppSettings(newSettings);
                    setAppSettings(newSettings);
                }
            } else {
                // No config found, this is a new login or first time using profile sync
                // We don't overwrite local settings yet, but we save the token
                // If we already have a spreadsheet link locally, we should save it to cloud now
                const currentSpreadsheetLink = spreadsheetLinkRef.current;
                if (currentSpreadsheetLink) {
                     const match = currentSpreadsheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
                     const spreadsheetId = match ? match[1] : currentSpreadsheetLink;
                     
                     const newConfig: SpreadsheetConfig = {
                        spreadsheetId,
                        spreadsheetUrl: currentSpreadsheetLink,
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token,
                        tokenExpiresAt: Date.now() + (tokens.expires_in * 1000)
                    };
                    saveSpreadsheetConfig(newConfig);
                    setSpreadsheetConfig(newConfig);
                    
                    // Save to Drive
                    await saveConfigToDrive({
                        spreadsheetId,
                        spreadsheetUrl: currentSpreadsheetLink,
                        theme: localAppSettingsRef.current.theme
                    }, tokens.access_token);
                } else {
                    // Just save the token for future use (we need a dummy config or just store it separately)
                    // For now, we wait for user to enter spreadsheet link
                    alert(`Welcome, ${profile.name}! Please enter your spreadsheet link to finish setup.`);
                }
            }
        } catch (error) {
            console.error("Profile sync error:", error);
            alert("Failed to sync profile data.");
        } finally {
            setIsSyncingProfile(false);
            // Trigger refresh to update UI
            if (onRefreshClick) onRefreshClick();
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const origin = window.location.origin;
            const response = await fetch(`/api/auth/google/url?origin=${encodeURIComponent(origin)}`);
            if (!response.ok) throw new Error('Failed to get auth URL');
            const { url } = await response.json();
            
            // Open Google Auth in a popup
            const authWindow = window.open(
                url,
                'oauth_popup',
                'width=600,height=700'
            );

            if (!authWindow) {
                alert('Please allow popups for this site to connect your account.');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Failed to start login process.');
        }
    };

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

        // Check if we have a valid session
        const session = getGoogleSession();
        
        if (!session) {
            // If we have a profile but no session, something is wrong (likely expired)
            if (googleProfile) {
                alert("Your session has expired. Please sign in again to connect your spreadsheet.");
            }
            handleGoogleLogin();
            return;
        }

        // We have a token, just save the config
        const spreadsheetId = match[1];
        const newConfig: SpreadsheetConfig = {
            spreadsheetId,
            spreadsheetUrl: spreadsheetLink,
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            tokenExpiresAt: session.expires_at
        };
        
        saveSpreadsheetConfig(newConfig);
        setSpreadsheetConfig(newConfig);
        
        // Sync to Drive
        try {
            await saveConfigToDrive({
                spreadsheetId,
                spreadsheetUrl: spreadsheetLink,
                theme: localAppSettings.theme
            }, session.access_token);
            alert("Spreadsheet connected and settings saved to Google Drive.");
        } catch (e) {
            console.warn("Failed to sync to Drive", e);
            alert("Spreadsheet connected locally, but failed to sync to Google Drive.");
        }
        
        if (onRefreshClick) onRefreshClick();
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
        // Check if GitHub is being newly connected
        const currentGithub = getGithubConfig();
        const isNewGithub = githubConfig.token && githubConfig.owner && githubConfig.repo && 
            (!currentGithub || currentGithub.token !== githubConfig.token || currentGithub.repo !== githubConfig.repo);

        if (isNewGithub) {
            setConnectionModal({
                isOpen: true,
                provider: 'github',
                config: githubConfig
            });
            return; // Stop save process, wait for modal choice
        } else if (githubConfig.token && githubConfig.owner && githubConfig.repo) {
            saveGithubConfig(githubConfig);
        }

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
        
        // Save to Drive if connected
        if (spreadsheetConfig && spreadsheetConfig.accessToken) {
             try {
                await saveConfigToDrive({
                    spreadsheetId: spreadsheetConfig.spreadsheetId,
                    spreadsheetUrl: spreadsheetConfig.spreadsheetUrl,
                    theme: localAppSettings.theme
                }, spreadsheetConfig.accessToken);
             } catch (e) {
                 console.warn("Failed to background sync to Drive", e);
             }
        }
        
        setTimeout(() => {
            setSettingsSaveStatus('idle');
        }, 2000);
    };

    const handleDisconnectGithub = () => {
        clearGithubConfig();
        setGithubConfig({ token: '', owner: '', repo: '', path: 'db.json' });
        if (onRefreshClick) onRefreshClick();
    };

    const handleConnectionChoice = async (choice: 'merge' | 'overwrite_cloud' | 'overwrite_local') => {
        if (!connectionModal) return;
        
        const { provider, config } = connectionModal;
        
        // Save the config
        if (provider === 'spreadsheet') {
            saveSpreadsheetConfig(config);
            setSpreadsheetConfig(config);
        } else if (provider === 'github') {
            saveGithubConfig(config);
        }
        
        setConnectionModal(null);
        
        // Trigger the action
        if (choice === 'merge') {
            if (onRefreshClick) onRefreshClick();
            setTimeout(() => {
                onSyncClick(false);
            }, 1500);
            alert(`Connected to ${provider} and merged data.`);
        } else if (choice === 'overwrite_cloud') {
            onSyncClick(true);
            alert(`Connected to ${provider} and overwrote cloud data.`);
        } else if (choice === 'overwrite_local') {
            if (onRefreshClick) onRefreshClick();
            alert(`Connected to ${provider} and overwrote local data.`);
        }

        // If it was github, we also need to finish the save process
        if (provider === 'github') {
            saveGeminiKey(geminiKey);
            localStorage.setItem('braindump_gcal_key', gCalKey);
            localStorage.setItem('braindump_gcal_id', gCalId);
            const newBudgetConfig: BudgetConfig = { monthlyIncome, rules: budgetRules };
            setSettingsSaveStatus('saved');
            onSave(newBudgetConfig, prompt, localAppSettings);
            setTimeout(() => {
                setSettingsSaveStatus('idle');
            }, 800);
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
    };
};
