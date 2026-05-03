import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeDeepWorkTodo, buildDeepWorkSuggestionMeta, createDeepWorkSubtaskItems } from '../deepWorkTransformer';
import { BrainDumpItem, ItemType } from '../../types';

test('detects summary IIMS and produces structured review guidance', () => {
  const plan = analyzeDeepWorkTodo('summary IIMS 2026');

  assert.equal(plan.shouldTransform, true);
  assert.equal(plan.status, 'suggested');
  assert.equal(plan.transform.trigger.pattern, 'summary');
  assert.equal(plan.confidence, 'medium');
  assert.match(plan.transform.nextAction?.text || '', /Open the IIMS 2026/i);
  assert.match(plan.transform.finalRequestedOutput?.description || '', /summary/i);
  assert.ok((plan.transform.sessionEstimate?.minutes || 0) >= 45);
  assert.ok(plan.transform.blockerCheck);
  assert.ok((plan.transform.subtasks || []).length >= 3);
});

test('detects vague summary regulasi as low-confidence editable guidance', () => {
  const plan = analyzeDeepWorkTodo('summary regulasi');

  assert.equal(plan.shouldTransform, true);
  assert.equal(plan.transform.trigger.pattern, 'regulation');
  assert.equal(plan.confidence, 'low');
  assert.equal(plan.transform.blockerCheck?.blocked, true);
  assert.deepEqual(plan.transform.blockerCheck?.missingInputs, ['specific regulation', 'audience', 'purpose']);
  assert.match(plan.transform.nextAction?.text || '', /Identify the exact regulation source/i);
  assert.equal(plan.transform.finalRequestedOutput?.format, 'table');
});

test('supports specific regulation summaries without shallow boilerplate', () => {
  const plan = analyzeDeepWorkTodo('summary regulasi Kepmen Komdigi No. 12 tahun 2026');

  assert.equal(plan.shouldTransform, true);
  assert.equal(plan.transform.trigger.pattern, 'regulation');
  assert.notEqual(plan.confidence, 'low');
  assert.ok(!(plan.transform.blockerCheck?.missingInputs || []).includes('specific regulation'));
  assert.match(plan.transform.nextAction?.text || '', /extract the 5 clauses/i);
  assert.ok((plan.transform.subtasks || []).some(step => /impact\/action table/i.test(step.title)));
});

test('detects research and recap patterns with non-boilerplate structure', () => {
  const researchPlan = analyzeDeepWorkTodo('research opsi vendor dashboard analytics');
  assert.equal(researchPlan.shouldTransform, true);
  assert.equal(researchPlan.transform.trigger.pattern, 'research');
  assert.match(researchPlan.transform.nextAction?.text || '', /^List\b/i);
  assert.match(researchPlan.transform.finalRequestedOutput?.description || '', /research brief/i);
  assert.ok((researchPlan.transform.subtasks || []).some(step => /recommendation|next-action summary/i.test(step.title)));

  const recapPlan = analyzeDeepWorkTodo('recap meeting supplier minggu ini');
  assert.equal(recapPlan.shouldTransform, true);
  assert.equal(recapPlan.transform.trigger.pattern, 'summary');
  assert.match(recapPlan.transform.nextAction?.text || '', /Open the source notes/i);
  assert.match(recapPlan.transform.finalRequestedOutput?.description || '', /meeting supplier.*recap/i);
  assert.notEqual(recapPlan.transform.nextAction?.text.toLowerCase(), 'recap meeting supplier minggu ini');
});

test('does not transform already concrete todos or checklists', () => {
  assert.equal(analyzeDeepWorkTodo('beli baterai AAA di Indomaret').shouldTransform, false);
  assert.equal(analyzeDeepWorkTodo('Call Budi at 10:00 about invoice').shouldTransform, false);
  assert.equal(analyzeDeepWorkTodo('review notes\n- extract 3 numbers\n- write 5 bullets').shouldTransform, false);
  assert.equal(analyzeDeepWorkTodo('Review 5 vendor options by price and material then output recommendation table').shouldTransform, false);
  assert.equal(analyzeDeepWorkTodo('Riset 10 referensi pasar atau kompetitor desk toys and decoration, lalu ringkas style, harga, material, audience, dan sinyal laku').shouldTransform, false);
  assert.equal(analyzeDeepWorkTodo('Packing buku-buku buat dibawa ke jakarta').shouldTransform, false);
  assert.equal(analyzeDeepWorkTodo('Buat RFQ untuk parts kampas rem').shouldTransform, false);
});

test('parser/add-task path stores suggestion metadata but does not create child todos until accepted', () => {
  const meta = buildDeepWorkSuggestionMeta('summary IIMS 2026', { date: '2026-05-03T00:00:00.000Z' });

  assert.equal(meta.deepWorkParent, true);
  assert.equal(meta.deepWorkStatus, 'suggested');
  assert.equal(meta.deepWorkTriggerPattern, 'summary');
  assert.ok(meta.deepWorkNextAction);
  assert.ok(meta.deepWorkFinalOutput);
  assert.ok(meta.deepWorkSessionEstimateMinutes);
  assert.ok(meta.deepWorkBlockerCheck);
  assert.equal(meta.childTodoIds, undefined);

  const lowConfidenceMeta = buildDeepWorkSuggestionMeta('summary regulasi', { date: '2026-05-03T00:00:00.000Z' });
  assert.equal(lowConfidenceMeta.deepWorkStatus, 'suggested');
  assert.equal(lowConfidenceMeta.deepWorkConfidence, 'low');
  assert.equal(lowConfidenceMeta.deepWorkBlockerStatus, 'needs_input');
  assert.equal(lowConfidenceMeta.childTodoIds, undefined);
  assert.ok(lowConfidenceMeta.subtasks?.length);
});

test('user-triggered accept path can materialize suggested subtasks with parent linkage', () => {
  const parent: BrainDumpItem = {
    id: 'todo-parent',
    type: ItemType.TODO,
    content: 'summary regulasi Kepmen Komdigi No. 12 tahun 2026',
    status: 'pending',
    created_at: '2026-05-03T00:00:00.000Z',
    meta: buildDeepWorkSuggestionMeta('summary regulasi Kepmen Komdigi No. 12 tahun 2026', { tags: ['work'] }),
  };

  let n = 0;
  const children = createDeepWorkSubtaskItems(parent, () => `child-${++n}`, '2026-05-03T01:00:00.000Z');

  assert.ok(children.length >= 3);
  assert.equal(children[0].meta.parentTodoId, 'todo-parent');
  assert.equal(children[0].meta.deepWorkStatus, 'active');
  assert.equal(children[0].meta.deepWorkStepIndex, 1);
  assert.equal(children[children.length - 1].meta.deepWorkStepCount, children.length);
});
