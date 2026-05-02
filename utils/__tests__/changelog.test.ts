import test from 'node:test';
import assert from 'node:assert/strict';

import { CHANGELOG_ENTRIES, LATEST_CHANGELOG, LATEST_CHANGELOG_VERSION, SEEN_CHANGELOG_STORAGE_KEY } from '../changelog';

test('latest changelog is the first centralized entry used for once-per-version popups', () => {
  assert.equal(LATEST_CHANGELOG, CHANGELOG_ENTRIES[0]);
  assert.equal(LATEST_CHANGELOG_VERSION, CHANGELOG_ENTRIES[0].version);
  assert.match(SEEN_CHANGELOG_STORAGE_KEY, /changelog/);
  assert.ok(LATEST_CHANGELOG.items.length > 0);
});
