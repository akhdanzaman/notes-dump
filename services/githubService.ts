import { Octokit } from "@octokit/rest";
import { DbSchema, BrainDumpItem } from "../types";

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

export const fetchDb = async (): Promise<{ data: DbSchema; sha: string }> => {
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
    
    // Backup to local storage
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);

    return { data, sha };
  } catch (error: any) {
    // If file not found (404), return empty to allow creation
    // We check this FIRST before logging warnings to avoid scaring the user on fresh installs
    if (error.status === 404) {
      console.log("Database file not found on GitHub, initialized empty DB.");
      return { data: { data: [] }, sha: '' };
    }

    console.warn("Failed to fetch DB from GitHub:", error);

    // For other errors (auth, network), fallback to LocalStorage if available
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) {
      return { data: JSON.parse(local), sha: 'local-sha' };
    }
    
    throw error;
  }
};

// Generic function to save the entire list (used for add, update, delete)
export const syncItemsToDb = async (items: BrainDumpItem[]): Promise<boolean> => {
  const config = getGithubConfig();
  let currentSha = '';

  try {
    if (config) {
        // Fetch latest SHA to avoid conflicts
        try {
            const res = await fetchDb();
            currentSha = res.sha;
        } catch (e) {
            // If fetch fails (e.g. 404 handled inside fetchDb returns sha=''), ignore specific errors here
            // logging handled in fetchDb
        }
    }
  } catch (e) {
    console.warn("Could not fetch current DB SHA, proceeding with caution.");
  }

  const updatedDb: DbSchema = { data: items };
  const jsonString = JSON.stringify(updatedDb, null, 2);

  // Always save to LocalStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
  } catch (e) {
    console.error("Local storage error", e);
  }

  if (config) {
    const octokit = new Octokit({ auth: config.token });
    try {
      const contentEncoded = toBase64(jsonString);
      await octokit.repos.createOrUpdateFileContents({
        owner: config.owner,
        repo: config.repo,
        path: config.path,
        message: `Update via BrainDump`,
        content: contentEncoded,
        sha: currentSha && currentSha !== 'local-sha' ? currentSha : undefined,
      });
      return true;
    } catch (error) {
      console.error("Failed to sync to GitHub:", error);
      return true; // Return true as local save worked
    }
  }

  return true;
};

// Deprecated wrapper for backward compatibility
export const saveItemToDb = async (newItem: BrainDumpItem): Promise<boolean> => {
  const { data } = await fetchDb();
  const newItems = [...data.data, newItem];
  return syncItemsToDb(newItems);
};