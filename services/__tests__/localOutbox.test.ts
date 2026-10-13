import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { ItemType, type DbSchema } from '../../types';
import { persistLocalState, readLocalState, reconstructBaseline, changeOperationState, acknowledgeOperations, closeLocalStore, persistDraft, readDrafts, resolveLocalConflicts, claimOperations } from '../localOutbox';
import { mergeFetchedItemsPreservingUnsavedLocal } from '../../hooks/useBrainDumpData';
import { mergeDbData } from '../../utils/mergeUtils';
import { __test__ } from '../spreadsheetService';
Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: indexedDB });
const item = { id: 'one', type: ItemType.NOTE, content: 'old', created_at: '2026-10-01', status: 'pending' as const, meta: {} };
const base: DbSchema = { data: [item], appSettings: { defaultCollapsed: false, hideMoney: false }, customPrompt: 'old', monthlyThemes: { '2026-10': 'old' } };
test('entity + delete tombstone survive store restart; scopes do not mix', async () => {
  await persistLocalState('offline-a', { ...base, data: [] }, base);
  await persistLocalState('offline-b', base, { data: [] });
  closeLocalStore();
  const local = await readLocalState('offline-a');
  assert.deepEqual(local.data?.data, []);
  assert.equal(local.operations.length, 1);
  assert.equal(local.operations[0].after, null);
  assert.deepEqual(reconstructBaseline(local.data!, local.operations).data, base.data);
  assert.deepEqual((await readLocalState('offline-b')).data?.data, base.data);
});
test('pending edits coalesce, but a sending operation is immutable and an old ack cannot remove a new edit', async () => {
  const scope = 'burst';
  await persistLocalState(scope, { ...base, data: [{ ...item, content: 'a' }] }, base);
  await persistLocalState(scope, { ...base, data: [{ ...item, content: 'b' }] });
  let local = await readLocalState(scope);
  assert.equal(local.operations.length, 1);
  assert.equal((local.operations[0].before as any).content, 'old');
  const first = local.operations[0].operationId;
  await changeOperationState(scope, [first], 'sending');
  await persistLocalState(scope, { ...base, data: [{ ...item, content: 'c' }] });
  await acknowledgeOperations(scope, [first]);
  local = await readLocalState(scope);
  assert.equal(local.operations.length, 1);
  assert.notEqual(local.operations[0].operationId, first);
  assert.equal((local.operations[0].after as any).content, 'c');
  assert.equal(local.data?.data[0].content, 'c');
});
test('raw parser drafts survive close before parsing completes', async () => {
  await persistDraft('draft-scope', 'draft-one', 'makan 25rb'); closeLocalStore();
  assert.equal((await readDrafts('draft-scope'))[0].text, 'makan 25rb');
});
test('refresh and save never resurrect a known deletion', () => {
  assert.deepEqual(mergeFetchedItemsPreservingUnsavedLocal(base.data, [], base.data), []);
  assert.deepEqual(__test__.preserveLocalItemsStillPresentInApp(base, { ...base, data: [] }, base).data, []);
});
test('remote-only settings, cleared prompt and themes win against an unchanged local baseline', () => {
  const remote = { ...base, appSettings: { defaultCollapsed: true, hideMoney: true }, customPrompt: '', monthlyThemes: { '2026-10': 'new' } };
  const merged = mergeDbData(base, remote, base);
  assert.deepEqual(merged.appSettings, remote.appSettings);
  assert.equal(merged.customPrompt, '');
  assert.deepEqual(merged.monthlyThemes, remote.monthlyThemes);
});
test('unknown acceptance cannot change an operation payload; newer edit depends on its immutable predecessor', async () => {
  const scope = 'unknown-acceptance'; const first = { ...base, data: [{ ...item, content: 'first' }] };
  await persistLocalState(scope, first, base);
  const initial = (await readLocalState(scope)).operations[0];
  await claimOperations(scope, [initial.operationId]);
  await persistLocalState(scope, { ...first, data: [{ ...item, content: 'second' }] });
  const operations = (await readLocalState(scope)).operations;
  assert.equal((operations[0].after as any).content, 'first');
  assert.equal(operations[1].parentOperationId, operations[0].operationId);
});
test('explicit conflict review preserves unrelated remote fields and creates a new operation ID', async () => {
  const scope = 'review-conflict';
  await persistLocalState(scope, { ...base, data: [{ ...item, content: 'local' }] }, base);
  const previous = (await readLocalState(scope)).operations[0];
  await changeOperationState(scope, [previous.operationId], 'conflict');
  const remote = { ...base, data: [{ ...item, content: 'remote', meta: { tags: ['remote tag'] } }] };
  await resolveLocalConflicts(scope, remote, true);
  const local = await readLocalState(scope);
  assert.equal(local.data?.data[0].content, 'local'); assert.deepEqual(local.data?.data[0].meta.tags, ['remote tag']);
  assert.notEqual(local.operations[0].operationId, previous.operationId);
  assert.equal((local.operations[0].before as any).content, 'remote');
});
test('parser completion and parsed entities persist atomically, so restart does not suggest parsing the same input again', async () => {
  const scope = 'parser-complete'; await persistDraft(scope, 'parser-draft-complete', 'a note');
  await persistLocalState(scope, base, { data: [] }, true, { id: 'parser-draft-complete', results: [], review: false });
  closeLocalStore(); const local = await readLocalState(scope); const draft = (await readDrafts(scope))[0];
  assert.equal(local.data?.data[0].id, item.id); assert.equal(local.operations.length, 4);
  assert.ok(draft.completedAt); assert.equal(draft.review, false);
});

 test('save options do not become durable config mutations', async () => {
  const scope = 'options-boundary';
  await persistLocalState(scope, { data: [], appSettings: { hideMoney: true }, forceOverwrite: false } as any);
  const local = await readLocalState(scope);
  assert.equal(local.operations.some(operation => operation.entityId === 'forceOverwrite'), false);
  assert.equal(Object.hasOwn(local.data!, 'forceOverwrite'), false);
});

test('field review resolves one entity and preserves another unresolved local conflict', async () => {
 const scope = 'field-choice-review'; const second = { ...item, id: 'two' };
 const original = { ...base, data: [item, second] };
 const edited = { ...original, data: [{ ...item, content: 'local one', meta: { amount: 20 } }, { ...second, content: 'local two' }] };
 await persistLocalState(scope, edited, original);
 const pending = (await readLocalState(scope)).operations;
 await changeOperationState(scope, pending.map(op => op.operationId), 'conflict');
 const remote = { ...original, data: [{ ...item, content: 'remote one', meta: { amount: 30 } }, { ...second, content: 'remote two' }] };
 await resolveLocalConflicts(scope, remote, false, 'one', { 'entity.content': 'local', 'entity.meta.amount': 'remote' });
 const result = await readLocalState(scope);
 assert.equal(result.data?.data.find(value => value.id === 'one')?.content, 'local one');
 assert.equal(result.data?.data.find(value => value.id === 'one')?.meta.amount, 30);
 assert.equal(result.data?.data.find(value => value.id === 'two')?.content, 'local two');
 assert.equal(result.operations.find(op => op.entityId === 'two')?.state, 'conflict');
 // Resolving the first item creates a pending mutation; it must not lock the second review.
 await resolveLocalConflicts(scope, remote, false, 'two', { 'entity.content': 'local' });
 const resolved = await readLocalState(scope);
 assert.equal(resolved.operations.filter(op => op.state === 'conflict').length, 0);
 assert.equal(resolved.operations.filter(op => op.state === 'pending').length, 2);
 assert.equal(resolved.data?.data.find(value => value.id === 'one')?.content, 'local one');
 assert.equal(resolved.data?.data.find(value => value.id === 'two')?.content, 'local two');
});

test('review preserves unrelated accepted operations and rebases only the selected conflict', async () => {
 const scope = 'review-unrelated-accepted';
 const second = { ...item, id: 'two' }; const original = { data: [item, second] };
 await persistLocalState(scope, { data: [{ ...item, content: 'local one' }, { ...second, content: 'local two' }] }, original);
 const queued = (await readLocalState(scope)).operations;
 const selected = queued.find(op => op.entityId === 'one')!;
 const unrelated = queued.find(op => op.entityId === 'two')!;
 await changeOperationState(scope, [selected.operationId], 'conflict');
 await changeOperationState(scope, [unrelated.operationId], 'accepted');
 const before = (await readLocalState(scope)).operations.find(op => op.entityId === 'two');
 await resolveLocalConflicts(scope, { data: [{ ...item, content: 'remote one', meta: { tags: ['remote'] } }, second] }, false, 'one', { 'entity.content': 'local' });
 const after = await readLocalState(scope);
 assert.deepEqual(after.operations.find(op => op.entityId === 'two'), before);
 assert.equal(after.data?.data.find(value => value.id === 'two')?.content, 'local two');
 assert.deepEqual(after.data?.data.find(value => value.id === 'one')?.meta.tags, ['remote']);
 assert.equal(after.operations.find(op => op.entityId === 'one')?.state, 'pending');
});

test('review folds unsent edits on the same conflicted item but refuses unknown in-flight acceptance', async () => {
 const scope = 'review-pending-descendant'; const original = { data: [item] };
 await persistLocalState(scope, { data: [{ ...item, content: 'first edit' }] }, original);
 const conflict = (await readLocalState(scope)).operations[0];
 await changeOperationState(scope, [conflict.operationId], 'conflict');
 await persistLocalState(scope, { data: [{ ...item, content: 'latest edit' }] });
 const local = await readLocalState(scope);
 const descendant = local.operations.find(op => op.state === 'pending')!;
 await changeOperationState(scope, [descendant.operationId], 'sending');
 const frozen = await readLocalState(scope);
 const remote = { data: [{ ...item, content: 'remote' }] };
 await assert.rejects(resolveLocalConflicts(scope, remote, false, 'one', { 'entity.content': 'local' }), /masih dikirim/);
 assert.deepEqual(await readLocalState(scope), frozen);
 // Simulate a confirmed terminal conflict; no uncertain request may be discarded.
 await changeOperationState(scope, [descendant.operationId], 'conflict');
 await persistLocalState(scope, { data: [{ ...item, content: 'newest unsent edit' }] });
 await resolveLocalConflicts(scope, remote, false, 'one', { 'entity.content': 'local' });
 const resolved = await readLocalState(scope);
 assert.equal(resolved.operations.length, 1);
 assert.equal(resolved.operations[0].state, 'pending');
 assert.equal((resolved.operations[0].before as any).content, 'remote');
 assert.equal((resolved.operations[0].after as any).content, 'newest unsent edit');
 assert.equal(resolved.operations[0].parentOperationId, undefined);
});
