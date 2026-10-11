import type { DbSchema } from '../types';
import { syncItemsToGoogleCalendar } from './googleCalendarService';
let pending: { db: DbSchema; onError: (error: unknown) => void } | undefined;
let running = false;
/** Calendar work is serialized/coalesced independently of canonical saves. */
export function scheduleCalendarSync(db: DbSchema, onError: (error: unknown) => void) {
  pending = { db: structuredClone(db), onError };
  if (running) return;
  running = true;
  void (async () => {
    try {
      while (pending) {
        const job = pending; pending = undefined;
        try { await syncItemsToGoogleCalendar(job.db.data, job.db.appSettings!); }
        catch (error) { job.onError(error); }
      }
    } finally { running = false; }
  })();
}
