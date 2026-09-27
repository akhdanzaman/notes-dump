import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoogleCalendarEvents, calendarEventMatches, syncItemsToGoogleCalendar } from '../googleCalendarService';
import { ItemType, type BrainDumpItem } from '../../types';

const item: BrainDumpItem = { id: 'todo', type: ItemType.TODO, status: 'pending', content: 'Report', created_at: '2026-09-01', meta: { start: '2026-09-27T09:00:00+07:00', end: '2026-09-27T10:00:00+07:00' } };

test('calendar comparison normalizes equivalent offsets and detects content/recurrence changes', () => {
  const desired = buildGoogleCalendarEvents([item])[0];
  const existing = { ...desired, id: 'event', start: { dateTime: '2026-09-27T09:00:00+07:00' }, end: { dateTime: '2026-09-27T10:00:00+07:00' } };
  assert.equal(calendarEventMatches(desired, existing), true);
  assert.equal(calendarEventMatches(desired, { ...existing, summary: 'different' }), false);
  assert.equal(calendarEventMatches(desired, { ...existing, recurrence: ['RRULE:FREQ=DAILY'] }), false);
});

test('calendar only writes changed/new events, deletes removed items and clears old recurrence', async (t) => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify({ access_token: 'synthetic', expires_at: Date.now() + 3600000 }) } });
  t.after(() => { if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else Reflect.deleteProperty(globalThis, 'localStorage'); });
  const desired = buildGoogleCalendarEvents([item])[0];
  let existing = [{ ...desired, id: 'event' }];
  const writes: { method: string; body: any }[] = [];
  t.mock.method(globalThis, 'fetch', async (_url, init: RequestInit = {}) => {
    if (!init.method) return new Response(JSON.stringify({ items: existing }));
    writes.push({ method: init.method, body: init.body ? JSON.parse(String(init.body)) : null });
    return new Response('{}');
  });
  const settings = { googleCalendarSyncEnabled: true };
  const unchanged = await syncItemsToGoogleCalendar([item], settings);
  assert.equal(unchanged.skipped, 1);
  assert.equal(writes.length, 0);
  existing = [{ ...desired, id: 'event', recurrence: ['RRULE:FREQ=DAILY'] }];
  const changed = await syncItemsToGoogleCalendar([item], settings);
  assert.equal(changed.updated, 1);
  assert.deepEqual(writes[0].body.recurrence, []);
  const removed = await syncItemsToGoogleCalendar([], settings);
  assert.equal(removed.deleted, 1);
  existing = [];
  const added = await syncItemsToGoogleCalendar([item], settings);
  assert.equal(added.created, 1);
  assert.deepEqual(writes.map(w => w.method), ['PATCH', 'DELETE', 'POST']);
});
