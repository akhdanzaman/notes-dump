import {
  applyLosslessConfig,
  CONFIG_SHEET,
  configTables,
} from '../../utils/losslessConfig.js';
import type { DbSchema, BrainDumpItem } from '../../types.js';
import { generateExportData, type SheetData } from '../../utils/exportUtils.js';
import { reconcileSpreadsheetData } from '../../services/spreadsheetReconciler.js';
import { parseConfigSheets } from '../../utils/spreadsheetConfig.js';
import {
  mergeMutation,
  SyncConflict,
  DeferredDependency,
  type SyncOperation,
  type SyncReceipt,
  equivalent,
} from '../../utils/syncProtocol.js';
import { fetchWithServiceAccount } from './googleServiceAccount.js';
import {
  SyncCache,
  syncCache,
  receiptKey,
  receiptEntries,
  scopeKey,
  QuotaDeferred,
} from './syncCoordination.js';
import { operationTables } from '../../utils/syncTables.js';

export const RECEIPT_SHEET = '_Sync_Receipts';
export { CONFIG_SHEET };
export type SheetsTransport = (
  scope: string,
  path: string,
  init?: RequestInit,
) => Promise<Response>;
const quote = (name: string) => `'${name.replace(/'/g, "''")}'`;
export const exportCore = (db: DbSchema): SheetData[] =>
  generateExportData(
    db.data,
    db.skills || [],
    db.wallets || [],
    db.budgetConfig || { monthlyIncome: 0, rules: [] },
    db.monthlyThemes || {},
    db.appSettings || { defaultCollapsed: false, hideMoney: false },
    new Date(),
    { ...db, includeDerived: false },
  );
const configSheets = configTables;
export const affectedTables = operationTables;
const cell = (value: unknown) =>
  value == null || value === ''
    ? {}
    : {
        userEnteredValue:
          typeof value === 'number'
            ? { numberValue: value }
            : typeof value === 'boolean'
              ? { boolValue: value }
              : { stringValue: String(value) },
      };
const rowData = (row: unknown[]) => ({ values: row.map(cell) });
const update = (
  sheetId: number,
  row: number,
  column: number,
  values: unknown[],
) => ({
  updateCells: {
    start: { sheetId, rowIndex: row, columnIndex: column },
    rows: [rowData(values)],
    fields: 'userEnteredValue',
  },
});
const contextTables = (operations: SyncOperation[]) =>
  operations.every(
    (operation) =>
      operation.entityKind === 'item' &&
      affectedTables(operation).every((name) =>
        ['Notes & Journals', 'Events'].includes(name),
      ),
  )
    ? []
    : [
        'Wallets Config',
        'Skills Config',
        'Budget Rules',
        'Themes & Settings',
        CONFIG_SHEET,
      ];
const columnLabel = (count: number) => {
  let label = '';
  for (let n = count; n > 0; n = Math.floor((n - 1) / 26))
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  return label;
};
const widths = new Map(
  exportCore({ data: [] }).map((sheet) => [sheet.name, sheet.data[0].length]),
);
widths.set(RECEIPT_SHEET, 5);
widths.set(CONFIG_SHEET, 2);

export class DurableSheets {
  readonly requestCounts = { reads: 0, writes: 0 };
  constructor(
    private transport: SheetsTransport = fetchWithServiceAccount,
    private cache: SyncCache | undefined = transport === fetchWithServiceAccount
      ? syncCache
      : undefined,
  ) {}
  async json(scope: string, path: string, init?: RequestInit): Promise<any> {
    const response = await this.transport(scope, path, {
      ...init,
      signal: AbortSignal.timeout(25_000),
    });
    this.requestCounts[init?.method === 'POST' ? 'writes' : 'reads']++;
    if (!response.ok)
      throw new Error(`Sheets ${response.status}: ${await response.text()}`);
    return response.json();
  }
  async metadata(scope: string) {
    return this.json(scope, '?fields=spreadsheetId,sheets(properties)');
  }
  async ranges(scope: string, names: string[], render = 'UNFORMATTED_VALUE') {
    if (!names.length) return [];
    const query = new URLSearchParams({
      valueRenderOption: render,
      dateTimeRenderOption: 'FORMATTED_STRING',
    });
    for (const name of names)
      query.append(
        'ranges',
        `${quote(name)}!A:${columnLabel(widths.get(name) || 702)}`,
      );
    const ranges = (await this.json(scope, `/values:batchGet?${query}`))
      .valueRanges;
    if (
      !Array.isArray(ranges) ||
      ranges.length !== names.length ||
      ranges.some(
        (range, index) =>
          (!String(range.range).startsWith(`${quote(names[index])}!`) &&
            !String(range.range).startsWith(`${names[index]}!`)) ||
          (range.values !== undefined &&
            (!Array.isArray(range.values) ||
              !range.values.every(Array.isArray))),
      )
    )
      throw new Error(
        'Incomplete Sheets read; retry without recording a receipt',
      );
    return ranges;
  }
  async receipts(
    scope: string,
    operationIds: string[],
  ): Promise<SyncReceipt[]> {
    if (!operationIds.length) return [];
    const cached = await this.cache?.getMany<{
      operationId: string;
      state: string;
      error?: string;
    }>(operationIds.map((id) => receiptKey(scope, id)));
    const terminal = (cached || []).filter(
      (receipt) => receipt && ['committed', 'conflict'].includes(receipt.state),
    ) as SyncReceipt[];
    if (cached?.every(Boolean)) return terminal;
    const recoveryKey = `${scopeKey(scope)}:receipt-recovery`;
    if (await this.cache?.get(recoveryKey)) return terminal;
    const lock = await this.cache?.lock(`${recoveryKey}:lock`);
    if (this.cache && !lock) return terminal;
    try {
      const ranges = await this.ranges(scope, [RECEIPT_SHEET]);
      const all = (ranges[0]?.values || [])
        .slice(1)
        .map((row: any[]) => ({
          operationId: row[0],
          state: row[1],
          error: row[3] || undefined,
        }))
        .filter(
          (receipt: any) =>
            receipt.operationId &&
            ['committed', 'conflict'].includes(receipt.state),
        ) as SyncReceipt[];
      await this.cache?.setMany(receiptEntries(scope, all), 604800);
      await this.cache?.set(recoveryKey, true, 30);
      const wanted = new Set(operationIds);
      return all.filter((receipt) => wanted.has(receipt.operationId));
    } finally {
      if (lock) await this.cache?.unlock(`${recoveryKey}:lock`, lock);
    }
  }
  /** Share one authoritative read snapshot and one atomic write for up to 20 mutations. */
  async applyBatch(operations: SyncOperation[]): Promise<SyncReceipt[]> {
    if (!operations.length || operations.length > 20)
      throw new Error('Send 1–20 operations');
    const scope = operations[0].scope;
    if (
      operations.some((operation) => operation.scope !== scope) ||
      new Set(operations.map((operation) => operation.operationId)).size !==
        operations.length
    )
      throw new Error('Mixed scopes or duplicate operation IDs');
    const keys = operations.map((operation) =>
      receiptKey(scope, operation.operationId),
    );
    const cached = await this.cache?.getMany<SyncReceipt>(keys);
    if (
      cached?.every(
        (receipt) =>
          receipt && ['committed', 'conflict'].includes(receipt.state),
      )
    ) {
      await this.cache?.publish(scope, cached as SyncReceipt[], [
        ...new Set(
          operations
            .filter((_, index) => cached[index]?.state === 'committed')
            .flatMap(affectedTables),
        ),
      ]);
      return cached as SyncReceipt[];
    }
    const metadata = await this.metadata(scope);
    const properties = (metadata.sheets || []).map(
      (sheet: any) => sheet.properties,
    );
    const context = [...contextTables(operations), RECEIPT_SHEET];
    const names = [
      ...new Set([...operations.flatMap(affectedTables), ...context]),
    ].filter((name) => properties.some((p: any) => p.title === name));
    const ranges = await this.ranges(scope, names);
    const formattedBudget = names.includes('Budget Rules')
      ? await this.ranges(scope, ['Budget Rules'], 'FORMATTED_VALUE')
      : [];
    const workbook = new Map<string, { properties: any; values: any[][] }>(
      properties.map((p: any) => [
        p.title,
        {
          properties: structuredClone(p),
          values: structuredClone(
            ranges.find(
              (range: any) =>
                String(range.range).startsWith(`${quote(p.title)}!`) ||
                String(range.range).startsWith(`${p.title}!`),
            )?.values || [],
          ),
        },
      ]),
    );
    const requests: any[] = [];
    const staged = new DurableSheets(async (_scope, path, init) => {
      if (path.startsWith('?'))
        return Response.json({
          sheets: [...workbook.values()].map((sheet) => ({
            properties: sheet.properties,
          })),
        });
      if (path.startsWith('/values:batchGet')) {
        const query = new URLSearchParams(path.split('?')[1]);
        return Response.json({
          valueRanges: query.getAll('ranges').map((range) => {
            const name = range
              .match(/^'((?:[^']|'')+)'!/)?.[1]
              .replace(/''/g, "'");
            const values =
              query.get('valueRenderOption') === 'FORMATTED_VALUE' &&
              name === 'Budget Rules'
                ? formattedBudget[0]?.values
                : workbook.get(name || '')?.values;
            return { range, values: values || [] };
          }),
        });
      }
      if (path !== ':batchUpdate')
        throw new Error('Unexpected staged Sheets request');
      const additions = JSON.parse(String(init?.body)).requests;
      requests.push(...additions);
      for (const request of additions) {
        if (request.addSheet) {
          const p = request.addSheet.properties;
          workbook.set(p.title, {
            properties: {
              ...p,
              gridProperties: {
                rowCount: 1000,
                columnCount: 26,
                ...p.gridProperties,
              },
            },
            values: [],
          });
        }
        const find = (id: number) =>
          [...workbook.values()].find(
            (sheet) => sheet.properties.sheetId === id,
          )!;
        if (request.updateSheetProperties) {
          const p = request.updateSheetProperties.properties;
          Object.assign(
            find(p.sheetId).properties.gridProperties,
            p.gridProperties,
          );
        }
        if (request.appendDimension)
          find(
            request.appendDimension.sheetId,
          ).properties.gridProperties.rowCount +=
            request.appendDimension.length;
        if (request.updateCells) {
          const action = request.updateCells;
          const sheet = find(action.start.sheetId);
          for (const [offset, row] of action.rows.entries()) {
            const target = (sheet.values[action.start.rowIndex + offset] ||=
              []);
            for (const [col, value] of row.values.entries()) {
              const next = (value as any).userEnteredValue
                ? Object.values((value as any).userEnteredValue)[0]
                : '';
              target[action.start.columnIndex + col] = next;
              if (
                sheet.properties.title === 'Budget Rules' &&
                formattedBudget[0]
              ) {
                const formatted = (formattedBudget[0].values[
                  action.start.rowIndex + offset
                ] ||= []);
                formatted[action.start.columnIndex + col] = next;
              }
            }
          }
        }
      }
      return Response.json({ replies: [] });
    });
    const result = new Map<string, SyncReceipt>();
    const remaining = [...operations];
    while (remaining.length) {
      const index = remaining.findIndex(
        (operation) =>
          !operation.parentOperationId ||
          !remaining.some(
            (parent) => parent.operationId === operation.parentOperationId,
          ),
      );
      if (index < 0) throw new Error('Cyclic mutation dependency');
      const [operation] = remaining.splice(index, 1);
      result.set(operation.operationId, await staged.apply(operation));
    }
    // No simulated receipt is published if any mutation fails before this atomic commit.
    if (requests.length) await this.commit(scope, requests);
    const receipts = operations.map(
      (operation) => result.get(operation.operationId)!,
    );
    await this.cache?.publish(scope, receipts, [
      ...new Set(
        operations
          .filter(
            (operation) =>
              result.get(operation.operationId)?.state === 'committed',
          )
          .flatMap(affectedTables),
      ),
    ]);
    return receipts;
  }
  async refreshReports(scope: string) {
    const metadata = await this.metadata(scope);
    const properties = new Map<string, any>(
      (metadata.sheets || []).map((sheet: any) => [
        sheet.properties.title,
        sheet.properties,
      ]),
    );
    const names = [
      ...exportCore({ data: [] }).map((sheet) => sheet.name),
      CONFIG_SHEET,
    ].filter((name) => properties.has(name));
    let ranges = await this.ranges(scope, names);
    if (names.includes('Budget Rules')) {
      const budget = await this.ranges(
        scope,
        ['Budget Rules'],
        'FORMATTED_VALUE',
      );
      ranges = ranges.map((range: any) =>
        range.range.includes('Budget Rules') ? budget[0] : range,
      );
    }
    const config = parseConfigSheets(ranges);
    const db = applyLosslessConfig(
      reconcileSpreadsheetData(
        {
          data: [],
          chatHistory: config.chatHistory || [],
          canonicalRules: config.canonicalRules || [],
        },
        ranges,
        { authoritativeEmpty: true },
      ),
      ranges,
    );
    const reports = generateExportData(
      db.data,
      db.skills || [],
      db.wallets || [],
      db.budgetConfig || { monthlyIncome: 0, rules: [] },
      db.monthlyThemes || {},
      db.appSettings || { defaultCollapsed: false, hideMoney: false },
      new Date(),
      { ...db },
    ).filter((sheet) => ['Sheet1', 'Data Quality'].includes(sheet.name));
    const requests: any[] = [];
    let nextSheetId =
      Math.max(0, ...[...properties.values()].map((p) => p.sheetId)) + 1;
    for (const report of reports) {
      let p = properties.get(report.name);
      const width = Math.max(...report.data.map((row) => row.length));
      if (!p) {
        p = {
          sheetId: nextSheetId++,
          title: report.name,
          gridProperties: {
            rowCount: Math.max(1000, report.data.length),
            columnCount: Math.max(26, width),
          },
        };
        requests.push({ addSheet: { properties: p } });
      } else if (
        p.gridProperties.rowCount < report.data.length ||
        p.gridProperties.columnCount < width
      ) {
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId: p.sheetId,
              gridProperties: {
                rowCount: Math.max(
                  p.gridProperties.rowCount,
                  report.data.length,
                ),
                columnCount: Math.max(p.gridProperties.columnCount, width),
              },
            },
            fields: 'gridProperties',
          },
        });
      }
      const oldRows =
        (
          await this.ranges(
            scope,
            properties.has(report.name) ? [report.name] : [],
          )
        )[0]?.values?.length || 0;
      requests.push({
        updateCells: {
          range: {
            sheetId: p.sheetId,
            startRowIndex: 0,
            endRowIndex: Math.max(oldRows, report.data.length),
            startColumnIndex: 0,
            endColumnIndex: width,
          },
          rows: report.data.map(rowData),
          fields: 'userEnteredValue',
        },
      });
    }
    await this.commit(scope, requests);
  }
  /** One queue consumer owns app writes. Entity changes and receipts commit atomically. */
  async apply(operation: SyncOperation): Promise<SyncReceipt> {
    const scope = operation.scope;
    const metadata = await this.metadata(scope);
    const properties = new Map<string, any>(
      (metadata.sheets || []).map((sheet: any) => [
        sheet.properties.title,
        sheet.properties,
      ]),
    );
    const receiptRanges = properties.has(RECEIPT_SHEET)
      ? await this.ranges(scope, [RECEIPT_SHEET])
      : [];
    const receiptRows: any[][] = receiptRanges[0]?.values || [];
    const existing = receiptRows.find(
      (row) => row[0] === operation.operationId,
    );
    if (existing)
      return {
        operationId: existing[0],
        state: existing[1],
        error: existing[3] || undefined,
      };
    if (operation.parentOperationId) {
      const parent = receiptRows.find(
        (row) => row[0] === operation.parentOperationId,
      );
      if (!parent)
        throw new DeferredDependency('Earlier mutation has not committed yet');
      if (parent[1] !== 'committed')
        return this.recordConflict(
          operation,
          properties,
          'Earlier mutation needs conflict review',
          receiptRows.length,
        );
    }
    const names = affectedTables(operation);
    const context = contextTables([operation]);
    const readable = [...new Set([...names, ...context])].filter((name) =>
      properties.has(name),
    );
    const ranges = await this.ranges(scope, readable);
    const formattedBudget = readable.includes('Budget Rules')
      ? await this.ranges(scope, ['Budget Rules'], 'FORMATTED_VALUE')
      : [];
    const domainRanges = ranges.map((range: any) =>
      range.range.includes('Budget Rules')
        ? formattedBudget[0] || range
        : range,
    );
    const parsedConfig = parseConfigSheets(domainRanges);
    const currentDb = applyLosslessConfig(
      reconcileSpreadsheetData(
        {
          data: [],
          chatHistory: parsedConfig.chatHistory || [],
          canonicalRules: parsedConfig.canonicalRules || [],
        },
        domainRanges,
        { authoritativeEmpty: true },
      ),
      domainRanges,
    );
    const configRows =
      ranges.find((range: any) => range.range.includes(CONFIG_SHEET))?.values ||
      [];
    const current =
      operation.entityKind === 'item'
        ? (currentDb.data.find((item) => item.id === operation.entityId) ??
          null)
        : ((currentDb as any)[operation.entityId] ?? null);
    let after: unknown;
    try {
      after = mergeMutation(operation.before, operation.after, current);
    } catch (error) {
      if (error instanceof SyncConflict)
        return this.recordConflict(
          operation,
          properties,
          error.message,
          receiptRows.length,
        );
      throw error;
    }
    const next = structuredClone(currentDb);
    if (operation.entityKind === 'item')
      next.data = [
        ...next.data.filter((item) => item.id !== operation.entityId),
        ...(after ? [after as BrainDumpItem] : []),
      ];
    else if (after === null) delete (next as any)[operation.entityId];
    else (next as any)[operation.entityId] = after;
    const beforeExport = exportCore(currentDb);
    const afterExport = exportCore(next);
    const requests: any[] = [];
    let nextSheetId =
      Math.max(0, ...[...properties.values()].map((p) => p.sheetId)) + 1;
    const ensure = (name: string, header: unknown[], writeHeader = false) => {
      if (!properties.has(name)) {
        properties.set(name, {
          sheetId: nextSheetId++,
          title: name,
          gridProperties: {
            rowCount: 1000,
            columnCount: Math.max(26, header.length),
          },
        });
        requests.push({
          addSheet: {
            properties: {
              ...properties.get(name),
              ...(name.startsWith('_Sync_') ? { hidden: true } : {}),
            },
          },
        });
        requests.push(update(properties.get(name).sheetId, 0, 0, header));
      } else if (writeHeader) {
        requests.push(update(properties.get(name).sheetId, 0, 0, header));
      }
      const p = properties.get(name);
      if (p.gridProperties.columnCount < header.length)
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId: p.sheetId,
              gridProperties: { columnCount: header.length },
            },
            fields: 'gridProperties.columnCount',
          },
        });
      return p;
    };
    const append = (p: any, rows: number, values: unknown[]) => {
      const row = Math.max(1, rows);
      if (row >= p.gridProperties.rowCount)
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId: p.sheetId,
              gridProperties: { rowCount: row + 250 },
            },
            fields: 'gridProperties.rowCount',
          },
        });
      requests.push(update(p.sheetId, row, 0, values));
    };
    for (const name of names) {
      const beforeSheet = beforeExport.find((sheet) => sheet.name === name)!;
      const afterSheet = afterExport.find((sheet) => sheet.name === name)!;
      const physical: any[][] =
        ranges.find(
          (range: any) =>
            range.range.startsWith(`${quote(name)}!`) ||
            range.range.startsWith(`${name}!`),
        )?.values || [];
      const header = afterSheet.data[0];
      if (
        physical.length &&
        !equivalent(physical[0].slice(0, header.length), header)
      )
        throw new Error(`MIGRATION_REQUIRED: ${name}`);
      const p = ensure(name, header, physical.length === 0);
      const idColumn = header.indexOf('ID');
      if (operation.entityKind === 'item') {
        const matches = physical.flatMap((row, index) =>
          index && row[idColumn] === operation.entityId ? [index] : [],
        );
        if (matches.length > 1)
          throw new Error(`Duplicate ID in ${name}; repair before replay`);
        const target = afterSheet.data.find(
          (row, index) => index > 0 && row[idColumn] === operation.entityId,
        );
        const old = beforeSheet.data.find(
          (row, index) => index > 0 && row[idColumn] === operation.entityId,
        );
        if (!target) {
          if (matches.length)
            requests.push(
              update(
                p.sheetId,
                matches[0],
                0,
                header.map(() => ''),
              ),
            );
        } else if (!matches.length) append(p, physical.length, target);
        else
          for (let col = 0; col < header.length; col++)
            if (!equivalent(old?.[col] ?? '', target[col] ?? ''))
              requests.push(update(p.sheetId, matches[0], col, [target[col]]));
      } else {
        const maxRows = Math.max(
          beforeSheet.data.length,
          afterSheet.data.length,
        );
        if (maxRows > p.gridProperties.rowCount)
          requests.push({
            appendDimension: {
              sheetId: p.sheetId,
              dimension: 'ROWS',
              length: maxRows - p.gridProperties.rowCount,
            },
          });
        for (let row = 1; row < maxRows; row++)
          for (let col = 0; col < header.length; col++)
            if (
              !equivalent(
                beforeSheet.data[row]?.[col] ?? '',
                afterSheet.data[row]?.[col] ?? '',
              )
            )
              requests.push(
                update(p.sheetId, row, col, [
                  afterSheet.data[row]?.[col] ?? '',
                ]),
              );
      }
    }
    if (operation.entityKind === 'config') {
      const p = ensure(
        CONFIG_SHEET,
        ['Field', 'JSON'],
        configRows.length === 0,
      );
      const projectionRanges = afterExport.map((sheet) => ({
        range: `${quote(sheet.name)}!A:ZZ`,
        values: sheet.data,
      }));
      const projectedConfig = parseConfigSheets(projectionRanges);
      const projectedDb = reconcileSpreadsheetData(
        {
          data: [],
          chatHistory: projectedConfig.chatHistory || [],
          canonicalRules: projectedConfig.canonicalRules || [],
        },
        projectionRanges,
        { authoritativeEmpty: true },
      );
      const row = [
        operation.entityId,
        JSON.stringify({
          value: after,
          projected: (projectedDb as any)[operation.entityId] ?? null,
        }),
      ];
      if (String(row[1]).length > 49_000)
        throw new Error('Config exceeds spreadsheet cell limit');
      const index = configRows.findIndex(
        (entry: any[]) => entry[0] === operation.entityId,
      );
      if (index >= 1) requests.push(update(p.sheetId, index, 0, row));
      else append(p, configRows.length, row);
    }
    const p = ensure(
      RECEIPT_SHEET,
      ['Operation_ID', 'State', 'Entity_ID', 'Error', 'Committed_At'],
      receiptRows.length === 0,
    );
    append(p, receiptRows.length, [
      operation.operationId,
      'committed',
      operation.entityId,
      '',
      new Date().toISOString(),
    ]);
    await this.commit(scope, requests);
    return { operationId: operation.operationId, state: 'committed' };
  }
  private async recordConflict(
    operation: SyncOperation,
    properties: Map<string, any>,
    error: string,
    receiptCount: number,
  ): Promise<SyncReceipt> {
    const requests: any[] = [];
    const sheetId =
      properties.get(RECEIPT_SHEET)?.sheetId ??
      Math.max(0, ...[...properties.values()].map((p) => p.sheetId)) + 1;
    if (!properties.has(RECEIPT_SHEET)) {
      requests.push({
        addSheet: {
          properties: { sheetId, title: RECEIPT_SHEET, hidden: true },
        },
      });
    }
    if (!properties.has(RECEIPT_SHEET) || !receiptCount) {
      requests.push(
        update(sheetId, 0, 0, [
          'Operation_ID',
          'State',
          'Entity_ID',
          'Error',
          'Committed_At',
        ]),
      );
    }
    const row = Math.max(1, receiptCount);
    const capacity =
      properties.get(RECEIPT_SHEET)?.gridProperties.rowCount || 1000;
    if (row >= capacity)
      requests.push({
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { rowCount: row + 250 } },
          fields: 'gridProperties.rowCount',
        },
      });
    requests.push(
      update(sheetId, row, 0, [
        operation.operationId,
        'conflict',
        operation.entityId,
        error,
        new Date().toISOString(),
      ]),
    );
    await this.commit(operation.scope, requests);
    return { operationId: operation.operationId, state: 'conflict', error };
  }
  private async commit(scope: string, requests: unknown[]) {
    const body = JSON.stringify({ requests });
    if (Buffer.byteLength(body) > 1_500_000)
      throw new Error(
        'Atomic mutation exceeds 1.5 MB; reduce config size before replay',
      );
    await this.json(scope, ':batchUpdate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  }
}
