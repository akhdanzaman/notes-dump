import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemType } from '../../types';
import { getNoteDisplayParts } from '../noteDisplay';

test('note display uses dedicated title and content preview', () => {
  const display = getNoteDisplayParts({
    type: ItemType.NOTE,
    content: 'First paragraph\nSecond paragraph',
    meta: { title: 'Meeting Decisions' },
  });

  assert.equal(display.title, 'Meeting Decisions');
  assert.equal(display.preview, 'First paragraph Second paragraph');
  assert.equal(display.hasDedicatedTitle, true);
});

test('legacy note display derives title from first line and previews remaining content', () => {
  const display = getNoteDisplayParts({
    type: ItemType.NOTE,
    content: '# Vendor Follow-up\nAsk for PO timeline\nConfirm WhatsApp contact',
    meta: {},
  });

  assert.equal(display.title, 'Vendor Follow-up');
  assert.equal(display.preview, 'Ask for PO timeline Confirm WhatsApp contact');
  assert.equal(display.hasDedicatedTitle, false);
});
