/* Runs without an open window. Browser support for Background Sync is best effort;
   once submit returns accepted, the Vercel consumer owns completion. */
async function flushDurableOutbox() {
  const request = value => new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
  const done = transaction => new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onabort = transaction.onerror = () => reject(transaction.error); });
  const opening = indexedDB.open('arkaiv-sync-v3');
  opening.onupgradeneeded = () => opening.transaction.abort();
  let db;
  try { db = await request(opening); } catch (error) { if (error?.name === 'AbortError') return; throw error; }
  try {
    if (!db.objectStoreNames.contains('outbox')) return;
    const operations = await request(db.transaction('outbox').objectStore('outbox').getAll());
    if (!operations.length) return;
    let csrf;
    const call = async (path, payload) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!csrf) {
          const session = await fetch('/api/spreadsheets/service-account/session', { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(25000) });
          if (!session.ok) throw new Error('Session unavailable');
          csrf = (await session.json()).csrfToken;
        }
        const response = await fetch(path, { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(25000),
          headers: { 'Content-Type': 'application/json', 'X-Arkaiv-Csrf': csrf }, body: JSON.stringify(payload) });
        if (response.status !== 401 || attempt === 1) return response;
        csrf = undefined;
      }
    };
    const update = async (scope, ids, state, error) => {
      const tx = db.transaction('outbox', 'readwrite'); const completed = done(tx); const store = tx.objectStore('outbox');
      for (const id of ids) { const op = await request(store.get(id)); if (op && op.scope === scope) { if (state === 'committed') store.delete(id); else store.put({ ...op, state, error }); } }
      await completed;
    };
    for (const scope of new Set(operations.map(op => op.scope).filter(scope => scope !== 'unconnected'))) {
      const capability = await call('/api/spreadsheets/sync/capabilities', { spreadsheetId: scope });
      if (capability.status === 404) continue;
      if (!capability.ok) throw new Error('Cannot determine sync mode');
      const capabilities = await capability.json();
      if (!capabilities.enabled) continue;
      const scoped = operations.filter(op => op.scope === scope);
      const settled = new Set();
      for (let start = 0; start < scoped.length; start += 200) {
        const response = await call('/api/spreadsheets/sync/status', { spreadsheetId: scope, operationIds: scoped.slice(start, start + 200).map(op => op.operationId) });
        if (!response.ok) throw new Error('Commit status unavailable');
        for (const receipt of (await response.json()).receipts) {
          await update(scope, [receipt.operationId], receipt.state, receipt.error); settled.add(receipt.operationId);
        }
      }
      if (!capabilities.ready) throw new Error('Durable sync awaits activation');
      const pending = scoped.filter(op => op.state !== 'conflict' && !settled.has(op.operationId));
      for (let start = 0; start < pending.length; start += 20) {
        // Claim in the same IDB transaction that reads payloads, preventing coalescing races.
        const tx = db.transaction('outbox', 'readwrite'); const completed = done(tx); const store = tx.objectStore('outbox'); const batch = [];
        for (const entry of pending.slice(start, start + 20)) {
          const op = await request(store.get(entry.operationId));
          if (op && op.state !== 'conflict') { const claimed = { ...op, state: 'sending', attempts: op.attempts + 1 }; store.put(claimed); batch.push(claimed); }
        }
        await completed;
        if (!batch.length) continue;
        const response = await call('/api/spreadsheets/sync/submit', { spreadsheetId: scope, operations: batch });
        const data = await response.json(); const accepted = data.accepted || [];
        await update(scope, accepted, 'accepted');
        const rejected = batch.filter(op => !accepted.includes(op.operationId)).map(op => op.operationId);
        await update(scope, rejected, 'sending', data.error);
        if (!response.ok) throw new Error(data.error || 'Submission failed');
      }
    }
  } finally { db.close(); }
}
