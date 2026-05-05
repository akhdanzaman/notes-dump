import test from 'node:test';
import assert from 'node:assert/strict';

import { contentSurface, responsiveModal, TABLET_BASELINE } from '../contentSurface';
import { RESPONSIVE_SHELL, responsiveShellClass } from '../responsiveShell';

test('NDZ-016 tablet baseline is explicit and bounded before desktop rail', () => {
  assert.equal(TABLET_BASELINE.minWidth, 640);
  assert.equal(TABLET_BASELINE.maxWidth, 1023);
  assert.equal(TABLET_BASELINE.desktopBreakpointClass, 'lg');
  assert.equal(RESPONSIVE_SHELL.desktopBreakpoint, 'lg');
  assert.match(responsiveShellClass.main, /lg:ml-72/);
  assert.match(responsiveShellClass.bottomNavWrap, /lg:hidden/);
});

test('NDZ-016 keeps tablet masonry at two columns until lg desktop expansion', () => {
  assert.equal(contentSurface.tabletMasonryGrid, 'columns-1 sm:columns-2 gap-4');
  assert.match(contentSurface.masonryGrid, /columns-1/);
  assert.match(contentSurface.masonryGrid, /sm:columns-2/);
  assert.match(contentSurface.masonryGrid, /lg:columns-3/);
  assert.doesNotMatch(contentSurface.tabletMasonryGrid, /md:columns-3|md:grid|lg:columns-3/);
});

test('NDZ-016 keeps existing sm modal centering behavior', () => {
  assert.match(responsiveModal.sheetOverlay, /items-end/);
  assert.match(responsiveModal.sheetOverlay, /sm:items-center/);
  assert.match(responsiveModal.sheetOverlay, /p-0/);
  assert.match(responsiveModal.sheetOverlay, /sm:p-4/);
  assert.match(responsiveModal.formPanel, /max-w-md/);
  assert.match(responsiveModal.formPanel, /lg:max-w-2xl/);
  assert.doesNotMatch(responsiveModal.sheetOverlay, /md:items-start|md:items-end/);
});
