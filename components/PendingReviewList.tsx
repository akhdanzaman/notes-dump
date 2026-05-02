import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertCircle, Edit2, Sparkles, Save, ArrowRight } from 'lucide-react';
import { CanonicalReviewSuggestion, ParserResultV2, ParserEntityType } from '../types';

interface PendingReviewListProps {
  reviews: { id: string; text: string; results: ParserResultV2[] }[];
  onApprove: (id: string, updatedResults: ParserResultV2[]) => void;
  onReject: (id: string) => void;
}

type CanonicalDecision = 'undecided' | 'applied' | 'kept_raw' | 'override';

const getSuggestionKey = (suggestion: CanonicalReviewSuggestion, index: number) =>
  `${suggestion.field}:${suggestion.rawValue || ''}:${suggestion.suggestedValue || ''}:${index}`;

const getSourceLabel = (source?: CanonicalReviewSuggestion['source']) => {
  switch (source) {
    case 'system_rule':
      return 'system rule';
    case 'learned_rule':
      return 'learned rule';
    case 'context_inference':
      return 'context clue';
    case 'ai_assist':
      return 'AI assist';
    case 'manual_review':
      return 'manual review';
    default:
      return 'canonicalizer';
  }
};

const getFieldLabel = (field: CanonicalReviewSuggestion['field']) => {
  switch (field) {
    case 'paymentMethod':
      return 'Payment';
    case 'subcommodity':
      return 'Subcommodity';
    default:
      return field.charAt(0).toUpperCase() + field.slice(1);
  }
};

const PendingReviewList: React.FC<PendingReviewListProps> = ({ reviews, onApprove, onReject }) => {
  if (reviews.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 mb-4 space-y-3 pointer-events-auto">
      <AnimatePresence>
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ReviewCard: React.FC<{
  review: { id: string; text: string; results: ParserResultV2[] };
  onApprove: (id: string, updatedResults: ParserResultV2[]) => void;
  onReject: (id: string) => void;
}> = ({ review, onApprove, onReject }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [results, setResults] = useState(review.results);
  const [decisions, setDecisions] = useState<Record<string, CanonicalDecision>>({});
  const [overrideKey, setOverrideKey] = useState<string | null>(null);
  const [overrideValues, setOverrideValues] = useState<Record<string, string>>({});

  const primaryResult = results[0];
  if (!primaryResult) return null;

  const confidenceColor =
    primaryResult.confidence === 'high' ? 'text-emerald-500 bg-emerald-500/10' :
    primaryResult.confidence === 'medium' ? 'text-amber-500 bg-amber-500/10' :
    'text-red-500 bg-red-500/10';

  const handleApprove = () => {
    onApprove(review.id, results);
  };

  const handleUpdateField = (field: string, value: any) => {
    setResults(prev => {
      const newResults = [...prev];
      const first = { ...newResults[0] };

      if (field === 'entityType') {
        first.entityType = value as ParserEntityType;
      } else if (field === 'content') {
        if (first.payload) {
          first.payload = { ...first.payload, content: value } as any;
        }
      } else {
        if (first.payload && 'meta' in first.payload) {
          first.payload = {
            ...first.payload,
            meta: {
              ...(first.payload.meta || {}),
              [field]: value
            }
          } as any;
        }
      }

      newResults[0] = first;
      return newResults;
    });
  };

  const updateCanonicalSuggestion = (
    suggestion: CanonicalReviewSuggestion,
    value: string | undefined,
    reason = suggestion.reason
  ) => {
    setResults(prev => {
      const newResults = [...prev];
      const first = { ...newResults[0] } as any;
      const payload = first.payload;

      if (!payload) return prev;

      const nextCanonicalValue = value ? {
        rawValue: suggestion.rawValue,
        value,
        confidence: suggestion.confidence,
        source: 'manual_review' as const,
        ruleId: suggestion.ruleId,
        needsReview: false,
        reason,
      } : undefined;

      const applyToMeta = (meta: any) => {
        const nextCanonical = { ...(meta?.canonical || {}) };
        if (nextCanonicalValue) {
          nextCanonical[suggestion.field] = nextCanonicalValue;
        } else {
          delete nextCanonical[suggestion.field];
        }

        return {
          ...(meta || {}),
          canonical: nextCanonical,
        };
      };

      if ('meta' in payload) {
        first.payload = {
          ...payload,
          meta: applyToMeta(payload.meta),
        };
      } else if ('changes' in payload) {
        first.payload = {
          ...payload,
          changes: applyToMeta(payload.changes),
        };
      }

      newResults[0] = first;
      return newResults;
    });
  };

  const handleApplyCanonicalSuggestion = (suggestion: CanonicalReviewSuggestion, key: string) => {
    if (!suggestion.suggestedValue) return;
    updateCanonicalSuggestion(suggestion, suggestion.suggestedValue);
    setDecisions(prev => ({ ...prev, [key]: 'applied' }));
  };

  const handleKeepRawCanonicalSuggestion = (suggestion: CanonicalReviewSuggestion, key: string) => {
    updateCanonicalSuggestion(suggestion, undefined);
    setDecisions(prev => ({ ...prev, [key]: 'kept_raw' }));
  };

  const handleSaveOverride = (suggestion: CanonicalReviewSuggestion, key: string) => {
    const value = (overrideValues[key] || suggestion.suggestedValue || '').trim();
    if (!value) return;

    updateCanonicalSuggestion(suggestion, value, 'Manual override during review');
    setDecisions(prev => ({ ...prev, [key]: 'override' }));
    setOverrideKey(null);
  };

  const payload = primaryResult.payload as any;
  const meta = payload?.meta || payload?.changes || {};
  const amount = meta?.amount || '';
  const financeType = meta?.financeType || '';
  const content = payload?.content || payload?.changes?.content || primaryResult.content || review.text;
  const canonicalReview = primaryResult.canonicalReview || [];
  const hasCanonicalReview = canonicalReview.length > 0;
  const isSourceTextDifferent = review.text && review.text !== content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className="bg-surface border border-indigo-500/30 rounded-2xl shadow-lg overflow-hidden"
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
                {hasCanonicalReview ? 'Review suggestion' : 'AI Draft'}
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${confidenceColor}`}>
                {primaryResult.confidence}
              </span>
              {hasCanonicalReview && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-500">
                  {canonicalReview.length} canonical {canonicalReview.length === 1 ? 'field' : 'fields'}
                </span>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2 mt-2">
                <div>
                  <input
                    type="text"
                    value={content}
                    onChange={(e) => handleUpdateField('content', e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-2 text-sm text-primary focus:outline-none focus:border-indigo-500"
                    placeholder="Title / Content"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={primaryResult.entityType}
                    onChange={(e) => handleUpdateField('entityType', e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-2 text-xs text-primary focus:outline-none focus:border-indigo-500"
                  >
                    <option value="finance">Finance</option>
                    <option value="todo">Task</option>
                    <option value="note">Note</option>
                    <option value="shopping">Shopping</option>
                    <option value="event">Event</option>
                  </select>
                  {primaryResult.entityType === 'finance' && (
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => handleUpdateField('amount', Number(e.target.value))}
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-2 text-xs text-primary focus:outline-none focus:border-indigo-500"
                      placeholder="Amount"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-primary font-medium leading-snug break-words">
                  {content}
                </p>
                {isSourceTextDifferent && (
                  <p className="text-[11px] text-muted leading-snug break-words">
                    From: “{review.text}”
                  </p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 bg-surface-elevated rounded text-muted border border-border capitalize">
                    {primaryResult.entityType}
                  </span>
                  {amount && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-elevated rounded text-muted border border-border">
                      Rp {Number(amount).toLocaleString()}
                    </span>
                  )}
                  {financeType && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-elevated rounded text-muted border border-border capitalize">
                      {financeType}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {isEditing && (
            <button
              onClick={() => setIsEditing(false)}
              className="min-w-11 h-11 px-3 rounded-xl bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors shadow-sm"
              aria-label="Save draft edits"
            >
              <Save className="w-4 h-4" />
            </button>
          )}
        </div>

        {primaryResult.needsReview && primaryResult.reviewReason && !isEditing && (
          <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight">
              {primaryResult.reviewReason}
            </p>
          </div>
        )}

        {!isEditing && hasCanonicalReview && (
          <div className="mt-3 p-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-2.5">
            <div>
              <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
                Canonical cleanup
              </div>
              <p className="text-[10px] text-muted mt-0.5">
                Group aliases without changing what you originally typed.
              </p>
            </div>

            {canonicalReview.map((suggestion, index) => {
              const key = getSuggestionKey(suggestion, index);
              const decision = decisions[key] || 'undecided';
              const confidencePct = Math.round(suggestion.confidence * 100);
              const isLowConfidence = suggestion.confidence < 0.7;
              const overrideValue = overrideValues[key] ?? suggestion.suggestedValue ?? '';

              return (
                <div
                  key={key}
                  className={`rounded-xl p-2.5 border space-y-2 bg-background/70 ${
                    isLowConfidence ? 'border-amber-500/30' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-elevated border border-border text-primary font-semibold">
                          {getFieldLabel(suggestion.field)}
                        </span>
                        {isLowConfidence && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                            Check first
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted leading-snug mt-1">
                        {confidencePct}% confidence • {getSourceLabel(suggestion.source)} • {suggestion.reason}
                      </div>
                    </div>
                    {decision !== 'undecided' && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold">
                        {decision === 'kept_raw' ? 'Raw kept' : 'Applied'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
                    <div className={`rounded-lg border p-2 min-w-0 ${decision === 'kept_raw' ? 'border-indigo-500 bg-indigo-500/5' : 'border-border bg-surface'}`}>
                      <div className="text-[9px] uppercase tracking-wider text-muted font-bold mb-0.5">Raw</div>
                      <div className="text-xs text-primary font-semibold break-words">{suggestion.rawValue || '—'}</div>
                    </div>
                    <div className="flex items-center text-muted">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <div className={`rounded-lg border p-2 min-w-0 ${decision === 'applied' || decision === 'override' ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-border bg-surface'}`}>
                      <div className={`text-[9px] uppercase tracking-wider font-bold mb-0.5 ${decision === 'applied' || decision === 'override' ? 'text-white/70' : 'text-muted'}`}>Canonical</div>
                      <div className="text-xs font-semibold break-words">{decision === 'override' ? overrideValue : suggestion.suggestedValue || '—'}</div>
                    </div>
                  </div>

                  {overrideKey === key && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        autoFocus
                        value={overrideValue}
                        onChange={(e) => setOverrideValues(prev => ({ ...prev, [key]: e.target.value }))}
                        className="flex-1 min-h-11 bg-surface border border-border rounded-lg px-3 text-sm text-primary focus:outline-none focus:border-indigo-500"
                        placeholder="Canonical value"
                      />
                      <button
                        onClick={() => handleSaveOverride(suggestion, key)}
                        className="min-h-11 px-3 rounded-lg bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 transition-colors"
                      >
                        Save override
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleApplyCanonicalSuggestion(suggestion, key)}
                      disabled={!suggestion.suggestedValue}
                      className={`min-h-11 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 ${
                        decision === 'applied'
                          ? 'bg-indigo-500 text-white'
                          : 'bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20'
                      }`}
                      aria-label={`Apply canonical ${getFieldLabel(suggestion.field)} ${suggestion.suggestedValue || ''}`}
                    >
                      {decision === 'applied' ? 'Applied ✓' : 'Apply'}
                    </button>
                    <button
                      onClick={() => handleKeepRawCanonicalSuggestion(suggestion, key)}
                      className={`min-h-11 rounded-lg text-xs font-bold transition-colors ${
                        decision === 'kept_raw'
                          ? 'bg-surface-elevated text-primary border border-indigo-500'
                          : 'bg-surface border border-border text-muted hover:text-primary'
                      }`}
                      aria-label={`Keep raw ${getFieldLabel(suggestion.field)} ${suggestion.rawValue || ''}`}
                    >
                      {decision === 'kept_raw' ? 'Kept raw ✓' : 'Keep raw'}
                    </button>
                    <button
                      onClick={() => setOverrideKey(prev => prev === key ? null : key)}
                      className="min-h-11 rounded-lg bg-surface border border-border text-muted hover:text-primary text-xs font-bold transition-colors"
                      aria-label={`Override canonical ${getFieldLabel(suggestion.field)}`}
                    >
                      Override
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isEditing && (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
            <button
              onClick={handleApprove}
              className="min-h-11 rounded-xl bg-indigo-500 text-white flex items-center justify-center gap-1.5 hover:bg-indigo-600 transition-colors shadow-sm text-xs font-bold"
            >
              <Check className="w-4 h-4" />
              Save draft
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="min-h-11 rounded-xl bg-surface-elevated text-muted flex items-center justify-center gap-1.5 hover:text-indigo-500 transition-colors border border-border text-xs font-bold"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit all
            </button>
            <button
              onClick={() => onReject(review.id)}
              className="min-h-11 rounded-xl bg-surface-elevated text-muted flex items-center justify-center gap-1.5 hover:text-red-500 transition-colors border border-border text-xs font-bold"
            >
              <X className="w-4 h-4" />
              Dismiss
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PendingReviewList;
