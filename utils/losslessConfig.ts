import type { DbSchema } from '../types.js';
import { mergeMutation } from './syncProtocol.js';
export const CONFIG_SHEET = '_Sync_Config';
export const configTables: Record<string, string[]> = {
  wallets: ['Wallets Config'], skills: ['Skills Config'], budgetConfig: ['Budget Rules', 'Themes & Settings'],
  appSettings: ['Themes & Settings'], customPrompt: ['Themes & Settings'], monthlyThemes: ['Themes & Settings'],
  monthlyThemeImages: ['Themes & Settings'], chatHistory: ['Chat History'], canonicalRules: ['Canonical Rules'],
};
export function applyLosslessConfig(db: DbSchema, ranges: any[]): DbSchema {
  const result = structuredClone(db);
  const names = new Set(ranges.map(range => String(range.range).split('!')[0].replace(/^'|'$/g, '').replace(/''/g, "'")));
  const rows = ranges.find(range => String(range.range).includes(CONFIG_SHEET))?.values || [];
  for (const row of rows.slice(1)) {
    if (!configTables[row[0]]) throw new Error('Unknown lossless config field');
    const stored = JSON.parse(String(row[1]));
    if (!Object.hasOwn(stored, 'value') || !Object.hasOwn(stored, 'projected')) throw new Error('Malformed lossless config');
    const known = (result as any)[row[0]] ?? null;
    (result as any)[row[0]] = configTables[row[0]].every(name => names.has(name))
      ? mergeMutation(stored.projected, known, stored.value, `config.${row[0]}`) : stored.value;
  }
  return result;
}
