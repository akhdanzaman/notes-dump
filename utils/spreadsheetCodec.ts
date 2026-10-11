import type { BrainDumpItem } from '../types';
export const ENTITY_SCHEMA_VERSION = 3;
export const ENTITY_JSON_COLUMN = '_Entity_JSON';
export const ENTITY_SCHEMA_COLUMN = '_Schema';
export class SpreadsheetCellError extends Error {
  constructor(public readonly location: string, detail: string) {
    super(`${location}: ${detail}`); this.name = 'SpreadsheetCellError';
  }
}
export function decodeSheetNumber(value: unknown, location = 'Number'): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim().startsWith('=')) throw new SpreadsheetCellError(location, 'Expected a computed number, not a formula or other value');
  const text = value.trim().replace(/^(?:Rp|IDR|USD|EUR|\$)\s*/i, '').replace(/\s/g, '');
  if (!/^-?\d[\d.,]*$/.test(text)) throw new SpreadsheetCellError(location, 'Invalid numeric cell');
  let normalized = text;
  if (text.includes('.') && text.includes(',')) {
    const decimal = text.lastIndexOf('.') > text.lastIndexOf(',') ? '.' : ',';
    normalized = text.split(decimal === '.' ? ',' : '.').join('').replace(decimal, '.');
  } else if (/^-?\d{1,3}([.,]\d{3})+$/.test(text)) normalized = text.replace(/[.,]/g, '');
  else normalized = text.replace(',', '.');
  const result = Number(normalized);
  if (!Number.isFinite(result)) throw new SpreadsheetCellError(location, 'Invalid numeric cell');
  return result;
}
export function decodeSheetJson(value: unknown, location: string, kind: 'array' | 'object'): any {
  if (value === undefined || value === null || value === '') return undefined;
  let parsed: any;
  try { parsed = typeof value === 'string' ? JSON.parse(value) : value; }
  catch { throw new SpreadsheetCellError(location, 'Malformed JSON; existing data was preserved'); }
  if (kind === 'array' ? !Array.isArray(parsed) : !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SpreadsheetCellError(location, `Expected JSON ${kind}`);
  return parsed;
}
export function normalizeIso(value: unknown): unknown {
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) {
    const date = new Date(value); if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return value;
}
export function encodeEntity(item: BrainDumpItem): string {
  const text = JSON.stringify(item, (_key, value) => normalizeIso(value));
  if (text.length > 49000) throw new SpreadsheetCellError(`ID ${item.id}`, 'Entity metadata exceeds safe cell capacity; shorten attachments/content before saving');
  return text;
}
export function decodeEntity(value: unknown, id: string, location: string): BrainDumpItem | undefined {
  const item = decodeSheetJson(value, location, 'object');
  if (!item) return undefined;
  if (item.id !== id || typeof item.content !== 'string' || typeof item.type !== 'string' || !item.meta || typeof item.meta !== 'object' || Array.isArray(item.meta)) throw new SpreadsheetCellError(location, 'Entity identity or shape is invalid');
  return item as BrainDumpItem;
}
