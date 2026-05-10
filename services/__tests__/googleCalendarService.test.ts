import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoogleCalendarEvents } from '../googleCalendarService';
import { BrainDumpItem, ItemType } from '../../types';

const baseItem = (overrides: Partial<BrainDumpItem>): BrainDumpItem => ({
  id: 'item-1',
  type: ItemType.TODO,
  content: 'finish report',
  status: 'pending',
  created_at: '2026-05-10T00:00:00.000Z',
  ...overrides,
  meta: { date: '2026-05-12T00:00:00.000Z', ...(overrides.meta || {}) },
});

test('buildGoogleCalendarEvents exports dated app items with stable Arkaiv metadata', () => {
  const events = buildGoogleCalendarEvents([
    baseItem({ id: 'todo-1', content: 'finish report', meta: { title: 'Report', date: '2026-05-12T00:00:00.000Z' } }),
    baseItem({ id: 'note-1', type: ItemType.NOTE, content: 'not dated', meta: { date: '2026-05-12T00:00:00.000Z' } }),
    baseItem({ id: 'hidden-1', content: 'hidden', meta: { date: '2026-05-12T00:00:00.000Z', hideFromCalendar: true } }),
  ]);

  assert.equal(events.length, 1);
  assert.equal(events[0].summary, 'Report');
  assert.equal(events[0].start.date, '2026-05-12');
  assert.equal(events[0].end.date, '2026-05-13');
  assert.equal(events[0].extendedProperties.private.arkaivSource, 'arkaiv');
  assert.equal(events[0].extendedProperties.private.arkaivItemId, 'todo-1');
});

test('buildGoogleCalendarEvents creates timed recurring calendar events', () => {
  const events = buildGoogleCalendarEvents([
    baseItem({
      id: 'routine-1',
      type: ItemType.EVENT,
      content: 'weekly review',
      meta: {
        start: '2026-05-12T09:00:00.000Z',
        end: '2026-05-12T10:00:00.000Z',
        isRoutine: true,
        routineInterval: 'weekly',
        routineDaysOfWeek: [2],
      },
    }),
  ]);

  assert.equal(events.length, 1);
  assert.equal(events[0].start.dateTime, '2026-05-12T09:00:00.000Z');
  assert.equal(events[0].end.dateTime, '2026-05-12T10:00:00.000Z');
  assert.deepEqual(events[0].recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=TU']);
});
