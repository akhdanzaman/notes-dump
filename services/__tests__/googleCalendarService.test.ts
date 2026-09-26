import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGoogleCalendarEvents } from '../googleCalendarService';
import { BrainDumpItem, ItemType } from '../../types';
import { getLocalDateKey } from '../../utils/selectors/dateUtils';

const baseItem = (overrides: Partial<BrainDumpItem>): BrainDumpItem => ({
  id: 'item-1',
  type: ItemType.TODO,
  content: 'finish report',
  status: 'pending',
  created_at: '2026-05-10T00:00:00.000Z',
  ...overrides,
  meta: { date: '2026-05-12T00:00:00.000Z', ...(overrides.meta || {}) },
});

test('all-day dates preserve local midnight in Jakarta, including normalized UTC timestamps', () => {
  const previousTZ = process.env.TZ;
  const previousTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  process.env.TZ = 'Asia/Jakarta';
  try {
    for (const date of ['2026-09-25T00:00:00+07:00', '2026-09-24T17:00:00.000Z', '2026-09-25']) {
      const [event] = buildGoogleCalendarEvents([baseItem({ meta: { date } })]);
      assert.equal(event.start.date, '2026-09-25');
      assert.equal(event.end.date, '2026-09-26');
      assert.equal(getLocalDateKey(date), '2026-09-25');
    }
  } finally {
    process.env.TZ = previousTZ || previousTimezone;
    if (previousTZ === undefined) delete process.env.TZ;
  }
});

test('date-only calendar events stay on the selected date across DST and year boundaries', () => {
  const previousTZ = process.env.TZ;
  const previousTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  process.env.TZ = 'America/Los_Angeles';
  try {
    for (const [date, next] of [['2026-03-08', '2026-03-09'], ['2026-11-01', '2026-11-02'], ['2026-12-31', '2027-01-01']]) {
      const [event] = buildGoogleCalendarEvents([baseItem({ meta: { date } })]);
      assert.equal(event.start.date, date);
      assert.equal(event.end.date, next);
      assert.equal(getLocalDateKey(new Date(`${date}T00:00:00`).toISOString()), date, 'task local-midnight save must round-trip');
    }
  } finally {
    process.env.TZ = previousTZ || previousTimezone;
    if (previousTZ === undefined) delete process.env.TZ;
  }
});

test('buildGoogleCalendarEvents exports dated app items with stable Arkaiv metadata', () => {
  const events = buildGoogleCalendarEvents([
    baseItem({ id: 'todo-1', content: 'finish report', meta: { title: 'Report', date: '2026-05-12' } }),
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
