import { applyLosslessConfig, CONFIG_SHEET, configTables } from '../../utils/losslessConfig';
import type { DbSchema, BrainDumpItem } from '../../types';
import { generateExportData, type SheetData } from '../../utils/exportUtils';
import { reconcileSpreadsheetData } from '../../services/spreadsheetReconciler';
import { parseConfigSheets } from '../../utils/spreadsheetConfig';
import { mergeMutation, SyncConflict, DeferredDependency, type SyncOperation, type SyncReceipt, equivalent } from '../../utils/syncProtocol';
import { fetchWithServiceAccount } from './googleServiceAccount.js';

export const RECEIPT_SHEET = '_Sync_Receipts';
export { CONFIG_SHEET };
export type SheetsTransport = (scope: string, path: string, init?: RequestInit) => Promise<Response>;
const quote = (name: string) => `'${name.replace(/'/g, "''")}'`;
export const exportCore = (db: DbSchema): SheetData[] => generateExportData(db.data, db.skills || [], db.wallets || [],
  db.budgetConfig || { monthlyIncome: 0, rules: [] }, db.monthlyThemes || {}, db.appSettings || { defaultCollapsed: false, hideMoney: false },
  new Date(), { ...db, includeDerived: false });
const configSheets = configTables;
export function affectedTables(operation: SyncOperation) {
  if (operation.entityKind === 'config') return configSheets[operation.entityId];
  const items = [operation.before, operation.after].filter(Boolean) as BrainDumpItem[];
  return exportCore({ data: items }).filter(sheet => sheet.data.length > 1 && sheet.data[0].includes('_Entity_JSON')).map(sheet => sheet.name);
}
const cell = (value: unknown) => value == null || value === '' ? {} : { userEnteredValue: typeof value === 'number' ? { numberValue: value } : typeof value === 'boolean' ? { boolValue: value } : { stringValue: String(value) } };
const rowData = (row: unknown[]) => ({ values: row.map(cell) });
const update = (sheetId: number, row: number, column: number, values: unknown[]) => ({ updateCells: { start: { sheetId, rowIndex: row, columnIndex: column }, rows: [rowData(values)], fields: 'userEnteredValue' } });

export class DurableSheets {
  constructor(private transport: SheetsTransport = fetchWithServiceAccount) {}
  async json(scope: string, path: string, init?: RequestInit): Promise<any> {
    const response = await this.transport(scope, path, { ...init, signal: AbortSignal.timeout(25_000) });
    if (!response.ok) throw new Error(`Sheets ${response.status}: ${await response.text()}`);
    return response.json();
  }
  async metadata(scope: string) { return this.json(scope, '?fields=spreadsheetId,sheets(properties)'); }
  async ranges(scope: string, names: string[], render = 'UNFORMATTED_VALUE') {
    if (!names.length) return [];
    const query = new URLSearchParams({ valueRenderOption: render, dateTimeRenderOption: 'FORMATTED_STRING' });
    for (const name of names) query.append('ranges', `${quote(name)}!A:ZZ`);
    const ranges = (await this.json(scope, `/values:batchGet?${query}`)).valueRanges;
    if (!Array.isArray(ranges) || ranges.length !== names.length || ranges.some((range, index) =>
      !String(range.range).startsWith(`${quote(names[index])}!`) && !String(range.range).startsWith(`${names[index]}!`) ||
      range.values !== undefined && (!Array.isArray(range.values) || !range.values.every(Array.isArray)))) throw new Error('Incomplete Sheets read; retry without recording a receipt');
    return ranges;
  }
  async receipts(scope: string, operationIds: string[]): Promise<SyncReceipt[]> {
    const metadata = await this.metadata(scope);
    if (!metadata.sheets?.some((sheet: any) => sheet.properties.title === RECEIPT_SHEET)) return [];
    const ranges = await this.ranges(scope, [RECEIPT_SHEET]);
    const wanted = new Set(operationIds);
    return (ranges[0]?.values || []).slice(1).filter((row: any[]) => wanted.has(row[0])).map((row: any[]) => ({ operationId: row[0], state: row[1], error: row[3] || undefined }));
  }
  async refreshReports(scope: string) {
    const metadata = await this.metadata(scope);
    const properties = new Map<string, any>((metadata.sheets || []).map((sheet: any) => [sheet.properties.title, sheet.properties]));
    const names = [...exportCore({ data: [] }).map(sheet => sheet.name), CONFIG_SHEET].filter(name => properties.has(name));
    let ranges = await this.ranges(scope, names);
    if (names.includes('Budget Rules')) {
      const budget = await this.ranges(scope, ['Budget Rules'], 'FORMATTED_VALUE');
      ranges = ranges.map((range: any) => range.range.includes('Budget Rules') ? budget[0] : range);
    }
    const config = parseConfigSheets(ranges);
    const db = applyLosslessConfig(reconcileSpreadsheetData({ data: [], chatHistory: config.chatHistory || [], canonicalRules: config.canonicalRules || [] }, ranges, { authoritativeEmpty: true }), ranges);
    const reports = generateExportData(db.data, db.skills || [], db.wallets || [], db.budgetConfig || { monthlyIncome: 0, rules: [] },
      db.monthlyThemes || {}, db.appSettings || { defaultCollapsed: false, hideMoney: false }, new Date(), { ...db }).filter(sheet => ['Sheet1', 'Data Quality'].includes(sheet.name));
    const requests: any[] = []; let nextSheetId = Math.max(0, ...[...properties.values()].map(p => p.sheetId)) + 1;
    for (const report of reports) {
      let p = properties.get(report.name);
      const width = Math.max(...report.data.map(row => row.length));
      if (!p) {
        p = { sheetId: nextSheetId++, title: report.name, gridProperties: { rowCount: Math.max(1000, report.data.length), columnCount: Math.max(26, width) } };
        requests.push({ addSheet: { properties: p } });
      } else if (p.gridProperties.rowCount < report.data.length || p.gridProperties.columnCount < width) {
        requests.push({ updateSheetProperties: { properties: { sheetId: p.sheetId, gridProperties: {
          rowCount: Math.max(p.gridProperties.rowCount, report.data.length), columnCount: Math.max(p.gridProperties.columnCount, width) } }, fields: 'gridProperties' } });
      }
      const oldRows = (await this.ranges(scope, properties.has(report.name) ? [report.name] : []))[0]?.values?.length || 0;
      requests.push({ updateCells: { range: { sheetId: p.sheetId, startRowIndex: 0, endRowIndex: Math.max(oldRows, report.data.length), startColumnIndex: 0, endColumnIndex: width }, rows: report.data.map(rowData), fields: 'userEnteredValue' } });
    }
    await this.commit(scope, requests);
  }
  /** One queue consumer owns app writes. Entity changes and receipts commit atomically. */
  async apply(operation: SyncOperation): Promise<SyncReceipt> {
    const scope = operation.scope;
    const metadata = await this.metadata(scope);
    const properties = new Map<string, any>((metadata.sheets || []).map((sheet: any) => [sheet.properties.title, sheet.properties]));
    const receiptRanges = properties.has(RECEIPT_SHEET) ? await this.ranges(scope, [RECEIPT_SHEET]) : [];
    const receiptRows: any[][] = receiptRanges[0]?.values || [];
    const existing = receiptRows.find(row => row[0] === operation.operationId);
    if (existing) return { operationId: existing[0], state: existing[1], error: existing[3] || undefined };
    if (operation.parentOperationId) {
      const parent = receiptRows.find(row => row[0] === operation.parentOperationId);
      if (!parent) throw new DeferredDependency('Earlier mutation has not committed yet');
      if (parent[1] !== 'committed') return this.recordConflict(operation, properties, 'Earlier mutation needs conflict review');
    }
    const names = affectedTables(operation);
    const context = ['Wallets Config', 'Skills Config', 'Budget Rules', 'Themes & Settings', CONFIG_SHEET];
    const readable = [...new Set([...names, ...context])].filter(name => properties.has(name));
    const ranges = await this.ranges(scope, readable);
    const formattedBudget = properties.has('Budget Rules') ? await this.ranges(scope, ['Budget Rules'], 'FORMATTED_VALUE') : [];
    const domainRanges = ranges.map((range: any) => range.range.includes('Budget Rules') ? formattedBudget[0] || range : range);
    const parsedConfig = parseConfigSheets(domainRanges);
    const currentDb = applyLosslessConfig(reconcileSpreadsheetData({ data: [], chatHistory: parsedConfig.chatHistory || [], canonicalRules: parsedConfig.canonicalRules || [] }, domainRanges, { authoritativeEmpty: true }), domainRanges);
    const configRows = ranges.find((range: any) => range.range.includes(CONFIG_SHEET))?.values || [];
    const current = operation.entityKind === 'item' ? currentDb.data.find(item => item.id === operation.entityId) ?? null : (currentDb as any)[operation.entityId] ?? null;
    let after: unknown;
    try { after = mergeMutation(operation.before, operation.after, current); }
    catch (error) { if (error instanceof SyncConflict) return this.recordConflict(operation, properties, error.message); throw error; }
    const next = structuredClone(currentDb);
    if (operation.entityKind === 'item') next.data = [...next.data.filter(item => item.id !== operation.entityId), ...(after ? [after as BrainDumpItem] : [])];
    else if (after === null) delete (next as any)[operation.entityId]; else (next as any)[operation.entityId] = after;
    const beforeExport = exportCore(currentDb); const afterExport = exportCore(next);
    const requests: any[] = []; let nextSheetId = Math.max(0, ...[...properties.values()].map(p => p.sheetId)) + 1;
    const ensure = (name: string, header: unknown[]) => {
      if (!properties.has(name)) {
        properties.set(name, { sheetId: nextSheetId++, title: name, gridProperties: { rowCount: 1000, columnCount: Math.max(26, header.length) } });
        requests.push({ addSheet: { properties: { ...properties.get(name), ...(name.startsWith('_Sync_') ? { hidden: true } : {}) } } });
        requests.push(update(properties.get(name).sheetId, 0, 0, header));
      }
      const p = properties.get(name);
      if (p.gridProperties.columnCount < header.length) requests.push({ updateSheetProperties: { properties: { sheetId: p.sheetId, gridProperties: { columnCount: header.length } }, fields: 'gridProperties.columnCount' } });
      return p;
    };
    for (const name of names) {
      const beforeSheet = beforeExport.find(sheet => sheet.name === name)!; const afterSheet = afterExport.find(sheet => sheet.name === name)!;
      const physical: any[][] = ranges.find((range: any) => range.range.startsWith(`${quote(name)}!`) || range.range.startsWith(`${name}!`))?.values || [];
      const header = afterSheet.data[0];
      if (physical.length && !equivalent(physical[0].slice(0, header.length), header)) throw new Error(`MIGRATION_REQUIRED: ${name}`);
      const p = ensure(name, header); const idColumn = header.indexOf('ID');
      if (operation.entityKind === 'item') {
        const matches = physical.flatMap((row, index) => index && row[idColumn] === operation.entityId ? [index] : []);
        if (matches.length > 1) throw new Error(`Duplicate ID in ${name}; repair before replay`);
        const target = afterSheet.data.find((row, index) => index > 0 && row[idColumn] === operation.entityId);
        const old = beforeSheet.data.find((row, index) => index > 0 && row[idColumn] === operation.entityId);
        if (!target) { if (matches.length) requests.push(update(p.sheetId, matches[0], 0, header.map(() => ''))); }
        else if (!matches.length) requests.push({ appendCells: { sheetId: p.sheetId, rows: [rowData(target)], fields: 'userEnteredValue' } });
        else for (let col = 0; col < header.length; col++) if (!equivalent(old?.[col] ?? '', target[col] ?? '')) requests.push(update(p.sheetId, matches[0], col, [target[col]]));
      } else {
        const maxRows = Math.max(beforeSheet.data.length, afterSheet.data.length);
        if (maxRows > p.gridProperties.rowCount) requests.push({ appendDimension: { sheetId: p.sheetId, dimension: 'ROWS', length: maxRows - p.gridProperties.rowCount } });
        for (let row = 1; row < maxRows; row++) for (let col = 0; col < header.length; col++)
          if (!equivalent(beforeSheet.data[row]?.[col] ?? '', afterSheet.data[row]?.[col] ?? '')) requests.push(update(p.sheetId, row, col, [afterSheet.data[row]?.[col] ?? '']));
      }
    }
    if (operation.entityKind === 'config') {
      const p = ensure(CONFIG_SHEET, ['Field', 'JSON']);
      const projectionRanges = afterExport.map(sheet => ({ range: `${quote(sheet.name)}!A:ZZ`, values: sheet.data }));
      const projectedConfig = parseConfigSheets(projectionRanges);
      const projectedDb = reconcileSpreadsheetData({ data: [], chatHistory: projectedConfig.chatHistory || [], canonicalRules: projectedConfig.canonicalRules || [] }, projectionRanges, { authoritativeEmpty: true });
      const row = [operation.entityId, JSON.stringify({ value: after, projected: (projectedDb as any)[operation.entityId] ?? null })];
      if (String(row[1]).length > 49_000) throw new Error('Config exceeds spreadsheet cell limit');
      const index = configRows.findIndex((entry: any[]) => entry[0] === operation.entityId);
      if (index >= 1) requests.push(update(p.sheetId, index, 0, row)); else requests.push({ appendCells: { sheetId: p.sheetId, rows: [rowData(row)], fields: 'userEnteredValue' } });
    }
    const p = ensure(RECEIPT_SHEET, ['Operation_ID', 'State', 'Entity_ID', 'Error', 'Committed_At']);
    requests.push({ appendCells: { sheetId: p.sheetId, rows: [rowData([operation.operationId, 'committed', operation.entityId, '', new Date().toISOString()])], fields: 'userEnteredValue' } });
    await this.commit(scope, requests);
    return { operationId: operation.operationId, state: 'committed' };
  }
  private async recordConflict(operation: SyncOperation, properties: Map<string, any>, error: string): Promise<SyncReceipt> {
    const requests: any[] = [];
    const sheetId = properties.get(RECEIPT_SHEET)?.sheetId ?? Math.max(0, ...[...properties.values()].map(p => p.sheetId)) + 1;
    if (!properties.has(RECEIPT_SHEET)) {
      requests.push({ addSheet: { properties: { sheetId, title: RECEIPT_SHEET, hidden: true } } });
      requests.push(update(sheetId, 0, 0, ['Operation_ID', 'State', 'Entity_ID', 'Error', 'Committed_At']));
    }
    requests.push({ appendCells: { sheetId, rows: [rowData([operation.operationId, 'conflict', operation.entityId, error, new Date().toISOString()])], fields: 'userEnteredValue' } });
    await this.commit(operation.scope, requests);
    return { operationId: operation.operationId, state: 'conflict', error };
  }
  private async commit(scope: string, requests: unknown[]) {
    const body = JSON.stringify({ requests });
    if (Buffer.byteLength(body) > 1_500_000) throw new Error('Atomic mutation exceeds 1.5 MB; reduce config size before replay');
    await this.json(scope, ':batchUpdate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  }
}
