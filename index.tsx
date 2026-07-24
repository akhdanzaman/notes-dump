import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import CallbackPage from './components/CallbackPage';
import { registerSW } from 'virtual:pwa-register';
import { registerBackgroundRuntime } from './utils/backgroundRuntime';

const STALE_ASSET_RELOAD_KEY = 'arkaiv-stale-asset-reload-attempted';

const isStaleAssetError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|dynamically imported module/i.test(message);
};

const recoverFromStaleAssets = async () => {
  if (sessionStorage.getItem(STALE_ASSET_RELOAD_KEY)) return;
  sessionStorage.setItem(STALE_ASSET_RELOAD_KEY, String(Date.now()));

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.update().catch(() => undefined)));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => /^workbox-|^precache-|^vite-pwa/i.test(key)).map(key => caches.delete(key)));
    }
  } catch (error) {
    console.warn('Failed to refresh stale PWA assets', error);
  } finally {
    window.location.reload();
  }
};

window.addEventListener('vite:preloadError', event => {
  event.preventDefault();
  recoverFromStaleAssets();
});

window.addEventListener('unhandledrejection', event => {
  if (isStaleAssetError(event.reason)) {
    event.preventDefault();
    recoverFromStaleAssets();
  }
});

window.addEventListener('error', event => {
  if (isStaleAssetError(event.error || event.message)) {
    event.preventDefault();
    recoverFromStaleAssets();
  }
});

// Register PWA service worker
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      registration?.update();
    }
  });
  registerBackgroundRuntime();
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

type RootErrorBoundaryState = { error?: Error };

class RootErrorBoundary extends React.Component<React.PropsWithChildren, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Arkaiv root render failed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-primary">
        <div className="w-full max-w-md rounded-[28px] border border-red-500/25 bg-surface p-6 shadow-2xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">!</div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-500">Arkaiv berhenti</p>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight">Aplikasi tidak dapat ditampilkan.</h1>
          <p className="mb-5 text-sm leading-relaxed text-muted">
            Biasanya ini terjadi karena cache PWA lama setelah pembaruan. Muat ulang untuk mengambil aset aplikasi terbaru.
          </p>
          <pre className="mb-5 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-red-500/15 bg-red-500/[0.06] p-3 text-xs text-red-500">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => recoverFromStaleAssets()}
            className="w-full rounded-xl bg-red-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-400"
          >
            Muat ulang aplikasi
          </button>
        </div>
      </div>
    );
  }
}

const RootComponent = () => {
  if (window.location.pathname === '/auth/callback') {
    return <CallbackPage />;
  }
  return <App />;
};

root.render(
  <React.StrictMode>
    <RootErrorBoundary>
      <RootComponent />
    </RootErrorBoundary>
  </React.StrictMode>
);
