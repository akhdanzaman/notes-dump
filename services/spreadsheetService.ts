import { DbSchema, BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, ChatMessage } from "../types";
import { SyncResult } from "./githubService";
import { mergeDbData } from "../utils/mergeUtils";
import { generateExportData, SheetData } from "../utils/exportUtils";
import { reconcileSpreadsheetData } from "./spreadsheetReconciler";

const SETTINGS_KEY = 'braindump_spreadsheet_config';
const LOCAL_STORAGE_KEY = 'braindump_db';
const SYSTEM_SHEET_NAME = 'App_State_Do_Not_Edit';

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
}

let isHydrated = false;
let lastSnapshot: string | null = null;
let syncQueue: Promise<SyncResult> = Promise.resolve({ success: true, method: 'local' });

export const getSpreadsheetConfig = (): SpreadsheetConfig | null => {
  try {
    const local = localStorage.getItem(SETTINGS_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed.spreadsheetId && parsed.accessToken) {
        return parsed;
      }
    }
  } catch(e) {
    console.warn("Error reading spreadsheet settings", e);
  }
  return null;
};

export const saveSpreadsheetConfig = (config: SpreadsheetConfig) => {
  const existing = localStorage.getItem(SETTINGS_KEY);
  const next = JSON.stringify(config);
  if (existing === next) return;

  localStorage.setItem(SETTINGS_KEY, next);
  isHydrated = false;
  lastSnapshot = null;
};

export const clearSpreadsheetConfig = () => {
  localStorage.removeItem(SETTINGS_KEY);
  isHydrated = false;
  lastSnapshot = null;
};

const refreshAccessToken = async (config: SpreadsheetConfig): Promise<SpreadsheetConfig> => {
  if (!config.refreshToken) throw new Error("No refresh token available");
  
  const res = await fetch('/api/auth/google/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: config.refreshToken })
  });
  
  if (!res.ok) throw new Error("Failed to refresh token");
  
  const data = await res.json();
  const newConfig = {
    ...config,
    accessToken: data.access_token,
    tokenExpiresAt: Date.now() + (data.expires_in * 1000)
  };
  
  saveSpreadsheetConfig(newConfig);
  return newConfig;
};

const getValidToken = async (config: SpreadsheetConfig): Promise<string> => {
  if (config.tokenExpiresAt && Date.now() > config.tokenExpiresAt - 60000) {
    const newConfig = await refreshAccessToken(config);
    return newConfig.accessToken;
  }
  return config.accessToken;
};

const validateSchema = (data: any): DbSchema => {
  if (!data || typeof data !== 'object') return { data: [] };
  return {
      data: Array.isArray(data.data) ? data.data : [],
      budgetConfig: data.budgetConfig,
      appSettings: data.appSettings,
      customPrompt: data.customPrompt,
      skills: Array.isArray(data.skills) ? data.skills : [],
      wallets: Array.isArray(data.wallets) ? data.wallets : [],
      monthlyThemes: data.monthlyThemes || {},
      chatHistory: Array.isArray(data.chatHistory) ? data.chatHistory : []
  };
};

export const fetchSpreadsheetDb = async (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string; reconciled: boolean }> => {
  const config = getSpreadsheetConfig();
  if (!config) throw new Error("No spreadsheet config");

  try {
    const token = await getValidToken(config);
    
    // First, get metadata to see which sheets exist
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!metaRes.ok) {
      if (metaRes.status === 401) {
        // Try refresh once
        const newConfig = await refreshAccessToken(config);
        return fetchSpreadsheetDbWithToken(newConfig, newConfig.accessToken, skipLocalStorage);
      }
      throw new Error(`Google Sheets API error: ${metaRes.statusText}`);
    }
    
    return fetchSpreadsheetDbWithToken(config, token, skipLocalStorage);

  } catch (error: any) {
    console.warn("Spreadsheet fetch failed:", error);
    if (!skipLocalStorage) {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) {
        const data = validateSchema(JSON.parse(local));
        isHydrated = true;
        lastSnapshot = local;
        return { data, sha: 'local-sha', reconciled: false };
      }
    }
    throw error;
  }
};

const fetchSpreadsheetDbWithToken = async (config: SpreadsheetConfig, token: string, skipLocalStorage: boolean) => {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!metaRes.ok) throw new Error("Failed to fetch metadata");
    const meta = await metaRes.json();
    const existingTitles = new Set((meta.sheets || []).map((s: any) => s.properties.title));

    const rangesToFetch = [];
    let systemSheetName = SYSTEM_SHEET_NAME;

    if (existingTitles.has(SYSTEM_SHEET_NAME)) {
        rangesToFetch.push(`'${SYSTEM_SHEET_NAME}'!A:A`);
    } else if (existingTitles.has('Sheet1')) {
        systemSheetName = 'Sheet1';
        rangesToFetch.push(`'Sheet1'!A:A`);
    } else if (meta.sheets && meta.sheets.length > 0) {
        systemSheetName = meta.sheets[0].properties.title;
        rangesToFetch.push(`'${systemSheetName}'!A:A`);
    }

    const sheetsToSync = ['Transactions', 'Todos', 'Shopping', 'Events', 'Notes & Journals', 'Skill Logs', 'Wallets Config', 'Skills Config', 'Budget Rules', 'Themes & Settings'];
    for (const s of sheetsToSync) {
        if (existingTitles.has(s)) {
            if (s === 'Transactions') rangesToFetch.push(`'${s}'!A:I`);
            else if (s === 'Todos') rangesToFetch.push(`'${s}'!A:I`);
            else if (s === 'Shopping') rangesToFetch.push(`'${s}'!A:G`);
            else if (s === 'Events') rangesToFetch.push(`'${s}'!A:E`);
            else if (s === 'Notes & Journals') rangesToFetch.push(`'${s}'!A:E`);
            else if (s === 'Skill Logs') rangesToFetch.push(`'${s}'!A:F`);
            else if (s === 'Wallets Config') rangesToFetch.push(`'${s}'!A:E`);
            else if (s === 'Skills Config') rangesToFetch.push(`'${s}'!A:E`);
            else if (s === 'Budget Rules') rangesToFetch.push(`'${s}'!A:B`);
            else if (s === 'Themes & Settings') rangesToFetch.push(`'${s}'!A:C`);
        }
    }

    let batchData: any = { valueRanges: [] };
    
    if (rangesToFetch.length > 0) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values:batchGet?ranges=${rangesToFetch.map(encodeURIComponent).join('&ranges=')}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        
        if (!res.ok) throw new Error("Failed to fetch batchGet");
        batchData = await res.json();
    }

    // Find system sheet data
    const systemSheet = batchData.valueRanges?.find((r: any) => r.range && r.range.includes(systemSheetName));
    
    let dbData = processFetchResponse(systemSheet, skipLocalStorage).data;
    let reconciled = false;

    // Reconcile with user-facing sheets
    if (batchData.valueRanges) {
        const reconciledDb = reconcileSpreadsheetData(dbData, batchData.valueRanges);
        if (JSON.stringify(reconciledDb.data) !== JSON.stringify(dbData.data)) {
            dbData = reconciledDb;
            reconciled = true;
        }
    }

    // Update local storage with reconciled data
    const jsonString = JSON.stringify(dbData);
    if (!skipLocalStorage) {
      localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
      isHydrated = true;
      lastSnapshot = jsonString;
    }
    
    return { data: dbData, sha: 'spreadsheet-sha', reconciled };
};

const processFetchResponse = (data: any, skipLocalStorage: boolean) => {
  let jsonString = '{"data":[]}';
  if (data && data.values && data.values.length > 0) {
    jsonString = data.values.map((row: any[]) => row[0] || '').join('');
  }
  
  let rawData;
  try {
    rawData = JSON.parse(jsonString);
  } catch (e) {
    console.warn("Failed to parse spreadsheet data, initializing empty DB", e);
    rawData = { data: [] };
    jsonString = '{"data":[]}';
  }

  const dbData = validateSchema(rawData);
  
  if (!skipLocalStorage) {
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
    isHydrated = true;
    lastSnapshot = jsonString;
  }
  
  return { data: dbData, sha: 'spreadsheet-sha' }; 
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
  const updatedDb: DbSchema = { 
    data: items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory
  };
  
  const jsonString = JSON.stringify(updatedDb);

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
  } catch (e) {
    console.error("Local storage error", e);
  }

  if (!isHydrated) {
    try {
      await fetchSpreadsheetDb(false);
    } catch (e) {
      console.warn("Failed to hydrate spreadsheet before sync", e);
      return { success: false, method: 'skipped_not_hydrated' };
    }
  }

  if (lastSnapshot === jsonString && !forceOverwrite) {
    return { success: true, method: 'skipped_no_changes' };
  }

  const config = getSpreadsheetConfig();
  if (!config) {
    lastSnapshot = jsonString;
    return { success: true, method: 'local' };
  }

  let finalItems = items;
  let finalDb = updatedDb;
  let reconciled = false;

  try {
    if (!forceOverwrite) {
        // 1. Fetch latest data from spreadsheet and merge
        const { data: remoteDb } = await fetchSpreadsheetDb(false);
        
        let baseDb: DbSchema | undefined;
        if (lastSnapshot) {
            try {
                baseDb = JSON.parse(lastSnapshot);
            } catch (e) {
                console.warn("Failed to parse lastSnapshot", e);
            }
        }
        
        finalDb = mergeDbData(updatedDb, remoteDb, baseDb);
        finalItems = finalDb.data;
        reconciled = true;
    }

    const token = await getValidToken(config);
    
    const finalJsonString = JSON.stringify(finalDb);

    // 2. Prepare Data
    // Generate the user-facing sheets
    const exportSheets = generateExportData(
      finalItems, 
      finalDb.skills || [], 
      finalDb.wallets || [], 
      finalDb.budgetConfig || { monthlyIncome: 0, rules: [] }, 
      finalDb.monthlyThemes || {}, 
      finalDb.appSettings || { defaultCollapsed: false, hideMoney: false }
    );

    // Add the system sheet for state persistence
    const CHUNK_SIZE = 45000; // Safe limit below 50,000
    const jsonChunks: string[][] = [];
    for (let i = 0; i < finalJsonString.length; i += CHUNK_SIZE) {
      jsonChunks.push([finalJsonString.substring(i, i + CHUNK_SIZE)]);
    }

    const allSheets: SheetData[] = [
      ...exportSheets,
      {
        name: SYSTEM_SHEET_NAME,
        data: jsonChunks
      }
    ];

    // 2. Get existing sheets to determine what needs to be created
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!metaRes.ok) throw new Error("Failed to fetch spreadsheet metadata");
    const meta = await metaRes.json();
    const existingSheetTitles = new Set((meta.sheets || []).map((s: any) => s.properties.title));

    // 3. Create missing sheets
    console.log("Creating missing sheets...");
    const requests = [];
    for (const sheet of allSheets) {
      if (!existingSheetTitles.has(sheet.name)) {
        requests.push({
          addSheet: {
            properties: { title: sheet.name }
          }
        });
      }
    }

    if (requests.length > 0) {
      const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });
      if (!batchRes.ok) throw new Error(`Failed to create sheets: ${await batchRes.text()}`);
    }

    // 4. Clear existing data in target sheets to avoid leftover rows
    console.log("Clearing sheets...");
    const rangesToClear = allSheets.map(s => `'${s.name}'!A:ZZ`);
    const clearRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values:batchClear`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ranges: rangesToClear })
    });
    if (!clearRes.ok) throw new Error(`Failed to clear sheets: ${await clearRes.text()}`);

    // 5. Write new data
    console.log("Writing new data...");
    const data = allSheets.map(sheet => ({
      range: `'${sheet.name}'!A1`,
      values: sheet.data
    }));

    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: data
      })
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      console.error("Google Sheets API Error Body:", errorText);
      throw new Error(`Google Sheets API error: ${updateRes.status} ${updateRes.statusText} - ${errorText}`);
    }

    lastSnapshot = finalJsonString;
    return { 
      success: true, 
      method: 'cloud',
      mergedData: reconciled ? finalDb : undefined
    };

  } catch (error: any) {
    console.error("Failed to sync to Spreadsheet:", error);
    if (error.response) {
      console.error("Error response:", await error.response.text());
    }
    return { success: false, method: 'error' }; 
  }
};

export const syncSpreadsheetData = (
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
  const queuedTask = syncQueue.then(() => task(), () => task());
  syncQueue = queuedTask;
  return queuedTask;
};
