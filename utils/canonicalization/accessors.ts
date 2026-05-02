import { BrainDumpItem, CanonicalField, ParsedItemMetaV2 } from '../../types';

export type CanonicalMetaField = Extract<CanonicalField, 'merchant' | 'paymentMethod' | 'commodity' | 'subcommodity'>;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const getCanonicalMetaValue = (
  meta: Pick<ParsedItemMetaV2, CanonicalMetaField | 'canonical'>,
  field: CanonicalMetaField
): string => {
  const canonicalValue = meta.canonical?.[field];
  if (canonicalValue?.needsReview) return '';
  return text(canonicalValue?.value);
};

export const getRawMetaValue = (
  meta: Pick<ParsedItemMetaV2, CanonicalMetaField>,
  field: CanonicalMetaField
): string => text(meta[field]);

export const getCanonicalOrRawMetaValue = (
  meta: Pick<ParsedItemMetaV2, CanonicalMetaField | 'canonical'>,
  field: CanonicalMetaField
): string => getCanonicalMetaValue(meta, field) || getRawMetaValue(meta, field);

export const getCanonicalOrRawItemValue = (
  item: BrainDumpItem,
  field: CanonicalMetaField
): string => getCanonicalOrRawMetaValue(item.meta, field);

export const getCanonicalSearchTokens = (item: BrainDumpItem): string[] => {
  const values = new Set<string>();

  values.add(item.content);
  item.meta.tags?.forEach(tag => values.add(tag));

  (['merchant', 'paymentMethod', 'commodity', 'subcommodity'] as CanonicalMetaField[]).forEach(field => {
    const raw = getRawMetaValue(item.meta, field);
    const canonical = getCanonicalMetaValue(item.meta, field);
    if (raw) values.add(raw);
    if (canonical) values.add(canonical);
  });

  return Array.from(values).filter(Boolean);
};

export const itemMatchesCanonicalSearch = (item: BrainDumpItem, query: string): boolean => {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return getCanonicalSearchTokens(item).some(value => value.toLowerCase().includes(q));
};

export const canonicalDebugLabel = (item: BrainDumpItem, field: CanonicalMetaField): string => {
  const raw = getRawMetaValue(item.meta, field);
  const canonical = getCanonicalMetaValue(item.meta, field);
  if (!canonical || canonical === raw) return raw;
  return raw ? `${raw} → ${canonical}` : canonical;
};
