import assert from 'node:assert/strict';
import {
  DurableSheets,
  exportCore,
  RECEIPT_SHEET,
} from '../../../api/_lib/durableSheets';
import { applyLosslessConfig } from '../../../utils/losslessConfig';
import { reconcileSpreadsheetData } from '../../spreadsheetReconciler';
import { ItemType } from '../../../types';
const note = (id = 'one') => ({
  id,
  type: ItemType.NOTE,
  content: 'old',
  status: 'pending' as const,
  created_at: '2026-10-01T00:00:00.000Z',
  meta: {},
});
export function workbook(items = [note()]) {
  let sheets = exportCore({ data: items }).map((sheet, index) => ({
    properties: {
      title: sheet.name,
      sheetId: index + 1,
      gridProperties: {
        rowCount: 1000,
        columnCount: Math.max(26, sheet.data[0].length),
      },
    },
    values: sheet.data as unknown[][],
  }));
  let writes = 0;
  let loseResponse = false;
  const reads: string[] = [];
  const calls: { path: string; kind: string }[] = [];
  const transport = async (
    _scope: string,
    path: string,
    init?: RequestInit,
  ) => {
    calls.push({ path, kind: init?.method === 'POST' ? 'write' : 'read' });
    if (path.startsWith('?'))
      return Response.json({
        sheets: sheets.map((sheet) => ({ properties: sheet.properties })),
      });
    if (path.startsWith('/values:batchGet')) {
      const query = new URLSearchParams(path.split('?')[1]);
      return Response.json({
        valueRanges: query.getAll('ranges').map((range) => {
          const name = range.match(/^'(.+)'!/)![1].replace(/''/g, "'");
          reads.push(name);
          return {
            range,
            values:
              sheets.find((sheet) => sheet.properties.title === name)?.values ||
              [],
          };
        }),
      });
    }
    assert.equal(path, ':batchUpdate');
    const requests = JSON.parse(String(init?.body)).requests;
    const next = structuredClone(sheets);
    for (const request of requests) {
      if (request.addSheet)
        next.push({
          properties: {
            ...request.addSheet.properties,
            gridProperties: {
              rowCount: 1000,
              columnCount: 26,
              ...request.addSheet.properties.gridProperties,
            },
          },
          values: [],
        });
      if (request.updateCells || request.appendCells) {
        const action = request.updateCells || request.appendCells;
        const sheet = next.find(
          (sheet) =>
            sheet.properties.sheetId ===
            (action.sheetId ?? action.start.sheetId),
        )!;
        const rowStart = request.appendCells
          ? Math.max(1, sheet.values.length)
          : action.start.rowIndex;
        for (const [offset, row] of action.rows.entries()) {
          const target = (sheet.values[rowStart + offset] ||= []);
          for (const [column, cell] of row.values.entries())
            target[(action.start?.columnIndex || 0) + column] =
              cell.userEnteredValue
                ? Object.values(cell.userEnteredValue)[0]
                : '';
        }
      }
      if (request.updateSheetProperties) {
        const p = request.updateSheetProperties.properties;
        Object.assign(
          next.find((sheet) => sheet.properties.sheetId === p.sheetId)!
            .properties.gridProperties,
          p.gridProperties,
        );
      }
    }
    sheets = next;
    writes++;
    if (loseResponse) {
      loseResponse = false;
      throw new Error('Connection lost AFTER commit');
    }
    return Response.json({ replies: [] });
  };
  const repository = new DurableSheets(transport);
  const current = () => {
    const ranges = sheets.map((sheet) => ({
      range: `'${sheet.properties.title}'!A:ZZ`,
      values: sheet.values,
    }));
    return applyLosslessConfig(
      reconcileSpreadsheetData({ data: [] }, ranges, {
        authoritativeEmpty: true,
      }),
      ranges,
    );
  };
  return {
    repository,
    transport,
    current,
    reads,
    calls,
    get sheets() {
      return sheets;
    },
    get writes() {
      return writes;
    },
    loseNextResponse() {
      loseResponse = true;
    },
  };
}
