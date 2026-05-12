import { DbSchema, BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, ChatMessage, CanonicalRule, ItemType } from "../types";
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
const SYSTEM_SNAPSHOT_WRITE_BATCH_ROWS = 20;
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
const BACKGROUND_REBUILD_DELAY_MS = 5000;
const ASSUMED_EXISTING_SHEET_TITLES = new Set<string>([
  SYSTEM_SHEET_NAME,
  HISTORY_SHEET_NAME,
  ...MANAGED_USER_SHEET_NAMES,
]);

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
  Shopping: 'A:P',
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
let backgroundRebuildTimer: ReturnType<typeof setTimeout> | null = null;

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

const buildSyntheticSpreadsheetMeta = (titles = ASSUMED_EXISTING_SHEET_TITLES) => ({
  sheets: Array.from(titles).map(title => ({ properties: { title } })),
});

const fetchSpreadsheetMetadata = async (
  config: SpreadsheetConfig,
  allowAssumedExistingSheets = false
): Promise<{ meta: any; existingTitles: Set<string>; reliable: boolean }> => {
  const metaRes = await sheetsFetch(config.spreadsheetId, '');
  if (metaRes.ok) {
    const meta = await metaRes.json();
    return {
      meta,
      existingTitles: new Set<string>((meta.sheets || []).map((s: any) => s.properties.title)),
      reliable: true,
    };
  }

  const errorText = await metaRes.text();
  if (!allowAssumedExistingSheets) {
    throw new Error(`Failed to fetch spreadsheet metadata: ${errorText}`);
  }

  console.warn('Spreadsheet metadata fetch failed; assuming existing managed sheets for save fallback:', errorText);
  return {
    meta: buildSyntheticSpreadsheetMeta(),
    existingTitles: new Set(ASSUMED_EXISTING_SHEET_TITLES),
    reliable: false,
  };
};

const escapeSheetName = (name: string) => `'${name.replace(/'/g, "''")}'`;

const columnLabel = (index: number) => {
  let label = '';
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};

const buildColumnWriteBatches = (
  sheetName: string,
  rows: SheetData['data'],
  maxRows = SYSTEM_SNAPSHOT_WRITE_BATCH_ROWS
) => {
  const batches: { range: string; values: SheetData['data'] }[] = [];
  for (let i = 0; i < rows.length; i += maxRows) {
    const values = rows.slice(i, i + maxRows);
    const startRow = i + 1;
    const endRow = startRow + values.length - 1;
    batches.push({
      range: `${escapeSheetName(sheetName)}!A${startRow}:A${endRow}`,
      values,
    });
  }
  return batches;
};

const getItemExportSheetNames = (item: BrainDumpItem): string[] => {
  const sheets = ['All Items (Raw)'];

  if (item.type === ItemType.FINANCE) {
    sheets.push('Transactions');
  } else if (item.type === ItemType.TODO) {
    sheets.push('Todos');
  } else if (item.type === ItemType.SHOPPING) {
    sheets.push('Shopping');
    if (item.status === 'done' && item.meta.shoppingCategory !== 'saving' && item.meta.shoppingCategory !== 'investment') {
      sheets.push('Transactions');
    }
  } else if (item.type === ItemType.EVENT) {
    sheets.push('Events');
  } else if (item.type === ItemType.NOTE || item.type === ItemType.JOURNAL) {
    sheets.push('Notes & Journals');
  }

  return sheets;
};

type SheetRowIndex = {
  sheet: SheetData;
  idColumnIndex: number;
  rowById: Map<string, number>;
};

const buildSheetRowIndexes = (sheets: SheetData[]) => {
  const indexes = new Map<string, SheetRowIndex>();

  for (const sheet of sheets) {
    const header = sheet.data[0] || [];
    const idColumnIndex = header.indexOf('ID');
    if (idColumnIndex < 0) continue;

    const rowById = new Map<string, number>();
    sheet.data.slice(1).forEach((row, offset) => {
      const id = row[idColumnIndex];
      if (typeof id === 'string' && id.trim()) {
        rowById.set(id, offset + 2);
      }
    });

    indexes.set(sheet.name, { sheet, idColumnIndex, rowById });
  }

  return indexes;
};

type IncrementalUserSheetPlan = {
  canIncremental: boolean;
  reason?: string;
  updates: { range: string; values: SheetData['data'] }[];
  appends: { sheetName: string; values: SheetData['data']; inputOption: 'RAW' | 'USER_ENTERED' }[];
};

const buildIncrementalUserSheetPlan = (
  previousDb: DbSchema,
  nextDb: DbSchema,
  exportSheets: SheetData[],
  existingSheetTitles: Set<string>,
  createdSheetTitles: Set<string>,
  isInitialSpreadsheetWrite: boolean,
): IncrementalUserSheetPlan => {
  if (isInitialSpreadsheetWrite) {
    return { canIncremental: false, reason: 'initial_write', updates: [], appends: [] };
  }

  const previousItems = previousDb.data || [];
  const nextItems = nextDb.data || [];
  const previousById = new Map(previousItems.map(item => [item.id, item]));
  const nextById = new Map(nextItems.map(item => [item.id, item]));
  const deletedIds = previousItems.filter(item => !nextById.has(item.id)).map(item => item.id);
  if (deletedIds.length > 0) {
    return { canIncremental: false, reason: 'deleted_items', updates: [], appends: [] };
  }

  const configChanged = JSON.stringify({
    budgetConfig: previousDb.budgetConfig,
    skills: previousDb.skills,
    wallets: previousDb.wallets,
    monthlyThemes: previousDb.monthlyThemes,
    appSettings: previousDb.appSettings,
  }) !== JSON.stringify({
    budgetConfig: nextDb.budgetConfig,
    skills: nextDb.skills,
    wallets: nextDb.wallets,
    monthlyThemes: nextDb.monthlyThemes,
    appSettings: nextDb.appSettings,
  });

  if (configChanged) {
    return { canIncremental: false, reason: 'config_changed', updates: [], appends: [] };
  }

  const changedIds = nextItems
    .filter(item => JSON.stringify(previousById.get(item.id)) !== JSON.stringify(item))
    .map(item => item.id);

  if (changedIds.length === 0) {
    return { canIncremental: true, reason: 'no_item_changes', updates: [], appends: [] };
  }

  const previousSheets = generateExportData(
    previousItems,
    previousDb.skills || [],
    previousDb.wallets || [],
    previousDb.budgetConfig || { monthlyIncome: 0, rules: [] },
    previousDb.monthlyThemes || {},
    previousDb.appSettings || { defaultCollapsed: false, hideMoney: false }
  );

  const previousIndexes = buildSheetRowIndexes(previousSheets);
  const nextIndexes = buildSheetRowIndexes(exportSheets);
  const updates: IncrementalUserSheetPlan['updates'] = [];
  const appends: IncrementalUserSheetPlan['appends'] = [];

  for (const id of changedIds) {
    const previousItem = previousById.get(id);
    const nextItem = nextById.get(id);
    if (!nextItem) continue;

    const previousSheetNames = previousItem ? getItemExportSheetNames(previousItem) : [];
    const nextSheetNames = getItemExportSheetNames(nextItem);
    const movedBetweenSheets = previousSheetNames.length > 0
      && JSON.stringify([...previousSheetNames].sort()) !== JSON.stringify([...nextSheetNames].sort());

    if (movedBetweenSheets) {
      return { canIncremental: false, reason: 'item_sheet_changed', updates: [], appends: [] };
    }

    for (const sheetName of nextSheetNames) {
      if (!existingSheetTitles.has(sheetName) || createdSheetTitles.has(sheetName)) {
        return { canIncremental: false, reason: 'missing_or_new_sheet', updates: [], appends: [] };
      }

      const nextIndex = nextIndexes.get(sheetName);
      if (!nextIndex) {
        return { canIncremental: false, reason: 'missing_next_row', updates: [], appends: [] };
      }

      const row = nextIndex.sheet.data.find(candidate => candidate[nextIndex.idColumnIndex] === id);
      if (!row) {
        return { canIncremental: false, reason: 'missing_next_row', updates: [], appends: [] };
      }

      const previousRowNumber = previousIndexes.get(sheetName)?.rowById.get(id);
      const inputOption = nextIndex.sheet.inputOption || 'RAW';

      if (previousRowNumber) {
        updates.push({
          range: `${escapeSheetName(sheetName)}!A${previousRowNumber}:${columnLabel(row.length - 1)}${previousRowNumber}`,
          values: [row],
        });
      } else {
        appends.push({
          sheetName,
          values: [row],
          inputOption,
        });
      }
    }
  }

  return { canIncremental: true, updates, appends };
};

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

const isServiceAccountProxyInvocationFailure = async (response: Response): Promise<boolean> => {
  if (response.status < 500) return false;
  try {
    const text = await response.clone().text();
    return text.includes('FUNCTION_INVOCATION_FAILED');
  } catch {
    return false;
  }
};

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

const oauthSheetsFetch = async (
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
  return oauthSheetsFetch(spreadsheetId, path, init, attempt + 1, response.status === 401 ? undefined : token);
};

const tryOauthSheetsFallback = async (
  spreadsheetId: string,
  path: string,
  init: RequestInit = {},
  tokenOverride?: string
): Promise<Response | null> => {
  try {
    const fallback = await oauthSheetsFetch(spreadsheetId, path, init, 0, tokenOverride);
    console.warn('Service-account proxy failed; saved through direct OAuth Sheets fallback.');
    return fallback;
  } catch (error) {
    console.warn('Service-account proxy failed and OAuth fallback was unavailable:', error);
    return null;
  }
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
    // Try OAuth fallback for any non-success service-account response
    // (not just 500+ proxy failures — 403s from missing Editor share also need fallback)
    if (!response.ok) {
      const fallback = await tryOauthSheetsFallback(spreadsheetId, path, init, tokenOverride);
      if (fallback) return fallback;
      return response;
    }

    if (attempt >= MAX_FETCH_RETRIES || !shouldRetrySpreadsheetRequest(response.status)) {
      return response;
    }
    const delayMs = getRetryDelayMs(attempt, response.headers.get('retry-after'));
    await wait(delayMs);
    return sheetsFetch(spreadsheetId, path, init, attempt + 1, tokenOverride);
  }

  return oauthSheetsFetch(spreadsheetId, path, init, attempt, tokenOverride);
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

// ── Fetch/migration path: current raw sheet first, then legacy system/user sheets ──
type SpreadsheetReadSource = 'current_raw' | 'legacy_system_snapshot' | 'legacy_user_sheets' | 'cache' | 'empty';

const batchGetSpreadsheetRanges = async (config: SpreadsheetConfig, ranges: string[]) => {
  if (ranges.length === 0) return [];

  const path = `/values:batchGet?ranges=${ranges.map(encodeURIComponent).join('&ranges=')}`;
  const res = await sheetsFetch(config.spreadsheetId, path);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to fetch spreadsheet data: ${res.status} ${res.statusText} - ${errText}`);
  }

  const batchData = await res.json();
  return batchData.valueRanges || [];
};

const buildCurrentRawDbFromValueRanges = (valueRanges: any[]): DbSchema => {
  const rawSheet = valueRanges.find((r: any) => r.range?.includes(ALL_ITEMS_SHEET));
  const rawRows = rawSheet?.values || [];
  const rawHeaders = rawRows[0] || [];
  const items = rawRows
    .slice(1)
    .map((row: any[], i: number) => parseRawItemRow(row, i + 1, rawHeaders))
    .filter(Boolean) as BrainDumpItem[];
  const configSheets = parseConfigSheets(valueRanges || []);

  return {
    data: items,
    wallets: configSheets.wallets,
    skills: configSheets.skills,
    budgetConfig: configSheets.budgetConfig,
    monthlyThemes: configSheets.monthlyThemes,
    appSettings: configSheets.appSettings,
  };
};

const fetchCurrentRawSpreadsheetDb = async (config: SpreadsheetConfig, existingTitles: Set<string>) => {
  const rangesToFetch: string[] = [];
  if (existingTitles.has(ALL_ITEMS_SHEET)) {
    rangesToFetch.push(`${escapeSheetName(ALL_ITEMS_SHEET)}!A:AZ`);
  }

  for (const name of ['Wallets Config', 'Skills Config', 'Budget Rules', 'Themes & Settings']) {
    if (existingTitles.has(name)) {
      rangesToFetch.push(`${escapeSheetName(name)}!A:E`);
    }
  }

  const valueRanges = await batchGetSpreadsheetRanges(config, rangesToFetch);
  return buildCurrentRawDbFromValueRanges(valueRanges);
};

const fetchLegacySystemSnapshotDb = async (config: SpreadsheetConfig, existingTitles: Set<string>): Promise<DbSchema | null> => {
  if (!existingTitles.has(SYSTEM_SHEET_NAME)) return null;

  const res = await sheetsFetch(config.spreadsheetId, `/values/${escapeSheetName(SYSTEM_SHEET_NAME)}!A:${MAX_HISTORY_COLUMNS}`);
  if (!res.ok) {
    if (res.status === 400 || res.status === 404) return null;
    const errText = await res.text();
    throw new Error(`Failed to fetch legacy system snapshot: ${res.status} ${res.statusText} - ${errText}`);
  }

  const sheet = await res.json();
  if (!isValidSystemSnapshotSheet(sheet)) return null;

  const snapshot = extractSystemSheetSnapshot(sheet);
  if (snapshot.status === 'writing') {
    console.warn('Legacy system snapshot is marked as writing; attempting migration from readable chunks anyway.');
  }

  return validateSchema(safeJsonParse(snapshot.jsonString, { data: [] }));
};

const fetchLegacyUserSheetDb = async (config: SpreadsheetConfig, existingTitles: Set<string>, baseDb: DbSchema = { data: [] }) => {
  const rangesToFetch = Object.entries(SPREADSHEET_FETCH_RANGES)
    .filter(([sheetName]) => existingTitles.has(sheetName))
    .map(([sheetName, range]) => `${escapeSheetName(sheetName)}!${range}`);

  if (rangesToFetch.length === 0) {
    return { data: baseDb, reconciled: false };
  }

  const valueRanges = await batchGetSpreadsheetRanges(config, rangesToFetch);
  const reconciledDb = reconcileSpreadsheetData(validateSchema(baseDb), valueRanges || []);
  const reconciled = JSON.stringify(reconciledDb) !== JSON.stringify(validateSchema(baseDb));
  return { data: reconciledDb, reconciled };
};

const fetchSpreadsheetDbWithToken = async (config: SpreadsheetConfig, skipLocalStorage: boolean) => {
  const { existingTitles } = await fetchSpreadsheetMetadata(config, true);

  let source: SpreadsheetReadSource = 'empty';
  let dbData: DbSchema = { data: [] };
  let reconciled = false;

  const currentRawDb = await fetchCurrentRawSpreadsheetDb(config, existingTitles);
  if (currentRawDb.data.length > 0) {
    source = 'current_raw';
    const userSheetMerge = await fetchLegacyUserSheetDb(config, existingTitles, currentRawDb);
    dbData = userSheetMerge.data;
    reconciled = userSheetMerge.reconciled;
  } else {
    const legacySnapshotDb = await fetchLegacySystemSnapshotDb(config, existingTitles);
    if (legacySnapshotDb?.data?.length) {
      source = 'legacy_system_snapshot';
      const userSheetMerge = await fetchLegacyUserSheetDb(config, existingTitles, legacySnapshotDb);
      dbData = userSheetMerge.data;
      reconciled = true;
    } else {
      const legacyUserSheets = await fetchLegacyUserSheetDb(config, existingTitles, currentRawDb);
      if (legacyUserSheets.data.data.length > 0) {
        source = 'legacy_user_sheets';
        dbData = legacyUserSheets.data;
        reconciled = true;
      }
    }
  }

  // Fallback to cache for empty/new spreadsheet
  if (dbData.data.length === 0) {
    const cached = getCachedSpreadsheetDb();
    if (cached?.data?.length) {
      dbData = cached;
      source = 'cache';
      console.log('Seeded items from spreadsheet cache');
    }
  }

  const normalizedDb = validateSchema(dbData);
  if (source === 'legacy_system_snapshot' || source === 'legacy_user_sheets' || reconciled) {
    needsInitialSpreadsheetWrite = true;
  }

  if (!skipLocalStorage) {
    try {
      writeSpreadsheetCache(JSON.stringify(normalizedDb));
    } catch (e) {
      console.warn('Failed to save to local storage', e);
    }
    isHydrated = true;
  }

  return {
    data: normalizedDb,
    sha: `spreadsheet-${source}-sha`,
    reconciled: source === 'legacy_system_snapshot' || source === 'legacy_user_sheets' || reconciled,
  };
};

// ── Direct sheet fetch: reads "All Items (Raw)" + config sheets ──
const ALL_ITEMS_SHEET = 'All Items (Raw)';

const readHeaderAwareCell = (headers: unknown[], row: any[], name: string, fallbackIndex: number, aliases: string[] = []) => {
  const normalizedHeaders = headers.map(header => String(header || '').trim());
  const candidates = [name, ...aliases];
  const index = candidates
    .map(candidate => normalizedHeaders.indexOf(candidate))
    .find(candidateIndex => candidateIndex >= 0);
  return index !== undefined && index >= 0 ? row[index] : row[fallbackIndex];
};

const parseRawItemRow = (row: any[], index: number, headers: unknown[] = []): BrainDumpItem | null => {
  const cell = (name: string, fallbackIndex: number, aliases: string[] = []) => readHeaderAwareCell(headers, row, name, fallbackIndex, aliases);
  const id = String(cell('ID', 0) || '').trim();
  if (!id) return null; // header or empty row
  if (id === 'ID') return null; // header

  const meta: any = {};
  if (cell('Title', 2)) meta.title = String(cell('Title', 2));
  if (cell('Date', 7)) meta.date = String(cell('Date', 7));
  const amount = Number(cell('Amount', 8));
  if (!isNaN(amount)) meta.amount = amount;
  if (cell('Tags', 9)) meta.tags = String(cell('Tags', 9)).split(',').map((t: string) => t.trim()).filter(Boolean);
  if (cell('Payment_Method', 10)) meta.paymentMethod = String(cell('Payment_Method', 10));
  if (cell('Canonical_Payment_Method', 11)) meta.canonical_paymentMethod = String(cell('Canonical_Payment_Method', 11));
  if (cell('Merchant', 12)) meta.merchant = String(cell('Merchant', 12));
  if (cell('Canonical_Merchant', 13)) meta.canonical_merchant = String(cell('Canonical_Merchant', 13));
  if (cell('Commodity', 14)) meta.commodity = String(cell('Commodity', 14));
  if (cell('Canonical_Commodity', 15)) meta.canonical_commodity = String(cell('Canonical_Commodity', 15));
  if (cell('Subcommodity', 16)) meta.subcommodity = String(cell('Subcommodity', 16));
  if (cell('Canonical_Subcommodity', 17)) meta.canonical_subcommodity = String(cell('Canonical_Subcommodity', 17));
  if (cell('To_Wallet', 18)) meta.toWallet = String(cell('To_Wallet', 18));
  if (cell('Finance_Type', 19)) meta.financeType = String(cell('Finance_Type', 19));
  if (cell('Budget_Category', 20)) meta.budgetCategory = String(cell('Budget_Category', 20));
  if (cell('Skill_Name', 21)) meta.skillName = String(cell('Skill_Name', 21));
  if (cell('Skill_ID', 22)) meta.skillId = String(cell('Skill_ID', 22));
  const duration = Number(cell('Duration_Minutes', 23));
  if (!isNaN(duration)) meta.durationMinutes = duration;
  if (cell('Shopping_Category', 24)) meta.shoppingCategory = String(cell('Shopping_Category', 24));
  if (cell('Investment_Type', 25)) meta.investmentAssetType = String(cell('Investment_Type', 25));
  if (cell('Investment_Code', 26, ['Investment_Symbol'])) meta.investmentSymbol = String(cell('Investment_Code', 26, ['Investment_Symbol']));
  const units = Number(cell('Investment_Units', 27));
  if (!isNaN(units)) meta.investmentUnits = units;
  const avgBuy = Number(cell('Investment_Avg_Buy', 28));
  if (!isNaN(avgBuy)) meta.investmentAveragePrice = avgBuy;
  const curPrice = Number(cell('Investment_Current_Price', 29));
  if (!isNaN(curPrice)) meta.investmentCurrentPrice = curPrice;
  if (cell('Investment_Platform', 30)) meta.investmentPlatform = String(cell('Investment_Platform', 30));
  const recurrence = Number(cell('Recurrence_Days', 31));
  if (!isNaN(recurrence)) meta.recurrenceDays = recurrence;
  if (cell('Priority', 32)) meta.priority = String(cell('Priority', 32));
  if (cell('Parent_Todo_ID', 33, ['Parent_ID'])) meta.parentTodoId = String(cell('Parent_Todo_ID', 33, ['Parent_ID']));
  if (cell('Child_Todo_IDs', 34, ['Child_IDs'])) meta.childTodoIds = String(cell('Child_Todo_IDs', 34, ['Child_IDs'])).split(',').map((t: string) => t.trim()).filter(Boolean);
  if (cell('Deep_Work_Role', 35)) meta.deepWorkParent = cell('Deep_Work_Role', 35) === 'parent' ? true : undefined;
  if (cell('Deep_Work_Status', 36)) meta.deepWorkStatus = String(cell('Deep_Work_Status', 36));
  if (cell('Deep_Work_Completion_Mode', 37, ['Completion_Mode'])) meta.deepWorkCompletionMode = String(cell('Deep_Work_Completion_Mode', 37, ['Completion_Mode']));
  if (cell('Deep_Work_Next_Action', 38, ['Next_Action'])) meta.deepWorkNextAction = String(cell('Deep_Work_Next_Action', 38, ['Next_Action']));
  if (cell('Deep_Work_Final_Output', 39, ['Final_Output'])) meta.deepWorkFinalOutput = String(cell('Deep_Work_Final_Output', 39, ['Final_Output']));
  const sessionEstimate = Number(cell('Deep_Work_Session_Estimate_Min', 40, ['Session_Estimate_Min']));
  if (!isNaN(sessionEstimate)) meta.deepWorkSessionEstimateMinutes = sessionEstimate;
  if (cell('Deep_Work_Blocker_Status', 41, ['Blocker_Status'])) meta.deepWorkBlockerStatus = String(cell('Deep_Work_Blocker_Status', 41, ['Blocker_Status']));
  if (cell('Deep_Work_Blocker_Check', 42, ['Blocker_Check'])) meta.deepWorkBlockerCheck = String(cell('Deep_Work_Blocker_Check', 42, ['Blocker_Check']));
  const stepIndex = Number(cell('Deep_Work_Step_Index', 43, ['Step_Order']));
  if (!isNaN(stepIndex)) meta.deepWorkStepIndex = stepIndex;
  const stepCount = Number(cell('Deep_Work_Step_Count', 44, ['Step_Count']));
  if (!isNaN(stepCount)) meta.deepWorkStepCount = stepCount;
  if (cell('Deep_Work_Subtasks', 45, ['Subtasks'])) {
    try { meta.subtasks = JSON.parse(String(cell('Deep_Work_Subtasks', 45, ['Subtasks']))); } catch { /* ignore */ }
  }

  return {
    id,
    type: String(cell('Type', 1) || ItemType.NOTE) as ItemType,
    content: String(cell('Content', 3) || ''),
    status: String(cell('Status', 4) || 'pending') as BrainDumpItem['status'],
    created_at: String(cell('Created_At', 5) || new Date().toISOString()),
    completed_at: cell('Completed_At', 6) ? String(cell('Completed_At', 6)) : undefined,
    meta,
  };
};

const truthySheetValue = (value: unknown) => ['true', '1', 'yes', 'y', 'on'].includes(String(value || '').trim().toLowerCase());

const parseBudgetRuleValue = (value: unknown) => {
  const raw = String(value || '').trim();
  const match = raw.match(/([\d.]+)%?\s*(?:\(ID:\s*(.+?)\))?$/i);
  return {
    percentage: match ? Number(match[1]) || 0 : Number(raw) || 0,
    id: match?.[2]?.trim(),
  };
};

const parseConfigSheets = (valueRanges: any[]): {
  wallets: Wallet[];
  skills: Skill[];
  budgetConfig: BudgetConfig | undefined;
  monthlyThemes: Record<string, string>;
  appSettings: AppSettings | undefined;
} => {
  const wallets: Wallet[] = [];
  const skills: Skill[] = [];
  let budgetConfig: BudgetConfig | undefined;
  const monthlyThemes: Record<string, string> = {};
  let appSettings: AppSettings | undefined;
  const ensureBudgetConfig = () => {
    if (!budgetConfig) budgetConfig = { monthlyIncome: 0, rules: [] };
    return budgetConfig;
  };
  const ensureAppSettings = () => {
    if (!appSettings) appSettings = { defaultCollapsed: false, hideMoney: false };
    return appSettings;
  };

  for (const vr of valueRanges) {
    const name = vr.range?.split('!')[0]?.replace(/'/g, '') || '';
    const rows = vr.values || [];
    if (rows.length < 2) continue;
    const headers = rows[0] || [];
    const cell = (row: any[], header: string, fallbackIndex: number, aliases: string[] = []) => readHeaderAwareCell(headers, row, header, fallbackIndex, aliases);

    if (name === 'Wallets Config') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const id = cell(r, 'ID', 0);
        if (!id) continue;
        wallets.push({
          id: String(id),
          name: String(cell(r, 'Name', 1) || ''),
          type: (String(cell(r, 'Type', 2) || 'cash')) as Wallet['type'],
          initialBalance: Number(cell(r, 'Initial_Balance', 3, ['Initial Balance'])) || 0,
          color: String(cell(r, 'Color', 4) || 'bg-gray-500'),
        });
      }
    } else if (name === 'Skills Config') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const id = cell(r, 'ID', 0);
        if (!id) continue;
        skills.push({
          id: String(id),
          name: String(cell(r, 'Name', 1) || ''),
          weeklyTargetMinutes: Number(cell(r, 'Weekly_Target_Minutes', 2, ['Weekly Target Minutes'])) || undefined,
          created_at: String(cell(r, 'Created_At', 3, ['Created At']) || new Date().toISOString()),
          color: String(cell(r, 'Color', 4) || 'indigo-500'),
        });
      }
    } else if (name === 'Budget Rules') {
      const rules: BudgetConfig['rules'] = [];
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const first = String(r[0] || '').trim();
        if (!first) continue;

        if (first === 'Monthly Income') {
          ensureBudgetConfig().monthlyIncome = Number(r[1]) || 0;
          continue;
        }

        if (first.startsWith('Rule: ')) {
          const name = first.replace('Rule: ', '').trim();
          const parsed = parseBudgetRuleValue(r[1]);
          rules.push({
            id: parsed.id || name,
            name,
            percentage: parsed.percentage,
            color: String(r[2] || 'bg-gray-500'),
          });
          continue;
        }

        // Older config shape: ID | Name | Percentage | Color
        rules.push({
          id: String(cell(r, 'ID', 0)),
          name: String(cell(r, 'Name', 1) || ''),
          percentage: Number(cell(r, 'Percentage', 2)) || 0,
          color: String(cell(r, 'Color', 3) || 'bg-blue-500'),
        });
      }
      if (rules.length > 0) {
        ensureBudgetConfig().rules = rules;
      }
    } else if (name === 'Themes & Settings') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const first = String(r[0] || '').trim();
        const second = String(r[1] || '').trim();
        if (!first) continue;

        if (first === 'Setting') {
          const settings = ensureAppSettings();
          if (second === 'Default Collapsed') settings.defaultCollapsed = truthySheetValue(r[2]);
          if (second === 'Hide Money') settings.hideMoney = truthySheetValue(r[2]);
          if (second === 'Google Calendar Sync') settings.googleCalendarSyncEnabled = truthySheetValue(r[2]);
          if (second === 'Google Calendar ID') settings.googleCalendarId = String(r[2] || 'primary');
          continue;
        }

        if (first === 'Theme') {
          if (second && r[2]) monthlyThemes[second] = String(r[2]);
          continue;
        }

        // Legacy key/value shape: monthlyIncome | 1000000, defaultCollapsed | true, theme_YYYY-MM | text
        if (first === 'monthlyIncome') {
          ensureBudgetConfig().monthlyIncome = Number(r[1]) || 0;
        } else if (first === 'defaultCollapsed') {
          ensureAppSettings().defaultCollapsed = truthySheetValue(r[1]);
        } else if (first === 'hideMoney') {
          ensureAppSettings().hideMoney = truthySheetValue(r[1]);
        } else if (first === 'googleCalendarSyncEnabled') {
          ensureAppSettings().googleCalendarSyncEnabled = truthySheetValue(r[1]);
        } else if (first === 'googleCalendarId') {
          ensureAppSettings().googleCalendarId = String(r[1] || 'primary');
        } else if (first.startsWith('theme_')) {
          monthlyThemes[first.replace('theme_', '')] = String(r[1] || '');
        }
      }
    }
  }

  return { wallets, skills, budgetConfig, monthlyThemes, appSettings };
};

const fetchUserEditableSpreadsheetDb = async (config: SpreadsheetConfig, baseDb: DbSchema) => {
  const { meta, existingTitles, reliable } = await fetchSpreadsheetMetadata(config, true);
  const rangesToFetch = Object.entries(SPREADSHEET_FETCH_RANGES)
    .filter(([sheetName]) => existingTitles.has(sheetName))
    .map(([sheetName, range]) => `${escapeSheetName(sheetName)}!${range}`);

  if (rangesToFetch.length === 0) {
    return { data: baseDb, reconciled: false, meta, existingTitles, reliableMeta: reliable };
  }

  const path = `/values:batchGet?ranges=${rangesToFetch.map(encodeURIComponent).join('&ranges=')}`;
  const res = await sheetsFetch(config.spreadsheetId, path);
  if (!res.ok) {
    const errorText = await res.text();
    if (!reliable) {
      console.warn('User-editable sheet fetch failed after metadata fallback; continuing save without manual spreadsheet merge:', errorText);
      return { data: baseDb, reconciled: false, meta, existingTitles, reliableMeta: reliable };
    }
    throw new Error(`Failed to fetch user-editable sheets: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const batchData = await res.json();
  const reconciledDb = reconcileSpreadsheetData(baseDb, batchData.valueRanges || []);
  const reconciled = JSON.stringify(reconciledDb.data) !== JSON.stringify(baseDb.data)
    || JSON.stringify(reconciledDb.budgetConfig) !== JSON.stringify(baseDb.budgetConfig)
    || JSON.stringify(reconciledDb.skills) !== JSON.stringify(baseDb.skills)
    || JSON.stringify(reconciledDb.wallets) !== JSON.stringify(baseDb.wallets)
    || JSON.stringify(reconciledDb.monthlyThemes) !== JSON.stringify(baseDb.monthlyThemes)
    || JSON.stringify(reconciledDb.appSettings) !== JSON.stringify(baseDb.appSettings);

  return { data: reconciledDb, reconciled, meta, existingTitles, reliableMeta: reliable };
};

const writeSystemSheetSnapshotInBatches = async (
  config: SpreadsheetConfig,
  sheet: SheetData,
  phase: SystemSheetSyncStatus
) => {
  const batches = buildColumnWriteBatches(sheet.name, sheet.data);
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const response = await sheetsFetch(config.spreadsheetId, '/values:batchUpdate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [batch]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Sheets API error (System Sheet / ${phase} batch ${i + 1}/${batches.length}): ${response.status} ${response.statusText} - ${errorText}`);
    }
  }
};

// ── Simplified save: clear + write all sheets directly, no system sheet ──
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
  const updatedDb: DbSchema = { 
    data: items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory,
    canonicalRules: canonicalRules || []
  };
  
  const finalJsonString = JSON.stringify(updatedDb);
  writeSpreadsheetCache(finalJsonString);

  const config = getSpreadsheetConfig();
  if (!config) {
    return { success: false, method: 'error', error: 'Spreadsheet is not connected.' };
  }

  try {
    // 1. Generate all sheet data
    const exportSheets = generateExportData(
      items, 
      skills || [], 
      wallets || [], 
      budgetConfig || { monthlyIncome: 0, rules: [] }, 
      monthlyThemes || {}, 
      appSettings || { defaultCollapsed: false, hideMoney: false }
    );

    // 2. Get existing sheets
    const { meta, existingTitles, reliable } = await fetchSpreadsheetMetadata(config, true);
    const allSheetData = [...exportSheets];

    // 3. Create missing sheets
    const requests: any[] = [];
    for (const sheet of allSheetData) {
      if (!existingTitles.has(sheet.name)) {
        requests.push({ addSheet: { properties: { title: sheet.name } } });
      }
    }

    if (requests.length > 0 && reliable) {
      const batchRes = await sheetsFetch(config.spreadsheetId, ':batchUpdate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
      });
      if (!batchRes.ok) {
        console.warn('Sheet creation warning:', await batchRes.text());
      }
    }

    // 4. Clear and write each sheet
    for (const sheet of allSheetData) {
      if (!existingTitles.has(sheet.name) && !reliable) continue;

      // Clear the sheet
      const clearRes = await sheetsFetch(config.spreadsheetId, `/values/${escapeSheetName(sheet.name)}!A:ZZ:clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!clearRes.ok) {
        console.warn(`Failed to clear sheet ${sheet.name}:`, await clearRes.text());
        continue;
      }

      // Write data in batches
      const chunks = chunkArray(sheet.data, 50);
      for (let ci = 0; ci < chunks.length; ci++) {
        const startRow = ci * 50 + 1;
        const range = `${escapeSheetName(sheet.name)}!A${startRow}`;
        const updateRes = await sheetsFetch(config.spreadsheetId, `/values/${range}?valueInputOption=${sheet.inputOption || 'RAW'}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: chunks[ci] })
        });
        if (!updateRes.ok) {
          console.warn(`Failed to write sheet ${sheet.name} chunk ${ci}:`, await updateRes.text());
        }
      }
    }

    // 5. Cache & cleanup
    writeSpreadsheetCache(finalJsonString);
    lastSnapshot = finalJsonString;
    isHydrated = true;

    return { success: true, method: 'cloud' };
  } catch (error: any) {
    console.error('Failed to sync to Spreadsheet:', error);
    return { success: false, method: 'error', error: error.message || 'Unknown sync error' };
  }
};

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};
const enqueueSpreadsheetSync = (args: SpreadsheetSyncArgs): Promise<SyncResult> => {
  const task = () => performSync(...args);
  const queuedTask = operationQueue.then(() => task(), () => task());
  operationQueue = queuedTask;
  return queuedTask;
};

const scheduleBackgroundUserSheetRebuild = (args: SpreadsheetSyncArgs) => {
  if (backgroundRebuildTimer) clearTimeout(backgroundRebuildTimer);

  backgroundRebuildTimer = setTimeout(() => {
    backgroundRebuildTimer = null;
    enqueueSpreadsheetSync(args).catch(error => {
      console.warn('Background spreadsheet rebuild failed:', error);
    });
  }, BACKGROUND_REBUILD_DELAY_MS);
};

const cancelPendingBackgroundRebuild = () => {
  if (!backgroundRebuildTimer) return;
  clearTimeout(backgroundRebuildTimer);
  backgroundRebuildTimer = null;
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
    cancelPendingBackgroundRebuild();
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
  buildIncrementalUserSheetPlan,
  buildColumnWriteBatches,
  columnLabel,
  getItemExportSheetNames,
  isServiceAccountProxyInvocationFailure,
  buildCurrentRawDbFromValueRanges,
  parseConfigSheets,
  fetchLegacyUserSheetDb,
};
