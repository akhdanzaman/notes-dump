import React, { useEffect, useState } from 'react';
import { readLocalState, resolveLocalConflicts, type LocalMutation } from '../services/localOutbox';
import { fetchSpreadsheetDb, getSpreadsheetConfig } from '../services/spreadsheetService';
import { replayDurableOutbox } from '../services/durableSync';
export default function SyncOutboxPanel() {
  const [operations, setOperations] = useState<LocalMutation[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => { const scope = getSpreadsheetConfig()?.spreadsheetId; if (scope && typeof indexedDB !== 'undefined') void readLocalState(scope).then(local => { if (active) setOperations(local.operations); }).catch(() => {}); };
    load(); const timer = setInterval(load, 2000); return () => { active = false; clearInterval(timer); };
  }, []);
  const conflicts = operations.filter(operation => operation.state === 'conflict');
  const resolve = async (preferLocal: boolean) => {
    setBusy(true); setError('');
    try {
      const scope = getSpreadsheetConfig()!.spreadsheetId;
      const remote = await fetchSpreadsheetDb(true);
      await resolveLocalConflicts(scope, remote.data, preferLocal);
      window.dispatchEvent(new Event('arkaiv-sync-committed'));
      await replayDurableOutbox();
    } catch (error) { setError(error instanceof Error ? error.message : 'Review failed'); } finally { setBusy(false); }
  };
  if (!operations.length) return null;
  return <div className="rounded-xl border border-border p-4 space-y-3 text-sm">
    <p>{operations.length} perubahan masih menunggu bukti tersimpan di Sheets.</p>
    <button disabled={busy} onClick={() => { void replayDurableOutbox().catch(error => setError(String(error))); }} className="rounded-lg border border-border px-3 py-2">Coba kirim / periksa status</button>
    {conflicts.map(operation => <details key={operation.operationId} className="rounded-lg bg-surface p-2">
      <summary>Konflik {operation.entityId}: {operation.error}</summary>
      <p className="mt-2">Perubahan lokal:</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({ before: operation.before, after: operation.after }, null, 2)}</pre>
    </details>)}
    {conflicts.length > 0 && <div className="space-y-2">
      <p>Pilihan berlaku untuk semua konflik di atas. Kolom yang tidak bertentangan tetap digabung. Tunggu operasi lain selesai sebelum memilih.</p>
      <button disabled={busy || conflicts.length !== operations.length} onClick={() => { void resolve(true); }} className="rounded-lg border border-border px-3 py-2">Gunakan nilai lokal saat konflik</button>
      <button disabled={busy || conflicts.length !== operations.length} onClick={() => { void resolve(false); }} className="ml-2 rounded-lg border border-border px-3 py-2">Gunakan nilai Sheets saat konflik</button>
    </div>}
    {error && <p className="text-red-500">{error}</p>}
  </div>;
}
