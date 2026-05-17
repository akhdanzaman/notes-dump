import { useState, useEffect, useRef } from 'react';
import { AppSettings, BudgetConfig, BudgetRule, BrainDumpItem, Skill, Wallet } from '../types';
import { checkServiceAccountSpreadsheetAccess, getSpreadsheetConfig, saveSpreadsheetConfig, clearSpreadsheetConfig, SpreadsheetConfig, SERVICE_ACCOUNT_EMAIL } from '../services/spreadsheetService';
import { saveGeminiKey } from '../services/geminiService';
import { exportToExcel } from '../services/exportService';
import { fetchGoogleProfile, loadConfigFromDrive, saveConfigToDrive, saveGoogleSession, clearGoogleSession, GoogleProfile, getValidGoogleAccessToken } from '../services/googleProfileService';
import { syncItemsToGoogleCalendar } from '../services/googleCalendarService';
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
    const oauthPopupRef = useRef<Window | null>(null);

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
    const [calendarSyncStatus, setCalendarSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [calendarSyncError, setCalendarSyncError] = useState<string | null>(null);

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
            const savedGCalId = appSettings.googleCalendarId || localStorage.getItem('braindump_gcal_id') || 'primary';
            setGCalKey(savedGCalKey);
            setGCalId(savedGCalId);

            // Load Spreadsheet
            const ss = getSpreadsheetConfig();
            if (ss) {
                setSpreadsheetConfig(ss);
                setSpreadsheetLink(ss.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${ss.spreadsheetId}/edit`);
            }

            // Google account state is independent from spreadsheet sync mode. Even when
            // Sheets uses the service account, the UI should still show an active Google
            // login because Calendar sync and profile backup use browser OAuth.
            getValidGoogleAccessToken().then(token => {
                if (token) {
                    fetchGoogleProfile(token).then(setGoogleProfile).catch(() => {
                        // Token might be expired or invalid
                    });
                }
            });
        }
    }, [isOpen, appSettings.googleCalendarId]);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (oauthPopupRef.current && event.source !== oauthPopupRef.current) return;
            if (event.data?.type === 'GOOGLE_OAUTH_SUCCESS' && event.data.tokens) {
                handleGoogleLoginSuccess(event.data.tokens);
                oauthPopupRef.current = null;
            } else if (event.data?.type === 'GOOGLE_OAUTH_ERROR') {
                oauthPopupRef.current = null;
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

            const token = await getValidGoogleAccessToken();
            if (!token) {
                throw new Error("Failed to get valid access token after login");
            }

            // 1. Fetch Profile
            const profile = await fetchGoogleProfile(token);
            setGoogleProfile(profile);

            // 2. Try to load config from Drive
            const cloudConfig = await loadConfigFromDrive(token);
            
            if (cloudConfig) {
                // Restore settings from cloud
                if (cloudConfig.spreadsheetId) {
                    const currentConfig = getSpreadsheetConfig();
                    const newConfig: SpreadsheetConfig = currentConfig?.spreadsheetId === cloudConfig.spreadsheetId
                        ? currentConfig
                        : {
                        spreadsheetId: cloudConfig.spreadsheetId,
                        spreadsheetUrl: cloudConfig.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${cloudConfig.spreadsheetId}/edit`,
                        authMode: cloudConfig.authMode || 'service_account',
                        serviceAccountEmail: cloudConfig.serviceAccountEmail || SERVICE_ACCOUNT_EMAIL
                    };
                    saveSpreadsheetConfig(newConfig);
                    setSpreadsheetConfig(newConfig);
                    setSpreadsheetLink(newConfig.spreadsheetUrl);
                    alert(`Welcome back, ${profile.name}! Settings synced from cloud.`);
                }
                
                if (cloudConfig.theme || cloudConfig.googleCalendarId || typeof cloudConfig.googleCalendarSyncEnabled === 'boolean') {
                    const newSettings = {
                        ...localAppSettingsRef.current,
                        theme: cloudConfig.theme || localAppSettingsRef.current.theme,
                        googleCalendarSyncEnabled: typeof cloudConfig.googleCalendarSyncEnabled === 'boolean'
                            ? cloudConfig.googleCalendarSyncEnabled
                            : localAppSettingsRef.current.googleCalendarSyncEnabled,
                        googleCalendarId: cloudConfig.googleCalendarId || localAppSettingsRef.current.googleCalendarId || 'primary',
                    };
                    setLocalAppSettings(newSettings);
                    setAppSettings(newSettings);
                    setGCalId(newSettings.googleCalendarId || 'primary');
                }
            } else {
                // No config found, this is a new login or first time using profile sync
                // We don't overwrite local settings yet, but we save the token
                // If we already have a spreadsheet link locally, we should save it to cloud now
                const currentSpreadsheetLink = spreadsheetLinkRef.current;
                if (currentSpreadsheetLink) {
                     const match = currentSpreadsheetLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
                     const spreadsheetId = match ? match[1] : currentSpreadsheetLink;
                     
                     const currentConfig = getSpreadsheetConfig();
                     const newConfig: SpreadsheetConfig = currentConfig?.spreadsheetId === spreadsheetId
                        ? currentConfig
                        : {
                        spreadsheetId,
                        spreadsheetUrl: currentSpreadsheetLink,
                        authMode: 'service_account',
                        serviceAccountEmail: SERVICE_ACCOUNT_EMAIL
                    };
                    saveSpreadsheetConfig(newConfig);
                    setSpreadsheetConfig(newConfig);
                    
                    // Save to Drive
                    await saveConfigToDrive({
                        spreadsheetId,
                        spreadsheetUrl: currentSpreadsheetLink,
                        authMode: newConfig.authMode,
                        serviceAccountEmail: newConfig.serviceAccountEmail,
                        theme: localAppSettingsRef.current.theme,
                        googleCalendarSyncEnabled: localAppSettingsRef.current.googleCalendarSyncEnabled,
                        googleCalendarId: localAppSettingsRef.current.googleCalendarId
                    }, token);
                    alert(`Welcome, ${profile.name}! Your current spreadsheet has been linked to your account.`);
                } else {
                    // Just save the token for future use (we need a dummy config or just store it separately)
                    // For now, we wait for user to enter spreadsheet link
                    alert(`Welcome, ${profile.name}! Please enter your spreadsheet link below to finish setup.`);
                }
            }
        } catch (error) {
            console.error("Profile sync error:", error);
            alert("Failed to sync profile data. Please check your connection or try again.");
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
            
            // Open the OAuth PROVIDER's URL directly in popup
            const authWindow = window.open(
                url,
                'oauth_popup',
                'width=600,height=700'
            );
            oauthPopupRef.current = authWindow;

            if (!authWindow) {
                oauthPopupRef.current = null;
                // Popup was blocked
                alert('Please allow popups for this site to connect your account.');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Failed to start login process.');
        }
    };

    const handleConnectSpreadsheet = async () => {
        if (isConnectingSpreadsheet) return;
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

        setIsConnectingSpreadsheet(true);
        try {
            const serviceAccountStatus = await checkServiceAccountSpreadsheetAccess(spreadsheetId);
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

        alert(`Belum bisa connect via service account. Pastikan spreadsheet sudah di-share ke ${SERVICE_ACCOUNT_EMAIL} sebagai Editor, lalu klik Connect Spreadsheet lagi. Google login tidak diperlukan untuk mode ini.`);
    };

    const handleGoogleSignOut = () => {
        clearGoogleSession();
        setGoogleProfile(null);
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

        // Save Google Calendar config. Calendar writes use OAuth, not an API key;
        // keep the legacy key only so older local setups do not lose it abruptly.
        localStorage.setItem('braindump_gcal_key', gCalKey);
        const calendarIdToSave = (gCalId || 'primary').trim() || 'primary';
        localStorage.setItem('braindump_gcal_id', calendarIdToSave);
        const settingsToSave: AppSettings = {
            ...localAppSettings,
            googleCalendarId: calendarIdToSave,
        };

        // Prepare Objects
        const newBudgetConfig: BudgetConfig = { monthlyIncome, rules: budgetRules };

        setSettingsSaveStatus('saved');
        
        // Propagate changes
        onSave(newBudgetConfig, prompt, settingsToSave);
        
        // Save optional Google profile settings only for OAuth configs. Service-account
        // spreadsheet sync is server-side and must not refresh browser Google tokens.
        if (spreadsheetConfig && spreadsheetConfig.authMode !== 'service_account') {
             getValidGoogleAccessToken().then(token => {
                 if (token) {
                         saveConfigToDrive({
                             spreadsheetId: spreadsheetConfig.spreadsheetId,
                             spreadsheetUrl: spreadsheetConfig.spreadsheetUrl,
                             authMode: spreadsheetConfig.authMode,
                             serviceAccountEmail: spreadsheetConfig.serviceAccountEmail,
                             theme: settingsToSave.theme,
                             googleCalendarSyncEnabled: settingsToSave.googleCalendarSyncEnabled,
                             googleCalendarId: settingsToSave.googleCalendarId
                         }, token).catch(e => {
                         console.warn("Failed to background sync to Drive", e);
                     });
                 }
             });
        }
        
        setTimeout(() => {
            setSettingsSaveStatus('idle');
        }, 2000);
    };

    const handleToggleCalendarSync = async (enabled: boolean) => {
        const calendarIdToSave = (gCalId || 'primary').trim() || 'primary';
        const nextSettings: AppSettings = {
            ...localAppSettingsRef.current,
            googleCalendarSyncEnabled: enabled,
            googleCalendarId: calendarIdToSave,
        };
        setLocalAppSettings(nextSettings);
        setAppSettings(nextSettings);
        localStorage.setItem('braindump_gcal_id', calendarIdToSave);
        onSave(undefined, undefined, nextSettings);

        if (enabled) {
            await handleSyncCalendarNow(nextSettings);
        } else {
            setCalendarSyncStatus('idle');
            setCalendarSyncError(null);
        }
    };

    const handleSyncCalendarNow = async (settingsOverride?: AppSettings) => {
        const effectiveSettings = settingsOverride || {
            ...localAppSettingsRef.current,
            googleCalendarId: (gCalId || 'primary').trim() || 'primary',
        };
        setCalendarSyncStatus('syncing');
        setCalendarSyncError(null);
        try {
            await syncItemsToGoogleCalendar(allItems, {
                googleCalendarSyncEnabled: true,
                googleCalendarId: effectiveSettings.googleCalendarId,
            });
            setCalendarSyncStatus('success');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown Calendar sync error';
            setCalendarSyncStatus('error');
            setCalendarSyncError(message);
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
        calendarSyncStatus,
        calendarSyncError,
        handleTabChange,
        setSpreadsheetLink,
        setGeminiKey,
        setPrompt,
        setGCalKey,
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
    };
};
