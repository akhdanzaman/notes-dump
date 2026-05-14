import { DbSchema, BrainDumpItem, BudgetConfig, Skill, Wallet, AppSettings, ChatMessage, CanonicalRule, ItemType } from "../types";
import { SyncProgressCallback, SyncResult } from "./syncTypes";
import { mergeDbData } from "../utils/mergeUtils";
import { DASHBOARD_HELPER_END_COLUMN_INDEX, DASHBOARD_HELPER_START_COLUMN_INDEX, DASHBOARD_SHEET_NAME, DATA_QUALITY_SHEET_NAME, generateExportData, SheetData } from "../utils/exportUtils";
import { reconcileSpreadsheetData } from "./spreadsheetReconciler";
import { getValidGoogleAccessToken } from "./googleProfileService";

const SETTINGS_KEY = 'braindump_spreadsheet_config';
const SPREADSHEET_CACHE_KEY = 'braindump_spreadsheet_cache';
const PENDING_SPREADSHEET_WRITE_KEY = 'braindump_spreadsheet_pending_write';
const LEGACY_LOCAL_STORAGE_KEY = 'braindump_db';
const SYSTEM_SHEET_NAME = 'App_State_Do_Not_Edit';
const HISTORY_SHEET_NAME = 'App_State_History';
const EVENT_LOG_SHEET_NAME = 'Event Log';
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
  'Skill Logs',
  'Wallets Config',
  'Skills Config',
  'Budget Rules',
  'Themes & Settings',
  'Chat History',
  'Canonical Rules',
  EVENT_LOG_SHEET_NAME,
] as const;
const GENERATED_DASHBOARD_SHEET_NAMES = new Set<string>([DASHBOARD_SHEET_NAME, DATA_QUALITY_SHEET_NAME]);
const BACKGROUND_REBUILD_DELAY_MS = 5000;
const ASSUMED_EXISTING_SHEET_TITLES = new Set<string>([
  SYSTEM_SHEET_NAME,
  HISTORY_SHEET_NAME,
  ...MANAGED_USER_SHEET_NAMES,
]);

type SystemSheetSyncStatus = 'ready' | 'writing';

type PendingSpreadsheetWrite = {
  id: string;
  createdAt: string;
  data: DbSchema;
};

type SystemSheetSnapshotMeta = {
  marker: string;
  version: number;
  status: SystemSheetSyncStatus;
  chunkCount: number;
  updatedAt: string;
};

export const SPREADSHEET_FETCH_RANGES = {
  Transactions: 'A:S',
  Todos: 'A:AA',
  Shopping: 'A:P',
  Events: 'A:H',
  'Notes & Journals': 'A:F',
  'Skill Logs': 'A:I',
  'Wallets Config': 'A:E',
  'Skills Config': 'A:E',
  'Budget Rules': 'A:C',
  'Themes & Settings': 'A:C',
  'Chat History': 'A:C',
  'Canonical Rules': 'A:U',
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
  SyncProgressCallback | undefined,
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
  const sheets: string[] = [];

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
  } else if (item.type === ItemType.SKILL_LOG) {
    sheets.push('Skill Logs');
  }

  return sheets;
};

const isGeneratedDashboardSheet = (sheetName: string) => GENERATED_DASHBOARD_SHEET_NAMES.has(sheetName);

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
  deletions: { sheetName: string; rowNumber: number }[];
  rewrites: RewriteSheetData[];
};

type RewriteSheetData = SheetData & {
  previousRowCount?: number;
  previousColumnCount?: number;
};

const CONFIG_SHEETS_FOR_REWRITE = new Set(['Budget Rules', 'Skills Config', 'Wallets Config', 'Themes & Settings', 'Chat History', 'Canonical Rules']);

const emptyIncrementalPlan = (canIncremental: boolean, reason?: string): IncrementalUserSheetPlan => ({
  canIncremental,
  reason,
  updates: [],
  appends: [],
  deletions: [],
  rewrites: [],
});

const EVENT_LOG_HEADER = ['Timestamp', 'Level', 'Phase', 'Action', 'Detail', 'Save_ID', 'Version', 'User_Agent'];

const buildEventLogSheet = (): SheetData => ({
  name: EVENT_LOG_SHEET_NAME,
  inputOption: 'RAW',
  data: [EVENT_LOG_HEADER],
});

const buildEventLogRow = (
  level: 'info' | 'success' | 'error',
  phase: string,
  action: string,
  detail: string,
  saveId: string,
) => [
  new Date().toISOString(),
  level,
  phase,
  action,
  detail.slice(0, 1500),
  saveId,
  'spreadsheet-sync-v2',
  typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 250) : 'server',
];

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const getSheetColumnCount = (rows: SheetData['data']) => rows.reduce((max, row) => Math.max(max, row.length), 0);

const buildIncrementalUserSheetPlan = (
  previousDb: DbSchema,
  nextDb: DbSchema,
  exportSheets: SheetData[],
  existingSheetTitles: Set<string>,
  createdSheetTitles: Set<string>,
  isInitialSpreadsheetWrite: boolean,
  actualSheetDb: DbSchema = previousDb,
): IncrementalUserSheetPlan => {
  if (isInitialSpreadsheetWrite) {
    return emptyIncrementalPlan(false, 'initial_write');
  }

  const previousItems = previousDb.data || [];
  const nextItems = nextDb.data || [];
  const previousById = new Map(previousItems.map(item => [item.id, item]));
  const nextById = new Map(nextItems.map(item => [item.id, item]));
  const deletedIds = previousItems.filter(item => !nextById.has(item.id)).map(item => item.id);

  const changedIds = nextItems
    .filter(item => JSON.stringify(previousById.get(item.id)) !== JSON.stringify(item))
    .map(item => item.id);

  const previousSheets = generateExportData(
    actualSheetDb.data || [],
    actualSheetDb.skills || [],
    actualSheetDb.wallets || [],
    actualSheetDb.budgetConfig || { monthlyIncome: 0, rules: [] },
    actualSheetDb.monthlyThemes || {},
    actualSheetDb.appSettings || { defaultCollapsed: false, hideMoney: false },
    new Date(),
    { customPrompt: actualSheetDb.customPrompt, chatHistory: actualSheetDb.chatHistory, canonicalRules: actualSheetDb.canonicalRules }
  );

  const previousIndexes = buildSheetRowIndexes(previousSheets);
  const nextIndexes = buildSheetRowIndexes(exportSheets);
  const nextSheetByName = new Map(exportSheets.map(sheet => [sheet.name, sheet]));
  const rewriteNames = new Set<string>(createdSheetTitles);
  const updates: IncrementalUserSheetPlan['updates'] = [];
  const appends: IncrementalUserSheetPlan['appends'] = [];
  const deletions: IncrementalUserSheetPlan['deletions'] = [];
  const appendCountsBySheet = new Map<string, number>();

  const markRewrite = (sheetName: string) => {
    if (isGeneratedDashboardSheet(sheetName)) return;
    if (!CONFIG_SHEETS_FOR_REWRITE.has(sheetName)) return; // Only config sheets get full rewrites
    if (!existingSheetTitles.has(sheetName) && !createdSheetTitles.has(sheetName)) return;
    rewriteNames.add(sheetName);
  };

  if (!sameJson(previousDb.budgetConfig, nextDb.budgetConfig)) markRewrite('Budget Rules');
  if (!sameJson(previousDb.skills, nextDb.skills)) markRewrite('Skills Config');
  if (!sameJson(previousDb.wallets, nextDb.wallets)) markRewrite('Wallets Config');
  if (!sameJson(previousDb.monthlyThemes, nextDb.monthlyThemes)
    || !sameJson(previousDb.appSettings, nextDb.appSettings)
    || !sameJson(previousDb.customPrompt, nextDb.customPrompt)) markRewrite('Themes & Settings');
  if (!sameJson(previousDb.chatHistory, nextDb.chatHistory)) markRewrite('Chat History');
  if (!sameJson(previousDb.canonicalRules, nextDb.canonicalRules)) markRewrite('Canonical Rules');

  deletedIds.forEach(id => {
    const previousItem = previousById.get(id);
    if (!previousItem) return;
    const sheetNames = getItemExportSheetNames(previousItem);
    for (const sheetName of sheetNames) {
      if (CONFIG_SHEETS_FOR_REWRITE.has(sheetName)) {
        markRewrite(sheetName);
      } else {
        const rowNumber = previousIndexes.get(sheetName)?.rowById.get(id);
        if (rowNumber) {
          deletions.push({ sheetName, rowNumber });
        }
      }
    }
  });

  for (const id of changedIds) {
    const previousItem = previousById.get(id);
    const nextItem = nextById.get(id);
    if (!nextItem) continue;

    const previousSheetNames = previousItem ? getItemExportSheetNames(previousItem) : [];
    const nextSheetNames = getItemExportSheetNames(nextItem);
    const movedBetweenSheets = previousSheetNames.length > 0
      && JSON.stringify([...previousSheetNames].sort()) !== JSON.stringify([...nextSheetNames].sort());

    if (movedBetweenSheets) {
      // Delete from old sheets (per-row)
      for (const sheetName of previousSheetNames) {
        if (CONFIG_SHEETS_FOR_REWRITE.has(sheetName)) {
          markRewrite(sheetName);
        } else {
          const rowNumber = previousIndexes.get(sheetName)?.rowById.get(id);
          if (rowNumber) deletions.push({ sheetName, rowNumber });
        }
      }
      // Append to new sheets
      for (const sheetName of nextSheetNames) {
        if (CONFIG_SHEETS_FOR_REWRITE.has(sheetName)) {
          markRewrite(sheetName);
        } else {
          const sheet = exportSheets.find(s => s.name === sheetName);
          const nextIdx = nextIndexes.get(sheetName);
          const rowNum = nextIdx?.rowById.get(id);
          if (sheet && rowNum) {
            const row = sheet.data[rowNum - 1];
            if (row) {
              appends.push({ sheetName, values: [row], inputOption: sheet.inputOption || 'RAW' });
            }
          }
        }
      }
      continue;
    }

    for (const sheetName of nextSheetNames) {
      if (!existingSheetTitles.has(sheetName) || createdSheetTitles.has(sheetName)) {
        if (createdSheetTitles.has(sheetName)) {
          markRewrite(sheetName);
          continue;
        }
        return emptyIncrementalPlan(false, 'missing_or_new_sheet');
      }

      const nextIndex = nextIndexes.get(sheetName);
      if (!nextIndex) {
        return emptyIncrementalPlan(false, 'missing_next_row');
      }

      const nextRowNumber = nextIndex.rowById.get(id);
      const row = nextRowNumber ? nextIndex.sheet.data[nextRowNumber - 1] : undefined;
      if (!row || !nextRowNumber) {
        return emptyIncrementalPlan(false, 'missing_next_row');
      }

      const previousRowNumber = previousIndexes.get(sheetName)?.rowById.get(id);
      const inputOption = nextIndex.sheet.inputOption || 'RAW';

      if (previousRowNumber) {
        updates.push({
          range: `${escapeSheetName(sheetName)}!A${previousRowNumber}:${columnLabel(row.length - 1)}${previousRowNumber}`,
          values: [row],
        });
      } else {
        // New item: always append (order managed by app, not sheet position)
        appends.push({
          sheetName,
          values: [row],
          inputOption,
        });
      }
    }
  }

  const rewrites = [...rewriteNames]
    .map((sheetName): RewriteSheetData | undefined => {
      const sheet = nextSheetByName.get(sheetName);
      if (!sheet) return undefined;
      const previousSheet = previousIndexes.get(sheetName)?.sheet;
      return {
        ...sheet,
        previousRowCount: previousSheet?.data.length,
        previousColumnCount: previousSheet ? getSheetColumnCount(previousSheet.data) : undefined,
      };
    })
    .filter((sheet): sheet is RewriteSheetData => !!sheet);
  const rewriteSet = new Set(rewrites.map(sheet => sheet.name));
  const filteredUpdates = updates.filter(update => {
    const sheetName = update.range.split('!')[0]?.replace(/'/g, '');
    return !rewriteSet.has(sheetName);
  });
  const filteredAppends = appends.filter(append => !rewriteSet.has(append.sheetName));

  return {
    canIncremental: true,
    reason: filteredUpdates.length === 0 && filteredAppends.length === 0 && deletions.length === 0 && rewrites.length === 0 ? 'no_changes' : 'changed_ranges',
    updates: filteredUpdates,
    appends: filteredAppends,
    deletions,
    rewrites,
  };
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

export const cachePendingSpreadsheetWrite = (db: DbSchema): string => {
  const pending: PendingSpreadsheetWrite = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    data: validateSchema(db),
  };
  writeSpreadsheetCache(JSON.stringify(pending.data));
  safeLocalStorageSet(PENDING_SPREADSHEET_WRITE_KEY, JSON.stringify(pending));
  return pending.id;
};

export const getPendingSpreadsheetWrite = (): PendingSpreadsheetWrite | null => {
  const jsonString = safeLocalStorageGet(PENDING_SPREADSHEET_WRITE_KEY);
  if (!jsonString) return null;
  try {
    const parsed = JSON.parse(jsonString) as Partial<PendingSpreadsheetWrite>;
    if (!parsed.id || !parsed.data) return null;
    return {
      id: parsed.id,
      createdAt: parsed.createdAt || new Date(0).toISOString(),
      data: validateSchema(parsed.data),
    };
  } catch (error) {
    console.warn('Failed to read pending spreadsheet write cache', error);
    return null;
  }
};

export const clearPendingSpreadsheetWrite = (id?: string) => {
  if (id) {
    const pending = getPendingSpreadsheetWrite();
    if (pending && pending.id !== id) return;
  }
  safeLocalStorageRemove(PENDING_SPREADSHEET_WRITE_KEY);
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

const shouldRetryServiceAccountProxyResponse = async (response: Response) => {
  if (!shouldRetrySpreadsheetRequest(response.status)) return false;
  if (response.status >= 500) return true;
  return isServiceAccountProxyInvocationFailure(response);
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
    if (!response.ok && attempt < MAX_FETCH_RETRIES && await shouldRetryServiceAccountProxyResponse(response.clone())) {
      const delayMs = getRetryDelayMs(attempt, response.headers.get('retry-after'));
      await wait(delayMs);
      return sheetsFetch(spreadsheetId, path, init, attempt + 1, tokenOverride);
    }
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

const appendSpreadsheetEvent = async (
  config: SpreadsheetConfig,
  row: ReturnType<typeof buildEventLogRow>
) => {
  try {
    const range = `${escapeSheetName(EVENT_LOG_SHEET_NAME)}!A1`;
    const response = await sheetsFetch(config.spreadsheetId, `/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    });
    if (!response.ok) {
      console.warn('Failed to append spreadsheet event log:', await response.text());
    }
  } catch (error) {
    console.warn('Failed to append spreadsheet event log:', error);
  }
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

// ── Fetch/migration path: dedicated sheets first, then legacy raw/system/user sheets ──
type SpreadsheetReadSource = 'dedicated_sheets' | 'current_raw' | 'legacy_system_snapshot' | 'legacy_user_sheets' | 'cache' | 'empty';

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
    customPrompt: configSheets.customPrompt,
    chatHistory: configSheets.chatHistory,
    canonicalRules: configSheets.canonicalRules,
  };
};

const hasDedicatedSheetData = (db: DbSchema) =>
  db.data.length > 0
  || (db.wallets?.length || 0) > 0
  || (db.skills?.length || 0) > 0
  || (db.budgetConfig?.rules.length || 0) > 0
  || !!db.budgetConfig?.monthlyIncome
  || Object.keys(db.monthlyThemes || {}).length > 0
  || !!db.appSettings
  || !!db.customPrompt
  || (db.chatHistory?.length || 0) > 0
  || (db.canonicalRules?.length || 0) > 0;

const mergeLegacyRawItemsForMissingDedicatedSheets = (db: DbSchema, valueRanges: any[]): DbSchema => {
  const hasSkillLogsSheet = valueRanges.some((r: any) => r.range?.includes('Skill Logs'));
  if (hasSkillLogsSheet) return db;

  const legacyRawDb = buildCurrentRawDbFromValueRanges(valueRanges || []);
  const legacySkillLogs = legacyRawDb.data.filter(item => item.type === ItemType.SKILL_LOG);
  if (legacySkillLogs.length === 0) return db;

  const existingIds = new Set(db.data.map(item => item.id));
  const missingSkillLogs = legacySkillLogs.filter(item => !existingIds.has(item.id));
  if (missingSkillLogs.length === 0) return db;

  return validateSchema({
    ...db,
    data: [...db.data, ...missingSkillLogs],
  });
};

const buildDedicatedDbFromValueRanges = (valueRanges: any[]): DbSchema => {
  const configSheets = parseConfigSheets(valueRanges || []);
  const baseDb = validateSchema({
    data: [],
    wallets: configSheets.wallets,
    skills: configSheets.skills,
    budgetConfig: configSheets.budgetConfig,
    monthlyThemes: configSheets.monthlyThemes,
    appSettings: configSheets.appSettings,
  });
  const reconciled = reconcileSpreadsheetData(baseDb, valueRanges || []);

  const dedicatedDb = validateSchema({
    ...reconciled,
    wallets: configSheets.wallets,
    skills: configSheets.skills,
    budgetConfig: configSheets.budgetConfig || reconciled.budgetConfig,
    monthlyThemes: configSheets.monthlyThemes,
    appSettings: configSheets.appSettings || reconciled.appSettings,
    customPrompt: configSheets.customPrompt,
    chatHistory: configSheets.chatHistory,
    canonicalRules: configSheets.canonicalRules,
  });

  return mergeLegacyRawItemsForMissingDedicatedSheets(dedicatedDb, valueRanges || []);
};

const fetchDedicatedSpreadsheetDb = async (config: SpreadsheetConfig, existingTitles: Set<string>) => {
  const rangesToFetch = Object.entries(SPREADSHEET_FETCH_RANGES)
    .filter(([sheetName]) => existingTitles.has(sheetName))
    .map(([sheetName, range]) => `${escapeSheetName(sheetName)}!${range}`);

  if (!existingTitles.has('Skill Logs') && existingTitles.has(ALL_ITEMS_SHEET)) {
    rangesToFetch.push(`${escapeSheetName(ALL_ITEMS_SHEET)}!A:AZ`);
  }

  const valueRanges = await batchGetSpreadsheetRanges(config, rangesToFetch);
  return buildDedicatedDbFromValueRanges(valueRanges);
};

const fetchCurrentRawSpreadsheetDb = async (config: SpreadsheetConfig, existingTitles: Set<string>) => {
  const rangesToFetch: string[] = [];
  if (existingTitles.has(ALL_ITEMS_SHEET)) {
    rangesToFetch.push(`${escapeSheetName(ALL_ITEMS_SHEET)}!A:AZ`);
  }

  for (const name of ['Wallets Config', 'Skills Config', 'Budget Rules', 'Themes & Settings', 'Chat History', 'Canonical Rules']) {
    if (existingTitles.has(name)) {
      const configuredRange = SPREADSHEET_FETCH_RANGES[name as keyof typeof SPREADSHEET_FETCH_RANGES] || 'A:E';
      rangesToFetch.push(`${escapeSheetName(name)}!${configuredRange}`);
    }
  }

  const valueRanges = await batchGetSpreadsheetRanges(config, rangesToFetch);
  return buildCurrentRawDbFromValueRanges(valueRanges);
};

const getValueRangeSheetNames = (valueRanges: any[]) => new Set(
  (valueRanges || [])
    .map(vr => String(vr.range || '').split('!')[0]?.replace(/'/g, ''))
    .filter(Boolean)
);

const applyConfigSheetsToBaseDb = (baseDb: DbSchema, valueRanges: any[]): DbSchema => {
  const sheetConfig = parseConfigSheets(valueRanges || []);
  const rangeNames = getValueRangeSheetNames(valueRanges || []);
  const hasThemesAndSettings = rangeNames.has('Themes & Settings');

  return validateSchema({
    ...baseDb,
    wallets: rangeNames.has('Wallets Config') ? sheetConfig.wallets : baseDb.wallets,
    skills: rangeNames.has('Skills Config') ? sheetConfig.skills : baseDb.skills,
    budgetConfig: rangeNames.has('Budget Rules') ? (sheetConfig.budgetConfig || baseDb.budgetConfig) : baseDb.budgetConfig,
    monthlyThemes: hasThemesAndSettings ? sheetConfig.monthlyThemes : baseDb.monthlyThemes,
    appSettings: hasThemesAndSettings ? (sheetConfig.appSettings || baseDb.appSettings) : baseDb.appSettings,
    customPrompt: sheetConfig.customPrompt ?? baseDb.customPrompt,
    chatHistory: rangeNames.has('Chat History') ? (sheetConfig.chatHistory || []) : baseDb.chatHistory,
    canonicalRules: rangeNames.has('Canonical Rules') ? (sheetConfig.canonicalRules || []) : baseDb.canonicalRules,
  });
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
  const configMergedBase = applyConfigSheetsToBaseDb(baseDb, valueRanges || []);
  const reconciledDb = validateSchema({
    ...reconcileSpreadsheetData(configMergedBase, valueRanges || []),
  });
  const reconciled = JSON.stringify(reconciledDb) !== JSON.stringify(validateSchema(baseDb));
  return { data: reconciledDb, reconciled };
};

const fetchSpreadsheetDbWithToken = async (config: SpreadsheetConfig, skipLocalStorage: boolean) => {
  const { existingTitles } = await fetchSpreadsheetMetadata(config, true);

  let source: SpreadsheetReadSource = 'empty';
  let dbData: DbSchema = { data: [] };
  let reconciled = false;

  const dedicatedDb = await fetchDedicatedSpreadsheetDb(config, existingTitles);
  if (hasDedicatedSheetData(dedicatedDb)) {
    source = 'dedicated_sheets';
    dbData = dedicatedDb;
  } else {
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
  }

  // Fallback to cache only for truly new spreadsheets. If managed app sheets
  // already exist, header-only item tabs are authoritative empty state.
  const hasManagedSheets = MANAGED_USER_SHEET_NAMES.some(sheetName => existingTitles.has(sheetName));
  if (dbData.data.length === 0 && !hasManagedSheets) {
    const cached = getCachedSpreadsheetDb();
    if (cached?.data?.length) {
      dbData = cached;
      source = 'cache';
      console.log('Seeded items from spreadsheet cache');
    }
  }

  const normalizedDb = validateSchema(dbData);
  if (source === 'current_raw' || source === 'legacy_system_snapshot' || source === 'legacy_user_sheets' || reconciled) {
    needsInitialSpreadsheetWrite = true;
  }

  if (!skipLocalStorage) {
    try {
      const normalizedSnapshot = JSON.stringify(normalizedDb);
      writeSpreadsheetCache(normalizedSnapshot);
      lastSnapshot = normalizedSnapshot;
    } catch (e) {
      console.warn('Failed to save to local storage', e);
    }
    isHydrated = true;
  }

  return {
    data: normalizedDb,
    sha: `spreadsheet-${source}-sha`,
    reconciled: source === 'current_raw' || source === 'legacy_system_snapshot' || source === 'legacy_user_sheets' || reconciled,
  };
};

// ── Legacy direct sheet fetch: reads old "All Items (Raw)" exports for migration only ──
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

const splitSheetListValue = (value: unknown): string[] => String(value || '')
  .split(/[;,\n]/)
  .map(part => part.trim())
  .filter(Boolean);

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
  customPrompt: string | undefined;
  chatHistory: ChatMessage[] | undefined;
  canonicalRules: CanonicalRule[] | undefined;
} => {
  const wallets: Wallet[] = [];
  const skills: Skill[] = [];
  const chatHistory: ChatMessage[] = [];
  const canonicalRules: CanonicalRule[] = [];
  let budgetConfig: BudgetConfig | undefined;
  const monthlyThemes: Record<string, string> = {};
  let appSettings: AppSettings | undefined;
  let customPrompt: string | undefined;
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
          if (second === 'Custom Prompt') customPrompt = String(r[2] || '');
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
        } else if (first === 'customPrompt') {
          customPrompt = String(r[1] || '');
        } else if (first.startsWith('theme_')) {
          monthlyThemes[first.replace('theme_', '')] = String(r[1] || '');
        }
      }
    } else if (name === 'Chat History') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const role = String(cell(r, 'Role', 1) || '').trim();
        const text = String(cell(r, 'Text', 2) || '');
        if ((role === 'user' || role === 'model') && text) {
          chatHistory.push({ role, text });
        }
      }
    } else if (name === 'Canonical Rules') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const id = String(cell(r, 'ID', 0) || '').trim();
        const field = String(cell(r, 'Field', 1) || '').trim() as CanonicalRule['field'];
        const canonicalValue = String(cell(r, 'Canonical_Value', 2, ['Canonical Value']) || '').trim();
        if (!id || !field || !canonicalValue) continue;

        const conditions: CanonicalRule['conditions'] = {};
        const financeType = splitSheetListValue(cell(r, 'Condition_Finance_Types', 8));
        const budgetCategory = splitSheetListValue(cell(r, 'Condition_Budget_Categories', 9));
        const commodity = splitSheetListValue(cell(r, 'Condition_Commodities', 10));
        const paymentMethod = splitSheetListValue(cell(r, 'Condition_Payment_Methods', 11));
        const amountMin = Number(cell(r, 'Condition_Amount_Min', 12));
        const amountMax = Number(cell(r, 'Condition_Amount_Max', 13));
        if (financeType.length) conditions.financeType = financeType as any;
        if (budgetCategory.length) conditions.budgetCategory = budgetCategory;
        if (commodity.length) conditions.commodity = commodity;
        if (paymentMethod.length) conditions.paymentMethod = paymentMethod;
        if (Number.isFinite(amountMin)) conditions.amountMin = amountMin;
        if (Number.isFinite(amountMax)) conditions.amountMax = amountMax;

        canonicalRules.push({
          id,
          field,
          canonicalValue,
          aliases: splitSheetListValue(cell(r, 'Aliases', 3)),
          source: (String(cell(r, 'Source', 4) || 'manual') as CanonicalRule['source']),
          confidenceBoost: Number(cell(r, 'Confidence_Boost', 5)) || undefined,
          approvalCount: Number(cell(r, 'Approval_Count', 6)) || 0,
          rejectionCount: Number(cell(r, 'Rejection_Count', 7)) || 0,
          conditions: Object.keys(conditions).length ? conditions : undefined,
          createdAt: String(cell(r, 'Created_At', 14) || new Date().toISOString()),
          updatedAt: String(cell(r, 'Updated_At', 15) || new Date().toISOString()),
          lastApprovedAt: String(cell(r, 'Last_Approved_At', 16) || '') || undefined,
          lastRejectedAt: String(cell(r, 'Last_Rejected_At', 17) || '') || undefined,
          autoApplyDisabled: truthySheetValue(cell(r, 'Auto_Apply_Disabled', 18)),
          disabled: truthySheetValue(cell(r, 'Disabled', 19)),
          disabledReason: String(cell(r, 'Disabled_Reason', 20) || '') || undefined,
        });
      }
    }
  }

  return {
    wallets,
    skills,
    budgetConfig,
    monthlyThemes,
    appSettings,
    customPrompt,
    chatHistory: chatHistory.length ? chatHistory : undefined,
    canonicalRules: canonicalRules.length ? canonicalRules : undefined,
  };
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
  const valueRanges = batchData.valueRanges || [];
  const configMergedBase = applyConfigSheetsToBaseDb(baseDb, valueRanges);
  const reconciledDb = reconcileSpreadsheetData(configMergedBase, valueRanges);
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

const buildSheetRewriteBatches = (
  sheet: RewriteSheetData,
  chunkSize = 20,
): { range: string; values: SheetData['data']; startRow: number; endRow: number }[] => {
  const totalRows = Math.max(sheet.data.length, sheet.previousRowCount || 0, 1);
  const totalColumns = Math.max(getSheetColumnCount(sheet.data), sheet.previousColumnCount || 0, 1);
  const batches: { range: string; values: SheetData['data']; startRow: number; endRow: number }[] = [];

  for (let start = 0; start < totalRows; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalRows);
    const values = Array.from({ length: end - start }, (_, offset) => {
      const sourceRow = sheet.data[start + offset] || [];
      const padded: SheetData['data'][number] = Array.from({ length: totalColumns }, () => '');
      sourceRow.forEach((cell, index) => {
        padded[index] = cell ?? '';
      });
      return padded;
    });
    batches.push({
      range: `${escapeSheetName(sheet.name)}!A${start + 1}:${columnLabel(totalColumns - 1)}${end}`,
      values,
      startRow: start + 1,
      endRow: end,
    });
  }

  return batches;
};

const rewriteSheetValuesInChunks = async (
  config: SpreadsheetConfig,
  sheet: RewriteSheetData,
  sheetIndex: number,
  totalSheets: number,
  onProgress?: SyncProgressCallback
) => {
  const batches = buildSheetRewriteBatches(sheet);
  for (let ci = 0; ci < batches.length; ci++) {
    const batch = batches[ci];
    onProgress?.({
      phase: 'write_sheet',
      label: 'Rewriting changed sheet rows',
      detail: `${sheet.name} · rows ${batch.startRow}-${batch.endRow} · batch ${ci + 1}/${batches.length}`,
      current: sheetIndex + 1,
      total: totalSheets,
    });
    const updateRes = await sheetsFetch(config.spreadsheetId, '/values:batchUpdate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: sheet.inputOption || 'RAW',
        data: [{ range: batch.range, values: batch.values }],
      })
    });
    if (!updateRes.ok) {
      throw new Error(`Failed to rewrite sheet ${sheet.name} chunk ${ci + 1}/${batches.length}: ${await updateRes.text()}`);
    }
  }
};

const rewriteChangedSheets = async (
  config: SpreadsheetConfig,
  sheets: RewriteSheetData[],
  onProgress?: SyncProgressCallback
) => {
  for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex += 1) {
    const sheet = sheets[sheetIndex];
    await rewriteSheetValuesInChunks(config, sheet, sheetIndex, sheets.length, onProgress);
  }
};

const writeIncrementalUserSheetPlan = async (
  config: SpreadsheetConfig,
  plan: IncrementalUserSheetPlan,
  sheetNameToId: Map<string, number>,
  onProgress?: SyncProgressCallback
) => {
  // Process row deletions first (bottom-up per sheet via deleteDimension)
  if (plan.deletions.length > 0) {
    onProgress?.({
      phase: 'delete_rows',
      label: 'Deleting removed rows',
      detail: `${plan.deletions.length} row(s) to delete`,
    });
    const sheetMap = new Map<string, number[]>();
    for (const del of plan.deletions) {
      const rows = sheetMap.get(del.sheetName) || [];
      rows.push(del.rowNumber);
      sheetMap.set(del.sheetName, rows);
    }
    const deleteRequests: any[] = [];
    for (const [sheetName, rowNumbers] of sheetMap) {
      const sheetId = sheetNameToId.get(sheetName);
      if (!sheetId) {
        console.warn('deleteDimension: no sheetId found for', sheetName, '- skipping');
        continue;
      }
      // Process bottom-up so row positions stay valid
      rowNumbers.sort((a, b) => b - a);
      for (const rowNumber of rowNumbers) {
        deleteRequests.push({
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        });
      }
    }
    if (deleteRequests.length > 0) {
      const res = await sheetsFetch(config.spreadsheetId, ':batchUpdate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: deleteRequests }),
      });
      if (!res.ok) {
        throw new Error(`Failed to delete ${deleteRequests.length} row(s): ${await res.text()}`);
      }
    }
  }

  if (plan.rewrites.length > 0) {
    await rewriteChangedSheets(config, plan.rewrites, onProgress);
  }

  if (plan.updates.length > 0) {
    const chunks = chunkArray(plan.updates, MAX_WRITE_BATCH_SIZE);
    for (let index = 0; index < chunks.length; index += 1) {
      onProgress?.({
        phase: 'write_sheet',
        label: 'Writing changed row batches',
        detail: `Updated rows batch ${index + 1}/${chunks.length}`,
        current: index + 1,
        total: chunks.length,
      });
      const response = await sheetsFetch(config.spreadsheetId, '/values:batchUpdate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valueInputOption: 'RAW', data: chunks[index] })
      });
      if (!response.ok) {
        throw new Error(`Failed to update changed rows batch ${index + 1}/${chunks.length}: ${await response.text()}`);
      }
    }
  }

  const appendGroups = new Map<string, { sheetName: string; inputOption: 'RAW' | 'USER_ENTERED'; values: SheetData['data'] }>();
  plan.appends.forEach(append => {
    const key = `${append.sheetName}\u0000${append.inputOption}`;
    const group = appendGroups.get(key) || { sheetName: append.sheetName, inputOption: append.inputOption, values: [] };
    group.values.push(...append.values);
    appendGroups.set(key, group);
  });

  const appendList = [...appendGroups.values()];
  for (let index = 0; index < appendList.length; index += 1) {
    const append = appendList[index];
    onProgress?.({
      phase: 'write_sheet',
      label: 'Appending changed rows',
      detail: `${append.sheetName} · ${append.values.length} new row${append.values.length === 1 ? '' : 's'}`,
      current: index + 1,
      total: appendList.length,
    });
    const range = `${escapeSheetName(append.sheetName)}!A1`;
    const response = await sheetsFetch(config.spreadsheetId, `/values/${range}:append?valueInputOption=${append.inputOption}&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: append.values })
    });
    if (!response.ok) {
      throw new Error(`Failed to append changed rows to ${append.sheetName}: ${await response.text()}`);
    }
  }
};

// Save only changed user sheets/ranges after the first full setup write.
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
  forceOverwrite = false,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> => {
  const updatedDb: DbSchema = { 
    data: items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory,
    canonicalRules: canonicalRules || []
  };

  writeSpreadsheetCache(JSON.stringify(updatedDb));

  const config = getSpreadsheetConfig();
  if (!config) {
    return { success: false, method: 'error', error: 'Spreadsheet is not connected.' };
  }
  const saveId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const localDbForPlan = validateSchema(updatedDb);
    let dbToWrite = localDbForPlan;
    const baseSnapshot = lastSnapshot ? validateSchema(safeJsonParse(lastSnapshot, { data: [] })) : undefined;
    let currentSheetDbForPlan: DbSchema | undefined;

    if (!forceOverwrite) {
      onProgress?.({ phase: 'merge_remote', label: 'Checking sheet edits', detail: 'Merging current spreadsheet rows before save' });
      const sheetBase = validateSchema(safeJsonParse(JSON.stringify(baseSnapshot || dbToWrite), { data: [] }));
      const sheetState = await fetchUserEditableSpreadsheetDb(config, sheetBase);
      currentSheetDbForPlan = sheetState.data;
      dbToWrite = baseSnapshot
        ? mergeDbData(dbToWrite, sheetState.data, baseSnapshot)
        : mergeDbData(dbToWrite, sheetState.data);
    }

    const finalJsonString = JSON.stringify(dbToWrite);

    // 1. Generate all sheet data
    onProgress?.({ phase: 'export', label: 'Building spreadsheet tabs', detail: `${dbToWrite.data.length} items → export sheets` });
    const exportSheets = generateExportData(
      dbToWrite.data,
      dbToWrite.skills || [],
      dbToWrite.wallets || [],
      dbToWrite.budgetConfig || { monthlyIncome: 0, rules: [] },
      dbToWrite.monthlyThemes || {},
      dbToWrite.appSettings || { defaultCollapsed: false, hideMoney: false },
      new Date(),
      { customPrompt: dbToWrite.customPrompt, chatHistory: dbToWrite.chatHistory, canonicalRules: dbToWrite.canonicalRules }
    );

    // 2. Get existing sheets
    onProgress?.({ phase: 'metadata', label: 'Checking spreadsheet structure', detail: 'Reading tab list and permissions' });
    const { meta, existingTitles, reliable } = await fetchSpreadsheetMetadata(config, true);
    const sheetNameToId = new Map<string, number>(
      (meta?.sheets || [])
        .map((s: any) => [s.properties.title, s.properties.sheetId] as [string, number])
        .filter(([, id]) => id !== undefined)
    );
    const allSheetData = [...exportSheets, buildEventLogSheet()];
    const isInitialSpreadsheetWrite = !baseSnapshot || !isHydrated || existingTitles.size === 0;
    const shouldWriteGeneratedDashboardSheets = forceOverwrite || isInitialSpreadsheetWrite;

    // 3. Create missing sheets
    const requests: any[] = [];
    const createdSheetTitles = new Set<string>();
    for (const sheet of allSheetData) {
      if (isGeneratedDashboardSheet(sheet.name) && !shouldWriteGeneratedDashboardSheets) continue;
      if (!existingTitles.has(sheet.name)) {
        requests.push({ addSheet: { properties: { title: sheet.name } } });
      }
    }

    if (requests.length > 0 && reliable) {
      onProgress?.({ phase: 'create_sheets', label: 'Creating missing tabs', detail: `${requests.length} tab${requests.length === 1 ? '' : 's'} needed` });
      const batchRes = await sheetsFetch(config.spreadsheetId, ':batchUpdate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests })
      });
      if (!batchRes.ok) {
        throw new Error(`Failed to create missing spreadsheet tabs: ${await batchRes.text()}`);
      }
      requests.forEach(request => {
        const title = request.addSheet?.properties?.title;
        if (title) createdSheetTitles.add(title);
      });
    }

    const effectiveExistingTitles = new Set([...existingTitles, ...createdSheetTitles]);
    const incrementalPlan = !forceOverwrite && baseSnapshot
      ? buildIncrementalUserSheetPlan(baseSnapshot, localDbForPlan, allSheetData, effectiveExistingTitles, createdSheetTitles, isInitialSpreadsheetWrite, currentSheetDbForPlan || baseSnapshot)
      : emptyIncrementalPlan(false, forceOverwrite ? 'force_overwrite' : 'missing_base_snapshot');

    // 4. Write only changed ranges/sheets after initial setup. Force overwrite and
    // first writes still rebuild all sheets to establish headers and formulas.
    if (incrementalPlan.canIncremental) {
      const writeCount = incrementalPlan.deletions.length + incrementalPlan.rewrites.length + incrementalPlan.updates.length + incrementalPlan.appends.length;
      onProgress?.({
        phase: 'write_sheet',
        label: writeCount > 0 ? 'Writing changed sheets only' : 'No sheet changes to write',
        detail: writeCount > 0
          ? `${incrementalPlan.deletions.length} row deletion(s), ${incrementalPlan.rewrites.length} sheet rewrite(s), ${incrementalPlan.updates.length} row update(s), ${incrementalPlan.appends.length} append batch(es)`
          : 'Local and spreadsheet data already match',
      });
      await appendSpreadsheetEvent(config, buildEventLogRow('info', 'plan', 'incremental_save_plan', `${incrementalPlan.deletions.length} delete(s), ${incrementalPlan.rewrites.length} rewrite(s), ${incrementalPlan.updates.length} update(s), ${incrementalPlan.appends.length} append(s); reason=${incrementalPlan.reason || 'changed_ranges'}`, saveId));
      await writeIncrementalUserSheetPlan(config, incrementalPlan, sheetNameToId, onProgress);
    } else {
      await appendSpreadsheetEvent(config, buildEventLogRow('info', 'plan', 'full_sheet_rewrite_plan', `reason=${incrementalPlan.reason || 'unknown'}; sheets=${allSheetData.map(sheet => sheet.name).join(', ')}`, saveId));
      await rewriteChangedSheets(
        config,
        allSheetData.filter(sheet => (shouldWriteGeneratedDashboardSheets || !isGeneratedDashboardSheet(sheet.name)) && (effectiveExistingTitles.has(sheet.name) || reliable)),
        onProgress
      );
    }

    // 5. Cache & cleanup
    onProgress?.({ phase: 'complete', label: 'Finalizing save', detail: 'Updating local cache' });
    writeSpreadsheetCache(finalJsonString);
    lastSnapshot = finalJsonString;
    isHydrated = true;
    await appendSpreadsheetEvent(config, buildEventLogRow('success', 'complete', 'save_success', `${dbToWrite.data.length} item(s) saved`, saveId));

    return {
      success: true,
      method: 'cloud',
      mergedData: JSON.stringify(dbToWrite) !== JSON.stringify(updatedDb) ? dbToWrite : undefined,
    };
  } catch (error: any) {
    onProgress?.({ phase: 'error', label: 'Save failed', detail: error.message || 'Unknown sync error' });
    console.error('Failed to sync to Spreadsheet:', error);
    await appendSpreadsheetEvent(config, buildEventLogRow('error', 'error', 'save_failed', error.message || 'Unknown sync error', saveId));
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

export const flushPendingSpreadsheetSync = async (): Promise<SyncResult | null> => {
  const pending = pendingDebouncedSync;
  if (!pending) return null;

  pendingDebouncedSync = null;
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = null;
  }

  try {
    const result = await enqueueSpreadsheetSync(pending.args);
    pending.resolvers.forEach(({ resolve }) => resolve(result));
    return result;
  } catch (error) {
    pending.resolvers.forEach(({ reject }) => reject(error));
    throw error;
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
  forceOverwrite = false,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> => {
  const args: SpreadsheetSyncArgs = [items, budgetConfig, customPrompt, skills, wallets, monthlyThemes, appSettings, chatHistory, canonicalRules, forceOverwrite, onProgress];

  if (forceOverwrite) {
    cancelPendingDebouncedSync({ success: true, method: 'skipped_no_changes' });
    cancelPendingBackgroundRebuild();
    return enqueueSpreadsheetSync(args);
  }

  onProgress?.({ phase: 'queue', label: 'Waiting for save debounce', detail: `${SPREADSHEET_SYNC_DEBOUNCE_MS}ms batching window` });
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
  buildSheetRewriteBatches,
  buildEventLogSheet,
  buildEventLogRow,
  buildColumnWriteBatches,
  columnLabel,
  getItemExportSheetNames,
  isServiceAccountProxyInvocationFailure,
  buildCurrentRawDbFromValueRanges,
  buildDedicatedDbFromValueRanges,
  parseConfigSheets,
  fetchLegacyUserSheetDb,
};
