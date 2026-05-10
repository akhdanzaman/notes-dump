import { DbSchema, BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, ChatMessage, CanonicalRule } from "../types";
import { SyncResult } from "./syncTypes";
import { mergeDbData } from "../utils/mergeUtils";
import { DASHBOARD_HELPER_END_COLUMN_INDEX, DASHBOARD_HELPER_START_COLUMN_INDEX, DASHBOARD_SHEET_NAME, DATA_QUALITY_SHEET_NAME, generateExportData, SheetData } from "../utils/exportUtils";
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
const SPREADSHEET_SYNC_DEBOUNCE_MS = 1200;
const MAX_HISTORY_COLUMNS = 'ZZZ';
const SYSTEM_SNAPSHOT_MARKER = '__BRAINDUMP_STATE_V2__';
const SYSTEM_SNAPSHOT_VERSION = 2;
const MANAGED_USER_SHEET_NAMES = [
  DASHBOARD_SHEET_NAME,
  DATA_QUALITY_SHEET_NAME,
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
  Transactions: 'A:K',
  Todos: 'A:AA',
  Shopping: 'A:I',
  Events: 'A:H',
  'Notes & Journals': 'A:F',
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
  authMode?: 'oauth' | 'service_account';
  serviceAccountEmail?: string;
}

export const SERVICE_ACCOUNT_EMAIL = 'openclaw-adan@gen-lang-client-0558606321.iam.gserviceaccount.com';

export interface ServiceAccountSpreadsheetStatus {
  configured: boolean;
  serviceAccountEmail: string;
  accessible: boolean;
  writable?: boolean;
  needsSharing?: boolean;
  status?: number;
  error?: string;
}

let isHydrated = false;
let lastSnapshot: string | null = null;
let needsInitialSpreadsheetWrite = false;
let operationQueue: Promise<any> = Promise.resolve();
type SpreadsheetSyncArgs = [
  BrainDumpItem[],
  BudgetConfig | undefined,
  string | undefined,
  Skill[] | undefined,
  Wallet[] | undefined,
  Record<string, string> | undefined,
  AppSettings | undefined,
  ChatMessage[] | undefined,
  CanonicalRule[] | undefined,
  boolean | undefined,
];
type PendingDebouncedSync = {
  args: SpreadsheetSyncArgs;
  resolvers: Array<{
    resolve: (value: SyncResult) => void;
    reject: (reason?: unknown) => void;
  }>;
};
let pendingDebouncedSync: PendingDebouncedSync | null = null;
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const hexToRgb = (hex: string) => {
  const normalized = hex.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;

  const value = parseInt(expanded, 16);
  return {
    red: ((value >> 16) & 255) / 255,
    green: ((value >> 8) & 255) / 255,
    blue: (value & 255) / 255,
  };
};

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

const isValidSystemSnapshotSheet = (sheet: any) => {
  try {
    const snapshot = extractSystemSheetSnapshot(sheet);
    const parsed = JSON.parse(snapshot.jsonString);
    return !!parsed && typeof parsed === 'object';
  } catch {
    return false;
  }
};

const shouldApplyManagedSheetFormatting = (
  sheetName: string,
  createdSheetTitles: Set<string>,
  isInitialSpreadsheetWrite: boolean
) => isInitialSpreadsheetWrite || createdSheetTitles.has(sheetName);

const shouldRenderDashboardCharts = (
  shouldFormatDashboard: boolean,
  existingChartIds: number[]
) => shouldFormatDashboard || existingChartIds.length === 0;

const buildSourceRange = (
  sheetId: number,
  startRowIndex: number,
  endRowIndex: number,
  startColumnIndex: number,
  endColumnIndex: number
) => ({
  sources: [{ sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex }]
});

const buildDashboardFormattingRequests = (sheetId: number) => {
  const visibleEndColumn = 7;

  return [
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          index: 0,
          gridProperties: { frozenRowCount: 3 }
        },
        fields: 'index,gridProperties.frozenRowCount'
      }
    },
    {
      unmergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 52, startColumnIndex: 0, endColumnIndex: visibleEndColumn }
      }
    },
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: visibleEndColumn },
        mergeType: 'MERGE_ALL'
      }
    },
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: visibleEndColumn },
        mergeType: 'MERGE_ALL'
      }
    },
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: visibleEndColumn },
        mergeType: 'MERGE_ALL'
      }
    },
    ...[
      [4, 5, 0, 3],
      [4, 5, 3, 6],
      [11, 12, 0, 3],
      [11, 12, 3, 6],
      [18, 19, 0, 3],
      [18, 19, 3, 6],
    ].map(([startRowIndex, endRowIndex, startColumnIndex, endColumnIndex]) => ({
      mergeCells: {
        range: { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex },
        mergeType: 'MERGE_ALL'
      }
    })),
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: visibleEndColumn },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgb('#111827'),
            textFormat: { foregroundColor: hexToRgb('#F9FAFB'), fontSize: 18, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: visibleEndColumn },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgb('#EEF2FF'),
            textFormat: { foregroundColor: hexToRgb('#312E81'), fontSize: 10, italic: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    ...[
      { row: 4, color: '#DBEAFE', text: '#1D4ED8' },
      { row: 11, color: '#EDE9FE', text: '#6D28D9' },
      { row: 18, color: '#DCFCE7', text: '#166534' },
    ].map(({ row, color, text }) => ({
      repeatCell: {
        range: { sheetId, startRowIndex: row, endRowIndex: row + 1, startColumnIndex: 0, endColumnIndex: visibleEndColumn },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgb(color),
            textFormat: { foregroundColor: hexToRgb(text), fontSize: 11, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    })),
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 5, endRowIndex: 52, startColumnIndex: 0, endColumnIndex: visibleEndColumn },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgb('#FFFFFF'),
            textFormat: { foregroundColor: hexToRgb('#111827'), fontSize: 10 },
            wrapStrategy: 'WRAP',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 25, endRowIndex: 26, startColumnIndex: 0, endColumnIndex: visibleEndColumn },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgb('#111827'),
            textFormat: { foregroundColor: hexToRgb('#F9FAFB'), fontSize: 11, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 26, endRowIndex: 27, startColumnIndex: 0, endColumnIndex: visibleEndColumn },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToRgb('#F8FAFC'),
            textFormat: { foregroundColor: hexToRgb('#334155'), fontSize: 10, italic: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    },
    ...[
      { startRowIndex: 5, endRowIndex: 10, startColumnIndex: 1, endColumnIndex: 2, type: 'CURRENCY', pattern: 'Rp#,##0' },
      { startRowIndex: 9, endRowIndex: 10, startColumnIndex: 1, endColumnIndex: 2, type: 'PERCENT', pattern: '0%' },
      { startRowIndex: 5, endRowIndex: 10, startColumnIndex: 4, endColumnIndex: 5 },
      { startRowIndex: 12, endRowIndex: 17, startColumnIndex: 1, endColumnIndex: 2 },
    ].map(({ type, pattern, ...range }) => ({
      repeatCell: {
        range: { sheetId, ...range },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true, fontSize: 12 },
            horizontalAlignment: 'LEFT',
            ...(type ? { numberFormat: { type, pattern } } : {})
          }
        },
        fields: type
          ? 'userEnteredFormat(textFormat,horizontalAlignment,numberFormat)'
          : 'userEnteredFormat(textFormat,horizontalAlignment)'
      }
    })),
    ...[
      { startIndex: 0, endIndex: 1, pixelSize: 240 },
      { startIndex: 1, endIndex: 2, pixelSize: 170 },
      { startIndex: 2, endIndex: 3, pixelSize: 32 },
      { startIndex: 3, endIndex: 4, pixelSize: 280 },
      { startIndex: 4, endIndex: 5, pixelSize: 170 },
      { startIndex: 5, endIndex: 6, pixelSize: 32 },
      { startIndex: 6, endIndex: 7, pixelSize: 32 },
    ].map(({ startIndex, endIndex, pixelSize }) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex, endIndex },
        properties: { pixelSize },
        fields: 'pixelSize'
      }
    })),
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: DASHBOARD_HELPER_START_COLUMN_INDEX,
          endIndex: DASHBOARD_HELPER_END_COLUMN_INDEX
        },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser'
      }
    }
  ];
};

const buildDataQualityFormattingRequests = (sheetId: number) => [
  {
    unmergeCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 }
    }
  },
  {
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: { frozenRowCount: 4 }
      },
      fields: 'gridProperties.frozenRowCount'
    }
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 },
      cell: {
        userEnteredFormat: {
          backgroundColor: hexToRgb('#111827'),
          textFormat: { foregroundColor: hexToRgb('#F9FAFB'), fontSize: 16, bold: true },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE'
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
    }
  },
  {
    mergeCells: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 5 },
      mergeType: 'MERGE_ALL'
    }
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 5 },
      cell: {
        userEnteredFormat: {
          backgroundColor: hexToRgb('#FEF3C7'),
          textFormat: { foregroundColor: hexToRgb('#92400E'), fontSize: 10, italic: true },
          wrapStrategy: 'WRAP',
          verticalAlignment: 'MIDDLE'
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)'
    }
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 5 },
      cell: {
        userEnteredFormat: {
          backgroundColor: hexToRgb('#DBEAFE'),
          textFormat: { foregroundColor: hexToRgb('#1E3A8A'), fontSize: 10, bold: true },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE'
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
    }
  },
  {
    repeatCell: {
      range: { sheetId, startRowIndex: 4, startColumnIndex: 0, endColumnIndex: 5 },
      cell: {
        userEnteredFormat: {
          wrapStrategy: 'WRAP',
          verticalAlignment: 'TOP'
        }
      },
      fields: 'userEnteredFormat(wrapStrategy,verticalAlignment)'
    }
  },
  ...[
    { startIndex: 0, endIndex: 1, pixelSize: 110 },
    { startIndex: 1, endIndex: 2, pixelSize: 220 },
    { startIndex: 2, endIndex: 3, pixelSize: 160 },
    { startIndex: 3, endIndex: 4, pixelSize: 460 },
    { startIndex: 4, endIndex: 5, pixelSize: 460 },
  ].map(({ startIndex, endIndex, pixelSize }) => ({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex, endIndex },
      properties: { pixelSize },
      fields: 'pixelSize'
    }
  }))
];

const buildDashboardChartRequests = (sheetId: number, existingChartIds: number[] = []) => {
  const deleteRequests = existingChartIds.map(objectId => ({
    deleteEmbeddedObject: { objectId }
  }));

  const helperStart = DASHBOARD_HELPER_START_COLUMN_INDEX;

  return [
    ...deleteRequests,
    {
      addChart: {
        chart: {
          spec: {
            title: 'Cashflow Trend (14 Days)',
            subtitle: 'Expense vs income pace',
            basicChart: {
              chartType: 'COMBO',
              legendPosition: 'BOTTOM_LEGEND',
              headerCount: 0,
              axis: [
                { position: 'BOTTOM_AXIS', title: 'Day' },
                { position: 'LEFT_AXIS', title: 'Amount (IDR)' }
              ],
              domains: [{ domain: { sourceRange: buildSourceRange(sheetId, 0, 1, helperStart, helperStart + 14) } }],
              series: [
                { series: { sourceRange: buildSourceRange(sheetId, 1, 2, helperStart, helperStart + 14) }, type: 'LINE', targetAxis: 'LEFT_AXIS' },
                { series: { sourceRange: buildSourceRange(sheetId, 2, 3, helperStart, helperStart + 14) }, type: 'AREA', targetAxis: 'LEFT_AXIS' }
              ],
              lineSmoothing: true,
              interpolateNulls: true
            }
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 27, columnIndex: 0 },
              offsetXPixels: 8,
              offsetYPixels: 8,
              widthPixels: 540,
              heightPixels: 260
            }
          }
        }
      }
    },
    {
      addChart: {
        chart: {
          spec: {
            title: 'Productivity Pulse (14 Days)',
            subtitle: 'Completed tasks vs capture volume',
            basicChart: {
              chartType: 'COLUMN',
              legendPosition: 'BOTTOM_LEGEND',
              headerCount: 0,
              axis: [
                { position: 'BOTTOM_AXIS', title: 'Day' },
                { position: 'LEFT_AXIS', title: 'Count' }
              ],
              domains: [{ domain: { sourceRange: buildSourceRange(sheetId, 0, 1, helperStart, helperStart + 14) } }],
              series: [
                { series: { sourceRange: buildSourceRange(sheetId, 3, 4, helperStart, helperStart + 14) }, targetAxis: 'LEFT_AXIS' },
                { series: { sourceRange: buildSourceRange(sheetId, 4, 5, helperStart, helperStart + 14) }, targetAxis: 'LEFT_AXIS' }
              ]
            }
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 27, columnIndex: 3 },
              offsetXPixels: 28,
              offsetYPixels: 8,
              widthPixels: 540,
              heightPixels: 260
            }
          }
        }
      }
    },
    {
      addChart: {
        chart: {
          spec: {
            title: 'Top Spend Categories',
            subtitle: 'Current month mix',
            basicChart: {
              chartType: 'BAR',
              legendPosition: 'NO_LEGEND',
              headerCount: 0,
              axis: [
                { position: 'LEFT_AXIS', title: 'Category' },
                { position: 'BOTTOM_AXIS', title: 'Spend (IDR)' }
              ],
              domains: [{ domain: { sourceRange: buildSourceRange(sheetId, 12, 17, 22, 23) } }],
              series: [
                { series: { sourceRange: buildSourceRange(sheetId, 12, 17, 23, 24) }, targetAxis: 'BOTTOM_AXIS' }
              ]
            }
          },
          position: {
            overlayPosition: {
              anchorCell: { sheetId, rowIndex: 41, columnIndex: 0 },
              offsetXPixels: 8,
              offsetYPixels: 8,
              widthPixels: 540,
              heightPixels: 240
            }
          }
        }
      }
    }
  ];
};

export const normalizeSpreadsheetConfig = (config: SpreadsheetConfig | null | undefined): SpreadsheetConfig | null => {
  if (!config?.spreadsheetId) return null;
  const authMode = config.authMode || 'service_account';
  return {
    ...config,
    authMode,
    ...(authMode === 'service_account'
      ? { serviceAccountEmail: config.serviceAccountEmail || SERVICE_ACCOUNT_EMAIL }
      : {})
  };
};

export const isServiceAccountSpreadsheetConfig = (config: SpreadsheetConfig | null | undefined) => (
  normalizeSpreadsheetConfig(config)?.authMode === 'service_account'
);

export const getSpreadsheetConfig = (): SpreadsheetConfig | null => {
  const raw = safeLocalStorageGet(SETTINGS_KEY);
  const parsed = safeJsonParse<SpreadsheetConfig | null>(raw, null);
  const normalized = normalizeSpreadsheetConfig(parsed);
  if (normalized && raw !== JSON.stringify(normalized)) {
    safeLocalStorageSet(SETTINGS_KEY, JSON.stringify(normalized));
  }
  return normalized;
};

export const saveSpreadsheetConfig = (config: SpreadsheetConfig) => {
  const normalized = normalizeSpreadsheetConfig(config);
  if (!normalized) return;
  const existingStr = safeLocalStorageGet(SETTINGS_KEY);
  const next = JSON.stringify(normalized);
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

export const checkServiceAccountSpreadsheetAccess = async (spreadsheetId: string): Promise<ServiceAccountSpreadsheetStatus> => {
  const response = await fetch(`/api/spreadsheets/service-account/status?spreadsheetId=${encodeURIComponent(spreadsheetId)}`);
  const data = await response.json().catch(() => ({}));
  return {
    configured: !!data.configured,
    serviceAccountEmail: data.serviceAccountEmail || SERVICE_ACCOUNT_EMAIL,
    accessible: response.ok && !!data.accessible,
    writable: !!data.writable,
    needsSharing: !!data.needsSharing,
    status: data.status || response.status,
    error: data.error,
  };
};

const serviceAccountSheetsFetch = async (
  spreadsheetId: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> => {
  const headers = new Headers(init.headers || {});
  const contentType = headers.get('content-type') || headers.get('Content-Type');
  return fetch(`/api/spreadsheets/service-account/proxy?spreadsheetId=${encodeURIComponent(spreadsheetId)}&path=${encodeURIComponent(path)}`, {
    method: init.method || 'GET',
    headers: contentType ? { 'Content-Type': contentType } : undefined,
    body: init.body,
  });
};

const sheetsFetch = async (
  spreadsheetId: string,
  path: string,
  init: RequestInit = {},
  attempt = 0,
  tokenOverride?: string
): Promise<Response> => {
  if (getSpreadsheetConfig()?.authMode === 'service_account') {
    const response = await serviceAccountSheetsFetch(spreadsheetId, path, init);
    if (attempt >= MAX_FETCH_RETRIES || !shouldRetrySpreadsheetRequest(response.status)) {
      return response;
    }
    const delayMs = getRetryDelayMs(attempt, response.headers.get('retry-after'));
    await wait(delayMs);
    return sheetsFetch(spreadsheetId, path, init, attempt + 1, tokenOverride);
  }

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
    const hasValidSystemSheet = systemSheet ? isValidSystemSnapshotSheet(systemSheet) : false;

    if (!hasValidSystemSheet && systemSheetName === SYSTEM_SHEET_NAME && systemSheet) {
        processFetchResponse(systemSheet, skipLocalStorage);
    }

    if (isNewSpreadsheet && !hasValidSystemSheet) {
        console.log("New spreadsheet detected, seeding from spreadsheet cache/legacy browser cache if available.");
        dbData = getCachedSpreadsheetDb() || { data: [] };
    } else {
        const fetched = processFetchResponse(systemSheet, skipLocalStorage);
        dbData = fetched.data;
        systemSheetStatus = fetched.systemStatus;
        isNewSpreadsheet = false;
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
    let liveMeta = meta;
    let existingSheetTitles = new Set((liveMeta.sheets || []).map((s: any) => s.properties.title));

    // 3. Create missing sheets
    console.log("Creating missing sheets...");
    const requests = [];
    const createdSheetTitles = new Set<string>();
    for (const sheet of allSheets) {
      if (!existingSheetTitles.has(sheet.name)) {
        createdSheetTitles.add(sheet.name);
        requests.push({
          addSheet: {
            properties: { title: sheet.name }
          }
        });
      }
    }
    
    // Also create history sheet if missing
    if (!existingSheetTitles.has(HISTORY_SHEET_NAME)) {
        createdSheetTitles.add(HISTORY_SHEET_NAME);
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

      const refreshedMetaRes = await sheetsFetch(config.spreadsheetId, '');
      if (!refreshedMetaRes.ok) throw new Error(`Failed to refresh spreadsheet metadata: ${await refreshedMetaRes.text()}`);
      liveMeta = await refreshedMetaRes.json();
      existingSheetTitles = new Set((liveMeta.sheets || []).map((s: any) => s.properties.title));
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

    const groupedUserSheets = exportSheets.reduce<Record<string, { range: string; values: SheetData['data'] }[]>>((acc, sheet) => {
        const inputOption = sheet.inputOption || 'RAW';
        if (!acc[inputOption]) acc[inputOption] = [];
        acc[inputOption].push({
          range: `'${sheet.name}'!A1`,
          values: sheet.data
        });
        return acc;
    }, {});

    // Update User Sheets
    for (const [inputOption, userSheetsData] of Object.entries(groupedUserSheets)) {
      for (let i = 0; i < userSheetsData.length; i += MAX_WRITE_BATCH_SIZE) {
            const batch = userSheetsData.slice(i, i + MAX_WRITE_BATCH_SIZE);
            const updateUserRes = await sheetsFetch(config.spreadsheetId, '/values:batchUpdate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    valueInputOption: inputOption,
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

    const dashboardSheetMeta = liveMeta.sheets?.find((sheet: any) => sheet.properties.title === DASHBOARD_SHEET_NAME);
    const dashboardSheetId = dashboardSheetMeta?.properties?.sheetId;
    if (typeof dashboardSheetId === 'number') {
      const shouldFormatDashboard = shouldApplyManagedSheetFormatting(
        DASHBOARD_SHEET_NAME,
        createdSheetTitles,
        needsInitialSpreadsheetWrite
      );

      if (shouldFormatDashboard) {
        const dashboardRes = await sheetsFetch(config.spreadsheetId, ':batchUpdate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: buildDashboardFormattingRequests(dashboardSheetId)
          })
        });

        if (!dashboardRes.ok) {
          console.warn('Failed to format dashboard sheet:', await dashboardRes.text());
        }
      }

      const existingChartIds = Array.isArray(dashboardSheetMeta?.charts)
        ? dashboardSheetMeta.charts
            .map((chart: any) => chart?.chartId ?? chart?.embeddedObjectId)
            .filter((id: unknown): id is number => typeof id === 'number')
        : [];

      if (shouldRenderDashboardCharts(shouldFormatDashboard, existingChartIds)) {
        const dashboardChartsRes = await sheetsFetch(config.spreadsheetId, ':batchUpdate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: buildDashboardChartRequests(dashboardSheetId, existingChartIds)
          })
        });

        if (!dashboardChartsRes.ok) {
          console.warn('Failed to render dashboard charts:', await dashboardChartsRes.text());
        }
      }
    }

    const dataQualitySheetMeta = liveMeta.sheets?.find((sheet: any) => sheet.properties.title === DATA_QUALITY_SHEET_NAME);
    const dataQualitySheetId = dataQualitySheetMeta?.properties?.sheetId;
    if (
      typeof dataQualitySheetId === 'number'
      && shouldApplyManagedSheetFormatting(DATA_QUALITY_SHEET_NAME, createdSheetTitles, needsInitialSpreadsheetWrite)
    ) {
      const dataQualityFormatRes = await sheetsFetch(config.spreadsheetId, ':batchUpdate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: buildDataQualityFormattingRequests(dataQualitySheetId)
        })
      });

      if (!dataQualityFormatRes.ok) {
        console.warn('Failed to format Data Quality sheet:', await dataQualityFormatRes.text());
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

const enqueueSpreadsheetSync = (args: SpreadsheetSyncArgs): Promise<SyncResult> => {
  const task = () => performSync(...args);
  const queuedTask = operationQueue.then(() => task(), () => task());
  operationQueue = queuedTask;
  return queuedTask;
};

const cancelPendingDebouncedSync = (result: SyncResult) => {
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }

  if (!pendingDebouncedSync) return;
  const pending = pendingDebouncedSync;
  pendingDebouncedSync = null;
  pending.resolvers.forEach(({ resolve }) => resolve(result));
};

const scheduleDebouncedSpreadsheetSync = (args: SpreadsheetSyncArgs): Promise<SyncResult> => {
  return new Promise<SyncResult>((resolve, reject) => {
    if (pendingDebouncedSync) {
      pendingDebouncedSync.args = args;
      pendingDebouncedSync.resolvers.push({ resolve, reject });
    } else {
      pendingDebouncedSync = {
        args,
        resolvers: [{ resolve, reject }],
      };
    }

    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);

    syncDebounceTimer = setTimeout(() => {
      const pending = pendingDebouncedSync;
      pendingDebouncedSync = null;
      syncDebounceTimer = null;

      if (!pending) return;

      enqueueSpreadsheetSync(pending.args)
        .then(result => pending.resolvers.forEach(({ resolve }) => resolve(result)))
        .catch(error => pending.resolvers.forEach(({ reject }) => reject(error)));
    }, SPREADSHEET_SYNC_DEBOUNCE_MS);
  });
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
  const args: SpreadsheetSyncArgs = [items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory, canonicalRules, forceOverwrite];

  if (forceOverwrite) {
    cancelPendingDebouncedSync({ success: true, method: 'skipped_no_changes' });
    return enqueueSpreadsheetSync(args);
  }

  return scheduleDebouncedSpreadsheetSync(args);
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
  shouldApplyManagedSheetFormatting,
  shouldRenderDashboardCharts,
};
