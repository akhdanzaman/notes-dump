import { Octokit } from "@octokit/rest";
import { DbSchema, BrainDumpItem, BudgetConfig, Skill, Wallet } from "../types";

// --- Configuration & Constants ---

const SETTINGS_KEY = 'braindump_github_config';
const LOCAL_STORAGE_KEY = 'braindump_db';

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
  branch?: string; // Added branch support
}

export type SyncResult = { 
  success: boolean; 
  method: 'cloud' | 'local' | 'skipped_not_hydrated' | 'skipped_no_changes' | 'error' 
};

// --- Module State (Singleton) ---

// Tracks if the application has successfully loaded data at least once.
// Critical for preventing overwrites of cloud data with empty default state on startup.
let isHydrated = false;

// Stores the SHA of the file on GitHub to handle concurrency/updates.
let currentCloudSha: string | undefined = undefined;

// Stores the stringified version of the last successfully saved/loaded data.
// Used for "dirty" checking to prevent unnecessary API calls.
let lastSnapshot: string | null = null;

// Promise chain to serialize all sync operations (Mutex-like).
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

// --- Configuration Management ---

export const getGithubConfig = (): GithubConfig | null => {
  // 1. Try LocalStorage
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

  // 2. Try Environment Variables
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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
    // Reset hydration state if config changes to force re-fetch
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

/**
 * Validates integrity of DB Schema.
 * Ensures we don't crash the app with malformed data.
 */
const validateSchema = (data: any): DbSchema => {
    if (!data || typeof data !== 'object') return { data: [] };
    
    return {
        data: Array.isArray(data.data) ? data.data : [],
        budgetConfig: data.budgetConfig,
        customPrompt: data.customPrompt,
        skills: Array.isArray(data.skills) ? data.skills : [],
        wallets: Array.isArray(data.wallets) ? data.wallets : []
    };
};

/**
 * Fetches the database.
 * Lifecycle: This MUST be called and succeed before any syncData operations are allowed to persist to Cloud.
 */
export const fetchDb = async (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string }> => {
  const config = getGithubConfig();

  // Mode: Local Only
  if (!config) {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    const data = local ? validateSchema(JSON.parse(local)) : { data: [] };
    
    // Mark as hydrated
    isHydrated = true;
    lastSnapshot = JSON.stringify(data);
    
    return { data, sha: 'local-sha' };
  }

  // Mode: Cloud
  const octokit = new Octokit({ auth: config.token });

  try {
    const response = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: config.path,
      ref: config.branch, // Support custom branch
    });

    // @ts-ignore
    const content = response.data.content;
    // @ts-ignore
    const sha = response.data.sha;

    if (!content) throw new Error("No content found");

    const jsonString = fromBase64(content);
    const rawData = JSON.parse(jsonString);
    const data = validateSchema(rawData);
    
    // Backup to local storage (Cache)
    if (!skipLocalStorage) {
        localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
    }

    // UPDATE STATE
    isHydrated = true;
    currentCloudSha = sha;
    lastSnapshot = jsonString; // Store exact string for dirty check

    return { data, sha };

  } catch (error: any) {
    console.warn("GitHub fetch failed:", error.status, error.message);

    // Fallback: LocalStorage (Cache)
    if (!skipLocalStorage) {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) {
            const data = validateSchema(JSON.parse(local));
            
            // We are hydrated from cache, but SHA is unknown or stale
            isHydrated = true; 
            lastSnapshot = local;
            // currentCloudSha remains undefined or stale, performSync will handle 409 if needed
            
            return { data, sha: error.status === 404 ? '' : 'local-sha' };
        }
    }

    // 404 Not Found means new repo/file -> Initialize Empty
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

/**
 * Internal worker for synchronization.
 * Contains the logic for dirty checks, hydration guards, and atomic writes.
 */
const performSync = async (items: BrainDumpItem[], budgetConfig?: BudgetConfig, customPrompt?: string, skills?: Skill[], wallets?: Wallet[]): Promise<SyncResult> => {
  // 1. HYDRATION GUARD
  // Critical: Never save if we haven't successfully loaded yet. 
  // This prevents the "empty state overwrite" bug on startup.
  if (!isHydrated) {
      console.warn("Blocked Sync: Database is not hydrated. This prevents overwriting cloud data with initial empty state.");
      return { success: false, method: 'skipped_not_hydrated' };
  }

  const updatedDb: DbSchema = { 
    data: items,
    budgetConfig: budgetConfig,
    customPrompt: customPrompt,
    skills: skills,
    wallets: wallets
  };
  
  const jsonString = JSON.stringify(updatedDb, null, 2);

  // 2. DIRTY CHECK
  // If data hasn't changed since last load/save, skip network request.
  if (lastSnapshot === jsonString) {
      // Data matches exactly what we have in memory as "synced"
      return { success: true, method: 'skipped_no_changes' };
  }

  // 3. OPTIMISTIC LOCAL SAVE
  // Always save to LocalStorage immediately as a backup/cache
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
  } catch (e) {
    console.error("Local storage error", e);
  }

  const config = getGithubConfig();

  // Local Mode -> Done
  if (!config) {
      lastSnapshot = jsonString;
      return { success: true, method: 'local' };
  }

  // Cloud Mode -> GitHub Push
  const octokit = new Octokit({ auth: config.token });

  const executeWrite = async (sha?: string) => {
      const contentEncoded = toBase64(jsonString);
      const response = await octokit.repos.createOrUpdateFileContents({
        owner: config.owner,
        repo: config.repo,
        path: config.path,
        branch: config.branch, // Support custom branch
        message: `Update via BrainDump`,
        content: contentEncoded,
        sha: sha && sha !== 'local-sha' ? sha : undefined,
      });
      return response.data.content?.sha;
  };

  try {
      try {
          // Attempt write with known SHA
          const newSha = await executeWrite(currentCloudSha);
          
          // Success: Update state
          currentCloudSha = newSha;
          lastSnapshot = jsonString;
          
          return { success: true, method: 'cloud' };

      } catch (writeError: any) {
          // 4. CONFLICT RESOLUTION (409)
          if (writeError.status === 409) {
              console.warn("Sync conflict (409). Fetching latest SHA and retrying...");
              
              // Re-fetch only the SHA (and content ideally, but we overwrite here based on "last write wins" for this user app model)
              // To be safer, we should merge, but for now we just get the valid SHA to force push.
              const { sha } = await fetchDb(true); // skip local storage update to avoid UI flickering
              
              // Retry write with fresh SHA
              const newSha = await executeWrite(sha);
              
              currentCloudSha = newSha;
              lastSnapshot = jsonString;

              return { success: true, method: 'cloud' };

          } else if (writeError.status === 404) {
             console.error("Sync failed: 404. Check Repo/Token permissions.");
             throw new Error("Repository not found (404)");
          } else {
              throw writeError;
          }
      }

  } catch (error) {
    console.error("Failed to sync to GitHub:", error);
    // Even if cloud fails, we saved to local. Return error status so UI can show "Cloud Offline".
    return { success: false, method: 'error' }; 
  }
};

/**
 * Public Sync Function
 * Serializes requests into a queue to prevent race conditions.
 */
export const syncData = (items: BrainDumpItem[], budgetConfig?: BudgetConfig, customPrompt?: string, skills?: Skill[], wallets?: Wallet[]): Promise<SyncResult> => {
  // Chain to the queue to ensure sequential execution
  const task = () => performSync(items, budgetConfig, customPrompt, skills, wallets);

  const queuedTask = syncQueue.then(
      () => task(), // run after previous finishes
      () => task()  // run even if previous failed
  );

  syncQueue = queuedTask;
  return queuedTask;
};
