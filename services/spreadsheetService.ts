import { DbSchema, BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, ChatMessage, CanonicalRule } from "../types";
import { SyncResult } from "./syncTypes";
import { mergeDbData } from "../utils/mergeUtils";
import { generateExportData, SheetData } from "../utils/exportUtils";
import { reconcileSpreadsheetData } from "./spreadsheetReconciler";
import { getValidGoogleAccessToken } from "./googleProfileService";

const SETTINGS_KEY = 'braindump_spreadsheet_config';
const SPREADSHEET_CACHE_KEY = 'braindump_spreadsheet_cache';
const LEGACY_LOCAL_STORAGE_KEY = 'braindump_db';
const SYSTEM_SHEET_NAME = 'App_State_Do_Not_Edit';
const HISTORY_SHEET_NAME = 'App_State_History';
const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const MAX_WRITE_BATCH_SIZE = 8;
const MAX_FETCH_RETRIES = 3;
const MAX_HISTORY_COLUMNS = 'ZZZ';
const SYSTEM_SNAPSHOT_MARKER = '__BRAINDUMP_STATE_V2__';
const SYSTEM_SNAPSHOT_VERSION = 2;
const MANAGED_USER_SHEET_NAMES = [
  'Transactions',
  'Todos',
  'Shopping',
  'Events',
  'Notes & Journals',
  'All Items (Raw)',
  'Wallets Config',
  'Skills Config',
  'Budget Rules',
  'Themes & Settings',
] as const;

type SystemSheetSyncStatus = 'ready' | 'writing';

type SystemSheetSnapshotMeta = {
  marker: string;
  version: number;
  status: SystemSheetSyncStatus;
  chunkCount: number;
  updatedAt: string;
};

export const SPREADSHEET_FETCH_RANGES = {
  Transactions: 'A:I',
  Todos: 'A:M',
  Shopping: 'A:I',
  Events: 'A:H',
  'Notes & Journals': 'A:E',
  'Skill Logs': 'A:F',
  'Wallets Config': 'A:E',
  'Skills Config': 'A:E',
  'Budget Rules': 'A:C',
  'Themes & Settings': 'A:C',
} as const;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const safeLocalStorageGet = (key: string): string | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`Error reading localStorage key: ${key}`, e);
    return null;
  }
};

const safeLocalStorageSet = (key: string, value: string) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Failed to save localStorage key: ${key}`, e);
  }
};

const safeLocalStorageRemove = (key: string) => {
  try {
    if (typeof localStorage === 'undefined') return;
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
let needsInitialSpreadsheetWrite = false;
let operationQueue: Promise<any> = Promise.resolve();

const buildSystemSheetRows = (jsonString: string, status: SystemSheetSyncStatus): string[][] => {
  const CHUNK_SIZE = 45000; // Safe limit below 50,000
  const chunks: string[] = [];

  for (let i = 0; i < jsonString.length; i += CHUNK_SIZE) {
    chunks.push(jsonString.substring(i, i + CHUNK_SIZE));
  }

  const meta: SystemSheetSnapshotMeta = {
    marker: SYSTEM_SNAPSHOT_MARKER,
    version: SYSTEM_SNAPSHOT_VERSION,
    status,
    chunkCount: chunks.length,
    updatedAt: new Date().toISOString(),
  };

  return [[JSON.stringify(meta)], ...chunks.map(chunk => [chunk])];
};

const parseSystemSheetSnapshotMeta = (value: unknown): SystemSheetSnapshotMeta | null => {
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return null;

  try {
    const parsed = JSON.parse(value) as Partial<SystemSheetSnapshotMeta>;
    if (
      parsed?.marker !== SYSTEM_SNAPSHOT_MARKER
      || parsed.version !== SYSTEM_SNAPSHOT_VERSION
      || (parsed.status !== 'ready' && parsed.status !== 'writing')
      || !Number.isInteger(parsed.chunkCount)
      || parsed.chunkCount! < 0
    ) {
      return null;
    }
    return parsed as SystemSheetSnapshotMeta;
  } catch {
    return null;
  }
};

const extractSystemSheetSnapshot = (sheet: any): { jsonString: string; status: SystemSheetSyncStatus; format: 'legacy' | 'v2' } => {
  const values = Array.isArray(sheet?.values) ? sheet.values : null;
  if (!values || values.length === 0) {
    throw new Error('System sheet snapshot is empty');
  }

  const meta = parseSystemSheetSnapshotMeta(values[0]?.[0]);
  if (meta) {
    const jsonString = values
      .slice(1, 1 + meta.chunkCount)
      .map((row: any[]) => row?.[0] || '')
      .join('');

    return { jsonString, status: meta.status, format: 'v2' };
  }

  return {
    jsonString: values.map((row: any[]) => row?.[0] || '').join(''),
    status: 'ready',
    format: 'legacy'
  };
};

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
  needsInitialSpreadsheetWrite = false;
};

export const clearSpreadsheetConfig = () => {
  safeLocalStorageRemove(SETTINGS_KEY);
  isHydrated = false;
  lastSnapshot = null;
  needsInitialSpreadsheetWrite = false;
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

const readDbFromStorageKey = (key: string): { data: DbSchema; jsonString: string } | null => {
  const jsonString = safeLocalStorageGet(key);
  if (!jsonString) return null;
  return { data: validateSchema(safeJsonParse(jsonString, { data: [] })), jsonString };
};

export const getCachedSpreadsheetDb = (): DbSchema | null => {
  return readDbFromStorageKey(SPREADSHEET_CACHE_KEY)?.data
    || readDbFromStorageKey(LEGACY_LOCAL_STORAGE_KEY)?.data
    || null;
};

const writeSpreadsheetCache = (jsonString: string) => {
  safeLocalStorageSet(SPREADSHEET_CACHE_KEY, jsonString);
};

export const cacheSpreadsheetDbForMigration = (db: DbSchema) => {
  writeSpreadsheetCache(JSON.stringify(validateSchema(db)));
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

const readSpreadsheetCacheFallback = () => {
  const cached = readDbFromStorageKey(SPREADSHEET_CACHE_KEY)
    || readDbFromStorageKey(LEGACY_LOCAL_STORAGE_KEY);
  if (!cached) return null;
  const { data, jsonString } = cached;
  isHydrated = true;
  lastSnapshot = jsonString;
  return { data, sha: 'spreadsheet-cache-sha', reconciled: false };
};

const performFetchSpreadsheetDb = async (skipLocalStorage = false): Promise<{ data: DbSchema; sha: string; reconciled: boolean }> => {
  const config = getSpreadsheetConfig();
  if (!config) throw new Error("No spreadsheet config");

  try {
    return await fetchSpreadsheetDbWithToken(config, skipLocalStorage);
  } catch (error: any) {
    console.warn("Spreadsheet fetch failed:", error);
    if (!skipLocalStorage) {
      const fallback = readSpreadsheetCacheFallback();
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
    needsInitialSpreadsheetWrite = isNewSpreadsheet;

    const sheetsToSync = Object.entries(SPREADSHEET_FETCH_RANGES);
    for (const [s, range] of sheetsToSync) {
        if (existingTitles.has(s)) {
            rangesToFetch.push(`'${s}'!${range}`);
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
    let systemSheetStatus: SystemSheetSyncStatus = 'ready';
    if (isNewSpreadsheet) {
        console.log("New spreadsheet detected, seeding from spreadsheet cache/legacy browser cache if available.");
        dbData = getCachedSpreadsheetDb() || { data: [] };
    } else {
        const fetched = processFetchResponse(systemSheet, skipLocalStorage);
        dbData = fetched.data;
        systemSheetStatus = fetched.systemStatus;
    }
    
    let reconciled = false;

    // Reconcile with user-facing sheets
    if (batchData.valueRanges && systemSheetStatus !== 'writing') {
        console.log("Reconciling with valueRanges:", batchData.valueRanges.map((r: any) => r.range));
        const reconciledDb = reconcileSpreadsheetData(dbData, batchData.valueRanges);
        console.log("Reconciled DB:", reconciledDb);
        if (JSON.stringify(reconciledDb.data) !== JSON.stringify(dbData.data) || 
            JSON.stringify(reconciledDb.budgetConfig) !== JSON.stringify(dbData.budgetConfig)) {
            dbData = reconciledDb;
            reconciled = true;
        }
    } else if (systemSheetStatus === 'writing') {
        console.log('Detected in-progress spreadsheet sync; skipping user-sheet reconciliation and trusting system snapshot.');
    }

    // Update local storage with reconciled data
    const jsonString = JSON.stringify(dbData);
    if (!skipLocalStorage) {
      try {
        writeSpreadsheetCache(jsonString);
      } catch (e) {
        console.warn("Failed to save to local storage (quota exceeded?)", e);
      }
      isHydrated = true;
      lastSnapshot = jsonString;
    }
    
    return { data: dbData, sha: 'spreadsheet-sha', reconciled };
};

const processFetchResponse = (data: any, skipLocalStorage: boolean) => {
  const snapshot = extractSystemSheetSnapshot(data);
  const jsonString = snapshot.jsonString;

  let rawData: any;
  try {
    rawData = JSON.parse(jsonString);
  } catch (e) {
    console.warn('Failed to parse spreadsheet system snapshot', e);
    throw new Error('Spreadsheet system snapshot is malformed');
  }

  if (!rawData || typeof rawData !== 'object') {
    throw new Error('Spreadsheet system snapshot is not a valid object');
  }

  const dbData = validateSchema(rawData);
  
  if (!skipLocalStorage) {
    try {
      writeSpreadsheetCache(jsonString);
    } catch (e) {
      console.warn("Failed to save to local storage (quota exceeded?)", e);
    }
    isHydrated = true;
    lastSnapshot = jsonString;
  }
  
  return { data: dbData, sha: 'spreadsheet-sha', systemStatus: snapshot.status }; 
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
  canonicalRules?: CanonicalRule[],
  forceOverwrite = false
): Promise<SyncResult> => {
  const previousDb = validateSchema(
    safeJsonParse<DbSchema | undefined>(lastSnapshot, undefined)
      || safeJsonParse<DbSchema | undefined>(safeLocalStorageGet(SPREADSHEET_CACHE_KEY), undefined)
      || safeJsonParse<DbSchema | undefined>(safeLocalStorageGet(LEGACY_LOCAL_STORAGE_KEY), undefined)
      || { data: [] }
  );

  const updatedDb: DbSchema = { 
    data: items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory,
    canonicalRules: canonicalRules || previousDb.canonicalRules || []
  };
  
  const jsonString = JSON.stringify(updatedDb);

  writeSpreadsheetCache(jsonString);

  if (!isHydrated) {
    try {
      await performFetchSpreadsheetDb(false);
    } catch (e: any) {
      console.warn("Failed to hydrate spreadsheet before sync", e);
      return { success: false, method: 'skipped_not_hydrated', error: 'Spreadsheet not hydrated and fetch failed: ' + e.message };
    }
  }

  if (lastSnapshot === jsonString && !forceOverwrite && !needsInitialSpreadsheetWrite) {
    return { success: true, method: 'skipped_no_changes' };
  }

  const config = getSpreadsheetConfig();
  if (!config) {
    return { success: false, method: 'error', error: 'Spreadsheet is not connected. Connect Google Sheets before saving.' };
  }

  let finalItems = items;
  let finalDb = updatedDb;
  let reconciled = false;

  try {
    if (!forceOverwrite) {
        // 1. Fetch latest data from spreadsheet and merge
        const { data: remoteDb } = await performFetchSpreadsheetDb(false);
        
        const baseDb = previousDb;
        
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

    const systemSheetData: SheetData = {
        name: SYSTEM_SHEET_NAME,
        data: buildSystemSheetRows(finalJsonString, 'ready')
    };

    const systemSheetWritingData: SheetData = {
      name: SYSTEM_SHEET_NAME,
      data: buildSystemSheetRows(finalJsonString, 'writing')
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

    // 4. Write the system snapshot first so refreshes never see an empty source-of-truth.
    console.log("Writing system snapshot...");
    const updateSystemWritingRes = await sheetsFetch(config.spreadsheetId, '/values:batchUpdate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [{
          range: `'${systemSheetWritingData.name}'!A1`,
          values: systemSheetWritingData.data
        }]
      })
    });

    if (!updateSystemWritingRes.ok) {
      const errorText = await updateSystemWritingRes.text();
      throw new Error(`Google Sheets API error (System Sheet / writing): ${updateSystemWritingRes.status} ${updateSystemWritingRes.statusText} - ${errorText}`);
    }

    // 5. Clear existing user-facing data only after the system snapshot is safely published.
    console.log("Clearing user-facing sheets...");
    const userSheetNamesToClear = Array.from(new Set([
      ...MANAGED_USER_SHEET_NAMES.filter(name => existingSheetTitles.has(name)),
      ...exportSheets.map(sheet => sheet.name),
    ]));

    const clearRes = userSheetNamesToClear.length === 0 ? null : await sheetsFetch(config.spreadsheetId, '/values:batchClear', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ranges: userSheetNamesToClear.map(name => `'${name}'`) })
    });
    if (clearRes && !clearRes.ok) throw new Error(`Failed to clear sheets: ${await clearRes.text()}`);

    // 6. Write new data - Split into chunks to avoid payload limits
    console.log("Writing new data...");

    const userSheetsData = exportSheets.map(sheet => ({
        range: `'${sheet.name}'!A1`,
        values: sheet.data
    }));

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

    // 7. Finalize the system snapshot only after user-facing sheets are fully updated.
    const updateSystemReadyRes = await sheetsFetch(config.spreadsheetId, '/values:batchUpdate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [{
          range: `'${systemSheetData.name}'!A1`,
          values: systemSheetData.data
        }]
      })
    });

    if (!updateSystemReadyRes.ok) {
      const errorText = await updateSystemReadyRes.text();
      throw new Error(`Google Sheets API error (System Sheet / ready): ${updateSystemReadyRes.status} ${updateSystemReadyRes.statusText} - ${errorText}`);
    }

    // 8. Append to History Sheet on every change
    const now = Date.now();
    
    try {
        const historyRow = [new Date().toISOString(), ...systemSheetData.data.slice(1).map(row => row[0] || '')];
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

    writeSpreadsheetCache(finalJsonString);
    safeLocalStorageRemove(LEGACY_LOCAL_STORAGE_KEY);
    lastSnapshot = finalJsonString;
    needsInitialSpreadsheetWrite = false;
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
  canonicalRules?: CanonicalRule[],
  forceOverwrite = false
): Promise<SyncResult> => {
  const task = () => performSync(items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory, canonicalRules, forceOverwrite);
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

export const __test__ = {
  buildSystemSheetRows,
  extractSystemSheetSnapshot,
};
