import { DbSchema, BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, ChatMessage } from "../types";
import { SyncResult } from "./githubService";
import { mergeDbData } from "../utils/mergeUtils";
import { generateExportData, SheetData } from "../utils/exportUtils";
import { reconcileSpreadsheetData } from "./spreadsheetReconciler";
import { getValidGoogleAccessToken } from "./googleProfileService";

const SETTINGS_KEY = 'braindump_spreadsheet_config';
const LOCAL_STORAGE_KEY = 'braindump_db';
const SYSTEM_SHEET_NAME = 'App_State_Do_Not_Edit';
const HISTORY_SHEET_NAME = 'App_State_History';
const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const MAX_WRITE_BATCH_SIZE = 8;
const MAX_FETCH_RETRIES = 3;
const MAX_HISTORY_COLUMNS = 'ZZZ';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const safeLocalStorageGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`Error reading localStorage key: ${key}`, e);
    return null;
  }
};

const safeLocalStorageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Failed to save localStorage key: ${key}`, e);
  }
};

const safeLocalStorageRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`Failed to remove localStorage key: ${key}`, e);
  }
};

const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (e) {
    console.warn('Failed to parse JSON payload', e);
    return fallback;
  }
};

const getRetryDelayMs = (attempt: number, retryAfterHeader: string | null) => {
  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  return 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
};

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

let isHydrated = false;
let lastSnapshot: string | null = null;
let operationQueue: Promise<any> = Promise.resolve();

export const getSpreadsheetConfig = (): SpreadsheetConfig | null => {
  const parsed = safeJsonParse<SpreadsheetConfig | null>(safeLocalStorageGet(SETTINGS_KEY), null);
  return parsed?.spreadsheetId ? parsed : null;
};

export const saveSpreadsheetConfig = (config: SpreadsheetConfig) => {
  const existingStr = safeLocalStorageGet(SETTINGS_KEY);
  const next = JSON.stringify({ ...config });
  if (existingStr === next) return;

  safeLocalStorageSet(SETTINGS_KEY, next);
  isHydrated = false;
  lastSnapshot = null;
};

export const clearSpreadsheetConfig = () => {
  safeLocalStorageRemove(SETTINGS_KEY);
  isHydrated = false;
  lastSnapshot = null;
};

const validateSchema = (data: any): DbSchema => {
  if (!data || typeof data !== 'object') return { data: [] };
  
  const rawChatHistory = Array.isArray(data.chatHistory) ? data.chatHistory : [];
  const chatHistory = rawChatHistory.slice(-50);

  return {
      data: Array.isArray(data.data) ? data.data : [],
      budgetConfig: data.budgetConfig ? {
          ...data.budgetConfig,
          rules: Array.isArray(data.budgetConfig.rules) ? data.budgetConfig.rules : []
      } : undefined,
      appSettings: data.appSettings,
      customPrompt: data.customPrompt,
      skills: Array.isArray(data.skills) ? data.skills : [],
      wallets: Array.isArray(data.wallets) ? data.wallets : [],
      monthlyThemes: data.monthlyThemes || {},
      chatHistory: chatHistory,
      canonicalRules: Array.isArray(data.canonicalRules) ? data.canonicalRules : []
  };
};

const shouldRetrySpreadsheetRequest = (status: number) => status === 401 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;

const sheetsFetch = async (
  spreadsheetId: string,
  path: string,
  init: RequestInit = {},
  attempt = 0,
  tokenOverride?: string
): Promise<Response> => {
  const token = tokenOverride || await getValidGoogleAccessToken();
  if (!token) throw new Error('No valid Google access token available');

  const response = await fetch(`${GOOGLE_SHEETS_API_BASE}/${spreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {})
    }
  });

  if (attempt >= MAX_FETCH_RETRIES || !shouldRetrySpreadsheetRequest(response.status)) {
    return response;
  }

  const delayMs = getRetryDelayMs(attempt, response.headers.get('retry-after'));
  await wait(delayMs);
  return sheetsFetch(spreadsheetId, path, init, attempt + 1, response.status === 401 ? undefined : token);
};

const readLocalDbFallback = () => {
  const local = safeLocalStorageGet(LOCAL_STORAGE_KEY);
  if (!local) return null;
  const data = validateSchema(safeJsonParse(local, { data: [] }));
  isHydrated = true;
  lastSnapshot = local;
  return { data, sha: 'local-sha', reconciled: false };
};

const performFetchSpreadsheetDb = async (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string; reconciled: boolean }> => {
  const config = getSpreadsheetConfig();
  if (!config) throw new Error("No spreadsheet config");

  try {
    return await fetchSpreadsheetDbWithToken(config, skipLocalStorage);
  } catch (error: any) {
    console.warn("Spreadsheet fetch failed:", error);
    if (!skipLocalStorage) {
      const fallback = readLocalDbFallback();
      if (fallback) return fallback;
    }
    throw error;
  }
};

export const fetchSpreadsheetDb = (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string; reconciled: boolean }> => {
  const task = () => performFetchSpreadsheetDb(skipLocalStorage);
  const queuedTask = operationQueue.then(() => task(), () => task());
  operationQueue = queuedTask;
  return queuedTask;
};

const fetchSpreadsheetDbWithToken = async (config: SpreadsheetConfig, skipLocalStorage: boolean) => {
    const metaRes = await sheetsFetch(config.spreadsheetId, '');
    if (!metaRes.ok) {
        const errText = await metaRes.text();
        throw new Error(`Failed to fetch metadata: ${metaRes.status} ${metaRes.statusText} - ${errText}`);
    }
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

    let isNewSpreadsheet = !existingTitles.has(SYSTEM_SHEET_NAME);

    const sheetsToSync = ['Transactions', 'Todos', 'Shopping', 'Events', 'Notes & Journals', 'Skill Logs', 'Wallets Config', 'Skills Config', 'Budget Rules', 'Themes & Settings'];
    for (const s of sheetsToSync) {
        if (existingTitles.has(s)) {
            if (s === 'Transactions') rangesToFetch.push(`'${s}'!A:I`);
            else if (s === 'Todos') rangesToFetch.push(`'${s}'!A:M`);
            else if (s === 'Shopping') rangesToFetch.push(`'${s}'!A:I`);
            else if (s === 'Events') rangesToFetch.push(`'${s}'!A:H`);
            else if (s === 'Notes & Journals') rangesToFetch.push(`'${s}'!A:E`);
            else if (s === 'Skill Logs') rangesToFetch.push(`'${s}'!A:F`);
            else if (s === 'Wallets Config') rangesToFetch.push(`'${s}'!A:E`);
            else if (s === 'Skills Config') rangesToFetch.push(`'${s}'!A:E`);
            else if (s === 'Budget Rules') rangesToFetch.push(`'${s}'!A:C`);
            else if (s === 'Themes & Settings') rangesToFetch.push(`'${s}'!A:C`);
        }
    }

    let batchData: any = { valueRanges: [] };
    
    if (rangesToFetch.length > 0) {
        const path = `/values:batchGet?ranges=${rangesToFetch.map(encodeURIComponent).join('&ranges=')}`;
        const res = await sheetsFetch(config.spreadsheetId, path);
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Failed to fetch batchGet: ${res.status} ${res.statusText} - ${errText}`);
        }
        batchData = await res.json();
    }

    // Find system sheet data
    const systemSheet = batchData.valueRanges?.find((r: any) => r.range && r.range.includes(systemSheetName));
    
    let dbData;
    if (isNewSpreadsheet) {
        console.log("New spreadsheet detected, returning local data to avoid wiping.");
        const local = safeLocalStorageGet(LOCAL_STORAGE_KEY);
        dbData = local ? validateSchema(safeJsonParse(local, { data: [] })) : { data: [] };
    } else {
        dbData = processFetchResponse(systemSheet, skipLocalStorage).data;
    }
    
    let reconciled = false;

    // Reconcile with user-facing sheets
    if (batchData.valueRanges) {
        console.log("Reconciling with valueRanges:", batchData.valueRanges.map((r: any) => r.range));
        const reconciledDb = reconcileSpreadsheetData(dbData, batchData.valueRanges);
        console.log("Reconciled DB:", reconciledDb);
        if (JSON.stringify(reconciledDb.data) !== JSON.stringify(dbData.data) || 
            JSON.stringify(reconciledDb.budgetConfig) !== JSON.stringify(dbData.budgetConfig)) {
            dbData = reconciledDb;
            reconciled = true;
        }
    }

    // Update local storage with reconciled data
    const jsonString = JSON.stringify(dbData);
    if (!skipLocalStorage) {
      try {
        safeLocalStorageSet(LOCAL_STORAGE_KEY, jsonString);
      } catch (e) {
        console.warn("Failed to save to local storage (quota exceeded?)", e);
      }
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
  
  let rawData = safeJsonParse<any>(jsonString, { data: [] });
  if (!rawData || typeof rawData !== 'object') {
    console.warn("Failed to parse spreadsheet data, initializing empty DB");
    rawData = { data: [] };
    jsonString = '{"data":[]}';
  }

  const dbData = validateSchema(rawData);
  
  if (!skipLocalStorage) {
    try {
      safeLocalStorageSet(LOCAL_STORAGE_KEY, jsonString);
    } catch (e) {
      console.warn("Failed to save to local storage (quota exceeded?)", e);
    }
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
  const previousDb = validateSchema(
    safeJsonParse<DbSchema | undefined>(lastSnapshot, undefined)
      || safeJsonParse<DbSchema | undefined>(safeLocalStorageGet(LOCAL_STORAGE_KEY), undefined)
      || { data: [] }
  );

  const updatedDb: DbSchema = { 
    data: items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory,
    canonicalRules: previousDb.canonicalRules || []
  };
  
  const jsonString = JSON.stringify(updatedDb);

  safeLocalStorageSet(LOCAL_STORAGE_KEY, jsonString);

  if (!isHydrated) {
    try {
      await performFetchSpreadsheetDb(false);
    } catch (e: any) {
      console.warn("Failed to hydrate spreadsheet before sync", e);
      return { success: false, method: 'skipped_not_hydrated', error: 'Spreadsheet not hydrated and fetch failed: ' + e.message };
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
        const { data: remoteDb } = await performFetchSpreadsheetDb(false);
        
        const baseDb = lastSnapshot ? safeJsonParse<DbSchema | undefined>(lastSnapshot, undefined) : undefined;
        
        finalDb = mergeDbData(updatedDb, remoteDb, baseDb);
        finalItems = finalDb.data;
        reconciled = true;
    }

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

    const systemSheetData: SheetData = {
        name: SYSTEM_SHEET_NAME,
        data: jsonChunks
    };

    const allSheets: SheetData[] = [
      ...exportSheets,
      systemSheetData
    ];

    // 2. Get existing sheets to determine what needs to be created
    const metaRes = await sheetsFetch(config.spreadsheetId, '');
    if (!metaRes.ok) throw new Error(`Failed to fetch spreadsheet metadata: ${await metaRes.text()}`);
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
    
    // Also create history sheet if missing
    if (!existingSheetTitles.has(HISTORY_SHEET_NAME)) {
        requests.push({
          addSheet: {
            properties: { title: HISTORY_SHEET_NAME }
          }
        });
    }

    if (requests.length > 0) {
      const batchRes = await sheetsFetch(config.spreadsheetId, ':batchUpdate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });
      if (!batchRes.ok) throw new Error(`Failed to create sheets: ${await batchRes.text()}`);
    }

    // 4. Clear existing data in target sheets to avoid leftover rows
    console.log("Clearing sheets...");
    const rangesToClear = allSheets.map(s => `'${s.name}'`);
    const clearRes = await sheetsFetch(config.spreadsheetId, '/values:batchClear', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ranges: rangesToClear })
    });
    if (!clearRes.ok) throw new Error(`Failed to clear sheets: ${await clearRes.text()}`);

    // 5. Write new data - Split into chunks to avoid payload limits
    console.log("Writing new data...");
    
    // Split: System sheet vs User sheets
    const systemData = [{
        range: `'${systemSheetData.name}'!A1`,
        values: systemSheetData.data
    }];

    const userSheetsData = exportSheets.map(sheet => ({
        range: `'${sheet.name}'!A1`,
        values: sheet.data
    }));

    // Update System Sheet first (critical data)
    const updateSystemRes = await sheetsFetch(config.spreadsheetId, '/values:batchUpdate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: systemData
      })
    });

    if (!updateSystemRes.ok) {
        const errorText = await updateSystemRes.text();
        throw new Error(`Google Sheets API error (System Sheet): ${updateSystemRes.status} ${updateSystemRes.statusText} - ${errorText}`);
    }

    // Update User Sheets
    if (userSheetsData.length > 0) {
        for (let i = 0; i < userSheetsData.length; i += MAX_WRITE_BATCH_SIZE) {
            const batch = userSheetsData.slice(i, i + MAX_WRITE_BATCH_SIZE);
            const updateUserRes = await sheetsFetch(config.spreadsheetId, '/values:batchUpdate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    valueInputOption: 'RAW',
                    data: batch
                })
            });

            if (!updateUserRes.ok) {
                const errorText = await updateUserRes.text();
                console.error(`Google Sheets API error (User Sheets): ${updateUserRes.status} ${updateUserRes.statusText} - ${errorText}`);
                throw new Error(`Failed to write user-facing sheets: ${updateUserRes.status} ${updateUserRes.statusText}`);
            }
        }
    }

    // 6. Append to History Sheet on every change
    const now = Date.now();
    
    try {
        const historyRow = [new Date().toISOString(), ...jsonChunks.map(c => c[0])];
        const appendRes = await sheetsFetch(config.spreadsheetId, `/values/'${HISTORY_SHEET_NAME}'!A:${MAX_HISTORY_COLUMNS}:append?valueInputOption=RAW`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                values: [historyRow]
            })
        });
        
        if (appendRes.ok) {
            safeLocalStorageSet('braindump_last_backup_time', now.toString());
            console.log("Appended new version to history sheet.");
        } else {
            console.warn("Failed to append to history sheet:", await appendRes.text());
        }
    } catch (e) {
        console.warn("Error appending to history sheet:", e);
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
      try {
          console.error("Error response:", await error.response.text());
      } catch(e) {}
    }
    return { success: false, method: 'error', error: error.message || 'Unknown error during spreadsheet sync' }; 
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
  const queuedTask = operationQueue.then(() => task(), () => task());
  operationQueue = queuedTask;
  return queuedTask;
};

export interface SpreadsheetHistoryEntry {
    timestamp: string;
    data: DbSchema;
}

export const getSpreadsheetHistory = async (): Promise<SpreadsheetHistoryEntry[]> => {
    const config = getSpreadsheetConfig();
    if (!config) throw new Error("No spreadsheet config");

    const res = await sheetsFetch(config.spreadsheetId, `/values/'${HISTORY_SHEET_NAME}'!A:${MAX_HISTORY_COLUMNS}`);

    if (!res.ok) {
        if (res.status === 400) {
            // Sheet might not exist yet
            return [];
        }
        throw new Error(`Failed to fetch history: ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.values || data.values.length === 0) return [];

    const history: SpreadsheetHistoryEntry[] = [];
    for (const row of data.values) {
        if (row.length < 2) continue;
        const timestamp = row[0];
        const jsonString = row.slice(1).join('');
        try {
            const parsed = safeJsonParse<any>(jsonString, null);
            if (!parsed) continue;
            history.push({
                timestamp,
                data: validateSchema(parsed)
            });
        } catch (e) {
            console.warn("Failed to parse history row", timestamp);
        }
    }

    // Return newest first
    return history.reverse();
};
