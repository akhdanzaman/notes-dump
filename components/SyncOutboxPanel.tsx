import React, { useEffect, useState } from 'react';
import { readLocalState, reconstructBaseline, resolveLocalConflicts, type LocalMutation } from '../services/localOutbox';
import { fetchSpreadsheetDb, getSpreadsheetConfig } from '../services/spreadsheetService';
import { replayDurableOutbox } from '../services/durableSync';
import { mergeMutation } from '../utils/syncProtocol';
import type { DbSchema } from '../types';
const labels: Record<string, string> = { content: 'Deskripsi', amount: 'Nominal', paymentMethod: 'Wallet', budgetCategory: 'Kategori', date: 'Tanggal', status: 'Status', tags: 'Tag', merchant: 'Merchant', title: 'Judul', name: 'Nama', initialBalance: 'Saldo awal', weeklyTargetMinutes: 'Target mingguan', enabled: 'Aktif' };
const describe = (value: any): string => value == null ? 'Kosong / dihapus' : typeof value === 'object' ? Array.isArray(value) ? `${value.length} item` : value.content || value.name || 'Detail item' : String(value);
export default function SyncOutboxPanel() {
  const [operations, setOperations] = useState<LocalMutation[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<DbSchema>(); const [remote, setRemote] = useState<DbSchema>();
  const [choices, setChoices] = useState<Record<string, Record<string, 'local' | 'remote'>>>({});
  useEffect(() => {
    let active = true;
    const load = () => { const scope = getSpreadsheetConfig()?.spreadsheetId; if (scope && typeof indexedDB !== 'undefined') void readLocalState(scope).then(state => { if (active) { setOperations(state.operations); setLocal(state.data); } }).catch(() => {}); };
    load(); const timer = setInterval(load, 2000); return () => { active = false; clearInterval(timer); };
  }, []);
  const conflicts = [...new Map(operations.filter(operation => operation.state === 'conflict').map(operation => [operation.entityId, operation])).values()];
  const conflictKey = conflicts.map(operation => operation.operationId).join(',');
  useEffect(() => { let active = true; if (conflictKey) void fetchSpreadsheetDb(true).then(result => { if (active) setRemote(result.data); }).catch(() => { if (active) setError('Data Sheets belum bisa dibaca; pilihan belum diterapkan.'); }); return () => { active = false; }; }, [conflictKey]);
  const base = local ? reconstructBaseline(local, operations) : undefined;
  const resolve = async (entityId: string) => {
    setBusy(true); setError('');
    try {
      const scope = getSpreadsheetConfig()!.spreadsheetId;
      const fresh = await fetchSpreadsheetDb(true);
      const entity = (db?: DbSchema) => operations.find(op => op.entityId === entityId)?.entityKind === 'item' ? db?.data.find(item => item.id === entityId) ?? null : (db as any)?.[entityId] ?? null;
      if (JSON.stringify(entity(fresh.data)) !== JSON.stringify(entity(remote)) || JSON.stringify(entity((await readLocalState(scope)).data)) !== JSON.stringify(entity(local))) {
        setRemote(fresh.data); setChoices(previous => ({ ...previous, [entityId]: {} }));
        throw new Error('Item berubah saat ditinjau. Periksa nilai terbaru dan pilih kembali.');
      }
      await resolveLocalConflicts(scope, fresh.data, false, entityId, choices[entityId]);
      const updated = await readLocalState(scope);
      setOperations(updated.operations); setLocal(updated.data); setRemote(fresh.data);
      setChoices(previous => { const next = { ...previous }; delete next[entityId]; return next; });
      window.dispatchEvent(new Event('arkaiv-sync-committed'));
      await replayDurableOutbox();
    } catch (error) { setError(error instanceof Error ? error.message : 'Review failed'); } finally { setBusy(false); }
  };
  if (!operations.length) return null;
  return <div className="rounded-xl border border-border p-4 space-y-3 text-sm">
    <p role="status">{conflicts.length ? `${conflicts.length} item perlu ditinjau; salinan lokal tetap aman.` : `${operations.length} perubahan menunggu sinkronisasi.`}</p>
    <button disabled={busy} onClick={() => { void replayDurableOutbox().catch(error => setError(String(error))); }} className="rounded-lg border border-border px-3 py-2">Coba kirim / periksa status</button>
    {conflicts.map(operation => {
      const value = (db?: DbSchema) => operation.entityKind === 'item' ? db?.data.find(item => item.id === operation.entityId) ?? null : (db as any)?.[operation.entityId] ?? null;
      const fields: { path: string; local: unknown; remote: unknown }[] = [];
      if (remote && base) mergeMutation(value(base), value(local), value(remote), 'entity', (localValue, remoteValue, path) => { fields.push({ path, local: localValue, remote: remoteValue }); return remoteValue; });
      const title = describe(value(local) || value(remote));
      const awaitingSameItem = operations.some(op => op.entityKind === operation.entityKind && op.entityId === operation.entityId && (op.state === 'sending' || op.state === 'accepted'));
      return <section key={operation.operationId} className="rounded-lg border border-border p-4 space-y-3">
        <h3 className="font-medium">{title}</h3>
        {!remote && <p>Memuat nilai Sheets…</p>}
        {fields.map(field => <fieldset key={field.path} className="space-y-2">
          <legend>{(() => { const id = field.path.match(/\[([^\]]+)\]/)?.[1]; const owner = id ? [...(local?.wallets || []), ...(local?.skills || []), ...(local?.budgetConfig?.rules || [])].find(entry => entry.id === id)?.name : ''; return `${owner ? owner + ' · ' : ''}${labels[field.path.split('.').at(-1)!] || 'Detail'}`; })()}</legend>
          {(['local', 'remote'] as const).map(source => <label key={source} className="flex items-start gap-3 rounded-lg bg-surface-soft p-3">
            <input type="radio" name={`${operation.operationId}:${field.path}`} checked={choices[operation.entityId]?.[field.path] === source} onChange={() => setChoices(previous => ({ ...previous, [operation.entityId]: { ...previous[operation.entityId], [field.path]: source } }))} />
            <span><span className="block text-xs text-muted">{source === 'local' ? 'Di perangkat ini' : 'Di Sheets'}</span>{local?.appSettings?.hideMoney && /amount|price|balance/i.test(field.path) ? 'Nominal disembunyikan' : describe(field[source])}</span>
          </label>)}
        </fieldset>)}
        {awaitingSameItem && <p role="status">Perubahan item ini masih dikirim. Pilihan dapat diterapkan setelah statusnya selesai.</p>}
        <button className="editor-primary disabled:opacity-50 disabled:cursor-not-allowed" disabled={busy || !remote || awaitingSameItem || fields.some(field => !choices[operation.entityId]?.[field.path])} onClick={() => { void resolve(operation.entityId); }}>{busy ? 'Menerapkan pilihan…' : 'Terapkan pilihan untuk item ini'}</button>
      </section>;
    })}
    {error && <p className="text-red-500">{error}</p>}
  </div>;
}
