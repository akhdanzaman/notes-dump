import test from 'node:test';
import assert from 'node:assert/strict';
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';
import Card from '../../components/Card';
import { useLazyItems } from '../useLazyItems';
import { BackHandler } from '../../utils/backHandler';
import { useEditorDraft } from '../useEditorDraft';
import { useDatabaseSave } from '../useDatabaseSave';
import { useControlCenter } from '../useControlCenter';
import PresencePanel from '../../motion/PresencePanel';
import { closeLocalStore, readLocalState } from '../../services/localOutbox';
import { ItemType, DbSchema } from '../../types';
import SyncOutboxPanel from '../../components/SyncOutboxPanel';
import { persistLocalState, changeOperationState } from '../../services/localOutbox';
import { saveSpreadsheetConfig, clearSpreadsheetConfig } from '../../services/spreadsheetService';
import { generateExportData } from '../../utils/exportUtils';

test('conflict choices apply sequentially while an unrelated item is accepted', async t => {
 const h = await environment(); const scope = 'ui-conflict-choices';
 const makeItem = (id: string, content: string) => ({ id, content, type: ItemType.NOTE, status: 'pending' as const, created_at: '2026-10-13', meta: {} });
 const original = { data: ['one', 'two', 'three'].map(id => makeItem(id, `old ${id}`)) };
 const local = { data: original.data.map(item => ({ ...item, content: `local ${item.id}` })) };
 const remote = { data: original.data.map(item => ({ ...item, content: `remote ${item.id}` })) };
 const sheets = generateExportData(remote.data, [], [], { monthlyIncome: 0, rules: [] }, {}, { defaultCollapsed: false, hideMoney: false });
 const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
 const mock = t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
   const url = String(input);
   if (url.endsWith('/session')) return json({ csrfToken: 'synthetic' });
   if (url.endsWith('/capabilities')) return json({ enabled: false, ready: false });
   const path = new URL(url, 'http://synthetic').searchParams.get('path') || '';
   if (path.startsWith('?')) return json({ sheets: sheets.map(sheet => ({ properties: { title: sheet.name } })) });
   const ranges = new URLSearchParams(path.split('?')[1]).getAll('ranges');
   return json({ valueRanges: ranges.map(range => ({ range, values: sheets.find(sheet => range.startsWith(`'${sheet.name}'!`))?.data || [] })) });
 });
 const settle = async (ready: () => boolean) => {
   for (let attempt = 0; attempt < 100 && !ready(); attempt++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
   assert.ok(ready(), document.body.textContent || 'UI did not settle');
 };
 try {
   clearSpreadsheetConfig(); saveSpreadsheetConfig({ spreadsheetId: scope, spreadsheetUrl: 'https://example.invalid', authMode: 'service_account' });
   await persistLocalState(scope, local, original);
   const operations = (await readLocalState(scope)).operations;
   await changeOperationState(scope, operations.filter(op => op.entityId !== 'three').map(op => op.operationId), 'conflict');
   await changeOperationState(scope, operations.filter(op => op.entityId === 'three').map(op => op.operationId), 'accepted');
   await h.render(<SyncOutboxPanel />);
   await settle(() => document.querySelectorAll('section input[type=radio]').length === 4);
   for (const remaining of [2, 1]) {
     const section = document.querySelector('section')!;
     const button = section.querySelector('button')!;
     assert.equal(button.disabled, true, 'field choice is required');
     await act(async () => section.querySelector<HTMLInputElement>('input[type=radio]')!.click());
     assert.equal(button.disabled, false, 'unrelated accepted/pending operations must not lock Apply');
     await act(async () => button.click());
     await settle(() => document.querySelectorAll('section').length === remaining - 1);
   }
   const resolved = await readLocalState(scope);
   assert.equal(resolved.operations.some(op => op.state === 'conflict'), false);
   assert.equal(resolved.operations.find(op => op.entityId === 'three')?.state, 'accepted');
   assert.deepEqual(resolved.data?.data.map(item => item.content), ['local one', 'local two', 'local three']);
 } finally { mock.mock.restore(); clearSpreadsheetConfig(); await h.close(); }
});

test('successful editor save closes only after the local save acknowledges', async () => {
 const h = await environment(); let closed=0; let acknowledge!:()=>void;
 const pending = new Promise<void>(resolve=>{acknowledge=resolve;});
 const item={id:'save-close',type:ItemType.NOTE,content:'original',status:'pending' as const,created_at:'2026-10-12',meta:{}};
 try {
  await h.render(<Card item={item} enableCollapse={false} defaultCollapsed={false} onUpdate={()=>pending} onSaveComplete={()=>closed++} />);
  await act(async()=>{(Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.includes('Simpan perubahan')) as HTMLButtonElement).click();});
  assert.equal(closed,0);
  await act(async()=>acknowledge()); assert.equal(closed,1);
 } finally { await h.close(); }
});

test('settings save awaits persistence before closing and remains open on failure', async () => {
 const h=await environment(); let controls!:ReturnType<typeof useControlCenter>; let closed=0; let acknowledge!:()=>void; let fail=false;
 const pending=new Promise<void>(resolve=>{acknowledge=resolve;});
 const props={isOpen:true, appSettings:{} as any, setAppSettings:()=>{}, onSave:()=>fail ? Promise.reject(new Error('Storage full')) : pending, onClose:()=>closed++, onSyncClick:()=>{}, allItems:[], allSkills:[], allWallets:[], monthlyThemes:{},monthlyThemeImages:{}};
 function Host() { controls=useControlCenter(props); return null; }
 try {
  await h.render(<Host />); let saving!:Promise<void>; await act(async()=>{saving=controls.handleSave();});
  assert.equal(closed,0); assert.equal(controls.settingsSaveStatus,'saving');
  await act(async()=>{acknowledge(); await saving;}); assert.equal(closed,1);
  fail=true; await act(async()=>{await controls.handleSave();}); assert.equal(closed,1); assert.equal(controls.settingsSaveStatus,'idle');
 } finally { await h.close(); }
});

async function environment() {
 const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/', pretendToBeVisual: true });
 const values = { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, indexedDB, IS_REACT_ACT_ENVIRONMENT: true };
 const originals = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
 for (const [key,value] of Object.entries(values)) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
 // React is imported before JSDOM; satisfy its legacy input-event feature probe.
 Object.assign(dom.window.HTMLElement.prototype, { attachEvent() {}, detachEvent() {} });
 const root = createRoot(document.getElementById('root')!);
 return { root, dom, render: async (node: React.ReactNode) => { await act(async () => root.render(node)); }, close: async () => { await act(async () => root.unmount()); closeLocalStore(); dom.window.close(); for (const [key,value] of originals) value ? Object.defineProperty(globalThis,key,value) : Reflect.deleteProperty(globalThis,key); } };
}

test('draft recovery preserves input across unmount and switching entity IDs does not mix drafts', async () => {
 const h = await environment(); let draft!: ReturnType<typeof useEditorDraft>; let change: (value:string) => void;
 function Host({id}:{id:string}) { const [text,setText] = useState(''); change = setText; draft = useEditorDraft(id,{text},value => setText(value.text)); return <p>{text}</p>; }
 try {
  await h.render(<Host id="a" />); await act(async () => { draft.markDirty(); change('unsaved a'); });
  await h.render(<Host id="b" />); await act(async () => { draft.markDirty(); change('unsaved b'); });
  await h.render(<Host id="a" />); assert.equal(document.querySelector('p')?.textContent,'unsaved a');
  await h.render(null); await h.render(<Host id="b" />); assert.equal(document.querySelector('p')?.textContent,'unsaved b');
  draft.clear(); await h.render(null); assert.equal(localStorage.getItem('arkaiv-editor:local:b'),null);
 } finally { await h.close(); }
});

test('dirty close asks for discard, while an inner remove-X button does not close the editor', async () => {
 const h = await environment(); let closes = 0, removed = 0;
 try {
  await h.render(<PresencePanel isOpen presentation="form" onClose={() => closes++} overlayClassName="overlay" panelClassName="panel" ariaLabel="Editor"><input aria-label="Name" /><button onClick={() => removed++}><span className="lucide-x" />Remove line</button><button data-editor-close onClick={() => closes++}>Tutup editor</button></PresencePanel>);
  await act(async () => document.querySelector('input')!.dispatchEvent(new h.dom.window.Event('input',{bubbles:true})));
  await act(async () => (Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Remove line') as HTMLButtonElement).click());
  assert.equal(removed,1); assert.equal(closes,0);
  await act(async () => (Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Tutup editor') as HTMLButtonElement).click());
  assert.equal(closes,0); assert.ok(document.querySelector('[role=alertdialog]')); assert.ok(document.querySelector('[inert]'));
  await act(async () => (Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Lanjut edit') as HTMLButtonElement).click()); assert.equal(closes,0);
  await act(async () => (Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Tutup editor') as HTMLButtonElement).click());
  await act(async () => (Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Buang perubahan') as HTMLButtonElement).click()); assert.equal(closes,1); await h.render(null); assert.equal(document.body.style.overflow,'');
 } finally { await h.close(); }
});

test('local save commits entities and outbox before publishing, and storage failure leaves state untouched', async () => {
 const h = await environment(); let save: ReturnType<typeof useDatabaseSave>; let data: DbSchema = { data: [] }; let publishes=0;
 function Host() { save = useDatabaseSave({ read: () => data, apply: next => { data=next; publishes++; }, hasActiveParsing: () => true, pendingSaveAfterParsingRef: {current:null}, lastSyncedItemsRef:{current:[]}, setSaveStatus:()=>{},setSaveProgress:()=>{},setError:()=>{} }); return null; }
 const item = { id:'safe-local',type:ItemType.NOTE,content:'persist me',status:'pending' as const,created_at:'2026-10-12',meta:{} };
 try {
  await h.render(<Host />); await act(async () => save.saveLocally({data:[item]}));
  assert.equal(publishes,1); const local = await readLocalState('unconnected'); assert.equal(local.data?.data[0].id,item.id); assert.ok(local.operations.length);
  closeLocalStore(); Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open:()=>{throw new Error('Storage blocked');}}});
  await act(async () => { await assert.rejects(save.saveLocally({data:[]}),/Storage blocked/); });
  assert.equal(publishes,1); assert.equal(data.data.length,1);
 } finally { await h.close(); }
});

test('remote item refresh preserves a restored dirty editor and tells the user about the change', async () => {
 const h = await environment(); const item = {id:'refresh-one',type:ItemType.NOTE,content:'original',status:'pending' as const,created_at:'2026-10-12',meta:{}};
 try {
  localStorage.setItem('arkaiv-editor:local:entity:refresh-one',JSON.stringify({editContent:'dirty draft'}));
  await h.render(<Card item={item} enableCollapse={false} defaultCollapsed={false} onUpdate={()=>{}} />);
  assert.equal(document.querySelector('textarea')?.value,'dirty draft');
  await h.render(<Card item={{...item,content:'remote revision'}} enableCollapse={false} defaultCollapsed={false} onUpdate={()=>{}} />);
  assert.equal(document.querySelector('textarea')?.value,'dirty draft'); assert.match(document.body.textContent || '',/Draft yang sedang kamu edit tetap dipertahankan/);
 } finally { await h.close(); }
});

test('nested dialogs keep the page locked, and Back asks the top dirty editor before any parent handler', async () => {
 const h = await environment(); let parentBack=0, childClose=0; const deregister=BackHandler.register(()=>{parentBack++;return true;});
 const view = (child:boolean) => <><PresencePanel isOpen onClose={()=>{}} overlayClassName="overlay" panelClassName="panel" ariaLabel="Parent"><button>Parent action</button></PresencePanel><PresencePanel isOpen={child} hasDraft presentation="form" onClose={()=>childClose++} overlayClassName="overlay" panelClassName="panel" ariaLabel="Child"><button>Child action</button></PresencePanel></>;
 try {
  await h.render(view(false)); await h.render(view(true));
  assert.equal(document.querySelector<HTMLElement>('[aria-label=Parent]')?.inert,true);
  await act(async()=>{assert.equal(BackHandler.handle(),true);}); assert.equal(parentBack,0); assert.equal(childClose,0); assert.ok(document.querySelector('[role=alertdialog]'));
  await h.render(view(false)); assert.equal(document.body.style.overflow,'hidden'); assert.equal(document.getElementById('root')?.inert,true); assert.equal(document.querySelector<HTMLElement>('[aria-label=Parent]')?.inert,false);
  await h.render(null); assert.equal(document.body.style.overflow,''); assert.equal(document.getElementById('root')?.inert,false);
 } finally { deregister(); await h.close(); }
});

test('ten thousand records mount only the visible page and grow one page per request', async () => {
 const h=await environment(); let page:ReturnType<typeof useLazyItems<number>>; const records=Array.from({length:10000},(_,i)=>i);
 function Host() { page=useLazyItems(records); return <ul>{page.visibleItems.map(item=><li key={item}>{item}</li>)}</ul>; }
 try { await h.render(<Host />); assert.equal(document.querySelectorAll('li').length,20); await act(async()=>page.loadMore()); assert.equal(document.querySelectorAll('li').length,40); } finally { await h.close(); }
});

test('an editor keeps its dirty content and does not close when the local save callback rejects', async () => {
 const h=await environment(); let closed=0; const item={id:'save-failure',type:ItemType.NOTE,content:'original',status:'pending' as const,created_at:'2026-10-12',meta:{}};
 try {
  localStorage.setItem('arkaiv-editor:local:entity:save-failure',JSON.stringify({editContent:'recover this draft'}));
  await h.render(<Card item={item} enableCollapse={false} defaultCollapsed={false} onUpdate={async()=>{throw new Error('Local storage is full');}} onSaveComplete={()=>closed++} />);
  await act(async()=>{ (Array.from(document.querySelectorAll('button')).find(button=>button.textContent?.includes('Simpan perubahan')) as HTMLButtonElement).click(); });
  assert.equal(closed,0); assert.equal(document.querySelector('textarea')?.value,'recover this draft'); assert.match(document.querySelector('[role=alert]')?.textContent || '',/Local storage is full/);
 } finally { await h.close(); }
});
