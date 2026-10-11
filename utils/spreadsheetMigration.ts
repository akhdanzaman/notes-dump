import { createHash } from 'node:crypto';
import { ItemType, type DbSchema } from '../types';
import { exportCore } from '../api/_lib/durableSheets';
import { reconcileSpreadsheetData } from '../services/spreadsheetReconciler';
import { parseConfigSheets } from './spreadsheetConfig';
import { applyLosslessConfig, CONFIG_SHEET, configTables } from './losslessConfig';
import { encodeEntity } from './spreadsheetCodec';
export interface WorkbookBackup {
  spreadsheetId: string; spreadsheet: any; valueRanges: any[]; computedRanges: any[]; formattedRanges: any[];
}
const nameOf = (range: string) => range.split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'");
const quote = (name: string) => `'${name.replace(/'/g, "''")}'`;
const cell = (value: any) => value == null || value === '' ? {} : { userEnteredValue: typeof value === 'number' ? { numberValue: value } : typeof value === 'boolean' ? { boolValue: value } : { stringValue: String(value) } };
const gridCell = (backup: WorkbookBackup, title: string, row: number, column: number) => {
  const sheet = backup.spreadsheet.sheets.find((sheet: any) => sheet.properties.title === title);
  for (const grid of sheet?.data || []) {
    const r = row - (grid.startRow || 0); const c = column - (grid.startColumn || 0);
    if (r >= 0 && c >= 0 && grid.rowData?.[r]?.values?.[c]) return grid.rowData[r].values[c];
  }
};
export function rollbackCell(backup: WorkbookBackup, title: string, row: number, column: number, value: unknown) {
  const original = gridCell(backup, title, row, column);
  if (original?.userEnteredValue) return { userEnteredValue: original.userEnteredValue };
  if (typeof value === 'string' && value.startsWith('=')) throw new Error('Typed grid backup required for rollback of formula or literal text');
  return cell(value);
}
export const snapshotHash = (backup: WorkbookBackup) => createHash('sha256').update(JSON.stringify(backup.valueRanges.map(range => [nameOf(range.range), range.values || []]))).digest('hex');
export function readBackupDomain(backup: WorkbookBackup): DbSchema {
  const names = new Set([...exportCore({ data: [] }).map(sheet => sheet.name), CONFIG_SHEET]);
  const ranges = backup.computedRanges.filter(range => names.has(nameOf(range.range))).map(range => nameOf(range.range) === 'Budget Rules'
    ? backup.formattedRanges.find(formatted => nameOf(formatted.range) === 'Budget Rules') || range : range);
  const config = parseConfigSheets(ranges);
  return applyLosslessConfig(reconcileSpreadsheetData({ data: [], wallets: config.wallets, skills: config.skills, budgetConfig: config.budgetConfig,
    chatHistory: config.chatHistory || [], canonicalRules: config.canonicalRules || [], customPrompt: config.customPrompt,
    monthlyThemes: config.monthlyThemes, monthlyThemeImages: config.monthlyThemeImages, appSettings: config.appSettings }, ranges, { authoritativeEmpty: true }), ranges);
}
/** Dry run preserves existing values/formulas, IDs, row order and unrelated sheets. */
export function buildMigrationPlan(backup: WorkbookBackup) {
  const db = readBackupDomain(backup);
  const txRange = backup.computedRanges.find(range => nameOf(range.range) === 'Transactions');
  const transactionCopies = txRange ? reconcileSpreadsheetData({ ...structuredClone(db), data: [] }, [txRange], { authoritativeEmpty: true }).data : [];
  const mirrors = new Set<string>();
  for (const item of db.data.filter(item => item.type === ItemType.SHOPPING && item.status === 'done')) {
    const copy = transactionCopies.find(copy => copy.id === item.id);
    if (!copy) continue;
    if (copy.content !== item.content || copy.meta.amount !== item.meta.amount) throw new Error('Divergent completed-shopping mirror requires manual review');
    for (const field of ['paymentMethod', 'budgetCategory', 'currency']) if ((copy.meta as any)[field] && (item.meta as any)[field] && (copy.meta as any)[field] !== (item.meta as any)[field]) throw new Error(`Divergent mirror ${field} requires manual review`);
    item.meta = { ...copy.meta, ...Object.fromEntries(Object.entries(item.meta).filter(([, value]) => value !== undefined)) };
    mirrors.add(item.id);
  }
  const sheets = exportCore(db); const byId = new Map(db.data.map(item => [item.id, item]));
  const seen = new Set<string>(); const requests: any[] = []; const tables: any[] = [];
  const archivedRows: any[] = [];
  const properties = new Map<string, any>(backup.spreadsheet.sheets.map((sheet: any) => [sheet.properties.title, sheet.properties]));
  let nextId = Math.max(0, ...[...properties.values()].map(p => p.sheetId)) + 1;
  for (const sheet of sheets.filter(sheet => sheet.data[0].includes('_Entity_JSON'))) {
    const physical = backup.valueRanges.find(range => nameOf(range.range) === sheet.name)?.values;
    if (!physical) { tables.push({ name: sheet.name, action: 'lazy-create-on-first-write', rows: 0 }); continue; }
    const header = sheet.data[0]; const oldHeader: string[] = physical[0]?.map(String) || [];
    const unknown = oldHeader.filter(column => column && !header.includes(column));
    if (unknown.length) throw new Error(`${sheet.name}: unknown columns require mapping: ${unknown.join(', ')}`);
    const oldId = oldHeader.indexOf('ID'); const newId = header.indexOf('ID'); const jsonColumn = header.indexOf('_Entity_JSON');
    if (oldId < 0) throw new Error(`${sheet.name}: ID column is required before migration`);
    const p = properties.get(sheet.name); const width = header.length;
    if (p.gridProperties.columnCount < width) requests.push({ updateSheetProperties: { properties: { sheetId: p.sheetId, gridProperties: { columnCount: width } }, fields: 'gridProperties.columnCount' } });
    let migratedRows = 0;
    for (let index = 0; index < physical.length; index++) {
      const row = physical[index]; if (index && row.every((value: any) => value == null || value === '')) continue;
      let values: any[];
      if (!index) values = header;
      else {
        const id = String(row[oldId] || '');
        if (!id || !byId.has(id)) throw new Error(`${sheet.name} row ${index + 1}: missing or unreadable ID; migration stopped`);
        const exported = sheet.data.find((candidate, i) => i > 0 && String(candidate[newId]) === id);
        if (!exported && sheet.name === 'Shopping' && mirrors.has(id) && seen.has(id)) {
          const computed = backup.computedRanges.find(range => nameOf(range.range) === sheet.name)?.values[index];
          archivedRows.push({ sheet: sheet.name, row: index + 1, id, header: oldHeader, raw: row, computed, reason: 'completed-shopping mirror; active entity retained in Transactions' });
          requests.push({ updateCells: { start: { sheetId: p.sheetId, rowIndex: index, columnIndex: 0 }, rows: [{ values: header.map(() => ({})) }], fields: 'userEnteredValue' } });
          continue;
        }
        if (!exported || seen.has(id)) throw new Error(`${sheet.name} row ${index + 1}: duplicate or changed ownership; review before migration`);
        seen.add(id);
        values = header.map((column, position) => oldHeader.includes(String(column)) ? row[oldHeader.indexOf(String(column))] ?? '' : exported[position] ?? '');
        values[jsonColumn] = encodeEntity(byId.get(id)!); values[header.indexOf('_Schema')] = 3; migratedRows++;
      }
      const typed = values.map((value, column) => {
        if (!index || column >= jsonColumn) return cell(value);
        const oldColumn = oldHeader.indexOf(String(header[column]));
        const original = oldColumn >= 0 ? gridCell(backup, sheet.name, index, oldColumn) : undefined;
        if (original?.userEnteredValue) return { userEnteredValue: original.userEnteredValue };
        if (typeof value === 'string' && value.startsWith('=') && oldColumn >= 0) throw new Error(`${sheet.name} row ${index + 1}: typed grid backup required to distinguish formula from literal text`);
        return cell(value);
      });
      requests.push({ updateCells: { start: { sheetId: p.sheetId, rowIndex: index, columnIndex: 0 }, rows: [{ values: typed }], fields: 'userEnteredValue' } });
    }
    requests.push({ updateDimensionProperties: { range: { sheetId: p.sheetId, dimension: 'COLUMNS', startIndex: jsonColumn, endIndex: jsonColumn + 2 }, properties: { hiddenByUser: true }, fields: 'hiddenByUser' } });
    tables.push({ name: sheet.name, rows: migratedRows, action: 'schema-v3; preserve existing cells and formulas' });
  }
  if (seen.size !== db.data.length) throw new Error('Not every decoded entity has a stable physical row; migration stopped');
  const projectedConfig = parseConfigSheets(sheets.map(sheet => ({ range: `${quote(sheet.name)}!A:ZZ`, values: sheet.data })));
  const projected = reconcileSpreadsheetData({ data: [], chatHistory: projectedConfig.chatHistory || [], canonicalRules: projectedConfig.canonicalRules || [] }, sheets.map(sheet => ({ range: `${quote(sheet.name)}!A:ZZ`, values: sheet.data })), { authoritativeEmpty: true });
  const configRows: any[][] = [['Field', 'JSON']];
  for (const field of Object.keys(configTables)) {
    const value = (db as any)[field] ?? null;
    const json = JSON.stringify({ value, projected: (projected as any)[field] ?? null });
    if (json.length > 49_000) throw new Error(`Config ${field} exceeds the cell limit`);
    configRows.push([field, json]);
  }
  const configId = properties.get(CONFIG_SHEET)?.sheetId ?? nextId++;
  if (!properties.has(CONFIG_SHEET)) requests.push({ addSheet: { properties: { title: CONFIG_SHEET, sheetId: configId, hidden: true } } });
  requests.push({ updateCells: { start: { sheetId: configId, rowIndex: 0, columnIndex: 0 }, rows: configRows.map(row => ({ values: row.map(cell) })), fields: 'userEnteredValue' } });
  if (archivedRows.length) {
    const archiveId = properties.get('_Sync_Migration_Archive')?.sheetId ?? nextId++;
    if (!properties.has('_Sync_Migration_Archive')) requests.push({ addSheet: { properties: { title: '_Sync_Migration_Archive', sheetId: archiveId, hidden: true } } });
    const rows = [['Original_Sheet', 'Original_Row', 'Entity_ID', 'Original_JSON'], ...archivedRows.map(row => [row.sheet, row.row, row.id, JSON.stringify(row)])];
    if (rows.some(row => String(row[3]).length > 49_000)) throw new Error('Archive row exceeds the cell limit');
    requests.push({ updateCells: { start: { sheetId: archiveId, rowIndex: 0, columnIndex: 0 }, rows: rows.map(row => ({ values: row.map(cell) })), fields: 'userEnteredValue' } });
  }
  return { schema: 3, beforeHash: snapshotHash(backup), entityCount: db.data.length, archivedRows, tables, requests, db };
}
