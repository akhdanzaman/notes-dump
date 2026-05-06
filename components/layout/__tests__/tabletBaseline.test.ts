import test from 'node:test';
import assert from 'node:assert/strict';

import { contentSurface, responsiveModal, TABLET_BASELINE, taskEditSurface } from '../contentSurface';
import { getResponsiveShellContentVariant, RESPONSIVE_SHELL, responsiveShellClass } from '../responsiveShell';

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

test('NDZ-017 gives Summary and filled desktop tabs the workspace shell', () => {
  assert.equal(getResponsiveShellContentVariant({
    activeTab: 'summary',
    planSubTab: 'tasks',
    librarySubTab: 'general',
    moneyView: 'transactions',
  }), 'workspace');

  assert.equal(getResponsiveShellContentVariant({
    activeTab: 'library',
    planSubTab: 'tasks',
    librarySubTab: 'skills',
    moneyView: 'transactions',
  }), 'workspace');

  assert.equal(getResponsiveShellContentVariant({
    activeTab: 'money',
    planSubTab: 'tasks',
    librarySubTab: 'general',
    moneyView: 'budget',
  }), 'workspace');
});

test('NDZ-017 keeps Summary dashboard dense on wide desktop without new widget slots', () => {
  assert.match(contentSurface.summaryDashboardGrid, /lg:grid-cols-\[minmax\(0,1fr\)_21rem\]/);
  assert.match(contentSurface.summaryDashboardGrid, /xl:grid-cols-\[minmax\(0,1fr\)_23rem\]/);
  assert.match(contentSurface.summaryDashboardGrid, /2xl:grid-cols-\[minmax\(0,1fr\)_25rem\]/);
  assert.doesNotMatch(contentSurface.summaryDashboardGrid, /repeat\(|3fr|4fr/);
});

test('NDZ-018 gives Plan/Focus task editing a wider workspace without changing the tablet breakpoint', () => {
  assert.equal(getResponsiveShellContentVariant({
    activeTab: 'plan',
    planSubTab: 'tasks',
    librarySubTab: 'general',
    moneyView: 'transactions',
  }), 'workspace');

  assert.match(contentSurface.taskWorkspaceGrid, /lg:grid-cols-\[repeat\(2,minmax\(22rem,1fr\)\)\]/);
  assert.match(contentSurface.taskWorkspaceGrid, /min-\[1440px\]:grid-cols-\[minmax\(23rem,1\.2fr\)_repeat\(2,minmax\(21rem,1fr\)\)\]/);
  assert.match(contentSurface.taskWorkspaceGrid, /2xl:grid-cols-\[minmax\(24rem,1\.2fr\)_repeat\(2,minmax\(22rem,1fr\)\)\]/);
  assert.doesNotMatch(contentSurface.taskWorkspaceGrid, /md:grid|md:grid-cols/);
});

test('NDZ-018 separates passive list density from edit-card comfort controls', () => {
  assert.match(contentSurface.denseList, /lg:space-y-2/);
  assert.match(taskEditSurface.cardExpanded, /lg:p-4/);
  assert.match(taskEditSurface.textarea, /lg:min-h-\[104px\]/);
  assert.match(taskEditSurface.fieldGrid, /lg:gap-4/);
  assert.match(taskEditSurface.priorityButton, /lg:py-3/);
  assert.match(taskEditSurface.progressPanel, /lg:p-4/);
  assert.match(taskEditSurface.actions, /sm:flex-row/);
});

test('NDZ-019 gives Money a workspace shell and fixed context rail', () => {
  assert.equal(getResponsiveShellContentVariant({
    activeTab: 'money',
    planSubTab: 'tasks',
    librarySubTab: 'general',
    moneyView: 'wallets',
  }), 'workspace');

  assert.equal(getResponsiveShellContentVariant({
    activeTab: 'money',
    planSubTab: 'tasks',
    librarySubTab: 'general',
    moneyView: 'transactions',
  }), 'workspace');

  assert.equal(getResponsiveShellContentVariant({
    activeTab: 'money',
    planSubTab: 'tasks',
    librarySubTab: 'general',
    moneyView: 'budget',
  }), 'workspace');

  assert.match(contentSurface.moneyHeaderGrid, /lg:grid-cols-\[minmax\(0,1fr\)_22rem\]/);
  assert.match(contentSurface.moneyHeaderGrid, /xl:grid-cols-\[minmax\(0,1fr\)_24rem\]/);
  assert.match(contentSurface.moneyWorkspaceGrid, /2xl:grid-cols-\[minmax\(0,1fr\)_25rem\]/);
  assert.match(contentSurface.moneySideCard, /lg:sticky/);
  assert.doesNotMatch(contentSurface.moneyWorkspaceGrid, /repeat\(|md:grid|3fr|4fr/);
});

test('NDZ-020 makes Library sparse states intentional without changing the tablet masonry contract', () => {
  assert.match(contentSurface.libraryEmptyState, /max-w-3xl/);
  assert.match(contentSurface.libraryEmptyState, /lg:max-w-4xl/);
  assert.match(contentSurface.libraryEmptyActions, /sm:flex-row/);
  assert.match(contentSurface.libraryEmptyActions, /lg:justify-start/);
  assert.doesNotMatch(contentSurface.libraryEmptyState, /md:/);
});

test('Calendar uses the workspace width when desktop tabs fill the main shell', () => {
  assert.equal(getResponsiveShellContentVariant({
    activeTab: 'calendar',
    planSubTab: 'tasks',
    librarySubTab: 'general',
    moneyView: 'transactions',
  }), 'workspace');

  assert.match(contentSurface.calendarFrame, /w-full/);
  assert.doesNotMatch(contentSurface.calendarFrame, /max-w-6xl|2xl:max-w-6xl|max-w-\[96rem\]|max-w-7xl|2xl:max-w-\[90rem\]/);
});

test('NDZ-022 maps responsive modal form variants by density', () => {
  assert.match(responsiveModal.formPanel, /max-w-md/);
  assert.match(responsiveModal.formPanel, /lg:max-w-2xl/);
  assert.match(responsiveModal.denseFormPanel, /max-w-md/);
  assert.match(responsiveModal.denseFormPanel, /lg:max-w-3xl/);
  assert.match(responsiveModal.fieldGrid, /lg:grid-cols-2/);
  assert.doesNotMatch(responsiveModal.formPanel, /lg:max-w-3xl/);
});

test('NDZ-024 keeps destructive confirms compact and visually separate from dense forms', () => {
  assert.match(responsiveModal.confirmPanel, /max-w-xs/);
  assert.match(responsiveModal.destructiveConfirmPanel, /max-w-xs/);
  assert.match(responsiveModal.destructiveConfirmPanel, /border-red-500\/30/);
  assert.doesNotMatch(responsiveModal.destructiveConfirmPanel, /lg:max-w-2xl|lg:max-w-3xl/);
});
