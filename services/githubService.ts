import { Octokit } from "@octokit/rest";
import { DbSchema, BrainDumpItem, BudgetConfig } from "../types";

// Safe access to env vars with fallback
const getEnv = (key: string) => {
  try {
    // @ts-ignore
    return process.env[key];
  } catch (e) {
    return undefined;
  }
};

const SETTINGS_KEY = 'braindump_github_config';

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
}

// Get config from LocalStorage first, then fall back to Env Vars
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
          path: getEnv('GITHUB_FILE_PATH') || 'db.json' 
      };
  }
  
  return null;
};

export const saveGithubConfig = (config: GithubConfig) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
};

export const clearGithubConfig = () => {
    localStorage.removeItem(SETTINGS_KEY);
};

// Helper to handle Base64 encoding/decoding for Unicode/UTF-8
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

const LOCAL_STORAGE_KEY = 'braindump_db';

export const isUsingLocalStorage = () => !getGithubConfig();

export const fetchDb = async (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string }> => {
  const config = getGithubConfig();

  // 1. If GitHub is not configured, use LocalStorage immediately
  if (!config) {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) return { data: JSON.parse(local), sha: 'local-sha' };
    return { data: { data: [] }, sha: 'local-sha' };
  }

  const octokit = new Octokit({ auth: config.token });

  try {
    const response = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: config.path,
    });

    // @ts-ignore
    const content = response.data.content;
    // @ts-ignore
    const sha = response.data.sha;

    if (!content) throw new Error("No content found");

    const jsonString = fromBase64(content);
    const data: DbSchema = JSON.parse(jsonString);
    
    // Backup to local storage only if not skipped
    if (!skipLocalStorage) {
        localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
    }

    return { data, sha };
  } catch (error: any) {
    console.warn("GitHub fetch failed:", error.status, error.message);

    // Robust Fallback: Try LocalStorage first on ANY error (404, 500, Offline)
    // This handles cases where Repo is missing (404) but User has local data they don't want to lose.
    if (!skipLocalStorage) {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) {
            // If error is 404 (Repo/File missing), we return empty SHA so next sync tries to create it.
            // Otherwise (Network/Auth error), we return 'local-sha' to indicate sync is pending/impossible but data is available.
            const sha = error.status === 404 ? '' : 'local-sha';
            return { data: JSON.parse(local), sha };
        }
    }

    // If no local data exists and error is 404, we can safely initialize empty
    if (error.status === 404) {
      console.log("Database file not found on GitHub, initialized empty DB.");
      return { data: { data: [] }, sha: '' };
    }

    // If no local data and other error, rethrow
    throw error;
  }
};

export type SyncResult = { success: boolean; method: 'cloud' | 'local' | 'error' };

// Queue to serialize sync operations
let syncQueue: Promise<any> = Promise.resolve();

const performSync = async (items: BrainDumpItem[], budgetConfig?: BudgetConfig, customPrompt?: string): Promise<SyncResult> => {
  const config = getGithubConfig();
  
  // Construct the full DB object
  const updatedDb: DbSchema = { 
    data: items,
    budgetConfig: budgetConfig,
    customPrompt: customPrompt
  };
  
  const jsonString = JSON.stringify(updatedDb, null, 2);

  // Always save to LocalStorage first (Optimistic)
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
  } catch (e) {
    console.error("Local storage error", e);
  }

  if (!config) {
      return { success: true, method: 'local' };
  }

  const octokit = new Octokit({ auth: config.token });

  // Helper function to attempt write
  const executeWrite = async (sha?: string) => {
      const contentEncoded = toBase64(jsonString);
      await octokit.repos.createOrUpdateFileContents({
        owner: config.owner,
        repo: config.repo,
        path: config.path,
        message: `Update via BrainDump`,
        content: contentEncoded,
        sha: sha && sha !== 'local-sha' ? sha : undefined,
      });
  };

  try {
      let currentSha: string | undefined = undefined;
      
      // Initial SHA fetch
      try {
          // Skip local storage update during SHA fetch to avoid race condition with UI state
          const res = await fetchDb(true); 
          currentSha = res.sha;
      } catch (e) {
          // Proceed; might be creating a new file or repo doesn't exist
      }

      try {
          await executeWrite(currentSha);
      } catch (writeError: any) {
          // Handle Conflict (409) - Retry logic
          if (writeError.status === 409) {
              console.warn("Sync conflict (409) detected. Retrying with fresh SHA...");
              // Fetch latest SHA again
              const res = await fetchDb(true);
              // Retry write
              await executeWrite(res.sha);
          } else if (writeError.status === 404) {
             console.error("Sync failed: Repository not found or missing permissions (404). Check settings.");
             throw new Error("Repository not found (404)");
          } else {
              throw writeError;
          }
      }

      return { success: true, method: 'cloud' };

  } catch (error) {
    console.error("Failed to sync to GitHub:", error);
    return { success: true, method: 'error' }; 
  }
};

// Updated to save the entire DbSchema including BudgetConfig and customPrompt
// Uses a queue to prevent race conditions
export const syncData = (items: BrainDumpItem[], budgetConfig?: BudgetConfig, customPrompt?: string): Promise<SyncResult> => {
  // Wrap performSync in a task
  const task = () => performSync(items, budgetConfig, customPrompt);

  // Chain to the queue
  const queuedTask = syncQueue.then(
      () => task(), // run if previous succeeded
      () => task()  // run even if previous failed
  );

  // Update the queue pointer
  syncQueue = queuedTask;

  return queuedTask;
};

// Kept for compatibility if needed, but App.tsx should use syncData
export const syncItemsToDb = async (items: BrainDumpItem[]): Promise<SyncResult> => {
    // Fetch existing config to avoid overwriting it with undefined
    const { data } = await fetchDb();
    return syncData(items, data.budgetConfig, data.customPrompt);
};