
import { Octokit } from "@octokit/rest";
import { DbSchema, BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings } from "../types";

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
};

// --- Module State (Singleton) ---

let isHydrated = false;
let currentCloudSha: string | undefined = undefined;
let lastSnapshot: string | null = null;
let syncQueue: Promise<SyncResult> = Promise.resolve({ success: true, method: 'local' });

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

// Helper for merging data (Exported for use in hook if needed, but primarily used here)
export const mergeDbData = (local: DbSchema, remote: DbSchema): DbSchema => {
    // Items: Map by ID. Local wins conflicts (LWW) to preserve current edits. Remote adds missing.
    const itemMap = new Map<string, BrainDumpItem>();
    remote.data.forEach(i => itemMap.set(i.id, i));
    local.data.forEach(i => itemMap.set(i.id, i));

    // Skills
    const skillMap = new Map<string, Skill>();
    remote.skills?.forEach(s => skillMap.set(s.id, s));
    local.skills?.forEach(s => skillMap.set(s.id, s));

    // Wallets
    const walletMap = new Map<string, Wallet>();
    remote.wallets?.forEach(w => walletMap.set(w.id, w));
    local.wallets?.forEach(w => walletMap.set(w.id, w));

    // Themes
    const themes = { ...remote.monthlyThemes, ...local.monthlyThemes };

    return {
        data: Array.from(itemMap.values()),
        budgetConfig: local.budgetConfig || remote.budgetConfig, // Local priority for config
        appSettings: local.appSettings || remote.appSettings,
        customPrompt: local.customPrompt || remote.customPrompt,
        skills: Array.from(skillMap.values()),
        wallets: Array.from(walletMap.values()),
        monthlyThemes: themes,
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

    localStorage.setItem(SETTINGS_KEY, next);
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
    
    return {
        data: Array.isArray(data.data) ? data.data : [],
        budgetConfig: data.budgetConfig,
        appSettings: data.appSettings,
        customPrompt: data.customPrompt,
        skills: Array.isArray(data.skills) ? data.skills : [],
        wallets: Array.isArray(data.wallets) ? data.wallets : [],
        monthlyThemes: data.monthlyThemes || {}
    };
};

export const fetchDb = async (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string }> => {
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
        localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
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

const performSync = async (
    items: BrainDumpItem[], 
    budgetConfig?: BudgetConfig, 
    customPrompt?: string, 
    skills?: Skill[], 
    wallets?: Wallet[],
    monthlyThemes?: Record<string, string>,
    appSettings?: AppSettings
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
    appSettings: appSettings
  };
  
  const jsonString = JSON.stringify(updatedDb, null, 2);

  if (lastSnapshot === jsonString) {
      return { success: true, method: 'skipped_no_changes' };
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
  } catch (e) {
    console.error("Local storage error", e);
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
          const newSha = await executeWrite(currentCloudSha);
          
          currentCloudSha = newSha;
          lastSnapshot = jsonString;
          
          return { success: true, method: 'cloud' };

      } catch (writeError: any) {
          if (writeError.status === 409) {
              console.warn("Sync conflict (409). Fetching latest, merging, and retrying...");
              
              // 1. Fetch remote data (skip local write to process merge in memory first)
              const { data: remoteData, sha: remoteSha } = await fetchDb(true); 
              
              // 2. Merge local (pending save) with remote
              const mergedData = mergeDbData(updatedDb, remoteData);
              const mergedJson = JSON.stringify(mergedData, null, 2);
              
              // 3. Update Local Storage immediately to persist merge
              localStorage.setItem(LOCAL_STORAGE_KEY, mergedJson);
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
    appSettings?: AppSettings
): Promise<SyncResult> => {
  const task = () => performSync(items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings);

  const queuedTask = syncQueue.then(
      () => task(),
      () => task() 
  );

  syncQueue = queuedTask;
  return queuedTask;
};
