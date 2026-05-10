import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, AlertCircle, Edit2, Sparkles, Save } from 'lucide-react';
import { CanonicalReviewSuggestion, ParserResultV2, ParserEntityType } from '../types';
import { getParserResultDetails, getParserResultSummary } from '../utils/parserResultSummary';

interface PendingReviewListProps {
  reviews: { id: string; text: string; results: ParserResultV2[] }[];
  onApprove: (id: string, updatedResults: ParserResultV2[]) => void;
  onReject: (id: string) => void;
}

const PendingReviewList: React.FC<PendingReviewListProps> = ({ reviews, onApprove, onReject }) => {
  if (reviews.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mb-4 space-y-3 pointer-events-auto">
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
  const [appliedSuggestionKeys, setAppliedSuggestionKeys] = useState<Set<string>>(new Set());
  const [keptRawSuggestionKeys, setKeptRawSuggestionKeys] = useState<Set<string>>(new Set());

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

  const suggestionKey = (suggestion: CanonicalReviewSuggestion) => `${suggestion.field}-${suggestion.rawValue || ''}-${suggestion.suggestedValue || ''}`;

  const handleApplyCanonicalSuggestion = (suggestion: CanonicalReviewSuggestion) => {
    const key = suggestionKey(suggestion);
    setAppliedSuggestionKeys(prev => new Set(prev).add(key));
    setKeptRawSuggestionKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    setResults(prev => {
      const newResults = [...prev];
      const first = { ...newResults[0] } as any;
      const payload = first.payload;

      if (!payload) return prev;

      if ('meta' in payload) {
        first.payload = {
          ...payload,
          meta: {
            ...(payload.meta || {}),
            canonical: {
              ...(payload.meta?.canonical || {}),
              [suggestion.field]: {
                rawValue: suggestion.rawValue,
                value: suggestion.suggestedValue,
                confidence: suggestion.confidence,
                source: 'manual_review',
                ruleId: suggestion.ruleId,
                needsReview: false,
                reason: suggestion.reason,
              }
            }
          }
        };
      } else if ('changes' in payload) {
        first.payload = {
          ...payload,
          changes: {
            ...(payload.changes || {}),
            canonical: {
              ...(payload.changes?.canonical || {}),
              [suggestion.field]: {
                rawValue: suggestion.rawValue,
                value: suggestion.suggestedValue,
                confidence: suggestion.confidence,
                source: 'manual_review',
                ruleId: suggestion.ruleId,
                needsReview: false,
                reason: suggestion.reason,
              }
            }
          }
        };
      }

      newResults[0] = first;
      return newResults;
    });
  };

  const handleKeepRawSuggestion = (suggestion: CanonicalReviewSuggestion) => {
    const key = suggestionKey(suggestion);
    setKeptRawSuggestionKeys(prev => new Set(prev).add(key));
    setAppliedSuggestionKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    setResults(prev => {
      const newResults = [...prev];
      const first = { ...newResults[0] } as any;
      const payload = first.payload;

      if (!payload) return prev;

      const removeField = (canonical?: Record<string, unknown>) => {
        const next = { ...(canonical || {}) };
        delete next[suggestion.field];
        return next;
      };

      if ('meta' in payload) {
        first.payload = {
          ...payload,
          meta: {
            ...(payload.meta || {}),
            canonical: removeField(payload.meta?.canonical),
          }
        };
      } else if ('changes' in payload) {
        first.payload = {
          ...payload,
          changes: {
            ...(payload.changes || {}),
            canonical: removeField(payload.changes?.canonical),
          }
        };
      }

      newResults[0] = first;
      return newResults;
    });
  };

  const payload = primaryResult.payload as any;
  const amount = payload?.meta?.amount || '';
  const financeType = payload?.meta?.financeType || '';
  const content = payload?.content || primaryResult.content || review.text;
  const canonicalReview = primaryResult.canonicalReview || [];
  const resultSummary = getParserResultSummary(primaryResult);
  const parsedDestination = resultSummary.destination;
  const parsedAttributes = getParserResultDetails(primaryResult);
  const isBatchReview = results.length > 1 || results.some(result => result.batchItem);

  if (isBatchReview && !isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
        className="bg-surface border border-indigo-500/30 rounded-xl shadow-lg overflow-hidden"
      >
        <div className="p-3 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
                  Parser Batch Draft
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-500">
                  {results.length} results
                </span>
              </div>
              <p className="text-sm text-primary font-medium truncate" title={review.text}>{review.text}</p>
              <p className="text-[11px] text-muted">Review each batch item below; approval saves the whole ordered batch.</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleApprove}
                className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors shadow-sm"
                title="Approve batch"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => onReject(review.id)}
                className="w-8 h-8 rounded-lg bg-surface-elevated text-muted flex items-center justify-center hover:text-red-500 transition-colors border border-border"
                title="Reject batch"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {results.map((result, index) => {
              const summary = getParserResultSummary(result);
              const attributes = getParserResultDetails(result);
              return (
                <div key={`${review.id}-${index}`} className="rounded-lg bg-background/60 border border-border p-2.5 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-bold uppercase tracking-wide">
                      Item {result.batchItem ? result.batchItem.index + 1 : index + 1}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-elevated rounded text-muted border border-border capitalize">
                      {result.entityType}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-surface-elevated rounded text-muted border border-border">
                      {summary.destination}
                    </span>
                  </div>
                  {result.batchItem && (
                    <div className="rounded-md bg-indigo-500/5 border border-indigo-500/15 px-2 py-1.5">
                      <div className="text-[9px] uppercase tracking-wide text-indigo-600 font-bold">Source</div>
                      <div className="text-[11px] text-primary font-medium leading-snug">{result.batchItem.sourceText}</div>
                    </div>
                  )}
                  <div className="text-[11px] text-primary font-medium">{summary.title}</div>
                  {attributes.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {attributes.slice(0, 8).map(([key, value]) => (
                        <div key={`${key}-${value}`} className="min-w-0 rounded-md bg-surface/80 border border-border px-2 py-1">
                          <div className="text-[9px] uppercase tracking-wide text-muted font-bold truncate">{key}</div>
                          <div className="text-[11px] text-primary font-medium truncate" title={value}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {result.needsReview && result.reviewReason && (
                    <p className="text-[10px] text-amber-500 leading-tight">{result.reviewReason}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      className="bg-surface border border-indigo-500/30 rounded-xl shadow-lg overflow-hidden"
    >
      <div className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
                Parser Draft
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${confidenceColor}`}>
                {primaryResult.confidence}
              </span>
            </div>
            
            {isEditing ? (
              <div className="space-y-2 mt-2">
                <div>
                  <input 
                    type="text" 
                    value={content}
                    onChange={(e) => handleUpdateField('content', e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-indigo-500"
                    placeholder="Title / Content"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select 
                    value={primaryResult.entityType}
                    onChange={(e) => handleUpdateField('entityType', e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-indigo-500"
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
                      className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-primary focus:outline-none focus:border-indigo-500"
                      placeholder="Amount"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-primary font-medium truncate">
                  {content}
                </p>
                <p className="text-[11px] text-muted truncate" title={resultSummary.title}>
                  {resultSummary.title}
                </p>
                
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

          <div className="flex items-center gap-1.5 shrink-0">
            {isEditing ? (
              <button
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleApprove}
                  className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors shadow-sm"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-8 h-8 rounded-lg bg-surface-elevated text-muted flex items-center justify-center hover:text-indigo-500 transition-colors border border-border"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onReject(review.id)}
                  className="w-8 h-8 rounded-lg bg-surface-elevated text-muted flex items-center justify-center hover:text-red-500 transition-colors border border-border"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {primaryResult.needsReview && primaryResult.reviewReason && !isEditing && (
          <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-500 leading-tight">
              {primaryResult.reviewReason}
            </p>
          </div>
        )}

        {!isEditing && (
          <div className="mt-3 p-2.5 bg-background/60 border border-border rounded-lg space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Parsed Output</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-medium">
                {parsedDestination}
              </span>
            </div>
            {parsedAttributes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {parsedAttributes.slice(0, 12).map(([key, value]) => (
                  <div key={`${key}-${value}`} className="min-w-0 rounded-md bg-surface/80 border border-border px-2 py-1">
                    <div className="text-[9px] uppercase tracking-wide text-muted font-bold truncate">{key}</div>
                    <div className="text-[11px] text-primary font-medium truncate" title={value}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!isEditing && canonicalReview.length > 0 && (
          <div className="mt-3 p-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-lg space-y-2">
            <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">
              Canonical Suggestions
            </div>
            {canonicalReview.map((suggestion) => {
              const key = suggestionKey(suggestion);
              const isApplied = appliedSuggestionKeys.has(key);
              const isKeptRaw = keptRawSuggestionKeys.has(key);

              return (
              <div key={key} className={`bg-background/60 rounded-lg p-2 border ${isApplied ? 'border-emerald-500/40' : isKeptRaw ? 'border-slate-500/30' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-muted uppercase tracking-wide">
                        {suggestion.field}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                        {Math.round(suggestion.confidence * 100)}%
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-muted">
                        {suggestion.source.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-[11px] text-primary font-medium">
                      <span className="text-muted">Raw:</span> {suggestion.rawValue || '—'}
                      <span className="text-muted mx-1">→</span>
                      <span className="text-indigo-500">{suggestion.suggestedValue || '—'}</span>
                    </div>
                    <div className="text-[10px] text-muted leading-tight">
                      {suggestion.reason}
                    </div>
                    {(isApplied || isKeptRaw) && (
                      <div className={`text-[10px] font-semibold ${isApplied ? 'text-emerald-500' : 'text-muted'}`}>
                        {isApplied ? 'Using this canonical value on approval.' : 'Keeping raw value; approval will teach this as a rejection signal.'}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 flex flex-col gap-1">
                    <button
                      onClick={() => handleApplyCanonicalSuggestion(suggestion)}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${isApplied ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}
                    >
                      {isApplied ? 'Using' : 'Use'}
                    </button>
                    <button
                      onClick={() => handleKeepRawSuggestion(suggestion)}
                      className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors ${isKeptRaw ? 'bg-surface-elevated text-primary border-border' : 'bg-background text-muted border-border hover:text-primary'}`}
                    >
                      Keep Raw
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PendingReviewList;
