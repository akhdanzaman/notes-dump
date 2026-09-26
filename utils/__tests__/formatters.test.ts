import assert from 'node:assert/strict';
import test from 'node:test';

import { formatCurrencyAmount } from '../formatters';

test('shared currency formatter keeps IDR whole and foreign currency fractional', () => {
  assert.match(formatCurrencyAmount(12_500, 'IDR'), /12\.500/);
  assert.match(formatCurrencyAmount(12.5, 'USD'), /12,50|12\.50/);
});

test('shared currency formatter treats missing amounts as zero', () => {
  assert.match(formatCurrencyAmount(undefined, 'IDR'), /0/);
});
