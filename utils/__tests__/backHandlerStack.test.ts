import test from 'node:test';
import assert from 'node:assert/strict';

import { BackHandler } from '../backHandler';

test('NDZ-023 BackHandler closes layered overlays in last-opened order', () => {
  const closed: string[] = [];
  const cleanupSearch = BackHandler.register(() => {
    closed.push('search');
    return true;
  });
  const cleanupChat = BackHandler.register(() => {
    closed.push('chat');
    return true;
  });
  const cleanupDialog = BackHandler.register(() => {
    closed.push('dialog');
    return true;
  });

  try {
    assert.equal(BackHandler.handle(), true);
    cleanupDialog();
    assert.deepEqual(closed, ['dialog']);

    assert.equal(BackHandler.handle(), true);
    cleanupChat();
    assert.deepEqual(closed, ['dialog', 'chat']);

    assert.equal(BackHandler.handle(), true);
    cleanupSearch();
    assert.deepEqual(closed, ['dialog', 'chat', 'search']);
  } finally {
    cleanupDialog();
    cleanupChat();
    cleanupSearch();
  }
});
