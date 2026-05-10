import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReviewCenterPanel from '../../components/ReviewCenterPanel';
import { EnrichmentTask, ParsingTask } from '../../types';

const tasks: ParsingTask[] = [
  {
    id: 'local-fast-path',
    text: 'expense kopi 18000 cash',
    status: 'success',
    stage: 'local',
    createdAt: 1,
    completedAt: 2,
    results: [{
      action: 'create_item',
      entityType: 'finance',
      content: 'kopi',
      confidence: 'high',
      needsReview: false,
      payload: { itemType: 'FINANCE', content: 'kopi', status: 'done', meta: { amount: 18000, financeType: 'expense', paymentMethod: 'cash', budgetCategory: 'wants', canonical: { paymentMethod: { value: 'cash-wallet', source: 'system_rule', confidence: 1 } } } },
    }],
  },
  {
    id: 'router-fallback-stage1',
    text: 'todo follow up investor deck tomorrow',
    status: 'success',
    stage: 'stage1',
    createdAt: 2,
    completedAt: 3,
    routerDecision: { route: 'deep_ai', intent: 'todo', confidenceScore: 0.82, reasonCodes: ['router_fallback_stage1'] },
    results: [{
      action: 'create_item',
      entityType: 'todo',
      confidence: 'high',
      needsReview: false,
      payload: { itemType: 'TODO', content: 'follow up investor deck', status: 'pending', meta: { priority: 'normal', date: '2026-05-10' } },
    }],
  },
  {
    id: 'deep-ai-stage2',
    text: 'event strategy sync tomorrow 10am',
    status: 'success',
    stage: 'stage2',
    createdAt: 3,
    completedAt: 4,
    routerDecision: { route: 'deep_ai', intent: 'event', confidenceScore: 0.57, reasonCodes: ['mixed_or_ambiguous_time'] },
    results: [{
      action: 'create_item',
      entityType: 'event',
      confidence: 'high',
      needsReview: false,
      payload: { itemType: 'EVENT', content: 'Strategy sync', status: 'pending', meta: { dateTime: '2026-05-10T10:00:00+07:00' } },
    }],
  },
  {
    id: 'merged-duplicate',
    text: 'Expense: makan bebek goreng 37500 gopay',
    status: 'success',
    stage: 'stage2',
    createdAt: 5,
    completedAt: 6,
    duplicateGuardRemovedCount: 2,
    duplicateGuardReason: 'single_finance_duplicate_guard',
    results: [{
      action: 'create_item',
      entityType: 'finance',
      content: 'makan bebek goreng',
      confidence: 'medium',
      needsReview: false,
      payload: { itemType: 'FINANCE', content: 'makan bebek goreng', status: 'done', meta: { amount: 37500, financeType: 'expense', paymentMethod: 'gopay', commodity: 'food', subcommodity: 'lunch' } },
    }],
  },
  {
    id: 'mutation-task',
    text: 'complete report and delete old reminder',
    status: 'success',
    stage: 'stage1',
    createdAt: 7,
    completedAt: 8,
    results: [
      { action: 'update_item', entityType: 'todo', confidence: 'high', needsReview: false, payload: { match: { itemId: 'todo-1', itemName: 'Write report' }, changes: { status: 'done' } } },
      { action: 'delete_item', entityType: 'todo', confidence: 'high', needsReview: false, payload: { match: { itemId: 'todo-2', itemName: 'Old reminder' } } },
    ],
  },
  {
    id: 'query-noop-hidden',
    text: 'berapa pengeluaran hari ini?',
    status: 'success',
    stage: 'local',
    createdAt: 9,
    completedAt: 10,
    results: [{ action: 'query_only', entityType: 'unknown', confidence: 'high', needsReview: false, payload: { question: 'berapa pengeluaran hari ini?', scope: 'money' } }],
  },
];

const enrichmentTasks: EnrichmentTask[] = [
  {
    id: 'async-enrichment-review',
    itemId: 'finance-1',
    parserTaskId: 'merged-duplicate',
    sourceText: 'makan bebek goreng',
    status: 'review',
    attempts: 1,
    createdAt: 11,
    completedAt: 12,
    appliedFields: ['commodity', 'subcommodity'],
    reviewCount: 1,
  },
];

const html = renderToStaticMarkup(
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>NDX-007 Review Center proof</title>
      <style>{`*{box-sizing:border-box}body{margin:0;background:#09090b;color:#f4f4f5;font-family:Inter,ui-sans-serif,system-ui}.bg-background{background:#09090b}.bg-surface{background:#18181b}.bg-surface\\/70{background:#18181bcc}.bg-background\\/70,.bg-background\\/60{background:#09090bcc}.border{border:1px solid #3f3f46}.border-border{border-color:#3f3f46}.rounded-xl{border-radius:16px}.rounded-lg{border-radius:12px}.rounded-md{border-radius:8px}.p-3{padding:12px}.p-2,.p-2\\.5{padding:10px}.px-4{padding-left:16px;padding-right:16px}.py-4{padding-top:16px;padding-bottom:16px}.mb-6{margin-bottom:24px}.mb-1{margin-bottom:4px}.space-y-3>*+*{margin-top:12px}.space-y-2>*+*{margin-top:8px}.flex{display:flex}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.items-center{align-items:center}.items-start{align-items:flex-start}.justify-between{justify-content:space-between}.gap-1\\.5{gap:6px}.gap-2{gap:8px}.gap-3{gap:12px}.grid{display:grid}.grid-cols-1{grid-template-columns:repeat(1,minmax(0,1fr))}.text-xs{font-size:12px}.text-sm{font-size:14px}.text-\\[10px\\]{font-size:10px}.text-\\[11px\\]{font-size:11px}.text-\\[9px\\]{font-size:9px}.font-bold{font-weight:700}.font-medium{font-weight:500}.uppercase{text-transform:uppercase}.capitalize{text-transform:capitalize}.tracking-wide{letter-spacing:.04em}.tracking-wider{letter-spacing:.08em}.text-primary{color:#f4f4f5}.text-muted{color:#a1a1aa}.text-emerald-500,.text-emerald-600{color:#10b981}.text-amber-600,.text-amber-500{color:#d97706}.text-indigo-500{color:#6366f1}.bg-emerald-500\\/5{background:#10b9810d}.bg-emerald-500\\/10{background:#10b9811a}.bg-indigo-500\\/10{background:#6366f11a}.bg-amber-500\\/5{background:#f59e0b0d}.truncate{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.min-w-0{min-width:0}.overflow-hidden{overflow:hidden}.overflow-y-auto{overflow-y:auto}.flex-1{flex:1}.shrink-0{flex-shrink:0}.shadow-sm{box-shadow:0 1px 2px #0003}.leading-snug{line-height:1.35}.leading-relaxed{line-height:1.55}.whitespace-pre-wrap{white-space:pre-wrap}.proof-shell{max-width:780px;margin:0 auto;padding:24px}.proof-note{color:#a1a1aa;font-size:12px;margin:0 0 16px}@media(min-width:640px){.sm\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:430px){.proof-shell{max-width:390px;padding:10px}.px-4{padding-left:10px;padding-right:10px}.py-4{padding-top:10px;padding-bottom:10px}.p-3{padding:10px}.gap-3{gap:8px}.text-sm{font-size:13px}}`}</style>
    </head>
    <body>
      <main className="proof-shell" data-proof="ndx-007-review-center">
        <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>NDX-007 Review Center proof</h1>
        <p className="proof-note">Desktop and mobile-safe DOM proof: local fast path, router fallback, deep AI, async enrichment, duplicate collapse, update/delete summaries, and hidden no-op query.</p>
        <ReviewCenterPanel parsingTasks={tasks} enrichmentTasks={enrichmentTasks} />
      </main>
    </body>
  </html>
);

process.stdout.write('<!doctype html>' + html);
