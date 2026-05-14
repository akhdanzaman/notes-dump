import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateFirstDueDate, calculateNextDueDate } from '../selectors/dateUtils';

test('monthly routine dates clamp end-of-month selections instead of overflowing months', () => {
  const next = calculateNextDueDate(new Date('2026-01-31T09:00:00.000Z'), 'monthly', [], [31], []);
  assert.equal(next.toISOString(), '2026-02-28T09:00:00.000Z');

  const following = calculateNextDueDate(next, 'monthly', [], [31], []);
  assert.equal(following.toISOString(), '2026-03-31T09:00:00.000Z');
});

test('first monthly routine date accepts today and clamps invalid selected days in short months', () => {
  const today = calculateFirstDueDate(new Date('2026-02-28T00:00:00.000Z'), 'monthly', [], [31], []);
  assert.equal(today.toISOString(), '2026-02-28T00:00:00.000Z');

  const later = calculateFirstDueDate(new Date('2026-02-20T00:00:00.000Z'), 'monthly', [], [31], []);
  assert.equal(later.toISOString(), '2026-02-28T00:00:00.000Z');
});
