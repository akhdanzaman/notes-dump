import { BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, DbSchema, ChatMessage } from "../types";
import { fetchDb as fetchGithubDb, syncData as syncGithubData, getGithubConfig, isUsingLocalStorage as isGithubLocal, SyncResult, mergeDbData } from "./githubService";
import { fetchSpreadsheetDb, syncSpreadsheetData, getSpreadsheetConfig, clearSpreadsheetConfig } from "./spreadsheetService";

export const getActiveSyncProviders = (): ('github' | 'spreadsheet')[] => {
  const providers: ('github' | 'spreadsheet')[] = [];
  if (getSpreadsheetConfig()) providers.push('spreadsheet');
  if (getGithubConfig()) providers.push('github');
  return providers;
};

export const fetchDb = async (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string; hasChanges: boolean }> => {
  const providers = getActiveSyncProviders();
  if (providers.length === 0) {
    const res = await fetchGithubDb(skipLocalStorage);
    return { ...res, hasChanges: false };
  }

  let mergedData: DbSchema | null = null;
  let finalSha = 'local-sha';
  let hasChanges = false;

  // Use local storage as base for 3-way merge during fetch
  let baseData: DbSchema | undefined;
  try {
    const local = localStorage.getItem('braindump_db');
    if (local) baseData = JSON.parse(local);
  } catch(e) {}

  for (const provider of providers) {
    try {
      if (provider === 'spreadsheet') {
        const { data, sha, reconciled } = await fetchSpreadsheetDb(true); // skip local storage update
        if (reconciled) hasChanges = true;
        if (!mergedData) {
          mergedData = data;
          finalSha = sha;
        } else {
          const prevData = mergedData;
          mergedData = mergeDbData(mergedData, data, baseData);
          if (JSON.stringify(mergedData.data) !== JSON.stringify(prevData.data)) {
            hasChanges = true;
          }
        }
      } else if (provider === 'github') {
        const { data, sha } = await fetchGithubDb(true); // skip local storage update
        if (!mergedData) {
          mergedData = data;
          finalSha = sha;
        } else {
          const prevData = mergedData;
          mergedData = mergeDbData(mergedData, data, baseData);
          if (JSON.stringify(mergedData.data) !== JSON.stringify(prevData.data)) {
            hasChanges = true;
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch from ${provider}`, e);
    }
  }

  if (mergedData) {
    // Re-read local storage to catch any changes made during fetch
    let currentLocalData: DbSchema | undefined;
    try {
      const local = localStorage.getItem('braindump_db');
      if (local) currentLocalData = JSON.parse(local);
    } catch(e) {}

    if (currentLocalData && JSON.stringify(currentLocalData.data) !== JSON.stringify(baseData?.data)) {
        // Local data changed during fetch! Merge it.
        mergedData = mergeDbData(currentLocalData, mergedData, baseData);
        hasChanges = true;
    }

    if (!skipLocalStorage) {
        localStorage.setItem('braindump_db', JSON.stringify(mergedData));
    }

    return { data: mergedData, sha: finalSha, hasChanges };
  }

  const res = await fetchGithubDb(skipLocalStorage);
  return { ...res, hasChanges: false };
};

export const syncData = async (
  items: BrainDumpItem[], 
  budgetConfig?: BudgetConfig, 
  customPrompt?: string, 
  skills?: Skill[], 
  wallets?: Wallet[],
  monthlyThemes?: Record<string, string>,
  appSettings?: AppSettings,
  chatHistory?: ChatMessage[]
): Promise<SyncResult> => {
  const providers = getActiveSyncProviders();
  if (providers.length === 0) {
    return syncGithubData(items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory); // Fallback to local
  }

  let hasError = false;
  let currentItems = items;
  let currentBudgetConfig = budgetConfig;
  let currentPrompt = customPrompt;
  let currentSkills = skills;
  let currentWallets = wallets;
  let currentThemes = monthlyThemes;
  let currentSettings = appSettings;
  let currentChatHistory = chatHistory;
  let finalMergedData: DbSchema | undefined;

  for (const provider of providers) {
    try {
      let res: SyncResult;
      if (provider === 'spreadsheet') {
        res = await syncSpreadsheetData(currentItems, currentBudgetConfig, currentPrompt, currentSkills, currentWallets, currentThemes, currentSettings, currentChatHistory);
      } else {
        res = await syncGithubData(currentItems, currentBudgetConfig, currentPrompt, currentSkills, currentWallets, currentThemes, currentSettings, currentChatHistory);
      }

      if (!res.success) hasError = true;
      if (res.mergedData) {
        finalMergedData = res.mergedData;
        // Update current state for next provider in loop
        currentItems = res.mergedData.data;
        currentBudgetConfig = res.mergedData.budgetConfig;
        currentPrompt = res.mergedData.customPrompt;
        currentSkills = res.mergedData.skills;
        currentWallets = res.mergedData.wallets;
        currentThemes = res.mergedData.monthlyThemes;
        currentSettings = res.mergedData.appSettings;
        currentChatHistory = res.mergedData.chatHistory;
      }
    } catch (e) {
      console.error(`Failed to sync to ${provider}`, e);
      hasError = true;
    }
  }

  return {
    success: !hasError,
    method: hasError ? 'error' : 'cloud',
    mergedData: finalMergedData
  };
};

export const isUsingLocalStorage = () => getActiveSyncProviders().length === 0;
