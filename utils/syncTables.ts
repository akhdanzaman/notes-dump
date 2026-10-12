import { configTables } from './losslessConfig.js';
import { generateExportData } from './exportUtils.js';
import type { BrainDumpItem } from '../types.js';
import type { SyncOperation } from './syncProtocol.js';
export function operationTables(
  operation: Pick<
    SyncOperation,
    'entityKind' | 'entityId' | 'before' | 'after'
  >,
): string[] {
  if (operation.entityKind === 'config')
    return configTables[operation.entityId] || [];
  const items = [operation.before, operation.after].filter(
    Boolean,
  ) as BrainDumpItem[];
  return generateExportData(
    items,
    [],
    [],
    { monthlyIncome: 0, rules: [] },
    {},
    { defaultCollapsed: false, hideMoney: false },
    new Date(),
    { includeDerived: false },
  )
    .filter(
      (sheet) =>
        sheet.data.length > 1 && sheet.data[0].includes('_Entity_JSON'),
    )
    .map((sheet) => sheet.name);
}
