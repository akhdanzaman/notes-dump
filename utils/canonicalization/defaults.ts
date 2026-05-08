import { CanonicalValue, ParsedItemMetaV2 } from '../../types';

export const CANONICAL_OTHER_VALUE = 'others';

const OTHER_ALIASES = new Set(['', '-', '—', 'n/a', 'na', 'none', 'null', 'unknown', 'tidak diketahui', 'other', 'others']);

const normalizeCanonicalText = (value?: string): string => (value || '').trim().toLowerCase().replace(/\s+/g, '_');

export const normalizeCanonicalFallback = (value?: string): string => {
  const normalized = normalizeCanonicalText(value);
  if (!normalized || OTHER_ALIASES.has(normalized)) return CANONICAL_OTHER_VALUE;
  return normalized;
};

export const isFinanceCanonicalCandidate = (meta: ParsedItemMetaV2): boolean => Boolean(
  meta.financeType
  || meta.budgetCategory
  || meta.commodity
  || meta.subcommodity
);

const hasAcceptedCanonical = (value?: CanonicalValue, rawValue?: string): boolean => {
  if (!value?.value || value.needsReview) return false;
  if (value.source === 'manual_review') return true;

  const canonicalValue = normalizeCanonicalFallback(value.value);
  const rawCanonicalValue = normalizeCanonicalFallback(rawValue);
  if (canonicalValue === CANONICAL_OTHER_VALUE && rawCanonicalValue !== CANONICAL_OTHER_VALUE) return false;

  return true;
};

const buildDefaultCanonical = (rawValue: string | undefined, field: 'commodity' | 'subcommodity'): CanonicalValue => {
  const value = normalizeCanonicalFallback(rawValue);
  const isFallback = value === CANONICAL_OTHER_VALUE && !rawValue;
  return {
    rawValue: rawValue || undefined,
    value,
    confidence: isFallback ? 0.2 : 0.8,
    source: isFallback ? 'system_rule' : 'context_inference',
    needsReview: false,
    reason: isFallback
      ? `No ${field} signal was available, so analytics use ${CANONICAL_OTHER_VALUE}.`
      : `Canonical ${field} normalized from the raw ${field} field.`,
  };
};

export const ensureFinanceCanonicalDefaults = (meta: ParsedItemMetaV2): ParsedItemMetaV2 => {
  if (!isFinanceCanonicalCandidate(meta)) return meta;

  const canonical = { ...(meta.canonical || {}) };

  if (!hasAcceptedCanonical(canonical.commodity, meta.commodity)) {
    canonical.commodity = buildDefaultCanonical(meta.commodity, 'commodity');
  }

  if (!hasAcceptedCanonical(canonical.subcommodity, meta.subcommodity)) {
    canonical.subcommodity = buildDefaultCanonical(meta.subcommodity, 'subcommodity');
  }

  return { ...meta, canonical };
};

export const getCommodityCanonicalForAnalytics = (meta: ParsedItemMetaV2): string => (
  normalizeCanonicalFallback(meta.canonical?.commodity?.needsReview ? meta.commodity : (meta.canonical?.commodity?.value || meta.commodity))
);

export const getSubcommodityCanonicalForAnalytics = (meta: ParsedItemMetaV2): string => (
  normalizeCanonicalFallback(meta.canonical?.subcommodity?.needsReview ? meta.subcommodity : (meta.canonical?.subcommodity?.value || meta.subcommodity))
);
