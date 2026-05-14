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
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-red-500/30 bg-zinc-900 p-6 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-300 mb-3">Arkaiv crashed</p>
          <h1 className="text-2xl font-black mb-3">The app could not render.</h1>
          <p className="text-sm text-zinc-300 mb-5">
            This is usually caused by a stale cached PWA bundle after an update. Reloading refreshes the app assets.
          </p>
          <pre className="mb-5 max-h-40 overflow-auto rounded-2xl bg-black/40 p-3 text-xs text-red-100 whitespace-pre-wrap">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => recoverFromStaleAssets()}
            className="w-full rounded-2xl bg-red-400 px-4 py-3 font-bold text-zinc-950 hover:bg-red-300"
          >
            Refresh app assets
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
