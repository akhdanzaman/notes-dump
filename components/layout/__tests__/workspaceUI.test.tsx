import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RecordRow from '../RecordRow';
import Card from '../../Card';
import DesktopCommandBar from '../DesktopCommandBar';
import { ItemType } from '../../../types';
import { responsiveShellClass } from '../responsiveShell';
import InputBar from '../../InputBar';
import { readFileSync } from 'node:fs';

test('every desktop menu has a sticky header inside the bounded content scroller', () => {
  for (const activeTab of ['summary', 'plan', 'library', 'money', 'calendar'] as const) {
    const html = renderToStaticMarkup(<DesktopCommandBar activeTab={activeTab} query="" onSearch={() => {}} onCreate={() => {}} onCapture={() => {}} onFilters={() => {}} onReview={() => {}} reviewCount={0} />);
    assert.match(html, /class="sticky top-0/);
    assert.doesNotMatch(html, /class="fixed/);
  }
  assert.ok(responsiveShellClass.root.includes('lg:h-[calc(100dvh-32px)]'));
  assert.ok(responsiveShellClass.root.includes('lg:overflow-hidden'));
  assert.ok(responsiveShellClass.main.includes('lg:h-full'));
  assert.ok(responsiveShellClass.main.includes('lg:overflow-y-auto'));
  assert.ok(responsiveShellClass.main.includes('lg:[padding-top:0]'));
});

test('composer feedback stays in document flow and text has a separate action row', () => {
  const html = renderToStaticMarkup(<InputBar onSend={() => {}} error="Offline feedback" topContent={<div>Capture progress</div>} showReviewCenterButton language="id" />);
  assert.match(html, /Offline feedback/);
  assert.match(html, /Capture progress/);
  assert.match(html, /data-composer-controls="true"/);
  assert.match(html, /col-span-2 row-start-1/);
  assert.match(html, /col-start-2 row-start-2/);
  assert.doesNotMatch(html, /absolute bottom-full/);
});

test('font inheritance stays in the base layer so component typography can override it', () => {
  const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
  assert.match(css, /@layer base\s*\{\s*button,\s*input,\s*textarea,\s*select\s*\{\s*font: inherit;/);
});

test('operational task row preserves status, priority, next action, progress and subtasks', () => {
  const html = renderToStaticMarkup(<RecordRow item={{id:'test',type:ItemType.TODO,content:'Ship the report',status:'pending',created_at:'2026-09-24',meta:{priority:'high',deepWorkNextAction:'Review the draft',progress:50,tags:['work']}}} language="en" childCount={3} onOpen={() => {}} onToggle={() => {}} />);
  for (const text of ['Ship the report','Review the draft','High priority','50%','3','subtasks','#work','Complete: Ship the report','Open: Ship the report']) assert.ok(html.includes(text), text);
  assert.match(html, /aria-pressed="false"/);
  assert.doesNotMatch(html, /textarea/);
});

test('note rows render untrusted text safely without task completion controls', () => {
  const html = renderToStaticMarkup(<RecordRow item={{id:'note',type:ItemType.NOTE,content:'<script>not executable</script>',status:'pending',created_at:'bad-date',meta:{}}} language="id" onOpen={() => {}} />);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Buka:/);
  assert.doesNotMatch(html, /aria-pressed|<script>/);
});

test('desktop command bar exposes scoped search, filters, creation, capture and review', () => {
  const html = renderToStaticMarkup(<DesktopCommandBar activeTab="money" language="en" query="" onSearch={() => {}} onCreate={() => {}} onCapture={() => {}} onFilters={() => {}} onReview={() => {}} reviewCount={2} />);
  for (const text of ['Search this workspace','Filters and sorting','Capture / Ask','New','Review queue (2)']) assert.ok(html.includes(text), text);
  assert.match(html, /aria-expanded="false"/);
  assert.match(responsiveShellClass.fixedBottom, /desktop-capture/);
});

test('overview does not show a search box that cannot filter its dashboard', () => {
  const html = renderToStaticMarkup(<DesktopCommandBar activeTab="summary" language="id" query="" onSearch={() => {}} onCreate={() => {}} onCapture={() => {}} onFilters={() => {}} onReview={() => {}} reviewCount={0} />);
  assert.doesNotMatch(html, /<input/);
  assert.match(html, /Catat \/ Tanya/);
  assert.match(html, /Baru/);
});

test('detail-only task editor exposes its edit and subtask controls without an inline-collapse trigger', () => {
  const html = renderToStaticMarkup(<Card item={{id:'detail',type:ItemType.TODO,content:'Full task content',status:'pending',created_at:'2026-09-24',meta:{}}} enableCollapse={false} defaultCollapsed={false} collapsibleEditPanel editPanelExpanded={false} editPanelControls={<button>Edit task</button>} extraExpandedContent={<div>Nested task editor</div>} onUpdate={() => {}} />);
  for (const text of ['Full task content', 'Edit task', 'Nested task editor']) assert.ok(html.includes(text), text);
});
