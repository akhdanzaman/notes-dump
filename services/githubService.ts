
import { Octokit } from "@octokit/rest";
import { DbSchema, BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, ChatMessage } from "../types";
import { mergeDbData } from "../utils/mergeUtils";
export { mergeDbData } from "../utils/mergeUtils";

// --- Configuration & Constants ---

const SETTINGS_KEY = 'braindump_github_config';
const LOCAL_STORAGE_KEY = 'braindump_db';

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
  branch?: string; 
}

export type SyncResult = { 
  success: boolean; 
  method: 'cloud' | 'local' | 'skipped_not_hydrated' | 'skipped_no_changes' | 'error';
  mergedData?: DbSchema;
  error?: string;
};

// --- Module State (Singleton) ---

let isHydrated = false;
let currentCloudSha: string | undefined = undefined;
let lastSnapshot: string | null = null;
let operationQueue: Promise<any> = Promise.resolve();

// --- Helpers ---

const getEnv = (key: string) => {
  try {
    // @ts-ignore
    return process.env[key];
  } catch (e) {
    return undefined;
  }
};

const toBase64 = (str: string) => {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    })
  );
};

const fromBase64 = (str: string) => {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), (c: string) => {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
};

// Helper for merging data (3-way merge to handle deletions correctly)
export const mergeDbDataInternal = (local: DbSchema, remote: DbSchema, base?: DbSchema): DbSchema => {
    const baseItemIds = new Set(base?.data.map(i => i.id) || []);
    const localItemIds = new Set(local.data.map(i => i.id));
    const remoteItemIds = new Set(remote.data.map(i => i.id));

    const itemMap = new Map<string, BrainDumpItem>();

    // 1. Items from Remote
    remote.data.forEach(remoteItem => {
        if (localItemIds.has(remoteItem.id)) {
            // In both: Local wins (LWW) to preserve current session edits
            const localItem = local.data.find(i => i.id === remoteItem.id)!;
            itemMap.set(remoteItem.id, localItem);
        } else {
            // In remote but not in local
            if (baseItemIds.has(remoteItem.id)) {
                // Was in base, now gone in local -> DELETED locally.
                // Do not add back.
            } else {
                // Not in base -> NEW in remote.
                itemMap.set(remoteItem.id, remoteItem);
            }
        }
    });

    // 2. Items from Local
    local.data.forEach(localItem => {
        if (!remoteItemIds.has(localItem.id)) {
            // In local but not in remote
            if (baseItemIds.has(localItem.id)) {
                // Was in base, now gone in remote -> DELETED remotely.
                // Do not add back.
            } else {
                // Not in base -> NEW in local.
                itemMap.set(localItem.id, localItem);
            }
        }
    });

    // Skills
    const baseSkillIds = new Set(base?.skills?.map(s => s.id) || []);
    const localSkillIds = new Set(local.skills?.map(s => s.id) || []);
    const remoteSkillIds = new Set(remote.skills?.map(s => s.id) || []);
    const skillMap = new Map<string, Skill>();

    remote.skills?.forEach(s => {
        if (localSkillIds.has(s.id)) {
            skillMap.set(s.id, local.skills?.find(ls => ls.id === s.id) || s);
        } else if (!baseSkillIds.has(s.id)) {
            skillMap.set(s.id, s);
        }
    });
    local.skills?.forEach(s => {
        if (!remoteSkillIds.has(s.id) && !baseSkillIds.has(s.id)) {
            skillMap.set(s.id, s);
        }
    });

    // Wallets
    const baseWalletIds = new Set(base?.wallets?.map(w => w.id) || []);
    const localWalletIds = new Set(local.wallets?.map(w => w.id) || []);
    const remoteWalletIds = new Set(remote.wallets?.map(w => w.id) || []);
    const walletMap = new Map<string, Wallet>();

    remote.wallets?.forEach(w => {
        if (localWalletIds.has(w.id)) {
            walletMap.set(w.id, local.wallets?.find(lw => lw.id === w.id) || w);
        } else if (!baseWalletIds.has(w.id)) {
            walletMap.set(w.id, w);
        }
    });
    local.wallets?.forEach(w => {
        if (!remoteWalletIds.has(w.id) && !baseWalletIds.has(w.id)) {
            walletMap.set(w.id, w);
        }
    });

    // Themes
    const themes = { ...remote.monthlyThemes, ...local.monthlyThemes };

    // Chat History (Append only, simple merge)
    // We can just take the longer one or try to merge unique messages. 
    // For simplicity, let's prefer local if it has more messages, otherwise remote.
    // A better approach for chat is usually append-only.
    const localChat = local.chatHistory || [];
    const remoteChat = remote.chatHistory || [];
    const chatHistory = localChat.length >= remoteChat.length ? localChat : remoteChat;

    return {
        data: Array.from(itemMap.values()),
        budgetConfig: local.budgetConfig || remote.budgetConfig,
        appSettings: local.appSettings || remote.appSettings,
        customPrompt: local.customPrompt || remote.customPrompt,
        skills: Array.from(skillMap.values()),
        wallets: Array.from(walletMap.values()),
        monthlyThemes: themes,
        chatHistory: chatHistory.slice(-50)
    };
};

// --- Configuration Management ---

export const getGithubConfig = (): GithubConfig | null => {
  try {
      const local = localStorage.getItem(SETTINGS_KEY);
      if (local) {
          const parsed = JSON.parse(local);
          if (parsed.token && parsed.owner && parsed.repo) {
              return parsed;
          }
      }
  } catch(e) {
      console.warn("Error reading settings from local storage", e);
  }

  const t = getEnv('GITHUB_TOKEN');
  const o = getEnv('GITHUB_OWNER');
  const r = getEnv('GITHUB_REPO');
  
  if (t && o && r) {
      return { 
          token: t, 
          owner: o, 
          repo: r, 
          path: getEnv('GITHUB_FILE_PATH') || 'db.json',
          branch: getEnv('GITHUB_BRANCH')
      };
  }
  
  return null;
};

export const saveGithubConfig = (config: GithubConfig) => {
    const existing = localStorage.getItem(SETTINGS_KEY);
    const next = JSON.stringify(config);
    
    // Prevent resetting hydration if connection details haven't changed.
    // This allows updating other settings (Budget, Prompt) without breaking the DB connection.
    if (existing === next) return;

    try {
        localStorage.setItem(SETTINGS_KEY, next);
    } catch (e) {
        console.warn("Failed to save settings to local storage", e);
    }
    isHydrated = false; 
    currentCloudSha = undefined;
    lastSnapshot = null;
};

export const clearGithubConfig = () => {
    localStorage.removeItem(SETTINGS_KEY);
    isHydrated = false;
    currentCloudSha = undefined;
    lastSnapshot = null;
};

export const isUsingLocalStorage = () => !getGithubConfig();

// --- Core Logic ---

const validateSchema = (data: any): DbSchema => {
    if (!data || typeof data !== 'object') return { data: [] };
    
    const rawChatHistory = Array.isArray(data.chatHistory) ? data.chatHistory : [];
    // Truncate to last 50 messages to prevent bloated database issues
    const chatHistory = rawChatHistory.slice(-50);

    return {
        data: Array.isArray(data.data) ? data.data : [],
        budgetConfig: data.budgetConfig,
        appSettings: data.appSettings,
        customPrompt: data.customPrompt,
        skills: Array.isArray(data.skills) ? data.skills : [],
        wallets: Array.isArray(data.wallets) ? data.wallets : [],
        monthlyThemes: data.monthlyThemes || {},
        chatHistory: chatHistory
    };
};

const performFetchDb = async (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string }> => {
  const config = getGithubConfig();

  if (!config) {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    const data = local ? validateSchema(JSON.parse(local)) : { data: [] };
    
    isHydrated = true;
    lastSnapshot = JSON.stringify(data);
    
    return { data, sha: 'local-sha' };
  }

  const octokit = new Octokit({ auth: config.token });

  try {
    const response = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: config.path,
      ref: config.branch, 
    });

    // @ts-ignore
    const content = response.data.content;
    // @ts-ignore
    const sha = response.data.sha;

    if (!content) throw new Error("No content found");

    const jsonString = fromBase64(content);
    const rawData = JSON.parse(jsonString);
    const data = validateSchema(rawData);
    
    if (!skipLocalStorage) {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
        } catch (e) {
            console.warn("Failed to save to local storage (quota exceeded?)", e);
        }
    }

    isHydrated = true;
    currentCloudSha = sha;
    lastSnapshot = jsonString; 

    return { data, sha };

  } catch (error: any) {
    console.warn("GitHub fetch failed:", error.status, error.message);

    if (!skipLocalStorage) {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) {
            const data = validateSchema(JSON.parse(local));
            
            isHydrated = true; 
            lastSnapshot = local;
            
            return { data, sha: error.status === 404 ? '' : 'local-sha' };
        }
    }

    if (error.status === 404) {
      console.log("Database file not found on GitHub, initialized empty DB.");
      const emptyDb: DbSchema = { data: [] };
      
      isHydrated = true;
      currentCloudSha = undefined;
      lastSnapshot = JSON.stringify(emptyDb);

      return { data: emptyDb, sha: '' };
    }

    throw error;
  }
};

export const fetchDb = (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string }> => {
  const task = () => performFetchDb(skipLocalStorage);
  const queuedTask = operationQueue.then(() => task(), () => task());
  operationQueue = queuedTask;
  return queuedTask;
};

const performSync = async (
    items: BrainDumpItem[], 
    budgetConfig?: BudgetConfig, 
    customPrompt?: string, 
    skills?: Skill[], 
    wallets?: Wallet[],
    monthlyThemes?: Record<string, string>,
    appSettings?: AppSettings,
    chatHistory?: ChatMessage[],
    forceOverwrite = false
): Promise<SyncResult> => {
  if (!isHydrated) {
      console.warn("Blocked Sync: Database is not hydrated. This prevents overwriting cloud data with initial empty state.");
      return { success: false, method: 'skipped_not_hydrated' };
  }

  // Ensure we persist ALL fields
  const updatedDb: DbSchema = { 
    data: items,
    budgetConfig: budgetConfig,
    customPrompt: customPrompt,
    skills: skills,
    wallets: wallets,
    monthlyThemes: monthlyThemes,
    appSettings: appSettings,
    chatHistory: chatHistory
  };
  
  const jsonString = JSON.stringify(updatedDb, null, 2);

  if (lastSnapshot === jsonString && !forceOverwrite) {
      return { success: true, method: 'skipped_no_changes' };
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
  } catch (e) {
    console.warn("Local storage error (quota exceeded?)", e);
  }

  const config = getGithubConfig();

  if (!config) {
      lastSnapshot = jsonString;
      return { success: true, method: 'local' };
  }

  const octokit = new Octokit({ auth: config.token });

  const executeWrite = async (sha?: string, contentStr?: string) => {
      const contentEncoded = toBase64(contentStr || jsonString);
      const response = await octokit.repos.createOrUpdateFileContents({
        owner: config.owner,
        repo: config.repo,
        path: config.path,
        branch: config.branch, 
        message: `Update via BrainDump`,
        content: contentEncoded,
        sha: sha && sha !== 'local-sha' ? sha : undefined,
      });
      return response.data.content?.sha;
  };

  try {
      try {
          // If forcing overwrite, try to get latest SHA first to minimize 409s
          let targetSha = currentCloudSha;
          if (forceOverwrite) {
              try {
                  const { sha } = await performFetchDb(true);
                  targetSha = sha;
              } catch (e) {
                  // Ignore, maybe file doesn't exist
              }
          }

          const newSha = await executeWrite(targetSha);
          
          currentCloudSha = newSha;
          lastSnapshot = jsonString;
          
          return { success: true, method: 'cloud' };

      } catch (writeError: any) {
          if (writeError.status === 409) {
              console.warn("Sync conflict (409). Fetching latest...");
              
              // 1. Fetch remote data (skip local write to process merge in memory first)
              const { data: remoteData, sha: remoteSha } = await performFetchDb(true); 
              
              if (forceOverwrite) {
                  // Retry write with new SHA, but SAME content (no merge)
                  const newSha = await executeWrite(remoteSha, jsonString);
                  currentCloudSha = newSha;
                  lastSnapshot = jsonString;
                  return { success: true, method: 'cloud' };
              }

              console.warn("Merging and retrying...");

              // 2. Merge local (pending save) with remote using lastSnapshot as base
              let baseData: DbSchema | undefined;
              if (lastSnapshot) {
                  try { baseData = JSON.parse(lastSnapshot); } catch(e) {}
              }
              const mergedData = mergeDbData(updatedDb, remoteData, baseData);
              const mergedJson = JSON.stringify(mergedData, null, 2);
              
              // 3. Update Local Storage immediately to persist merge
              try {
                localStorage.setItem(LOCAL_STORAGE_KEY, mergedJson);
              } catch (e) {
                console.warn("Failed to save to local storage (quota exceeded?)", e);
              }
              lastSnapshot = mergedJson;

              // 4. Write merged data
              const newSha = await executeWrite(remoteSha, mergedJson);
              
              currentCloudSha = newSha;
              
              // 5. Return merged data so App can update state
              return { success: true, method: 'cloud', mergedData };

          } else if (writeError.status === 404) {
             console.error("Sync failed: 404. Check Repo/Token permissions.");
             throw new Error("Repository not found (404)");
          } else {
              throw writeError;
          }
      }

  } catch (error) {
    console.error("Failed to sync to GitHub:", error);
    return { success: false, method: 'error' }; 
  }
};

export const syncData = (
    items: BrainDumpItem[], 
    budgetConfig?: BudgetConfig, 
    customPrompt?: string, 
    skills?: Skill[], 
    wallets?: Wallet[],
    monthlyThemes?: Record<string, string>,
    appSettings?: AppSettings,
    chatHistory?: ChatMessage[],
    forceOverwrite = false
): Promise<SyncResult> => {
  const task = () => performSync(items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory, forceOverwrite);

  const queuedTask = operationQueue.then(
      () => task(),
      () => task() 
  );

  operationQueue = queuedTask;
  return queuedTask;
};
