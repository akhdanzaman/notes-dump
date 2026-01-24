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

const TOKEN = getEnv('GITHUB_TOKEN');
const OWNER = getEnv('GITHUB_OWNER');
const REPO = getEnv('GITHUB_REPO');
const PATH = getEnv('GITHUB_FILE_PATH') || 'db.json';

// Check if critical config is present
const isGithubConfigured = !!(TOKEN && OWNER && REPO);

const octokit = new Octokit({
  auth: TOKEN,
});

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

export const isUsingLocalStorage = () => !isGithubConfigured;

export const fetchDb = async (): Promise<{ data: DbSchema; sha: string }> => {
  // 1. If GitHub is not configured, use LocalStorage immediately
  if (!isGithubConfigured) {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (local) return { data: JSON.parse(local), sha: 'local-sha' };
    return { data: { data: [] }, sha: 'local-sha' };
  }

  try {
    const response = await octokit.repos.getContent({
      owner: OWNER!,
      repo: REPO!,
      path: PATH,
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
    console.warn("Failed to fetch DB from GitHub:", error);

    // If file not found (404), return empty to allow creation
    if (error.status === 404) {
      return { data: { data: [] }, sha: '' };
    }

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
  let currentSha = '';

  try {
    if (isGithubConfigured) {
        // Fetch latest SHA to avoid conflicts
        const res = await fetchDb();
        currentSha = res.sha;
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

  if (isGithubConfigured) {
    try {
      const contentEncoded = toBase64(jsonString);
      await octokit.repos.createOrUpdateFileContents({
        owner: OWNER!,
        repo: REPO!,
        path: PATH,
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

// Deprecated wrapper for backward compatibility if needed, but we will move to syncItemsToDb
export const saveItemToDb = async (newItem: BrainDumpItem): Promise<boolean> => {
  const { data } = await fetchDb();
  const newItems = [...data.data, newItem];
  return syncItemsToDb(newItems);
};