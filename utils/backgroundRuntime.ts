import { flushPendingSpreadsheetSync } from '../services/spreadsheetService';

const BACKGROUND_SYNC_TAG = 'arkaiv-background-flush';
const PERIODIC_SYNC_TAG = 'arkaiv-background-runtime';
const PERIODIC_SYNC_INTERVAL_MS = 15 * 60 * 1000;

let registered = false;
let flushing = false;

const hasDocument = () => typeof document !== 'undefined';
const hasNavigator = () => typeof navigator !== 'undefined';

const getServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!hasNavigator() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.warn('Background runtime could not access the service worker registration', error);
    return null;
  }
};

const registerOneShotBackgroundSync = async () => {
  const registration = await getServiceWorkerRegistration();
  if (!registration || !('sync' in registration)) return;

  try {
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register(BACKGROUND_SYNC_TAG);
  } catch (error) {
    // Background Sync is best-effort and may be denied when battery/data-saver policies apply.
    console.warn('Background Sync registration skipped', error);
  }
};

const registerPeriodicBackgroundSync = async () => {
  const registration = await getServiceWorkerRegistration();
  if (!registration || !('periodicSync' in registration)) return;

  try {
    const status = await navigator.permissions?.query?.({ name: 'periodic-background-sync' as PermissionName });
    if (status && status.state === 'denied') return;

    await (registration as ServiceWorkerRegistration & {
      periodicSync: { register: (tag: string, options: { minInterval: number }) => Promise<void> }
    }).periodicSync.register(PERIODIC_SYNC_TAG, { minInterval: PERIODIC_SYNC_INTERVAL_MS });
  } catch (error) {
    // Not all browsers support this yet; the lifecycle flush below still protects pending writes.
    console.warn('Periodic Background Sync registration skipped', error);
  }
};

export const flushBackgroundRuntime = async () => {
  if (flushing) return null;
  flushing = true;
  try {
    return await flushPendingSpreadsheetSync();
  } finally {
    flushing = false;
  }
};

export const registerBackgroundRuntime = () => {
  if (registered || !hasNavigator() || !hasDocument()) return;
  registered = true;

  const flushAndAskWorkerToWakeLater = () => {
    void flushBackgroundRuntime().catch(error => {
      console.warn('Background runtime flush failed', error);
    });
    void registerOneShotBackgroundSync();
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAndAskWorkerToWakeLater();
  });
  window.addEventListener('pagehide', flushAndAskWorkerToWakeLater);
  document.addEventListener('freeze', flushAndAskWorkerToWakeLater);

  navigator.serviceWorker?.addEventListener?.('message', event => {
    const type = event.data?.type;
    if (type === 'ARKAIV_BACKGROUND_SYNC' || type === 'ARKAIV_PERIODIC_SYNC') {
      void flushBackgroundRuntime().catch(error => {
        console.warn('Service worker background flush failed', error);
      });
    }
  });

  void registerOneShotBackgroundSync();
  void registerPeriodicBackgroundSync();
};
